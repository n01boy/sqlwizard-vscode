import * as vscode from 'vscode';
import { I18nService } from '../../services/I18nService';

export function getSettingsViewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    const i18n = I18nService.getInstance();
    const commonStylesUri = getUri(webview, extensionUri, ['src', 'webview', 'styles', 'common.css']);
    const settingsStylesUri = getUri(webview, extensionUri, ['src', 'webview', 'styles', 'settings.css']);

    return `
        <!DOCTYPE html>
        <html lang="${i18n.getCurrentLanguage()}">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link rel="stylesheet" href="${commonStylesUri}">
            <link rel="stylesheet" href="${settingsStylesUri}">
            <title>${i18n.t('settings.title')}</title>
        </head>
        <body>
            <div class="container">
                <div class="section">
                    <h2>${i18n.t('settings.language.label')}</h2>
                    <div class="form-group">
                        <select id="language" class="language-selector">
                            <option value="en">${i18n.t('settings.language.en')}</option>
                            <option value="ja">${i18n.t('settings.language.ja')}</option>
                        </select>
                    </div>
                </div>

                <div class="section ai-config">
                    <h2>${i18n.t('settings.ai.title')}</h2>
                    <div class="form-group">
                        <label for="ai-model">${i18n.t('settings.ai.model')}</label>
                        <select id="ai-model">
                            <option value="claude-3-7-sonnet-latest">claude-3-7-sonnet-latest</option>
                            <option value="claude-3-5-sonnet-latest">claude-3-5-sonnet-latest</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="api-key">${i18n.t('settings.ai.apiKey')}</label>
                        <input type="password" id="api-key">
                    </div>
                    <div class="form-group">
                        <button id="save-ai-config" class="vscode-button">
                            ${i18n.t('settings.ai.save')}
                        </button>
                    </div>
                </div>

                <div class="section">
                    <div class="section-header">
                        <h2>${i18n.t('settings.database.title')}</h2>
                        <button id="add-database" class="vscode-button">
                            ${i18n.t('settings.database.add')}
                        </button>
                    </div>
                    <div id="database-list"></div>
                </div>
            </div>

            <div id="database-form" class="page" style="display: none;">
                <div class="container">
                    <div class="page-header">
                        <h2 id="db-form-title">${i18n.t('settings.database.add')}</h2>
                        <button id="back-to-settings" class="vscode-button">${i18n.t('settings.database.back')}</button>
                    </div>

                    <div class="error-message" id="error-message" style="display: none;"></div>

                    <div class="form-container">
                            <div class="form-row">
                                <label for="db-name">${i18n.t('settings.database.name')}</label>
                                <input type="text" id="db-name" required>
                                <div class="field-error" id="name-error"></div>
                            </div>
                            <div class="form-row">
                                <label for="db-provider">${i18n.t('settings.database.provider')}</label>
                                <select id="db-provider">
                                    <option value="mysql">MySQL</option>
                                </select>
                            </div>
                            <div class="form-row">
                                <label for="db-host">${i18n.t('settings.database.host')}</label>
                                <input type="text" id="db-host" value="localhost" required>
                                <div class="field-error" id="host-error"></div>
                            </div>
                            <div class="form-row">
                                <label for="db-port">${i18n.t('settings.database.port')}</label>
                                <input type="number" id="db-port" value="3306" required>
                                <div class="field-error" id="port-error"></div>
                            </div>
                            <div class="form-row">
                                <label for="db-user">${i18n.t('settings.database.user')}</label>
                                <input type="text" id="db-user" value="root" required>
                                <div class="field-error" id="user-error"></div>
                            </div>
                            <div class="form-row">
                                <label for="db-password">${i18n.t('settings.database.password')}</label>
                                <input type="password" id="db-password">
                            </div>
                            <div class="form-row">
                                <label for="db-database">${i18n.t('settings.database.database')}</label>
                                <input type="text" id="db-database" required>
                                <div class="field-error" id="database-error"></div>
                            </div>
                        </div>
                        
                        <div class="form-actions">
                            <button id="test-connection" class="vscode-button">${i18n.t('settings.database.testConnection')}</button>
                            <div class="right-buttons">
                                <button id="cancel-db" class="vscode-button">${i18n.t('settings.database.cancel')}</button>
                                <button id="save-db" class="vscode-button">${i18n.t('settings.database.save')}</button>
                            </div>
                        </div>
                    </div>
            </div>

            <script src="${getUri(webview, extensionUri, ['src', 'webview', 'settings', 'settingsScript.js'])}"></script>
        </body>
        </html>
    `;
}

function getUri(webview: vscode.Webview, extensionUri: vscode.Uri, pathList: string[]): vscode.Uri {
    return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, ...pathList));
}