import * as mysql from 'mysql2/promise';
import { DatabaseConfig, DatabaseSchema, TableEntity } from '../models/interfaces';
import { SSHService } from './SSHService';

export class DatabaseService {
  private static instance: DatabaseService;
  private connections: Map<string, mysql.Connection>;
  private schemas: Map<string, DatabaseSchema>;

  private constructor() {
    this.connections = new Map();
    this.schemas = new Map();
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async connect(config: DatabaseConfig): Promise<void> {
    try {
      let host = config.host;
      let port = config.port;

      // SSHポートフォワーディングが設定されており、有効な場合
      if (config.sshConfig && config.sshConfig.enabled) {
        const sshService = SSHService.getInstance();
        const localPort = await sshService.createTunnel(config);
        host = '127.0.0.1';
        port = localPort;
      }

      const connection = await mysql.createConnection({
        host,
        port,
        user: config.user,
        password: config.password,
        database: config.database,
      });

      this.connections.set(config.id, connection);
    } catch (error: unknown) {
      console.error('Database connection error:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
        });

        // エラーメッセージをより分かりやすく変換
        let userFriendlyMessage = error.message;
        if (error.message.includes('ETIMEDOUT')) {
          userFriendlyMessage =
            'データベースサーバーへの接続がタイムアウトしました。ホスト名、ポート番号、ネットワーク接続を確認してください。';
        } else if (error.message.includes('ECONNREFUSED')) {
          userFriendlyMessage =
            'データベースサーバーへの接続が拒否されました。サーバーが起動しているか、ポート番号が正しいか確認してください。';
        } else if (error.message.includes('ENOTFOUND')) {
          userFriendlyMessage =
            'データベースサーバーが見つかりません。ホスト名を確認してください。';
        } else if (error.message.includes('Access denied')) {
          userFriendlyMessage =
            'データベースへのアクセスが拒否されました。ユーザー名、パスワード、データベース名を確認してください。';
        } else if (error.message.includes('Unknown database')) {
          userFriendlyMessage =
            '指定されたデータベースが存在しません。データベース名を確認してください。';
        } else if (error.message.includes('SSH接続が無効になっています')) {
          userFriendlyMessage = 'SSH接続が無効になっています。SSH設定を確認してください。';
        }

        throw new Error(userFriendlyMessage);
      }
      console.error('Unknown error type:', typeof error, error);
      throw new Error('データベース接続に失敗しました: 不明なエラー');
    }
  }

  async disconnect(databaseId: string): Promise<void> {
    const connection = this.connections.get(databaseId);
    if (connection) {
      await connection.end();
      this.connections.delete(databaseId);
      this.schemas.delete(databaseId);

      // SSHトンネルも閉じる
      const sshService = SSHService.getInstance();
      await sshService.closeTunnel(databaseId);
    }
  }

  /**
   * SSH接続の状態を取得
   */
  getSSHStatus(databaseId: string): { connected: boolean; localPort?: number } {
    const sshService = SSHService.getInstance();
    return sshService.getTunnelStatus(databaseId);
  }

  async fetchSchema(databaseId: string): Promise<DatabaseSchema> {
    const cachedSchema = this.schemas.get(databaseId);
    if (cachedSchema) {
      return cachedSchema;
    }

    const connection = this.connections.get(databaseId);
    if (!connection) {
      throw new Error(`No connection found for database ${databaseId}`);
    }

    try {
      const tables = await this.fetchTables(connection);
      const schema: DatabaseSchema = {
        tables,
        relationships: await this.extractRelationships(tables),
      };

      this.schemas.set(databaseId, schema);
      return schema;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch database schema: ${error.message}`);
      }
      throw new Error('Failed to fetch database schema: Unknown error');
    }
  }

  private async fetchTables(connection: mysql.Connection): Promise<TableEntity[]> {
    const tables: TableEntity[] = [];
    const [tableRows] = await connection.query('SHOW TABLES');

    for (const row of tableRows as any[]) {
      const tableName = row[Object.keys(row)[0]];
      const [columns] = await connection.query(`SHOW FULL COLUMNS FROM ${tableName}`);
      const [indexes] = await connection.query(`SHOW INDEX FROM ${tableName}`);
      const [foreignKeys] = await connection.query(
        `
                SELECT 
                    COLUMN_NAME,
                    REFERENCED_TABLE_NAME,
                    REFERENCED_COLUMN_NAME
                FROM information_schema.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = ?
                AND REFERENCED_TABLE_NAME IS NOT NULL
            `,
        [tableName]
      );

      tables.push({
        tableName,
        columns: (columns as any[]).map((col) => ({
          name: col.Field,
          type: col.Type,
          nullable: col.Null === 'YES',
          key: col.Key,
          default: col.Default,
        })),
        indexes: this.processIndexes(indexes as any[]),
        foreignKeys: (foreignKeys as any[]).map((fk) => ({
          columnName: fk.COLUMN_NAME,
          referencedTable: fk.REFERENCED_TABLE_NAME,
          referencedColumn: fk.REFERENCED_COLUMN_NAME,
        })),
      });
    }

    return tables;
  }

  private processIndexes(indexRows: any[]): TableEntity['indexes'] {
    const indexMap = new Map<string, TableEntity['indexes'][0]>();

    for (const row of indexRows) {
      const indexName = row.Key_name;
      if (!indexMap.has(indexName)) {
        // 基本的なインデックス情報
        const indexType =
          row.Key_name === 'PRIMARY'
            ? 'PRIMARY'
            : row.Non_unique === 0
              ? 'UNIQUE'
              : row.Index_type === 'FULLTEXT'
                ? 'FULLTEXT'
                : 'INDEX';

        // 追加情報をコメントに含める
        const additionalInfo = [
          `Cardinality: ${row.Cardinality || 'N/A'}`,
          `Null: ${row.Null === 'YES' ? 'Allowed' : 'Not Allowed'}`,
          `Collation: ${row.Collation || 'N/A'}`,
          `Sub_part: ${row.Sub_part || 'N/A'}`,
        ]
          .filter((info) => !info.endsWith('N/A'))
          .join(', ');

        // 既存のコメントと追加情報を結合
        const comment = row.Index_comment
          ? `${row.Index_comment}. ${additionalInfo}`
          : additionalInfo;

        indexMap.set(indexName, {
          name: indexName,
          columns: [],
          type: indexType,
          method: row.Index_type.toUpperCase() as 'BTREE' | 'HASH',
          comment: comment || undefined,
        });
      }
      indexMap.get(indexName)!.columns.push(row.Column_name);
    }

    return Array.from(indexMap.values());
  }

  private async extractRelationships(
    tables: TableEntity[]
  ): Promise<DatabaseSchema['relationships']> {
    const relationships: DatabaseSchema['relationships'] = [];

    for (const table of tables) {
      for (const fk of table.foreignKeys) {
        const referencedTable = tables.find((t) => t.tableName === fk.referencedTable);
        if (!referencedTable) continue;

        const fromColumn = table.columns.find((c) => c.name === fk.columnName);
        const toColumn = referencedTable.columns.find((c) => c.name === fk.referencedColumn);

        if (!fromColumn || !toColumn) continue;

        const type = this.determineRelationshipType(fromColumn, toColumn);
        relationships.push({
          fromTable: table.tableName,
          fromColumn: fk.columnName,
          toTable: fk.referencedTable,
          toColumn: fk.referencedColumn,
          type,
        });
      }
    }

    return relationships;
  }

  private determineRelationshipType(
    fromColumn: TableEntity['columns'][0],
    toColumn: TableEntity['columns'][0]
  ): DatabaseSchema['relationships'][0]['type'] {
    const isFromUnique = fromColumn.key === 'UNI' || fromColumn.key === 'PRI';
    const isToUnique = toColumn.key === 'UNI' || toColumn.key === 'PRI';

    if (isFromUnique && isToUnique) return 'one-to-one';
    if (isFromUnique && !isToUnique) return 'many-to-one';
    if (!isFromUnique && isToUnique) return 'one-to-many';
    return 'many-to-many';
  }
}
