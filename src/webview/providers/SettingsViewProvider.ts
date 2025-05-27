import * as vscode from 'vscode';
import { StorageService } from '../../services/StorageService';
import { I18nService } from '../../services/I18nService';
import { getSettingsViewHtml } from './SettingsViewTemplate';

export class SettingsViewProvider implements vscode.WebviewViewProvider {
  public webview?: vscode.WebviewView;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ) {
    this.webview = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
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
    webview.onDidReceiveMessage(async (message: any) => {
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
            const result = (await vscode.commands.executeCommand(
              'sqlwizard.saveDatabase',
              message.database
            )) as {
              success: boolean;
              message?: string;
              fieldErrors?: Record<string, string>;
            };

            if (result.success) {
              webview.postMessage({
                command: 'databaseSaved',
              });
            } else {
              webview.postMessage({
                command: 'showDatabaseError',
                message: result.message || i18n.t('messages.error.validation'),
                fieldErrors: result.fieldErrors || {},
              });
            }
          } catch (error) {
            let errorMessage = i18n.t('messages.error.validation');
            if (error instanceof Error) {
              errorMessage = error.message;
            }

            webview.postMessage({
              command: 'showDatabaseError',
              message: errorMessage,
            });
          }
          break;

        case 'deleteDatabase':
          await vscode.commands.executeCommand('sqlwizard.deleteDatabase', message.databaseId);
          break;

        case 'testDatabaseConnection':
          try {
            const result = (await vscode.commands.executeCommand(
              'sqlwizard.testDatabaseConnection',
              message.database
            )) as { success: boolean; error?: string };
            webview.postMessage({
              command: 'testConnectionResult',
              success: result.success,
              error: result.error,
            });
          } catch (error) {
            let errorMessage = i18n.t('messages.error.connection');
            if (error instanceof Error) {
              errorMessage = error.message;
            }

            webview.postMessage({
              command: 'testConnectionResult',
              success: false,
              error: errorMessage,
            });
          }
          break;

        case 'updateAIConfig':
          try {
            // VertexAI設定を含むAI設定を更新
            const aiConfigData: any = {
              model: message.model,
              apiKey: message.apiKey || '',
            };

            // VertexAI設定がある場合は追加
            if (message.vertexProjectId) {
              aiConfigData.vertexProjectId = message.vertexProjectId;
            }
            if (message.vertexLocation) {
              aiConfigData.vertexLocation = message.vertexLocation;
            }

            await vscode.commands.executeCommand('sqlwizard.updateAIConfig', aiConfigData);
            vscode.window.showInformationMessage(i18n.t('messages.success.saved'));
          } catch (error) {
            vscode.window.showErrorMessage(i18n.t('messages.error.validation'));
          }
          break;

        case 'testAIConfig':
          console.log('Received testAIConfig message:', message);
          try {
            const aiConfigData: any = {
              model: message.model,
              apiKey: message.apiKey || '',
            };

            // VertexAI設定がある場合は追加
            if (message.vertexProjectId) {
              aiConfigData.vertexProjectId = message.vertexProjectId;
            }
            if (message.vertexLocation) {
              aiConfigData.vertexLocation = message.vertexLocation;
            }

            console.log('Executing testAIConfig command with data:', aiConfigData);

            const result = (await vscode.commands.executeCommand(
              'sqlwizard.testAIConfig',
              aiConfigData
            )) as { success: boolean; error?: string };

            console.log('testAIConfig command result:', result);

            // VSCodeの通知でも結果を表示
            if (result.success) {
              vscode.window.showInformationMessage(
                i18n.getCurrentLanguage() === 'ja'
                  ? 'AI接続テストが成功しました'
                  : 'AI connection test successful'
              );
            } else {
              vscode.window.showErrorMessage(
                result.error ||
                  (i18n.getCurrentLanguage() === 'ja'
                    ? 'AI接続テストに失敗しました'
                    : 'AI connection test failed')
              );
            }

            webview.postMessage({
              command: 'testAIConfigResult',
              success: result.success,
              error: result.error,
            });
          } catch (error) {
            console.error('testAIConfig error:', error);
            let errorMessage = i18n.t('messages.error.apiConnection');
            if (error instanceof Error) {
              errorMessage = error.message;
            }

            // エラー時もVSCodeの通知を表示
            vscode.window.showErrorMessage(errorMessage);

            webview.postMessage({
              command: 'testAIConfigResult',
              success: false,
              error: errorMessage,
            });
          }
          break;

        case 'browsePrivateKey':
          try {
            const result = await vscode.window.showOpenDialog({
              canSelectFiles: true,
              canSelectFolders: false,
              canSelectMany: false,
              filters: {
                'All Files': ['*'],
              },
              openLabel: i18n.t('settings.database.ssh.browse'),
            });

            if (result && result[0]) {
              webview.postMessage({
                command: 'privateKeySelected',
                filePath: result[0].fsPath,
              });
            }
          } catch (error) {
            vscode.window.showErrorMessage(i18n.t('messages.error.unknown'));
          }
          break;

        case 'showError':
          vscode.window.showErrorMessage(message.message);
          break;
      }
    });
  }

  updateDatabases() {
    if (this.webview) {
      this.webview.webview.postMessage({
        command: 'updateDatabases',
        databases: StorageService.getInstance().getDatabases(),
      });
    }
  }

  updateLanguage(language: string) {
    if (this.webview) {
      this.webview.webview.postMessage({
        command: 'updateLanguage',
        language,
      });
    }
  }

  updateAIConfig() {
    if (this.webview) {
      const aiConfig = StorageService.getInstance().getAIConfig();
      this.webview.webview.postMessage({
        command: 'updateAIConfig',
        model: aiConfig.model,
        apiKey: aiConfig.apiKey || '',
        vertexProjectId: aiConfig.vertexProjectId || '',
        vertexLocation: aiConfig.vertexLocation || 'us-central1',
      });
    }
  }
}
