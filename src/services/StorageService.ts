import * as vscode from 'vscode';
import { Settings, DatabaseConfig, AIConfig } from '../models/interfaces';

export class StorageService {
    private static instance: StorageService;
    private context: vscode.ExtensionContext;
    private settings: Settings;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.settings = this.loadSettings();
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
                apiKey: ''
            }
        };

        const settings = this.context.globalState.get<Settings>('sqlwizard.settings');
        return settings || defaultSettings;
    }

    async saveSettings(): Promise<void> {
        await this.context.globalState.update('sqlwizard.settings', this.settings);
    }

    getLanguage(): string {
        return this.settings.language;
    }

    async setLanguage(language: 'en' | 'ja'): Promise<void> {
        this.settings.language = language;
        await this.saveSettings();
    }

    getDatabases(): DatabaseConfig[] {
        return this.settings.databases;
    }

    async addDatabase(config: DatabaseConfig): Promise<void> {
        this.settings.databases.push(config);
        await this.saveSettings();
    }

    async updateDatabase(config: DatabaseConfig): Promise<void> {
        const index = this.settings.databases.findIndex(db => db.id === config.id);
        if (index === -1) {
            throw new Error(`Database with id ${config.id} not found`);
        }
        this.settings.databases[index] = config;
        await this.saveSettings();
    }

    async removeDatabase(id: string): Promise<void> {
        this.settings.databases = this.settings.databases.filter(db => db.id !== id);
        await this.saveSettings();
    }

    getAIConfig(): AIConfig {
        return this.settings.aiConfig;
    }

    async updateAIConfig(config: AIConfig): Promise<void> {
        this.settings.aiConfig = config;
        await this.saveSettings();
    }
}