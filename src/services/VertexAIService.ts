import * as vscode from 'vscode';
import { DatabaseSchema, QueryGenerationRequest } from '../models/interfaces';
import { I18nService } from './I18nService';

// VertexAI SDK のインポート
const { VertexAI } = require('@google-cloud/vertexai');

export class VertexAIService {
  async makeVertexAIRequest(params: {
    systemPrompt: string;
    userPrompt: string;
    projectId: string;
    location: string;
  }): Promise<string> {
    try {
      console.log(
        `Making VertexAI request to project: ${params.projectId}, location: ${params.location}`
      );

      // VertexAI クライアントの初期化
      const vertexAI = new VertexAI({
        project: params.projectId,
        location: params.location,
      });

      // Gemini Pro モデルを取得
      const model = vertexAI.getGenerativeModel({
        model: 'gemini-1.5-flash-001',
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
      let fullResponse = '';

      console.log('--- VertexAI ストリーミング開始 ---');

      // ストリームからデータチャンクを順次処理
      for await (const item of result.stream) {
        // 応答の構造からテキストコンテンツを抽出
        const chunkText = item.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (chunkText) {
          fullResponse += chunkText;

          // ```sql や ``` を除外
          const cleanedText = chunkText.replace(/```sql|```/g, '');

          // SQLブロックの開始を検出（-- で始まるコメント）
          if (
            cleanedText.includes('--') ||
            cleanedText.includes('SELECT') ||
            cleanedText.includes('INSERT') ||
            cleanedText.includes('UPDATE') ||
            cleanedText.includes('DELETE')
          ) {
            // できるだけ早く表示するために、各チャンクごとに追加
            await vscode.commands.executeCommand('sqlwizard.appendToStreamingEditor', cleanedText);
          }
        }
      }

      console.log('--- VertexAI ストリーミング終了 ---');
      console.log('最終的な完全な応答:\n', fullResponse);

      return fullResponse;
    } catch (error: unknown) {
      console.error('VertexAI request error:', error);
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
}
