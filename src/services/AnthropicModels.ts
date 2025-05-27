/**
 * Anthropic Claude モデルの定義と共通機能
 */

export interface ClaudeModel {
  id: string;
  name: string;
  maxTokens: number;
  isLatest?: boolean;
}

export const CLAUDE_MODELS: Record<string, ClaudeModel> = {
  'claude-sonnet-4-20250514': {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4 (2025-05-14)',
    maxTokens: 64000,
    isLatest: true,
  },
  'claude-3-7-sonnet-20250219': {
    id: 'claude-3-7-sonnet-20250219',
    name: 'Claude 3.7 Sonnet (2025-02-19)',
    maxTokens: 16384,
  },
  'claude-3-5-sonnet-20241022': {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet (2024-10-22)',
    maxTokens: 8192,
  },
};

/**
 * モデル名から実際のAPI用モデルIDを取得
 */
export function getApiModelId(modelName: string): string {
  const model = CLAUDE_MODELS[modelName];
  return model ? model.id : modelName;
}

/**
 * モデル名から最大トークン数を取得
 */
export function getMaxTokens(modelName: string): number {
  const model = CLAUDE_MODELS[modelName];
  return model ? model.maxTokens : 16384;
}

/**
 * Claudeモデルかどうかを判定
 */
export function isClaudeModel(modelName: string): boolean {
  return modelName.startsWith('claude-') || CLAUDE_MODELS.hasOwnProperty(modelName);
}

/**
 * 利用可能なClaudeモデルのリストを取得
 */
export function getAvailableClaudeModels(): ClaudeModel[] {
  return Object.values(CLAUDE_MODELS);
}
