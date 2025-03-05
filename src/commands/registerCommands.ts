import * as vscode from 'vscode';
import { StorageService } from '../services/StorageService';
import { DatabaseService } from '../services/DatabaseService';
import { AIService } from '../services/AIService';
import { I18nService } from '../services/I18nService';
import { AIConfig, DatabaseConfig } from '../models/interfaces';
import { SettingsViewProvider } from '../webview/providers/SettingsViewProvider';
import { QueryViewProvider } from '../webview/providers/QueryViewProvider';

export function registerCommands(
    context: vscode.ExtensionContext,
    settingsViewProvider: SettingsViewProvider,
    queryViewProvider: QueryViewProvider
): vscode.Disposable[] {
    const i18nService = I18nService.getInstance();
    const storageService = StorageService.getInstance();

    // ストリーミングエディタの参照を保持
    let streamingEditor: vscode.TextEditor | undefined;
    let streamingDocument: vscode.TextDocument | undefined;

    const commands = [
        vscode.commands.registerCommand('sqlwizard.openSettings', () => {
            vscode.commands.executeCommand('workbench.view.extension.sqlwizard');
            setTimeout(() => {
                vscode.commands.executeCommand('sqlwizard.settingsView.focus');
            }, 300);
        }),

        // ストリーミングエディタを準備するコマンド
        vscode.commands.registerCommand('sqlwizard.prepareStreamingEditor', async () => {
            // 空のエディタを開く
            streamingDocument = await vscode.workspace.openTextDocument({
                content: '',
                language: 'sql'
            });
            streamingEditor = await vscode.window.showTextDocument(streamingDocument);
            return streamingEditor;
        }),

        // ストリーミングエディタにテキストを追加するコマンド
        vscode.commands.registerCommand('sqlwizard.appendToStreamingEditor', async (text: string) => {
            if (streamingEditor && streamingDocument) {
                await streamingEditor.edit(editBuilder => {
                    const lastLine = streamingDocument!.lineCount - 1;
                    const lastChar = streamingDocument!.lineAt(lastLine).text.length;
                    editBuilder.insert(new vscode.Position(lastLine, lastChar), text);
                });
            }
        }),

        vscode.commands.registerCommand('sqlwizard.openQuery', () => {
            vscode.commands.executeCommand('workbench.view.extension.sqlwizard');
            setTimeout(() => {
                vscode.commands.executeCommand('sqlwizard.queryView.focus');
            }, 300);
        }),

        vscode.commands.registerCommand('sqlwizard.changeLanguage', async (language: 'en' | 'ja') => {
            await i18nService.changeLanguage(language);
            // Notify webviews to update
            settingsViewProvider.updateLanguage(language);
            queryViewProvider.updateLanguage(language);
        }),

        vscode.commands.registerCommand('sqlwizard.saveDatabase', async (database: Partial<DatabaseConfig>) => {
            try {
                // バリデーション
                const fieldErrors: Record<string, string> = {};
                let hasError = false;
                
                if (!database.name) {
                    fieldErrors.name = i18nService.t('settings.database.nameRequired');
                    hasError = true;
                }
                
                if (!database.host) {
                    fieldErrors.host = i18nService.t('settings.database.hostRequired');
                    hasError = true;
                }
                
                if (!database.port) {
                    fieldErrors.port = i18nService.t('settings.database.portRequired');
                    hasError = true;
                } else if (isNaN(database.port)) {
                    fieldErrors.port = i18nService.t('settings.database.portInvalid');
                    hasError = true;
                }
                
                if (!database.user) {
                    fieldErrors.user = i18nService.t('settings.database.userRequired');
                    hasError = true;
                }
                
                if (!database.database) {
                    fieldErrors.database = i18nService.t('settings.database.databaseRequired');
                    hasError = true;
                }
                
                if (hasError) {
                    throw new ValidationError(i18nService.t('messages.error.validation'), fieldErrors);
                }
                
                if (database.id) {
                    // 既存のデータベースを更新
                    const existingDb = storageService.getDatabases().find(db => db.id === database.id);
                    if (!existingDb) {
                        throw new Error(i18nService.t('messages.error.validation'));
                    }
                    
                    const updatedDb: DatabaseConfig = {
                        ...existingDb,
                        ...database as any
                    };
                    
                    await storageService.updateDatabase(updatedDb);
                } else {
                    // 新しいデータベースを追加
                    const newDb: DatabaseConfig = {
                        id: Date.now().toString(),
                        name: database.name!,
                        provider: 'mysql',
                        host: database.host!,
                        port: database.port!,
                        user: database.user!,
                        password: database.password || '',
                        database: database.database!
                    };
                    
                    await storageService.addDatabase(newDb);
                }
                
                vscode.window.showInformationMessage(i18nService.t('messages.success.saved'));
                settingsViewProvider.updateDatabases();
                queryViewProvider.updateDatabases();
            } catch (error) {
                if (error instanceof ValidationError) {
                    throw error;
                } else if (error instanceof Error) {
                    throw new Error(error.message);
                } else {
                    throw new Error(i18nService.t('messages.error.validation'));
                }
            }
        }),

        vscode.commands.registerCommand('sqlwizard.deleteDatabase', async (databaseId: string) => {
            const answer = await vscode.window.showWarningMessage(
                i18nService.t('messages.confirm.deleteDatabase'),
                { modal: true },
                i18nService.t('messages.confirm.yes')
            );

            if (answer) {
                await storageService.removeDatabase(databaseId);
                settingsViewProvider.updateDatabases();
                queryViewProvider.updateDatabases();
            }
        }),

        vscode.commands.registerCommand('sqlwizard.updateAIConfig', async (config: { model: string; apiKey: string }) => {
            const aiConfig: AIConfig = {
                model: config.model as AIConfig['model'],
                apiKey: config.apiKey
            };
            await storageService.updateAIConfig(aiConfig);
            settingsViewProvider.updateAIConfig();
            vscode.window.showInformationMessage(i18nService.t('messages.success.saved'));
        }),

        vscode.commands.registerCommand('sqlwizard.generateSQL', async (params: { databaseId: string; prompt: string }) => {
            const dbService = DatabaseService.getInstance();
            const aiService = AIService.getInstance();

            try {
                const dbConfig = storageService.getDatabases().find(db => db.id === params.databaseId);
                if (!dbConfig) {
                    throw new Error(i18nService.t('messages.error.validation'));
                }

                await dbService.connect(dbConfig);
                const schema = await dbService.fetchSchema(params.databaseId);
                
                // プロンプト履歴に追加
                await storageService.addPromptHistory(params.prompt, params.databaseId);
                
                // プロンプト履歴を更新
                queryViewProvider.updatePromptHistory();
                
                const result = await aiService.generateSQL({
                    ...params,
                    schema
                });

                return result;
            } catch (error) {
                if (error instanceof Error) {
                    vscode.window.showErrorMessage(error.message);
                }
                throw error;
            }
        }),

        vscode.commands.registerCommand('sqlwizard.executeSQL', async (params: { databaseId: string; sql: string }) => {
            const dbService = DatabaseService.getInstance();

            try {
                const dbConfig = storageService.getDatabases().find(db => db.id === params.databaseId);
                if (!dbConfig) {
                    throw new Error(i18nService.t('messages.error.validation'));
                }

                await dbService.connect(dbConfig);
                // TODO: SQLの実行と結果の表示を実装
                await dbService.disconnect(params.databaseId);
                vscode.window.showInformationMessage(i18nService.t('messages.success.executed'));
            } catch (error) {
                if (error instanceof Error) {
                    vscode.window.showErrorMessage(error.message);
                }
                throw error;
            }
        }),

        vscode.commands.registerCommand('sqlwizard.openSQLInEditor', async (sql: string) => {
            try {
                // ストリーミングAPIを使用する場合は、このコマンドは単にSQLをエディタに開くだけ
                // ストリーミングはAIService.makeStreamingRequestで処理される
                const document = await vscode.workspace.openTextDocument({
                    content: sql,
                    language: 'sql'
                });
                await vscode.window.showTextDocument(document);
                vscode.window.showInformationMessage(i18nService.t('messages.success.openedInEditor'));
            } catch (error) {
                if (error instanceof Error) {
                    vscode.window.showErrorMessage(error.message);
                }
                throw error;
            }
        }),

        vscode.commands.registerCommand('sqlwizard.testDatabaseConnection', async (database: Partial<DatabaseConfig>) => {
            try {
                // バリデーション
                const fieldErrors: Record<string, string> = {};
                let hasError = false;
                
                if (!database.host) {
                    fieldErrors.host = i18nService.t('settings.database.hostRequired');
                    hasError = true;
                }
                
                if (!database.port) {
                    fieldErrors.port = i18nService.t('settings.database.portRequired');
                    hasError = true;
                } else if (isNaN(database.port)) {
                    fieldErrors.port = i18nService.t('settings.database.portInvalid');
                    hasError = true;
                }
                
                if (!database.user) {
                    fieldErrors.user = i18nService.t('settings.database.userRequired');
                    hasError = true;
                }
                
                if (!database.database) {
                    fieldErrors.database = i18nService.t('settings.database.databaseRequired');
                    hasError = true;
                }
                
                if (hasError) {
                    throw new ValidationError(i18nService.t('messages.error.validation'), fieldErrors);
                }
                
                // 一時的なデータベース設定を作成
                const tempDbConfig: DatabaseConfig = {
                    id: 'temp-' + Date.now().toString(),
                    name: 'Temporary Connection',
                    provider: 'mysql',
                    host: database.host!,
                    port: database.port!,
                    user: database.user!,
                    password: database.password || '',
                    database: database.database!
                };
                
                // データベースサービスを取得
                const dbService = DatabaseService.getInstance();
                
                // 接続テスト
                await dbService.connect(tempDbConfig);
                
                // 接続が成功したら切断
                await dbService.disconnect(tempDbConfig.id);
                
                // 成功メッセージを返す
                return { success: true };
            } catch (error) {
                if (error instanceof ValidationError) {
                    throw error;
                } else if (error instanceof Error) {
                    return {
                        success: false,
                        error: error.message
                    };
                } else {
                    return {
                        success: false,
                        error: i18nService.t('messages.error.connection')
                    };
                }
            }
        })
    ];

    return commands;
}

// バリデーションエラークラス
class ValidationError extends Error {
    fieldErrors: Record<string, string>;
    
    constructor(message: string, fieldErrors: Record<string, string>) {
        super(message);
        this.name = 'ValidationError';
        this.fieldErrors = fieldErrors;
    }
}
