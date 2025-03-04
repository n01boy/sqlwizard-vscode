import * as vscode from 'vscode';
import { StorageService } from '../../services/StorageService';
import { I18nService } from '../../services/I18nService';

export class QueryViewProvider implements vscode.WebviewViewProvider {
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

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        this.setWebviewMessageListener(webviewView.webview);
        
        // 初期データの送信
        this.updateDatabases();
        this.updatePromptHistory();
    }

    private getHtmlForWebview(webview: vscode.Webview) {
        const i18n = I18nService.getInstance();
        const commonStylesUri = this.getUri(webview, ['src', 'webview', 'styles', 'common.css']);
        const queryStylesUri = this.getUri(webview, ['src', 'webview', 'styles', 'query.css']);
        const scriptUri = this.getUri(webview, ['src', 'webview', 'query', 'queryScript.js']);

        return `
            <!DOCTYPE html>
            <html lang="${i18n.getCurrentLanguage()}">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link rel="stylesheet" href="${commonStylesUri}">
                <link rel="stylesheet" href="${queryStylesUri}">
                <title>${i18n.t('query.title')}</title>
            </head>
            <body>
                <div class="container">
                    <div class="section">
                        <div class="form-group">
                            <select id="database">
                                <option value="">${i18n.t('query.database')}</option>
                            </select>
                        </div>
                    </div>

                    <div class="section">
                        <div class="form-group">
                            <textarea
                                id="prompt"
                                placeholder="${i18n.t('query.prompt')}"
                                rows="5"
                            ></textarea>
                        </div>
                        <button id="generate" class="vscode-button">
                            ${i18n.t('query.generate')}
                        </button>
                        <div class="loading-container" id="loading-container">
                            <div class="loading-spinner"></div>
                            <div class="loading-text">${i18n.t('query.loading')}</div>
                        </div>
                    </div>

                    <!-- プロンプト履歴セクション -->
                    <div class="section prompt-history-section">
                        <h3>プロンプト履歴</h3>
                        <ul id="prompt-history" class="prompt-history-list">
                            <!-- 履歴はJavaScriptで動的に追加 -->
                        </ul>
                    </div>
                </div>

                <!-- 外部JavaScriptファイルを読み込む -->
                <script src="${scriptUri}"></script>
            </body>
            </html>
        `;
    }

    private getUri(webview: vscode.Webview, pathList: string[]) {
        return webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, ...pathList));
    }

    private setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
            async (message: any) => {
                const i18n = I18nService.getInstance();

                switch (message.command) {
                    case 'generateSQL':
                        try {
                            const result = await vscode.commands.executeCommand('sqlwizard.generateSQL', {
                                databaseId: message.databaseId,
                                prompt: message.prompt
                            });
                            webview.postMessage({
                                command: 'showResult',
                                result
                            });
                        } catch (error) {
                            vscode.window.showErrorMessage(i18n.t('messages.error.generation'));
                            
                            // エラー通知をWebviewに送信してローディングを非表示にする
                            webview.postMessage({
                                command: 'showError',
                                message: i18n.t('messages.error.generation')
                            });
                        }
                        break;

                    case 'copySQL':
                        try {
                            await vscode.env.clipboard.writeText(message.sql);
                            vscode.window.showInformationMessage(i18n.t('messages.success.copied'));
                        } catch (error) {
                            vscode.window.showErrorMessage(i18n.t('messages.error.copy'));
                        }
                        break;

                    case 'executeSQL':
                        try {
                            await vscode.commands.executeCommand('sqlwizard.executeSQL', {
                                databaseId: message.databaseId,
                                sql: message.sql
                            });
                        } catch (error) {
                            vscode.window.showErrorMessage(i18n.t('messages.error.execution'));
                        }
                        break;

                    case 'showError':
                        vscode.window.showErrorMessage(message.message);
                        break;
                        
                    case 'openSQLInEditor':
                        try {
                            await vscode.commands.executeCommand('sqlwizard.openSQLInEditor', message.sql);
                        } catch (error) {
                            vscode.window.showErrorMessage(i18n.t('messages.error.validation'));
                        }
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
            // クエリパネルは言語変更時に再読み込みが必要
            this.view.webview.html = this.getHtmlForWebview(this.view.webview);
            this.updateDatabases();
        }
    }

    // プロンプト履歴を更新
    updatePromptHistory() {
        if (this.view) {
            this.view.webview.postMessage({
                command: 'updatePromptHistory',
                history: StorageService.getInstance().getPromptHistory()
            });
        }
    }
}