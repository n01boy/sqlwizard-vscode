# Change Log

## [0.5.0] - 2025-05-29

### Changed

- Minor version update with stability improvements
- Enhanced overall system performance and reliability

### 変更

- 安定性向上を含むマイナーバージョンアップデート
- システム全体のパフォーマンスと信頼性の強化

## [0.4.1] - 2025-05-27

### Added

- Support for Gemini 2.5 Pro (Vertex AI) model
- Support for Gemini 2.5 Flash (Vertex AI) model
- Enhanced Vertex AI integration with @anthropic-ai/vertex-sdk for Claude models
- AI test button disable/enable functionality based on configuration changes

### Changed

- Vertex AI location settings now automatically configured based on model type:
  - Gemini models use us-central1 region
  - Claude models use us-east5 region
- Removed manual location input from settings UI for simplified configuration
- Improved AI configuration validation and error handling
- Enhanced button state management for better user experience

### Fixed

- Fixed AI test and save buttons not working after configuration changes
- Resolved location configuration errors for Vertex AI models
- Improved JavaScript module loading and event listener initialization

### 追加

- Gemini 2.5 Pro (Vertex AI)モデルのサポート
- Gemini 2.5 Flash (Vertex AI)モデルのサポート
- ClaudeモデルのためのAnthropicVertex SDKによる強化されたVertex AI統合
- 設定変更に基づくAIテストボタンの無効化・有効化機能

### 変更

- Vertex AIロケーション設定がモデルタイプに基づいて自動設定されるように変更:
  - Geminiモデルはus-central1リージョンを使用
  - Claudeモデルはus-east5リージョンを使用
- 設定簡素化のため設定UIから手動ロケーション入力を削除
- AI設定の検証とエラー処理を改善
- より良いユーザーエクスペリエンスのためのボタン状態管理の強化

### 修正

- 設定変更後にAIテストと保存ボタンが動作しない問題を修正
- Vertex AIモデルのロケーション設定エラーを解決
- JavaScriptモジュールの読み込みとイベントリスナー初期化を改善

## [0.4.0] - 2025-05-27

### Added

- Support for Vertex AI Claude models: Claude Sonnet 4 (Vertex AI) and Claude 3.7 Sonnet (Vertex AI)
- Added us-east5 region option for Vertex AI configuration alongside us-central1
- Enhanced model selection with clear distinction between Anthropic and Vertex AI models

### Changed

- Updated Gemini 2.0 Flash model name from 'gemini-2.0-flash-exp' to 'gemini-2.0-flash'
- Improved internal model naming convention with 'vertex-' prefix for Vertex AI models
- Enhanced model detection logic to properly handle Vertex AI Claude models

### 追加

- Vertex AI Claudeモデルのサポート: Claude Sonnet 4 (Vertex AI)とClaude 3.7 Sonnet (Vertex AI)
- us-central1と併せてVertex AI設定用のus-east5リージョンオプションを追加
- AnthropicとVertex AIモデルの明確な区別を含むモデル選択の強化

### 変更

- Gemini 2.0 Flashモデル名を'gemini-2.0-flash-exp'から'gemini-2.0-flash'に更新
- Vertex AIモデル用の'vertex-'プレフィックスによる内部モデル命名規則の改善
- Vertex AI Claudeモデルを適切に処理するモデル検出ロジックの強化

## [0.3.9] - 2025-05-27

### Changed

- Minor improvements and bug fixes
- Enhanced stability and performance

### 変更

- 軽微な改善とバグ修正
- 安定性とパフォーマンスの向上

## [0.3.8] - 2025-05-27

### Added

- Support for new Claude models: Claude Sonnet 4 (2025-05-14), Claude 3.7 Sonnet (2025-02-19), Claude 3.5 Sonnet (2024-10-22)
- Centralized Anthropic model management with AnthropicModels.ts for better maintainability

### Changed

- Refactored Anthropic service code to use shared model definitions and reduce code duplication
- Improved model selection UI with clear model names and dates
- Enhanced AI service architecture with better separation of concerns

### Removed

- Deprecated claude-4-0-latest model option (replaced with specific versioned models)

### 追加

- 新しいClaudeモデルのサポート: Claude Sonnet 4 (2025-05-14)、Claude 3.7 Sonnet (2025-02-19)、Claude 3.5 Sonnet (2024-10-22)
- 保守性向上のためのAnthropicModels.tsによる一元化されたAnthropicモデル管理

### 変更

- 共有モデル定義を使用し、コードの重複を削減するためのAnthropicサービスコードのリファクタリング
- 明確なモデル名と日付を含むモデル選択UIの改善
- 関心の分離を改善したAIサービスアーキテクチャの強化

### 削除

- 非推奨のclaude-4-0-latestモデルオプション（特定のバージョン付きモデルに置き換え）

## [0.3.7] - 2025-05-27

### Added

- AI connection test functionality with "Test AI" button next to "Save Settings"
- VSCode notification system for AI test results (success/failure messages)
- Debug logging for AI test operations to improve troubleshooting

### Changed

- Vertex AI location setting restricted to us-central1 only for simplified configuration
- Improved user experience with clear success/failure notifications for AI tests
- Enhanced error handling and messaging for AI connection tests

### 追加

- 「設定を保存」の隣に「AIをテスト」ボタンによるAI接続テスト機能
- AIテスト結果（成功・失敗メッセージ）用のVSCode通知システム
- トラブルシューティング改善のためのAIテスト操作のデバッグログ

### 変更

- 設定簡素化のためVertex AIロケーション設定をus-central1のみに制限
- AIテストの明確な成功・失敗通知によるユーザーエクスペリエンスの向上
- AI接続テストのエラー処理とメッセージングの強化

## [0.3.6] - 2025-05-23

