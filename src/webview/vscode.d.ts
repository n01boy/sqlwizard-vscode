declare module 'vscode' {
    export interface WebviewApi<T> {
        postMessage(message: T): void;
        getState(): T | undefined;
        setState(state: T): void;
    }

    export interface Disposable {
        dispose(): void;
    }

    export interface Webview {
        onDidReceiveMessage(callback: (message: any) => void): Disposable;
        asWebviewUri(uri: Uri): Uri;
        html: string;
    }

    export interface WebviewPanel {
        webview: Webview;
        onDidDispose(callback: () => void): Disposable;
        dispose(): void;
        reveal(viewColumn?: ViewColumn): void;
    }

    export interface Uri {
        toString(): string;
    }

    export enum ViewColumn {
        One = 1
    }

    export interface Window {
        createWebviewPanel(
            viewType: string,
            title: string,
            viewColumn: ViewColumn,
            options: any
        ): WebviewPanel;
        showErrorMessage(message: string): void;
        showInformationMessage(message: string): void;
    }

    export interface Commands {
        executeCommand(command: string, ...args: any[]): Promise<any>;
    }

    export interface Env {
        clipboard: {
            writeText(text: string): Promise<void>;
        };
    }

    export const window: Window;
    export const commands: Commands;
    export const env: Env;
    export const Uri: {
        joinPath(base: Uri, ...pathSegments: string[]): Uri;
    };
}

declare module './vscode' {
    const vscode: {
        postMessage: (message: any) => void;
    };
    export { vscode };
}

declare function acquireVsCodeApi<T = unknown>(): import('vscode').WebviewApi<T>;