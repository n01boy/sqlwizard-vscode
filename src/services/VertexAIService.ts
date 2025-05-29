import * as vscode from 'vscode';
import { DatabaseSchema, QueryGenerationRequest } from '../models/interfaces';
import { I18nService } from './I18nService';

// VertexAI SDK のインポート
const { VertexAI } = require('@google-cloud/vertexai');
// Anthropic Vertex SDK のインポート
import { AnthropicVertex } from '@anthropic-ai/vertex-sdk';

export class VertexAIService {
  // Claude Sonnetモデル用のリージョン定数
  private static readonly CLAUDE_REGION = 'us-east5';

  private getModelName(): string {
    const { StorageService } = require('./StorageService');
    const aiConfig = StorageService.getInstance().getAIConfig();
    const model = aiConfig.model;

    // モデル名をVertex AI用に変換
    if (model === 'vertex-gemini-2-0-flash') {
      return 'gemini-2.0-flash';
    } else if (model === 'vertex-gemini-2-5-pro') {
      return 'gemini-2.5-pro-preview-05-06';
    } else if (model === 'vertex-gemini-2-5-flash') {
      return 'gemini-2.5-flash-preview-05-20';
    } else if (model === 'vertex-claude-sonnet-4') {
      return 'claude-sonnet-4@20250514';
    } else if (model === 'vertex-claude-3-7-sonnet') {
      return 'claude-3-7-sonnet@20250219';
    }

    // デフォルトはGemini 2.0 Flash
    return 'gemini-2.0-flash';
  }

  private getLocation(modelName: string): string {
    // Claudeモデルの場合はus-east5、Geminiモデルの場合はus-central1
    if (this.isClaudeModel(modelName)) {
      return 'us-east5';
    }
    return 'us-central1';
  }

  private isClaudeModel(modelName: string): boolean {
    return modelName.includes('claude');
  }

