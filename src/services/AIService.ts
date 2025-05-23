import * as vscode from 'vscode';
import {
  DatabaseSchema,
  QueryGenerationRequest,
  QueryGenerationResponse,
} from '../models/interfaces';
import { StorageService } from './StorageService';
import { I18nService } from './I18nService';
import { AnthropicService } from './AnthropicService';
import { VertexAIService } from './VertexAIService';

export class AIService {
  private static instance: AIService;
  private anthropicService: AnthropicService | null = null;
  private vertexAIService: VertexAIService;

  private constructor() {
    this.vertexAIService = new VertexAIService();
  }

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  async generateSQL(request: QueryGenerationRequest): Promise<QueryGenerationResponse> {
    const i18n = I18nService.getInstance();
    const aiConfig = StorageService.getInstance().getAIConfig();
    const model = aiConfig.model;

    // リクエスト開始時間を記録
    const startTime = new Date();
    console.log(`AI Request started at: ${startTime.toISOString()}`);

    try {
      // モデルに応じて適切なAPIを使用
      if (model.startsWith('vertex-')) {
        // VertexAI経由でリクエスト
        const systemPrompt = this.vertexAIService.createSystemPrompt(request.schema);
        const userPrompt = this.vertexAIService.createUserPrompt(request);

        await this.vertexAIService.makeVertexAIRequest({
          systemPrompt,
          userPrompt,
          projectId: aiConfig.vertexProjectId!,
          location: aiConfig.vertexLocation!,
        });
      } else {
        // Anthropic直接でリクエスト
        if (!this.anthropicService) {
          this.anthropicService = new AnthropicService(aiConfig.apiKey);
        }

        const systemPrompt = this.anthropicService.createSystemPrompt(request.schema);
        const userPrompt = this.anthropicService.createUserPrompt(request);

        await this.anthropicService.makeStreamingRequest({
          model,
          max_tokens: 16384,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        });
      }

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

  // APIキーが変更された場合にAnthropicServiceを再初期化
  updateApiKey(apiKey: string): void {
    this.anthropicService = new AnthropicService(apiKey);
  }
}
