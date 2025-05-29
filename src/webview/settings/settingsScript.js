// VSCode APIの取得
const vscode = acquireVsCodeApi();

// グローバル変数
let databases = [];
let currentDbId = null;

// 初期化処理
document.addEventListener('DOMContentLoaded', function () {
  console.log('DOM loaded, initializing...');
  initializeEventListeners();
});

// フォールバック: DOMContentLoadedが既に発生している場合
if (document.readyState === 'loading') {
  // まだ読み込み中
  console.log('Document is still loading, waiting for DOMContentLoaded...');
} else {
  // DOMContentLoadedは既に発生済み
  console.log('Document already loaded, initializing immediately...');
  initializeEventListeners();
}

// イベントリスナーの初期化
function initializeEventListeners() {
  console.log('initializeEventListeners called');

  // Language settings
  const languageDropdown = document.getElementById('language');
  if (languageDropdown) {
    languageDropdown.addEventListener('change', (e) => {
      vscode.postMessage({
        command: 'changeLanguage',
        language: e.target.value,
      });
    });
  }

  // AI設定のイベントリスナーを初期化
  console.log('Calling initializeAIEventListeners...');
  if (typeof initializeAIEventListeners === 'function') {
    initializeAIEventListeners();
  } else {
    console.error('initializeAIEventListeners function not found!');
  }

  // データベース設定のイベントリスナーを初期化
  console.log('Calling initializeDatabaseEventListeners...');
  if (typeof initializeDatabaseEventListeners === 'function') {
    initializeDatabaseEventListeners();
  } else {
    console.error('initializeDatabaseEventListeners function not found!');
  }

  console.log('initializeEventListeners completed');
}

// フォームのバリデーション
function validateForm() {
  const nameInput = document.getElementById('db-name');
  const hostInput = document.getElementById('db-host');
  const portInput = document.getElementById('db-port');
  const userInput = document.getElementById('db-user');
  const databaseInput = document.getElementById('db-database');

  let isValid = true;
  const fieldErrors = {};

  clearErrors();

  if (!nameInput.value.trim()) {
    fieldErrors.name =
      document.documentElement.lang === 'ja' ? '名前を入力してください' : 'Name is required';
    isValid = false;
  }

  if (!hostInput.value.trim()) {
    fieldErrors.host =
      document.documentElement.lang === 'ja' ? 'ホストを入力してください' : 'Host is required';
    isValid = false;
  }

  if (!portInput.value) {
    fieldErrors.port =
      document.documentElement.lang === 'ja' ? 'ポートを入力してください' : 'Port is required';
    isValid = false;
  } else if (isNaN(parseInt(portInput.value))) {
    fieldErrors.port =
      document.documentElement.lang === 'ja'
        ? 'ポートは数値で入力してください'
        : 'Port must be a number';
    isValid = false;
  }

  if (!userInput.value.trim()) {
    fieldErrors.user =
      document.documentElement.lang === 'ja' ? 'ユーザーを入力してください' : 'User is required';
    isValid = false;
  }

  if (!databaseInput.value.trim()) {
    fieldErrors.database =
      document.documentElement.lang === 'ja'
        ? 'データベース名を入力してください'
        : 'Database name is required';
    isValid = false;
  }

  if (!isValid) {
    showError(
      document.documentElement.lang === 'ja'
        ? '必須項目を入力してください'
        : 'Please fill in all required fields',
      fieldErrors
    );
  }

  return isValid;
}