  async makeClaudeVertexRequest(params: {
    systemPrompt: string;
    userPrompt: string;
    projectId: string;
    location: string;
  }): Promise<string> {
    let fullResponse = '';
    let textBuffer = '';
    let lastSendTime = Date.now();

    try {
      const modelName = this.getModelName();
      const location = this.getLocation(modelName);

      console.log(
        `Making Claude Vertex request to project: ${params.projectId}, location: ${location}, model: ${modelName}`
      );

      // AnthropicVertex クライアントの初期化
      const client = new AnthropicVertex({
        projectId: params.projectId,
        region: location,
      });

      // エディタを開く処理を行う
      await vscode.commands.executeCommand('sqlwizard.prepareStreamingEditor');

      // ストリーミング応答を生成
      const stream = await client.messages.create({
        model: modelName,
        max_tokens: 8192,
        temperature: 0.1,
        system: params.systemPrompt,
        messages: [
          {
            role: 'user',
            content: params.userPrompt,
          },
        ],
        stream: true,
      });

      console.log('--- Claude Vertex ストリーミング開始 ---');

      // タイムアウト設定（120秒に延長）
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('ストリーミングがタイムアウトしました')), 120000);
      });

      // ストリーミング処理とタイムアウトの競合
      await Promise.race([
        (async () => {
          try {
            for await (const chunk of stream) {
              console.log('Claude Vertex chunk:', JSON.stringify(chunk, null, 2));

              // 複数のチャンクタイプに対応
              let chunkText = '';

              if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
                chunkText = chunk.delta.text;
              } else if (
                chunk.type === 'content_block_start' &&
                chunk.content_block?.type === 'text'
              ) {
                chunkText = chunk.content_block.text || '';
              } else if (chunk.type === 'message_delta' && chunk.delta) {
                // メッセージデルタの場合 - 実際の構造に基づいて調整
                const delta = chunk.delta as any;
                if (delta.content) {
                  if (Array.isArray(delta.content)) {
                    chunkText = delta.content.map((c: any) => c.text || '').join('');
                  } else if (delta.content.text) {
                    chunkText = delta.content.text;
                  }
                }
              }

              if (chunkText) {
                console.log('Claude Vertex chunk text:', JSON.stringify(chunkText));
                fullResponse += chunkText;

                // ```sql や ``` を除外
                const cleanedText = chunkText.replace(/```sql|```/g, '');
                textBuffer += cleanedText;

                // バッファリング: 50文字以上溜まったか、500ms経過したらエディタに送信
                const currentTime = Date.now();
                const shouldSend = textBuffer.length >= 50 || currentTime - lastSendTime >= 500;

                if (shouldSend && textBuffer.trim()) {
                  console.log('Sending buffered text to editor:', JSON.stringify(textBuffer));
                  try {
                    await vscode.commands.executeCommand(
                      'sqlwizard.appendToStreamingEditor',
                      textBuffer
                    );
                    textBuffer = '';
                    lastSendTime = currentTime;
                  } catch (editorError) {
                    console.warn(
                      'エディタへの追記でエラーが発生しましたが、処理を続行します:',
                      editorError
                    );
                  }
                }
              } else {
                console.log('Claude Vertex: Skipping chunk type:', chunk.type);
              }
            }
          } catch (streamError) {
            console.error('ストリーミング処理中にエラーが発生:', streamError);
            throw streamError;
          }
        })(),
        timeoutPromise,
      ]);

      // ストリーミング終了後、残ったバッファの内容をエディタに送信
      if (textBuffer.trim()) {
        console.log('Sending final buffered text to editor:', JSON.stringify(textBuffer));
        try {
          await vscode.commands.executeCommand('sqlwizard.appendToStreamingEditor', textBuffer);
        } catch (editorError) {
          console.warn(
            'エディタへの最終追記でエラーが発生しましたが、処理を続行します:',
            editorError
          );
        }
      }

      console.log('--- Claude Vertex ストリーミング終了 ---');
      console.log('最終的な完全な応答:\n', fullResponse);

      if (!fullResponse.trim()) {
        throw new Error('Claude Vertexから有効な応答を受信できませんでした');
      }

      return fullResponse;
    } catch (error: unknown) {
      console.error('Claude Vertex request error:', error);

      // 部分的な応答がある場合はそれを返す
      if (fullResponse.trim()) {
        console.log('部分的な応答を返します:', fullResponse);
        return fullResponse;
      }

      if (error instanceof Error) {
        throw new Error(`Claude Vertex API request failed: ${error.message}`);
      }
      throw new Error('Claude Vertex API request failed: Unknown error');
    }
  }

  async makeVertexAIRequest(params: {
    systemPrompt: string;
    userPrompt: string;
    projectId: string;
    location: string;
  }): Promise<string> {
    const modelName = this.getModelName();

    // Claudeモデルの場合はAnthropicVertexを使用
    if (this.isClaudeModel(modelName)) {
      return this.makeClaudeVertexRequest(params);
    }

    let fullResponse = '';

    try {
      // モデルに応じたリージョンを決定
      const location = this.getLocation(modelName);

      console.log(
        `Making VertexAI request to project: ${params.projectId}, location: ${location}, model: ${modelName}`
      );

      // VertexAI クライアントの初期化
      const vertexAI = new VertexAI({
        project: params.projectId,
        location: location,
      });
      const model = vertexAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.1,
        },
      });

      // リクエストの作成
      const request = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${params.systemPrompt}\n\n${params.userPrompt}`,
              },
            ],
          },
        ],
      };

      console.log('VertexAI request:', JSON.stringify(request, null, 2));

      // エディタを開く処理を行う
      await vscode.commands.executeCommand('sqlwizard.prepareStreamingEditor');

      // ストリーミング応答を生成
      const result = await model.generateContentStream(request);

      console.log('--- VertexAI ストリーミング開始 ---');

      // タイムアウト設定（120秒に延長）
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('ストリーミングがタイムアウトしました')), 120000);
      });

      // ストリーミング処理とタイムアウトの競合
      await Promise.race([
        (async () => {
          try {
            // ストリームからデータチャンクを順次処理
            for await (const item of result.stream) {
              // 応答の構造からテキストコンテンツを抽出
              const chunkText = item.candidates?.[0]?.content?.parts?.[0]?.text || '';

              if (chunkText) {
                fullResponse += chunkText;

                // ```sql や ``` を除外
                const cleanedText = chunkText.replace(/```sql|```/g, '');

                // 全てのテキストをエディタに送信（フィルタリングを削除）
                if (cleanedText.trim()) {
                  try {
                    // できるだけ早く表示するために、各チャンクごとに追加
                    await vscode.commands.executeCommand(
                      'sqlwizard.appendToStreamingEditor',
                      cleanedText
                    );
                  } catch (editorError) {
                    console.warn(
                      'エディタへの追記でエラーが発生しましたが、処理を続行します:',
                      editorError
                    );
                  }
                }
              }
            }
          } catch (streamError) {
            console.error('ストリーミング処理中にエラーが発生:', streamError);
            throw streamError;
          }
        })(),
        timeoutPromise,
      ]);

      console.log('--- VertexAI ストリーミング終了 ---');
      console.log('最終的な完全な応答:\n', fullResponse);

      if (!fullResponse.trim()) {
        throw new Error('VertexAIから有効な応答を受信できませんでした');
      }

      return fullResponse;
    } catch (error: unknown) {
      console.error('VertexAI request error:', error);

      // 部分的な応答がある場合はそれを返す
      if (fullResponse.trim()) {
        console.log('部分的な応答を返します:', fullResponse);
        return fullResponse;
      }

      if (error instanceof Error) {
        throw new Error(`VertexAI API request failed: ${error.message}`);
      }
      throw new Error('VertexAI API request failed: Unknown error');
    }
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

  async testConnection(params: { projectId: string; location: string }): Promise<void> {
    const modelName = this.getModelName();
    const location = this.getLocation(modelName);

    // Claudeモデルの場合はAnthropicVertexでテスト
    if (this.isClaudeModel(modelName)) {
      try {
        console.log(
          `Testing Claude Vertex connection to project: ${params.projectId}, location: ${location}, model: ${modelName}`
        );

        const client = new AnthropicVertex({
          projectId: params.projectId,
          region: location,
        });

        const response = await client.messages.create({
          model: modelName,
          max_tokens: 100,
          messages: [
            {
              role: 'user',
              content:
                'Hello, this is a connection test. Please respond with "Connection successful".',
            },
          ],
        });

        if (!response.content || response.content.length === 0) {
          throw new Error('Claude Vertexからの応答がありません。');
        }

        console.log('Claude Vertex connection test successful');
        return;
      } catch (error: unknown) {
        console.error('Claude Vertex connection test error:', error);
        if (error instanceof Error) {
          throw new Error(`Claude Vertex接続テストに失敗しました: ${error.message}`);
        }
        throw new Error('Claude Vertex接続テストに失敗しました: 不明なエラー');
      }
    }

    try {
      console.log(
        `Testing VertexAI connection to project: ${params.projectId}, location: ${location}, model: ${modelName}`
      );

      // VertexAI クライアントの初期化
      const vertexAI = new VertexAI({
        project: params.projectId,
        location: location,
      });
      const model = vertexAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.1,
        },
      });

      // 簡単なテストリクエストを送信
      const testRequest = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: 'Hello, this is a connection test. Please respond with "Connection successful".',
              },
            ],
          },
        ],
      };

      const result = await model.generateContent(testRequest);
      const response = result.response;

      if (!response) {
        throw new Error('VertexAIからの応答がありません。');
      }

      console.log('VertexAI connection test successful');
    } catch (error: unknown) {
      console.error('VertexAI connection test error:', error);
      if (error instanceof Error) {
        throw new Error(`VertexAI接続テストに失敗しました: ${error.message}`);
      }
      throw new Error('VertexAI接続テストに失敗しました: 不明なエラー');
    }
  }
}
