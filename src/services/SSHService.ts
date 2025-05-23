import { Client } from 'ssh2';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import { DatabaseConfig } from '../models/interfaces';

export interface SSHTunnel {
  client: Client;
  server: net.Server;
  localPort: number;
  close: () => Promise<void>;
}

export class SSHService {
  private static instance: SSHService;
  private activeTunnels: Map<string, SSHTunnel> = new Map();

  private constructor() {}

  static getInstance(): SSHService {
    if (!SSHService.instance) {
      SSHService.instance = new SSHService();
    }
    return SSHService.instance;
  }

  /**
   * SSHトンネルを作成し、ローカルポートを返す
   */
  async createTunnel(config: DatabaseConfig): Promise<number> {
    if (!config.sshConfig) {
      throw new Error('SSH設定が見つかりません');
    }

    // SSH設定が無効の場合はエラー
    if (!config.sshConfig.enabled) {
      throw new Error('SSH接続が無効になっています');
    }

    const tunnelKey = `${config.id}_ssh`;

    // 既存のトンネルがある場合は再利用
    const existingTunnel = this.activeTunnels.get(tunnelKey);
    if (existingTunnel) {
      console.log(`Reusing existing SSH tunnel on port ${existingTunnel.localPort}`);
      return existingTunnel.localPort;
    }

    return new Promise((resolve, reject) => {
      const client = new Client();
      // ローカルポートの決定：設定で指定されている場合はそれを使用、そうでなければ自動割り当て
      const localPort = config.sshConfig!.localPort || this.getAvailablePort();
      let server: net.Server;

      console.log(
        `Creating SSH tunnel: localhost:${localPort} -> ${config.host}:${config.port} via ${config.sshConfig!.host}`
      );

      client.on('ready', () => {
        console.log('SSH connection established');

        // ローカルサーバーを作成
        server = net.createServer((localSocket) => {
          console.log(`New connection to localhost:${localPort}`);

          // SSH経由でリモートホストに接続
          client.forwardOut(
            '127.0.0.1',
            localPort,
            config.host,
            config.port,
            (err: Error | undefined, remoteSocket: any) => {
              if (err) {
                console.error('SSH forward error:', err);
                localSocket.end();
                return;
              }

              console.log(`Forwarding connection to ${config.host}:${config.port}`);

              // データを双方向にパイプ
              localSocket.pipe(remoteSocket);
              remoteSocket.pipe(localSocket);

              localSocket.on('error', (err: Error) => {
                console.error('Local socket error:', err);
                remoteSocket.end();
              });

              remoteSocket.on('error', (err: Error) => {
                console.error('Remote socket error:', err);
                localSocket.end();
              });

              localSocket.on('close', () => {
                console.log('Local socket closed');
                remoteSocket.end();
              });

              remoteSocket.on('close', () => {
                console.log('Remote socket closed');
                localSocket.end();
              });
            }
          );
        });

        server.listen(localPort, '127.0.0.1', () => {
          console.log(`SSH tunnel listening on localhost:${localPort}`);

          const tunnel: SSHTunnel = {
            client,
            server,
            localPort,
            close: async () => {
              return new Promise((resolveClose) => {
                console.log(`Closing SSH tunnel on port ${localPort}`);
                server.close(() => {
                  client.end();
                  this.activeTunnels.delete(tunnelKey);
                  resolveClose();
                });
              });
            },
          };

          this.activeTunnels.set(tunnelKey, tunnel);
          resolve(localPort);
        });

        server.on('error', (err) => {
          console.error('Server error:', err);
          client.end();
          reject(new Error(`ローカルサーバーの作成に失敗しました: ${err.message}`));
        });
      });

      client.on('error', (err) => {
        console.error('SSH connection error:', err);
        console.error('SSH error details:', {
          message: err.message,
          stack: err.stack,
          name: err.name,
          code: (err as any).code,
          level: (err as any).level,
        });
        reject(new Error(`SSH接続に失敗しました: ${err.message}`));
      });

      // SSH接続設定
      const sshConfig = config.sshConfig!;
      const connectConfig: any = {
        host: sshConfig.host,
        port: sshConfig.port || 22,
        username: sshConfig.username,
      };

      console.log(
        `Connecting to SSH server: ${sshConfig.username}@${sshConfig.host}:${sshConfig.port || 22}`
      );

      // 認証方法の設定
      if (sshConfig.privateKey) {
        try {
          const privateKeyPath = this.resolveKeyPath(sshConfig.privateKey);
          console.log(`Using private key: ${privateKeyPath}`);
          connectConfig.privateKey = fs.readFileSync(privateKeyPath);

          if (sshConfig.passphrase) {
            console.log('Using passphrase for private key');
            connectConfig.passphrase = sshConfig.passphrase;
          }
        } catch (error) {
          console.error('Private key read error:', error);
          reject(new Error(`秘密鍵ファイルの読み込みに失敗しました: ${error}`));
          return;
        }
      } else {
        reject(new Error('秘密鍵による認証が必要です。パスワード認証はサポートされていません。'));
        return;
      }

      client.connect(connectConfig);
    });
  }

