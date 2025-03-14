import * as https from 'https';
import * as vscode from 'vscode';
import {
  DatabaseSchema,
  QueryGenerationRequest,
  QueryGenerationResponse,
} from '../models/interfaces';
import { StorageService } from './StorageService';
import { I18nService } from './I18nService';

export class AIService {
  private static instance: AIService;
  private apiKey: string;
  private baseUrl = 'https://api.anthropic.com/v1/messages';

  private constructor() {
    this.apiKey = StorageService.getInstance().getAIConfig().apiKey;
  }

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  async generateSQL(request: QueryGenerationRequest): Promise<QueryGenerationResponse> {
    const i18n = I18nService.getInstance();
    const model = StorageService.getInstance().getAIConfig().model;

    // リクエスト開始時間を記録
    const startTime = new Date();
    console.log(`AI Request started at: ${startTime.toISOString()}`);

    try {
      const systemPrompt = this.createSystemPrompt(request.schema);
      const userPrompt = this.createUserPrompt(request);

      // ストリーミングモードでリクエスト
      // 結果はエディタに直接表示され、SQLのみを返す
      await this.makeStreamingRequest({
        model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      // リクエスト終了時間を記録
      const endTime = new Date();
      const elapsedTime = (endTime.getTime() - startTime.getTime()) / 1000; // 秒単位
      console.log(`AI Request completed at: ${endTime.toISOString()}`);
      console.log(`AI Request took ${elapsedTime.toFixed(2)} seconds`);

      // ストリーミングの結果はエディタに表示されるため、
      // ここではダミーの結果を返す（UIの処理を完了させるため）
      return {
        sql: '-- SQL is displayed in the editor',
        explanation: `Query has been generated and displayed in the editor.\n\n[AI Response Time: ${elapsedTime.toFixed(2)} seconds]`,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        // エラーの種類に基づいて詳細なエラーメッセージを生成
        let errorMessage = `${i18n.t('messages.error.generation')}: ${error.message}`;

        // APIエラーの場合は詳細情報を追加
        if (error.message.includes('API')) {
          errorMessage += ` - ${i18n.t('messages.error.apiConnection')}`;
        }

        // パースエラーの場合は詳細情報を追加
        if (error.message.includes('parse') || error.message.includes('JSON')) {
          errorMessage += ` - ${i18n.t('messages.error.responseFormat')}`;
        }

        // タイムアウトエラーの場合は詳細情報を追加
        if (error.message.includes('timeout') || error.message.includes('time')) {
          errorMessage += ` - ${i18n.t('messages.error.timeout')}`;
        }

        console.error('SQL Generation Error:', error);
        throw new Error(errorMessage);
      }
      console.error('Unknown SQL Generation Error:', error);
      throw new Error(
        `${i18n.t('messages.error.generation')} - ${i18n.t('messages.error.unknown')}`
      );
    }
  }

  private makeRequest(data: any): Promise<any> {
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

  private makeStreamingRequest(data: any): Promise<string> {
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

  private createSystemPrompt(schema: DatabaseSchema): string {
    // 現在の言語設定を取得
    const currentLanguage = I18nService.getInstance().getCurrentLanguage();
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

  private createUserPrompt(request: QueryGenerationRequest): string {
    return `Generate a MySQL query for the following request:\n${request.prompt}`;
  }
}