### Fixed

- Fixed database add/edit functionality not working in extension mode
- Improved error handling for database save operations with proper field validation
- Enhanced database configuration with default values for existing settings
- Added comprehensive debug logging for troubleshooting database operations
- Fixed event listener initialization timing issues in webview

### 修正

- 拡張機能モードでデータベース追加・編集機能が動作しない問題を修正
- 適切なフィールド検証によるデータベース保存操作のエラー処理を改善
- 既存設定のデフォルト値を含むデータベース設定の強化
- データベース操作のトラブルシューティング用の包括的なデバッグログを追加
- webviewでのイベントリスナー初期化タイミングの問題を修正

## [0.3.4] - 2025-05-23

### Fixed

- SSH private key file browser now shows all files instead of filtering by extension
- Improved file selection for SSH keys to support any file format

### 修正

- SSH秘密鍵ファイルブラウザが拡張子でフィルタリングせず、すべてのファイルを表示するように修正
- 任意のファイル形式をサポートするSSHキーのファイル選択を改善

## [0.3.3] - 2025-05-23

### Added

- Support for Vertex AI (Google Cloud) with project ID and region configuration
- Separate AI configuration UI for Anthropic (API key) and Vertex AI (project ID)
- Enhanced SSH port forwarding support with detailed connection testing
- Connection test error messages displayed above test button for better UX
- Improved file organization with modular JavaScript files (under 300 lines each)

### Fixed

- SSH configuration now properly included in database connection tests
- Connection test properly validates SSH settings before database connection
- Improved error handling and logging for SSH connections
- Fixed VertexAI configuration not being saved correctly

### 追加

- プロジェクトIDとリージョン設定によるVertex AI（Google Cloud）のサポート
- Anthropic（APIキー）とVertex AI（プロジェクトID）用の分離されたAI設定UI
- 詳細な接続テストを含む強化されたSSHポートフォワーディングサポート
- より良いUXのためにテストボタンの上に表示される接続テストエラーメッセージ
- モジュラーJavaScriptファイル（各300行以下）による改善されたファイル構成

### 修正

- SSH設定がデータベース接続テストに適切に含まれるように修正
- 接続テストがデータベース接続前にSSH設定を適切に検証するように修正
- SSH接続の改善されたエラー処理とログ出力
- VertexAI設定が正しく保存されない問題を修正

## [0.3.2] - 2025-04-04

- Update max_tokens to 16384.

All notable changes to the "sqlwizard-vscode" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.3.1] - 2025-03-14

### Fixed

- Fixed CSS file loading bug on Windows platforms
- Improved build script compatibility across different operating systems

### 修正

- Windows環境でのCSSファイル読み込みバグを修正
- 異なるOS間でのビルドスクリプトの互換性を向上

## [0.3.0] - 2025-03-14

### Added

- Support for Claude 3.5 Sonnet and Claude 3.7 Sonnet models
- Prompt history feature to easily reuse previous queries
- Database schema viewer with table and column information
- Streaming mode for SQL generation with real-time results
- Improved error handling and user feedback

### 追加

- Claude 3.5 SonnetとClaude 3.7 Sonnetモデルのサポート
- 過去のクエリを簡単に再利用できるプロンプト履歴機能
- テーブルとカラム情報を表示するデータベーススキーマビューア
- リアルタイム結果表示によるSQLストリーミング生成モード
- エラー処理とユーザーフィードバックの改善

## [0.2.1] - 2025-03-10

### Fixed

- Fixed compatibility issues with older VSCode versions
- Improved error handling for database connections
- Fixed UI layout issues in the settings panel

### 修正

- 古いバージョンのVSCodeとの互換性の問題を修正
- データベース接続のエラー処理を改善
- 設定パネルのUIレイアウトの問題を修正

## [0.2.0] - 2025-03-08

### Added

- Enhanced SQL generation with better schema understanding
- Improved database connection management
- Added support for SSH tunneling
- UI improvements for better user experience

### 追加

- スキーマ理解の向上によるSQL生成の強化
- データベース接続管理の改善
- SSHトンネリングのサポートを追加
- ユーザーエクスペリエンス向上のためのUI改善

## [0.1.4] - 2025-03-05

### Changed

- Further improved VSCode engine compatibility to support VSCode 1.70.0 and above
- Enhanced compatibility with older VSCode-based editors

### 変更

- VSCodeエンジンの互換性をさらに改善し、VSCode 1.70.0以上をサポート
- 古いVSCodeベースのエディタとの互換性を強化

## [0.1.3] - 2025-03-05

### Changed

- Updated VSCode engine compatibility to support VSCode 1.96.2 and above
- Fixed compatibility issues with Cursor editor

### 変更

- VSCodeエンジンの互換性をVSCode 1.96.2以上に更新
- Cursorエディタとの互換性の問題を修正

## [0.1.2] - 2025-03-05

### Added

- Added VSCode Marketplace installation information to README

### 追加

- READMEにVSCode Marketplaceからのインストール情報を追加

## [0.1.1] - 2025-03-05

### Added

- Enhanced documentation with detailed explanations
- Added overview diagrams in English and Japanese
- Added GitHub repository information

### 追加

- 詳細な説明を含むドキュメントの強化
- 英語と日本語の概要図を追加
- GitHubリポジトリ情報を追加

## [0.1.0] - 2025-03-04

### Added

- Database management (MySQL database registration and management)
- AI-powered SQL query generation (from natural language)
- Multilingual support (Japanese and English)
- SSH port forwarding support

### 追加

- データベース管理機能（MySQLデータベースの登録と管理）
- AIによるSQLクエリ生成（自然言語からSQLクエリを生成）
- 日本語・英語の多言語対応
- SSHポートフォワーディングのサポート