  /**
   * SSHトンネルを閉じる
   */
  async closeTunnel(databaseId: string): Promise<void> {
    const tunnelKey = `${databaseId}_ssh`;
    const tunnel = this.activeTunnels.get(tunnelKey);

    if (tunnel) {
      await tunnel.close();
    }
  }

  /**
   * 全てのSSHトンネルを閉じる
   */
  async closeAllTunnels(): Promise<void> {
    console.log(`Closing ${this.activeTunnels.size} SSH tunnels`);
    const closePromises = Array.from(this.activeTunnels.values()).map((tunnel) => tunnel.close());
    await Promise.all(closePromises);
    this.activeTunnels.clear();
  }

  /**
   * 利用可能なローカルポートを取得
   */
  private getAvailablePort(): number {
    // 簡易的な実装：3307から順番に試す
    const usedPorts = Array.from(this.activeTunnels.values()).map((t) => t.localPort);
    let port = 3307;

    while (usedPorts.includes(port)) {
      port++;
    }

    return port;
  }

  /**
   * 指定されたポートが利用可能かチェック
   */
  private isPortAvailable(port: number): boolean {
    const usedPorts = Array.from(this.activeTunnels.values()).map((t) => t.localPort);
    return !usedPorts.includes(port);
  }

  /**
   * SSH接続の状態を取得
   */
  getTunnelStatus(databaseId: string): { connected: boolean; localPort?: number } {
    const tunnelKey = `${databaseId}_ssh`;
    const tunnel = this.activeTunnels.get(tunnelKey);

    if (tunnel) {
      return { connected: true, localPort: tunnel.localPort };
    }

    return { connected: false };
  }

  /**
   * 秘密鍵ファイルのパスを解決
   */
  private resolveKeyPath(keyPath: string): string {
    // ホームディレクトリの展開
    if (keyPath.startsWith('~/')) {
      const homeDir = process.env.HOME || process.env.USERPROFILE;
      if (!homeDir) {
        throw new Error('ホームディレクトリが見つかりません');
      }
      return path.join(homeDir, keyPath.slice(2));
    }

    // 絶対パスの場合はそのまま
    if (path.isAbsolute(keyPath)) {
      return keyPath;
    }

    // 相対パスの場合は現在のディレクトリからの相対パス
    return path.resolve(keyPath);
  }

  /**
   * SSH接続をテスト
   */
  async testSSHConnection(sshConfig: DatabaseConfig['sshConfig']): Promise<void> {
    if (!sshConfig) {
      throw new Error('SSH設定が見つかりません');
    }

    console.log('Starting SSH connection test...');
    console.log('SSH Config:', {
      host: sshConfig.host,
      port: sshConfig.port || 22,
      username: sshConfig.username,
      hasPrivateKey: !!sshConfig.privateKey,
      hasPassphrase: !!sshConfig.passphrase,
      enabled: sshConfig.enabled,
    });

    return new Promise((resolve, reject) => {
      const client = new Client();

      client.on('ready', () => {
        console.log('SSH connection test successful');
        client.end();
        resolve();
      });

      client.on('error', (err) => {
        console.error('SSH connection test failed:', err);
        console.error('SSH test error details:', {
          message: err.message,
          stack: err.stack,
          name: err.name,
          code: (err as any).code,
          level: (err as any).level,
        });
        reject(new Error(`SSH接続テストに失敗しました: ${err.message}`));
      });

      const connectConfig: any = {
        host: sshConfig.host,
        port: sshConfig.port || 22,
        username: sshConfig.username,
      };

      console.log(
        `Testing SSH connection to: ${sshConfig.username}@${sshConfig.host}:${sshConfig.port || 22}`
      );

      if (sshConfig.privateKey) {
        try {
          const privateKeyPath = this.resolveKeyPath(sshConfig.privateKey);
          console.log(`Using private key for test: ${privateKeyPath}`);

          if (!fs.existsSync(privateKeyPath)) {
            throw new Error(`秘密鍵ファイルが見つかりません: ${privateKeyPath}`);
          }

          connectConfig.privateKey = fs.readFileSync(privateKeyPath);

          if (sshConfig.passphrase) {
            console.log('Using passphrase for private key test');
            connectConfig.passphrase = sshConfig.passphrase;
          }
        } catch (error) {
          console.error('Private key read error during test:', error);
          reject(new Error(`秘密鍵ファイルの読み込みに失敗しました: ${error}`));
          return;
        }
      } else {
        reject(new Error('秘密鍵による認証が必要です'));
        return;
      }

      console.log('Attempting SSH connection...');
      client.connect(connectConfig);
    });
  }
}