// データベースを保存
function saveDatabase() {
  console.log('saveDatabase called');

  if (!validateForm()) {
    console.log('Validation failed');
    return;
  }

  const name = document.getElementById('db-name').value;
  const provider = document.getElementById('db-provider').value;
  const host = document.getElementById('db-host').value;
  const port = document.getElementById('db-port').value;
  const user = document.getElementById('db-user').value;
  const password = document.getElementById('db-password').value;
  const database = document.getElementById('db-database').value;

  // SSH設定
  const sshEnabled = document.getElementById('ssh-enabled').checked;
  let sshConfig = null;

  if (sshEnabled) {
    const sshHost = document.getElementById('ssh-host').value;
    const sshPort = document.getElementById('ssh-port').value;
    const sshUser = document.getElementById('ssh-user').value;
    const sshPrivateKey = document.getElementById('ssh-private-key').value;
    const sshPassphrase = document.getElementById('ssh-passphrase').value;

    sshConfig = {
      host: sshHost,
      port: parseInt(sshPort) || 22,
      username: sshUser,
      privateKey: sshPrivateKey,
      passphrase: sshPassphrase || undefined,
      enabled: true,
    };
  }

  const databaseData = {
    id: currentDbId,
    name,
    provider,
    host,
    port: parseInt(port),
    user,
    password,
    database,
    sshConfig,
  };

  console.log('Sending saveDatabase message:', databaseData);

  vscode.postMessage({
    command: 'saveDatabase',
    database: databaseData,
  });
}

// 接続テスト
function testConnection() {
  if (!validateForm()) {
    return;
  }

  // 接続テスト専用のエラーメッセージをクリア
  clearConnectionError();

  const host = document.getElementById('db-host').value;
  const port = document.getElementById('db-port').value;
  const user = document.getElementById('db-user').value;
  const password = document.getElementById('db-password').value;
  const database = document.getElementById('db-database').value;

  // SSH設定
  const sshEnabled = document.getElementById('ssh-enabled').checked;
  let sshConfig = null;

  if (sshEnabled) {
    const sshHost = document.getElementById('ssh-host').value;
    const sshPort = document.getElementById('ssh-port').value;
    const sshUser = document.getElementById('ssh-user').value;
    const sshPrivateKey = document.getElementById('ssh-private-key').value;
    const sshPassphrase = document.getElementById('ssh-passphrase').value;

    sshConfig = {
      host: sshHost,
      port: parseInt(sshPort) || 22,
      username: sshUser,
      privateKey: sshPrivateKey,
      passphrase: sshPassphrase || undefined,
      enabled: true,
    };
  }

  vscode.postMessage({
    command: 'testDatabaseConnection',
    database: {
      host,
      port: parseInt(port),
      user,
      password,
      database,
      sshConfig,
    },
  });

  const testConnectionButton = document.getElementById('test-connection');
  if (testConnectionButton) {
    testConnectionButton.disabled = true;
    testConnectionButton.textContent =
      document.documentElement.lang === 'ja' ? 'テスト中...' : 'Testing...';
  }
}

// エラーメッセージをクリア
function clearErrors() {
  const errorMessage = document.getElementById('error-message');
  if (errorMessage) {
    errorMessage.style.display = 'none';
    errorMessage.textContent = '';
  }

  const errorFields = ['name-error', 'host-error', 'port-error', 'user-error', 'database-error'];
  errorFields.forEach((fieldId) => {
    const element = document.getElementById(fieldId);
    if (element) {
      element.textContent = '';
    }
  });
}

// 接続テスト専用のエラーメッセージをクリア
function clearConnectionError() {
  const connectionErrorMessage = document.getElementById('connection-error-message');
  if (connectionErrorMessage) {
    connectionErrorMessage.style.display = 'none';
    connectionErrorMessage.textContent = '';
  }
}

// エラーメッセージを表示
function showError(message, fieldErrors = {}) {
  const errorMessage = document.getElementById('error-message');
  if (errorMessage) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
  }

  Object.keys(fieldErrors).forEach((field) => {
    const errorElement = document.getElementById(field + '-error');
    if (errorElement) {
      errorElement.textContent = fieldErrors[field];
    }
  });
}

// 接続テスト専用のエラーメッセージを表示
function showConnectionError(message) {
  const connectionErrorMessage = document.getElementById('connection-error-message');
  if (connectionErrorMessage) {
    connectionErrorMessage.textContent = message;
    connectionErrorMessage.style.display = 'block';
  }
}

