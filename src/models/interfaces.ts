export interface DatabaseConfig {
  id: string;
  name: string;
  provider: 'mysql';
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  sshConfig?: {
    host: string;
    port: number;
    username: string;
    privateKey?: string;
    passphrase?: string;
    localPort?: number; // ローカルポートの指定（省略時は自動割り当て）
    enabled: boolean; // SSH接続の有効/無効
  };
}

export interface AIConfig {
  model: 'claude-3-7-sonnet-latest' | 'claude-3-5-sonnet-latest' | 'vertex-claude-3-7-sonnet';
  apiKey: string;
  vertexProjectId?: string;
  vertexLocation?: string;
}

export interface Settings {
  language: 'en' | 'ja';
  databases: DatabaseConfig[];
  aiConfig: AIConfig;
}

export interface TableEntity {
  tableName: string;
  columns: {
    name: string;
    type: string;
    nullable: boolean;
    key?: string;
    default?: string;
  }[];
  indexes: {
    name: string;
    columns: string[];
    type: 'PRIMARY' | 'UNIQUE' | 'INDEX' | 'FULLTEXT';
    method?: 'BTREE' | 'HASH';
    comment?: string;
  }[];
  foreignKeys: {
    columnName: string;
    referencedTable: string;
    referencedColumn: string;
  }[];
}

export interface DatabaseSchema {
  tables: TableEntity[];
  relationships: {
    fromTable: string;
    fromColumn: string;
    toTable: string;
    toColumn: string;
    type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  }[];
}

export interface QueryGenerationRequest {
  prompt: string;
  databaseId: string;
  schema: DatabaseSchema;
}

export interface QueryGenerationResponse {
  sql: string;
  explanation: string;
}

export interface PromptHistoryItem {
  id: string;
  prompt: string;
  databaseId: string;
  databaseName: string;
  timestamp: number;
}
