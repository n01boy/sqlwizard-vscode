import * as vscode from 'vscode';
import { StorageService } from '../../services/StorageService';
import { I18nService } from '../../services/I18nService';
import { getSettingsViewHtml } from './SettingsViewTemplate';

export class SettingsViewProvider implements vscode.WebviewViewProvider {
    private view?: vscode.WebviewView;

    constructor(private readonly extensionUri: vscode.Uri) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ) {
        this.view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };

        webviewView.webview.html = getSettingsViewHtml(webviewView.webview, this.extensionUri);

        this.setWebviewMessageListener(webviewView.webview);
        
        // 初期データの送信
        this.updateDatabases();
        this.updateLanguage(StorageService.getInstance().getLanguage());
        this.updateAIConfig();
    }

    private getUri(webview: vscode.Webview, pathList: string[]) {
        return webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, ...pathList));
    }

    private setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
            async (message: any) => {
                const i18n = I18nService.getInstance();

                switch (message.command) {
                    case 'changeLanguage':
                        try {
                            await vscode.commands.executeCommand('sqlwizard.changeLanguage', message.language);
                        } catch (error) {
                            vscode.window.showErrorMessage(i18n.t('messages.error.validation'));
                        }
                        break;

                    case 'saveDatabase':
                        try {
                            await vscode.commands.executeCommand('sqlwizard.saveDatabase', message.database);
                            webview.postMessage({
                                command: 'databaseSaved'
                            });
                        } catch (error) {
                            let errorMessage = i18n.t('messages.error.validation');
                            if (error instanceof Error) {
                                errorMessage = error.message;
                            }
                            
                            webview.postMessage({
                                command: 'showDatabaseError',
                                message: errorMessage
                            });
                        }
                        break;

                    case 'deleteDatabase':
                        await vscode.commands.executeCommand('sqlwizard.deleteDatabase', message.databaseId);
                        break;

                    case 'updateAIConfig':
                        try {
                            await vscode.commands.executeCommand('sqlwizard.updateAIConfig', {
                                model: message.model,
                                apiKey: message.apiKey
                            });
                            vscode.window.showInformationMessage(i18n.t('messages.success.saved'));
                        } catch (error) {
                            vscode.window.showErrorMessage(i18n.t('messages.error.validation'));
                        }
                        break;

                    case 'showError':
                        vscode.window.showErrorMessage(message.message);
                        break;
                }
            }
        );
    }

    updateDatabases() {
        if (this.view) {
            this.view.webview.postMessage({
                command: 'updateDatabases',
                databases: StorageService.getInstance().getDatabases()
            });
        }
    }

    updateLanguage(language: string) {
        if (this.view) {
            this.view.webview.postMessage({
                command: 'updateLanguage',
                language
            });
        }
    }

    updateAIConfig() {
        if (this.view) {
            const aiConfig = StorageService.getInstance().getAIConfig();
            this.view.webview.postMessage({
                command: 'updateAIConfig',
                model: aiConfig.model,
                apiKey: aiConfig.apiKey
            });
        }
    }
}