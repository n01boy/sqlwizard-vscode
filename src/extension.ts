import * as vscode from 'vscode';
import { StorageService } from './services/StorageService';
import { I18nService } from './services/I18nService';
import { SettingsViewProvider } from './webview/providers/SettingsViewProvider';
import { QueryViewProvider } from './webview/providers/QueryViewProvider';
import { registerCommands } from './commands/registerCommands';

export async function activate(context: vscode.ExtensionContext) {
    // Initialize services
    StorageService.initialize(context);
    I18nService.getInstance();
    
    // Register views
    const settingsViewProvider = new SettingsViewProvider(context.extensionUri);
    const queryViewProvider = new QueryViewProvider(context.extensionUri);
    
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('sqlwizard.settingsView', settingsViewProvider),
        vscode.window.registerWebviewViewProvider('sqlwizard.queryView', queryViewProvider)
    );
    
    // Register commands
    const commands = registerCommands(context, settingsViewProvider, queryViewProvider);
    context.subscriptions.push(...commands);
}

export function deactivate() {
    // Clean up resources
}
