import * as https from 'https';
import * as vscode from 'vscode';
import { DatabaseSchema, QueryGenerationRequest } from '../models/interfaces';
import { I18nService } from './I18nService';

export class AnthropicService {
  private apiKey: string;
  private baseUrl = 'https://api.anthropic.com/v1/messages';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  makeRequest(data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        timeout: 60000, // 60秒のタイムアウト設定
      };

      const req = https.request(this.baseUrl, options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const parsedData = JSON.parse(responseData);
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsedData);
            } else {
              // APIエラーの詳細情報を取得
              const errorType = parsedData.error?.type || 'unknown_error';
              const errorMessage = parsedData.error?.message || 'API request failed';
              const statusCode = res.statusCode;

              // エラーログを出力
              console.error(`API Error (${statusCode}): ${errorType} - ${errorMessage}`);

              // エラーメッセージを構築
              let detailedError = `API Error (${statusCode}): ${errorMessage}`;

              // レート制限エラーの場合
              if (statusCode === 429 || errorType.includes('rate_limit')) {
                detailedError += ' - Rate limit exceeded. Please try again later.';
              }

              // 認証エラーの場合
              if (statusCode === 401 || errorType.includes('auth')) {
                detailedError += ' - Authentication failed. Please check your API key.';
              }

              reject(new Error(detailedError));
            }
          } catch (error) {
            console.error('Failed to parse API response:', error);
            reject(new Error('Failed to parse API response. The server returned an invalid JSON.'));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(JSON.stringify(data));
      req.end();
    });
  }

  makeStreamingRequest(data: any): Promise<string> {
    return new Promise((resolve, reject) => {
      // ストリーミングモードを有効にする
      const streamingData = {
        ...data,
        stream: true,
      };

      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        timeout: 60000, // 60秒のタイムアウト設定
      };

      const req = https.request(this.baseUrl, options, (res) => {
        let fullContent = '';
        let currentContent = '';
        let sqlContent = '';
        let inSqlBlock = false;
        let eventCount = 0;

        // エディタを開く処理を行う
        vscode.commands.executeCommand('sqlwizard.prepareStreamingEditor').then((editor) => {
          res.on('data', (chunk) => {
            const chunkStr = chunk.toString();
            const lines = chunkStr.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.substring(6));
                  if (data.type === 'content_block_delta') {
                    const deltaText = data.delta?.text || '';
                    fullContent += deltaText;

                    // ```sql や ``` を除外
                    const cleanedText = deltaText.replace(/```sql|```/g, '');

                    // SQLブロックの開始を検出（-- で始まるコメント）
                    if (cleanedText.includes('--') && !inSqlBlock) {
                      inSqlBlock = true;
                    }

                    // SQLブロック内の場合のみ追加
                    if (inSqlBlock && cleanedText.length > 0) {
                      currentContent += cleanedText;

                      // できるだけ早く表示するために、各チャンクごとに追加
                      vscode.commands.executeCommand(
                        'sqlwizard.appendToStreamingEditor',
                        cleanedText
                      );
                    }

                    eventCount++;
                  }
                } catch (e) {
                  // JSONパースエラーは無視
                }
              } else if (line.trim() === 'data: [DONE]') {
                // ストリーミング完了
                resolve(fullContent);
              }
            }
          });
        });

        res.on('end', () => {
          // ストリーミングが正常に終了しなかった場合
          if (fullContent.length === 0) {
            reject(new Error('No content received from API'));
          } else {
            resolve(fullContent);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(JSON.stringify(streamingData));
      req.end();
    });
  }

  createSystemPrompt(schema: DatabaseSchema): string {
    const tableDescriptions = schema.tables
      .map((table) => {
        const columns = table.columns
          .map(
            (col) =>
              `${col.name} ${col.type}${col.nullable ? ' NULL' : ' NOT NULL'}${col.key ? ` (${col.key})` : ''}`
          )
          .join('\n    ');

        const indexes = table.indexes
          .map((idx) => {
            return `${idx.type} INDEX ${idx.name} (${idx.columns.join(', ')})${idx.method ? ` USING ${idx.method}` : ''}${idx.comment ? ` - ${idx.comment}` : ''}`;
          })
          .join('\n    ');

        const foreignKeys = table.foreignKeys
          .map(
            (fk) =>
              `FOREIGN KEY ${fk.columnName} REFERENCES ${fk.referencedTable}(${fk.referencedColumn})`
          )
          .join('\n    ');

        return [
          `Table: ${table.tableName}`,
          `  Columns:\n    ${columns}`,
          `  Indexes:\n    ${indexes}`,
          `  Foreign Keys:\n    ${foreignKeys}`,
        ].join('\n');
      })
      .join('\n\n');

    const relationships = schema.relationships
      .map(
        (rel) =>
          `${rel.fromTable}.${rel.fromColumn} -> ${rel.toTable}.${rel.toColumn} (${rel.type})`
      )
      .join('\n');

    return [
      'You are a SQL expert. Generate MySQL queries based on the following database schema:',
      '',
      tableDescriptions,
      '',
      'Relationships:',
      relationships,
      '',
      'Generate SQL queries with the following structure:',
      '',
      '-- Summary',
      '-- Process Overview',
      '-- Index Usage',
      '-- Key Tables & Columns',
      '',
      '{SQL}',
      '',
      'The SQL should:',
      '- Use appropriate indexes',
      '- Follow MySQL best practices',
      '- Consider table relationships',
      '',
      'Do not add any additional explanations or notes beyond the specified structure. No supplementary explanations are needed.',
      'Do not use markdown code blocks (```sql or ```) in your response. Provide the SQL directly without any markdown formatting.',
      '',
      // 言語設定に応じた応答言語の指定
      I18nService.getInstance().t('messages.error.responseLanguage'),
    ].join('\n');
  }

  createUserPrompt(request: QueryGenerationRequest): string {
    return `Generate a MySQL query for the following request:\n${request.prompt}`;
  }
}
