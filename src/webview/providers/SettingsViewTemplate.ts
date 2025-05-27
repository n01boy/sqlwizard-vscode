import * as vscode from 'vscode';
import { I18nService } from '../../services/I18nService';
const isDev = process.env.NODE_ENV === 'local';
export function getSettingsViewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const i18n = I18nService.getInstance();
  const commonStylesUri = getUri(webview, extensionUri, [
    isDev ? 'src' : 'out',
    'webview',
    'styles',
    'common.css',
  ]);
  const settingsStylesUri = getUri(webview, extensionUri, [
    isDev ? 'src' : 'out',
    'webview',
    'styles',
    'settings.css',
  ]);

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
                            <option value="claude-4-0-latest">Claude 4.0 (Anthropic)</option>
                            <option value="vertex-gemini-2-0-flash">Gemini 2.0 Flash (Vertex AI)</option>
                        </select>
                    </div>
                    <div id="anthropic-config">
                        <div class="form-group">
                            <label for="api-key">${i18n.t('settings.ai.apiKey')}</label>
                            <input type="password" id="api-key">
                            <small class="field-hint" id="api-key-hint">${i18n.t('settings.ai.apiKeyHint')}</small>
                        </div>
                    </div>
                    <div id="vertex-config" style="display: none;">
                        <div class="form-group">
                            <label for="vertex-project-id">${i18n.t('settings.ai.vertexProjectId')}</label>
                            <input type="text" id="vertex-project-id">
                            <small class="field-hint">${i18n.t('settings.ai.vertexProjectIdHint')}</small>
                        </div>
                        <div class="form-group">
                            <label for="vertex-location">${i18n.t('settings.ai.vertexLocation')}</label>
                            <select id="vertex-location">
                                <option value="us-central1" selected>us-central1</option>
                            </select>
                            <small class="field-hint">${i18n.t('settings.ai.vertexLocationHint')}</small>
                        </div>
                    </div>
                    <div class="form-group">
                        <button id="save-ai-config" class="vscode-button">
                            ${i18n.t('settings.ai.save')}
                        </button>
                        <button id="test-ai-config" class="vscode-button">
                            ${i18n.t('settings.ai.test')}
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
                            <div class="form-row">
                                <label for="ssh-enabled">
                                    <input type="checkbox" id="ssh-enabled">
                                    ${i18n.t('settings.database.ssh.enabled')}
                                </label>
                            </div>
                            <div id="ssh-config" style="display: none;">
                                <div class="form-row">
                                    <label for="ssh-host">${i18n.t('settings.database.ssh.host')}</label>
                                    <input type="text" id="ssh-host" required>
                                    <div class="field-error" id="ssh-host-error"></div>
                                </div>
                                <div class="form-row">
                                    <label for="ssh-port">${i18n.t('settings.database.ssh.port')}</label>
                                    <input type="number" id="ssh-port" value="22" required>
                                    <div class="field-error" id="ssh-port-error"></div>
                                </div>
                                <div class="form-row">
                                    <label for="ssh-user">${i18n.t('settings.database.ssh.username')}</label>
                                    <input type="text" id="ssh-user" required>
                                    <div class="field-error" id="ssh-user-error"></div>
                                </div>
                                <div class="form-row">
                                    <label for="ssh-private-key">${i18n.t('settings.database.ssh.privateKey')}</label>
                                    <div class="file-input-group">
                                        <input type="text" id="ssh-private-key" readonly>
                                        <button id="browse-private-key" class="vscode-button" type="button">${i18n.t('settings.database.ssh.browse')}</button>
                                        <button id="clear-private-key" class="vscode-button secondary" type="button">${i18n.t('settings.database.ssh.clear')}</button>
                                    </div>
                                    <div class="field-error" id="ssh-private-key-error"></div>
                                </div>
                                <div class="form-row">
                                    <label for="ssh-passphrase">${i18n.t('settings.database.ssh.passphrase')}</label>
                                    <input type="password" id="ssh-passphrase">
                                    <small class="field-hint">${i18n.t('settings.database.ssh.passphraseHint')}</small>
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-actions">
                            <div class="error-message" id="connection-error-message" style="display: none;"></div>
                            <button id="test-connection" class="vscode-button">${i18n.t('settings.database.testConnection')}</button>
                            <div class="right-buttons">
                                <button id="cancel-db" class="vscode-button">${i18n.t('settings.database.cancel')}</button>
                                <button id="save-db" class="vscode-button">${i18n.t('settings.database.save')}</button>
                            </div>
                        </div>
                    </div>
            </div>

            <script src="${getUri(webview, extensionUri, [isDev ? 'src' : 'out', 'webview', 'settings', 'aiConfigHandler.js'])}"></script>
            <script src="${getUri(webview, extensionUri, [isDev ? 'src' : 'out', 'webview', 'settings', 'databaseHandler.js'])}"></script>
            <script src="${getUri(webview, extensionUri, [isDev ? 'src' : 'out', 'webview', 'settings', 'settingsScript.js'])}"></script>
        </body>
        </html>
    `;
}

function getUri(webview: vscode.Webview, extensionUri: vscode.Uri, pathList: string[]): vscode.Uri {
  return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, ...pathList));
}