// 接続テスト成功メッセージを表示
function showConnectionSuccess(message) {
  const connectionErrorMessage = document.getElementById('connection-error-message');
  if (connectionErrorMessage) {
    connectionErrorMessage.textContent = message;
    connectionErrorMessage.style.display = 'block';

    // エラーメッセージクラスを削除し、成功メッセージクラスを追加
    connectionErrorMessage.classList.remove('error-message');
    connectionErrorMessage.classList.add('success-message');

    // 3秒後に自動的に非表示にする
    setTimeout(() => {
      connectionErrorMessage.style.display = 'none';
      connectionErrorMessage.classList.remove('success-message');
      connectionErrorMessage.classList.add('error-message'); // 元に戻す
    }, 3000);
  }
}

// データベース要素を作成
function createDatabaseElement(database) {
  const div = document.createElement('div');
  div.className = 'database-item';
  div.innerHTML = `
    <div class="form-group">
      <input type="text" value="${database.name}" readonly>
      <button class="edit-database vscode-button" data-id="${database.id}">
        ${document.documentElement.lang === 'ja' ? '編集' : 'Edit'}
      </button>
      <button class="delete-database vscode-button" data-id="${database.id}">
        ${document.documentElement.lang === 'ja' ? '削除' : 'Delete'}
      </button>
    </div>
  `;
  return div;
}

// メッセージハンドラー
window.addEventListener('message', (event) => {
  const message = event.data;
  console.log('Received message:', message);
  switch (message.command) {
    case 'updateDatabases':
      databases = message.databases;
      const databaseList = document.getElementById('database-list');
      if (databaseList) {
        databaseList.innerHTML = '';
        databases.forEach((db) => {
          databaseList.appendChild(createDatabaseElement(db));
        });
      }
      break;

    case 'updateLanguage':
      const languageDropdown = document.getElementById('language');
      if (languageDropdown) {
        languageDropdown.value = message.language;
      }
      break;

    case 'updateAIConfig':
      updateAIConfig(message);
      break;

    case 'aiConfigSaved':
      // AI設定保存後にテストボタンを有効化
      const testButton = document.getElementById('test-ai-config');
      if (testButton) {
        testButton.disabled = false;
        testButton.textContent = document.documentElement.lang === 'ja' ? 'AIをテスト' : 'Test AI';
      }
      break;

    case 'showDatabaseError':
      showError(message.message, message.fieldErrors || {});
      break;

    case 'databaseSaved':
      console.log('Database saved successfully, returning to settings page');
      clearErrors();
      showSettingsPage();
      break;

    case 'testConnectionResult':
      const testConnectionButton = document.getElementById('test-connection');
      if (testConnectionButton) {
        testConnectionButton.disabled = false;
        testConnectionButton.textContent =
          document.documentElement.lang === 'ja' ? '接続テスト' : 'Test Connection';
      }

      if (message.success) {
        // 成功時は成功メッセージを表示
        showConnectionSuccess(
          document.documentElement.lang === 'ja'
            ? 'データベースに接続しました'
            : 'Database connected successfully'
        );
      } else {
        // 失敗時は接続テスト専用のエラーメッセージを表示
        showConnectionError(
          message.error ||
            (document.documentElement.lang === 'ja'
              ? 'データベースへの接続に失敗しました'
              : 'Failed to connect to database')
        );
      }
      break;

    case 'privateKeySelected':
      const sshPrivateKeyInput = document.getElementById('ssh-private-key');
      if (sshPrivateKeyInput) {
        sshPrivateKeyInput.value = message.filePath;
      }
      break;

    case 'testAIConfigResult':
      console.log('Received testAIConfigResult:', message);
      const testAiButton = document.getElementById('test-ai-config');
      if (testAiButton) {
        testAiButton.disabled = false;
        testAiButton.textContent =
          document.documentElement.lang === 'ja' ? 'AIをテスト' : 'Test AI';
        console.log('Test button re-enabled');
      } else {
        console.error('Test AI button not found when processing result');
      }

      if (message.success) {
        // 成功時は成功メッセージを表示
        console.log('AI test successful');
        // VSCodeの通知はSettingsViewProviderで表示されるため、ここではログのみ
      } else {
        // 失敗時はエラーメッセージを表示
        console.log('AI test failed:', message.error);
        // VSCodeの通知はSettingsViewProviderで表示されるため、ここではログのみ
      }
      break;
  }
});
