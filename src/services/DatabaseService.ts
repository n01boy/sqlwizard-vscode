import * as mysql from 'mysql2/promise';
import { DatabaseConfig, DatabaseSchema, TableEntity } from '../models/interfaces';

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
            const connection = await mysql.createConnection({
                host: config.host,
                port: config.port,
                user: config.user,
                password: config.password,
                database: config.database
            });

            this.connections.set(config.id, connection);
        } catch (error: unknown) {
            if (error instanceof Error) {
                throw new Error(`Failed to connect to database: ${error.message}`);
            }
            throw new Error('Failed to connect to database: Unknown error');
        }
    }

    async disconnect(databaseId: string): Promise<void> {
        const connection = this.connections.get(databaseId);
        if (connection) {
            await connection.end();
            this.connections.delete(databaseId);
            this.schemas.delete(databaseId);
        }
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
                relationships: await this.extractRelationships(tables)
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
            const [foreignKeys] = await connection.query(`
                SELECT 
                    COLUMN_NAME,
                    REFERENCED_TABLE_NAME,
                    REFERENCED_COLUMN_NAME
                FROM information_schema.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = ?
                AND REFERENCED_TABLE_NAME IS NOT NULL
            `, [tableName]);

            tables.push({
                tableName,
                columns: (columns as any[]).map(col => ({
                    name: col.Field,
                    type: col.Type,
                    nullable: col.Null === 'YES',
                    key: col.Key,
                    default: col.Default
                })),
                indexes: this.processIndexes(indexes as any[]),
                foreignKeys: (foreignKeys as any[]).map(fk => ({
                    columnName: fk.COLUMN_NAME,
                    referencedTable: fk.REFERENCED_TABLE_NAME,
                    referencedColumn: fk.REFERENCED_COLUMN_NAME
                }))
            });
        }

        return tables;
    }

    private processIndexes(indexRows: any[]): TableEntity['indexes'] {
        const indexMap = new Map<string, TableEntity['indexes'][0]>();

        for (const row of indexRows) {
            const indexName = row.Key_name;
            if (!indexMap.has(indexName)) {
                indexMap.set(indexName, {
                    name: indexName,
                    columns: [],
                    type: row.Key_name === 'PRIMARY' ? 'PRIMARY' :
                          row.Non_unique === 0 ? 'UNIQUE' :
                          row.Index_type === 'FULLTEXT' ? 'FULLTEXT' : 'INDEX',
                    method: row.Index_type.toUpperCase() as 'BTREE' | 'HASH',
                    comment: row.Index_comment || undefined
                });
            }
            indexMap.get(indexName)!.columns.push(row.Column_name);
        }

        return Array.from(indexMap.values());
    }

    private async extractRelationships(tables: TableEntity[]): Promise<DatabaseSchema['relationships']> {
        const relationships: DatabaseSchema['relationships'] = [];

        for (const table of tables) {
            for (const fk of table.foreignKeys) {
                const referencedTable = tables.find(t => t.tableName === fk.referencedTable);
                if (!referencedTable) continue;

                const fromColumn = table.columns.find(c => c.name === fk.columnName);
                const toColumn = referencedTable.columns.find(c => c.name === fk.referencedColumn);

                if (!fromColumn || !toColumn) continue;

                const type = this.determineRelationshipType(fromColumn, toColumn);
                relationships.push({
                    fromTable: table.tableName,
                    fromColumn: fk.columnName,
                    toTable: fk.referencedTable,
                    toColumn: fk.referencedColumn,
                    type
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