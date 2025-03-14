import * as vscode from 'vscode';
import { DatabaseConfig, QueryGenerationResponse } from '../../models/interfaces';
import { I18nService } from '../../services/I18nService';
const isDev = process.env.NODE_ENV === 'local';
export class QueryPanel {
  private static currentPanel: QueryPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.html = this.getWebviewContent(extensionUri);
    this.setWebviewMessageListener(this.panel.webview);
  }

  static render(extensionUri: vscode.Uri) {
    if (QueryPanel.currentPanel) {
      QueryPanel.currentPanel.panel.reveal(vscode.ViewColumn.One);
    } else {
      const panel = vscode.window.createWebviewPanel(
        'sqlwizard.query',
        I18nService.getInstance().t('query.title'),
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [extensionUri],
        }
      );
      QueryPanel.currentPanel = new QueryPanel(panel, extensionUri);
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
    const queryStylesUri = this.getUri(extensionUri, [
      isDev ? 'src' : 'out',
      'webview',
      'styles',
      'query.css',
    ]);

    return `
            <!DOCTYPE html>
            <html lang="${i18n.getCurrentLanguage()}">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <script type="module" src="https://unpkg.com/@vscode/webview-ui-toolkit"></script>
                <link rel="stylesheet" href="${commonStylesUri}">
                <link rel="stylesheet" href="${queryStylesUri}">
                <title>${i18n.t('query.title')}</title>
            </head>
            <body>
                <div class="container">
                    <div class="section">
                        <div class="form-group">
                            <vscode-dropdown id="database">
                                <vscode-option value="">${i18n.t('query.database')}</vscode-option>
                            </vscode-dropdown>
                        </div>
                    </div>

                    <div class="section">
                        <div class="form-group">
                            <vscode-text-area
                                id="prompt"
                                placeholder="${i18n.t('query.prompt')}"
                                rows="5"
                            ></vscode-text-area>
                        </div>
                        <vscode-button id="generate">
                            ${i18n.t('query.generate')}
                        </vscode-button>
                    </div>

                    <div class="section result-section" id="result-section" style="display: none;">
                        <h3>SQL</h3>
                        <div class="sql-result" id="sql-result"></div>
                        <div class="button-group">
                            <vscode-button id="copy">
                                ${i18n.t('query.copy')}
                            </vscode-button>
                            <vscode-button id="execute">
                                ${i18n.t('query.execute')}
                            </vscode-button>
                        </div>
                        <h3>Explanation</h3>
                        <div class="explanation" id="explanation"></div>
                    </div>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();
                    let currentSQL = '';

                    // Database selector
                    const databaseDropdown = document.getElementById('database');
                    const promptTextarea = document.getElementById('prompt');
                    const generateButton = document.getElementById('generate');
                    const resultSection = document.getElementById('result-section');
                    const sqlResult = document.getElementById('sql-result');
                    const explanation = document.getElementById('explanation');
                    const copyButton = document.getElementById('copy');
                    const executeButton = document.getElementById('execute');

                    generateButton.addEventListener('click', () => {
                        if (!databaseDropdown.value) {
                            vscode.postMessage({
                                command: 'showError',
                                message: '${i18n.t('messages.error.validation')}'
                            });
                            return;
                        }

                        vscode.postMessage({
                            command: 'generateSQL',
                            databaseId: databaseDropdown.value,
                            prompt: promptTextarea.value
                        });
                    });

                    copyButton.addEventListener('click', () => {
                        vscode.postMessage({
                            command: 'copySQL',
                            sql: currentSQL
                        });
                    });

                    executeButton.addEventListener('click', () => {
                        vscode.postMessage({
                            command: 'executeSQL',
                            databaseId: databaseDropdown.value,
                            sql: currentSQL
                        });
                    });

                    window.addEventListener('message', (event) => {
                        const message = event.data;
                        switch (message.command) {
                            case 'updateDatabases':
                                databaseDropdown.innerHTML = \`
                                    <vscode-option value="">${i18n.t('query.database')}</vscode-option>
                                \`;
                                message.databases.forEach(db => {
                                    const option = document.createElement('vscode-option');
                                    option.value = db.id;
                                    option.textContent = db.name;
                                    databaseDropdown.appendChild(option);
                                });
                                break;

                            case 'showResult':
                                currentSQL = message.result.sql;
                                sqlResult.textContent = message.result.sql;
                                explanation.textContent = message.result.explanation;
                                resultSection.style.display = 'block';
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
          case 'generateSQL':
            try {
              const result = await vscode.commands.executeCommand('sqlwizard.generateSQL', {
                databaseId: message.databaseId,
                prompt: message.prompt,
              });
              webview.postMessage({
                command: 'showResult',
                result,
              });
            } catch (error) {
              vscode.window.showErrorMessage(i18n.t('messages.error.generation'));
            }
            break;

          case 'copySQL':
            await vscode.env.clipboard.writeText(message.sql);
            vscode.window.showInformationMessage(i18n.t('messages.success.copied'));
            break;

          case 'executeSQL':
            try {
              await vscode.commands.executeCommand('sqlwizard.executeSQL', {
                databaseId: message.databaseId,
                sql: message.sql,
              });
            } catch (error) {
              vscode.window.showErrorMessage(i18n.t('messages.error.execution'));
            }
            break;

          case 'showError':
            vscode.window.showErrorMessage(message.message);
            break;
        }
      },
      undefined,
      this.disposables
    );
  }

  private dispose() {
    QueryPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
