import * as vscode from 'vscode';
import { DatabaseConfig, AIConfig } from '../../models/interfaces';
import { I18nService } from '../../services/I18nService';
const isDev = process.env.NODE_ENV === 'local';
export class SettingsPanel {
  private static currentPanel: SettingsPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.html = this.getWebviewContent(extensionUri);
    this.setWebviewMessageListener(this.panel.webview);
  }

  static render(extensionUri: vscode.Uri) {
    if (SettingsPanel.currentPanel) {
      SettingsPanel.currentPanel.panel.reveal(vscode.ViewColumn.One);
    } else {
      const panel = vscode.window.createWebviewPanel(
        'sqlwizard.settings',
        I18nService.getInstance().t('settings.title'),
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [extensionUri],
        }
      );
      SettingsPanel.currentPanel = new SettingsPanel(panel, extensionUri);
    }
  }

  private getWebviewContent(extensionUri: vscode.Uri): string {
    const i18n = I18nService.getInstance();
    const commonStylesUri = this.getUri(extensionUri, [
      isDev ? 'src' : 'out',
      'webview',
      'styles',
      'common.css',
    ]);
    const settingsStylesUri = this.getUri(extensionUri, [
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
                <script type="module" src="https://unpkg.com/@vscode/webview-ui-toolkit"></script>
                <link rel="stylesheet" href="${commonStylesUri}">
                <link rel="stylesheet" href="${settingsStylesUri}">
                <title>${i18n.t('settings.title')}</title>
            </head>
            <body>
                <div class="container">
                    <div class="section">
                        <h2>${i18n.t('settings.language.label')}</h2>
                        <div class="form-group">
                            <vscode-dropdown id="language" class="language-selector">
                                <vscode-option value="en">${i18n.t('settings.language.en')}</vscode-option>
                                <vscode-option value="ja">${i18n.t('settings.language.ja')}</vscode-option>
                            </vscode-dropdown>
                        </div>
                    </div>

                    <div class="section">
                        <h2>${i18n.t('settings.database.title')}</h2>
                        <div id="database-list"></div>
                        <vscode-button id="add-database">
                            ${i18n.t('settings.database.add')}
                        </vscode-button>
                    </div>

                    <div class="section ai-config">
                        <h2>${i18n.t('settings.ai.title')}</h2>
                        <div class="form-group">
                            <vscode-dropdown id="ai-model">
                                <vscode-option value="claude-3-7-sonnet-latest">Claude 3 Sonnet</vscode-option>
                                <vscode-option value="claude-3-5-sonnet-latest">Claude 3.5 Sonnet</vscode-option>
                            </vscode-dropdown>
                        </div>
                        <div class="form-group">
                            <vscode-text-field type="password" id="api-key" placeholder="${i18n.t('settings.ai.apiKey')}">
                            </vscode-text-field>
                        </div>
                    </div>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();

                    // Language settings
                    const languageDropdown = document.getElementById('language');
                    languageDropdown.addEventListener('change', (e) => {
                        vscode.postMessage({
                            command: 'changeLanguage',
                            language: e.target.value
                        });
                    });

                    // Database settings
                    const databaseList = document.getElementById('database-list');
                    const addDatabaseButton = document.getElementById('add-database');

                    function createDatabaseElement(database) {
                        const div = document.createElement('div');
                        div.className = 'database-item';
                        div.innerHTML = \`
                            <div class="form-group">
                                <vscode-text-field value="\${database.name}" readonly>
                                </vscode-text-field>
                                <vscode-button appearance="secondary" data-id="\${database.id}" class="edit-database">
                                    ${i18n.t('settings.database.edit')}
                                </vscode-button>
                                <vscode-button appearance="secondary" data-id="\${database.id}" class="delete-database">
                                    ${i18n.t('settings.database.delete')}
                                </vscode-button>
                            </div>
                        \`;
                        return div;
                    }

                    addDatabaseButton.addEventListener('click', () => {
                        vscode.postMessage({
                            command: 'addDatabase'
                        });
                    });

                    databaseList.addEventListener('click', (e) => {
                        const target = e.target;
                        if (target.classList.contains('edit-database')) {
                            vscode.postMessage({
                                command: 'editDatabase',
                                databaseId: target.dataset.id
                            });
                        } else if (target.classList.contains('delete-database')) {
                            vscode.postMessage({
                                command: 'deleteDatabase',
                                databaseId: target.dataset.id
                            });
                        }
                    });

                    // AI settings
                    const aiModelDropdown = document.getElementById('ai-model');
                    const apiKeyInput = document.getElementById('api-key');

                    aiModelDropdown.addEventListener('change', (e) => {
                        vscode.postMessage({
                            command: 'updateAIConfig',
                            model: e.target.value,
                            apiKey: apiKeyInput.value
                        });
                    });

                    apiKeyInput.addEventListener('change', (e) => {
                        vscode.postMessage({
                            command: 'updateAIConfig',
                            model: aiModelDropdown.value,
                            apiKey: e.target.value
                        });
                    });

                    // Handle messages from extension
                    window.addEventListener('message', (event) => {
                        const message = event.data;
                        switch (message.command) {
                            case 'updateDatabases':
                                databaseList.innerHTML = '';
                                message.databases.forEach(db => {
                                    databaseList.appendChild(createDatabaseElement(db));
                                });
                                break;
                            case 'updateLanguage':
                                languageDropdown.value = message.language;
                                break;
                            case 'updateAIConfig':
                                aiModelDropdown.value = message.model;
                                apiKeyInput.value = message.apiKey;
                                break;
                        }
                    });
                </script>
            </body>
            </html>
        `;
  }

  private getUri(extensionUri: vscode.Uri, pathList: string[]) {
    return this.panel.webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, ...pathList));
  }

  private setWebviewMessageListener(webview: vscode.Webview) {
    webview.onDidReceiveMessage(
      async (message: any) => {
        const i18n = I18nService.getInstance();

        switch (message.command) {
          case 'changeLanguage':
            try {
              await vscode.commands.executeCommand('sqlwizard.changeLanguage', message.language);
              vscode.window.showInformationMessage(i18n.t('messages.success.saved'));
            } catch (error) {
              vscode.window.showErrorMessage(i18n.t('messages.error.validation'));
            }
            break;

          case 'addDatabase':
          case 'editDatabase':
          case 'deleteDatabase':
            await vscode.commands.executeCommand(
              `sqlwizard.${message.command}`,
              message.databaseId
            );
            break;

          case 'updateAIConfig':
            try {
              await vscode.commands.executeCommand('sqlwizard.updateAIConfig', {
                model: message.model,
                apiKey: message.apiKey,
              });
              vscode.window.showInformationMessage(i18n.t('messages.success.saved'));
            } catch (error) {
              vscode.window.showErrorMessage(i18n.t('messages.error.validation'));
            }
            break;
        }
      },
      undefined,
      this.disposables
    );
  }

  private dispose() {
    SettingsPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
