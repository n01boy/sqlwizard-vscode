import * as vscode from 'vscode';
import { Settings, DatabaseConfig, AIConfig, PromptHistoryItem } from '../models/interfaces';

export class StorageService {
  private static instance: StorageService;
  private context: vscode.ExtensionContext;
  private settings: Settings;
  private promptHistory: PromptHistoryItem[] = [];
  private readonly MAX_HISTORY_ITEMS = 10;

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.settings = this.loadSettings();
    this.promptHistory = this.loadPromptHistory();
  }

  static initialize(context: vscode.ExtensionContext): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService(context);
    }
    return StorageService.instance;
  }

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      throw new Error('StorageService not initialized');
    }
    return StorageService.instance;
  }

  private loadSettings(): Settings {
    const defaultSettings: Settings = {
      language: 'en',
      databases: [],
      aiConfig: {
        model: 'claude-3-7-sonnet-latest',
        apiKey: '',
      },
    };

    const settings = this.context.globalState.get<Settings>('sqlwizard.settings');
    return settings || defaultSettings;
  }

  private loadPromptHistory(): PromptHistoryItem[] {
    const history = this.context.globalState.get<PromptHistoryItem[]>('sqlwizard.promptHistory');
    return history || [];
  }

  async saveSettings(): Promise<void> {
    await this.context.globalState.update('sqlwizard.settings', this.settings);
  }

  async savePromptHistory(): Promise<void> {
    await this.context.globalState.update('sqlwizard.promptHistory', this.promptHistory);
  }

  getLanguage(): string {
    return this.settings.language;
  }

  async setLanguage(language: 'en' | 'ja'): Promise<void> {
    this.settings.language = language;
    await this.saveSettings();
  }

  getDatabases(): DatabaseConfig[] {
    // 既存のデータベース設定にデフォルト値を適用
    return this.settings.databases.map((db) => ({
      ...db,
      provider: db.provider || 'mysql',
      host: db.host || 'localhost',
      port: db.port || 3306,
      user: db.user || 'root',
      password: db.password || '',
      database: db.database || '',
      sshConfig: db.sshConfig || undefined,
    }));
  }

  async addDatabase(config: DatabaseConfig): Promise<void> {
    this.settings.databases.push(config);
    await this.saveSettings();
  }

  async updateDatabase(config: DatabaseConfig): Promise<void> {
    const index = this.settings.databases.findIndex((db) => db.id === config.id);
    if (index === -1) {
      throw new Error(`Database with id ${config.id} not found`);
    }
    this.settings.databases[index] = config;
    await this.saveSettings();
  }

  async removeDatabase(id: string): Promise<void> {
    this.settings.databases = this.settings.databases.filter((db) => db.id !== id);
    await this.saveSettings();
  }

  getAIConfig(): AIConfig {
    return this.settings.aiConfig;
  }

  async updateAIConfig(config: AIConfig): Promise<void> {
    this.settings.aiConfig = config;
    await this.saveSettings();
  }

  // プロンプト履歴の取得
  getPromptHistory(): PromptHistoryItem[] {
    return this.promptHistory;
  }

  // プロンプト履歴の追加
  async addPromptHistory(prompt: string, databaseId: string): Promise<void> {
    // データベース名を取得
    const database = this.settings.databases.find((db) => db.id === databaseId);
    if (!database) {
      return;
    }

    const historyItem: PromptHistoryItem = {
      id: Date.now().toString(),
      prompt,
      databaseId,
      databaseName: database.name,
      timestamp: Date.now(),
    };

    // 先頭に追加
    this.promptHistory.unshift(historyItem);

    // 最大数を超えた場合は古いものを削除
    if (this.promptHistory.length > this.MAX_HISTORY_ITEMS) {
      this.promptHistory = this.promptHistory.slice(0, this.MAX_HISTORY_ITEMS);
    }

    await this.savePromptHistory();
  }

  // プロンプト履歴のクリア
  async clearPromptHistory(): Promise<void> {
    this.promptHistory = [];
    await this.savePromptHistory();
  }
}
