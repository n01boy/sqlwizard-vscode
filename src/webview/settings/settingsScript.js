// VSCode APIの取得
const vscode = acquireVsCodeApi();

// グローバル変数
let databases = [];
let currentDbId = null;
const settingsPage = document.querySelector('.container');
const databaseForm = document.getElementById('database-form');
const errorMessage = document.getElementById('error-message');

// Language settings
const languageDropdown = document.getElementById('language');
languageDropdown.addEventListener('change', (e) => {
    vscode.postMessage({
        command: 'changeLanguage',
        language: e.target.value
    });
});

// Database settings
const databaseList = document.getElementById('database-list');
const addDatabaseButton = document.getElementById('add-database');
const backToSettingsButton = document.getElementById('back-to-settings');
const cancelDbButton = document.getElementById('cancel-db');
const saveDbButton = document.getElementById('save-db');
const dbFormTitle = document.getElementById('db-form-title');
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const dbSearchInput = document.getElementById('db-search');
const searchResults = document.getElementById('search-results');

// フィールドとエラー表示
const nameInput = document.getElementById('db-name');
const hostInput = document.getElementById('db-host');
const portInput = document.getElementById('db-port');
const userInput = document.getElementById('db-user');
const passwordInput = document.getElementById('db-password');
const databaseInput = document.getElementById('db-database');

const nameError = document.getElementById('name-error');
const hostError = document.getElementById('host-error');
const portError = document.getElementById('port-error');
const userError = document.getElementById('user-error');
const databaseError = document.getElementById('database-error');

// エラーメッセージをクリア
function clearErrors() {
    errorMessage.style.display = 'none';
    errorMessage.textContent = '';
    nameError.textContent = '';
    hostError.textContent = '';
    portError.textContent = '';
    userError.textContent = '';
    databaseError.textContent = '';
}

// エラーメッセージを表示
function showError(message, fieldErrors = {}) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    
    if (fieldErrors.name) {
        nameError.textContent = fieldErrors.name;
    }
    if (fieldErrors.host) {
        hostError.textContent = fieldErrors.host;
    }
    if (fieldErrors.port) {
        portError.textContent = fieldErrors.port;
    }
    if (fieldErrors.user) {
        userError.textContent = fieldErrors.user;
    }
    if (fieldErrors.database) {
        databaseError.textContent = fieldErrors.database;
    }
}

// タブ切り替え
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const tabId = button.dataset.tab;
        
        // アクティブなタブボタンを更新
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // アクティブなタブコンテンツを更新
        tabContents.forEach(content => content.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
    });
});

// データベース検索
dbSearchInput.addEventListener('input', () => {
    const searchTerm = dbSearchInput.value.toLowerCase();
    const filteredDbs = databases.filter(db => 
        db.name.toLowerCase().includes(searchTerm) || 
        db.host.toLowerCase().includes(searchTerm)
    );
    
    renderSearchResults(filteredDbs);
});

function renderSearchResults(results) {
    searchResults.innerHTML = '';
    
    if (results.length === 0) {
        searchResults.innerHTML = '<div class="search-result-item">No results found</div>';
        return;
    }
    
    results.forEach(db => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.textContent = `${db.name} (${db.host})`;
        item.dataset.id = db.id;
        
        item.addEventListener('click', () => {
            selectDatabase(db);
        });
        
        searchResults.appendChild(item);
    });
}

function selectDatabase(db) {
    currentDbId = db.id;
    document.getElementById('db-name').value = db.name;
    document.getElementById('db-provider').value = db.provider;
    document.getElementById('db-host').value = db.host;
    document.getElementById('db-port').value = db.port;
    document.getElementById('db-user').value = db.user;
    document.getElementById('db-password').value = db.password;
    document.getElementById('db-database').value = db.database;
    
    // 新規作成タブに切り替え
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabButtons[1].classList.add('active');
    
    tabContents.forEach(content => content.classList.remove('active'));
    document.getElementById('create-tab').classList.add('active');
}

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

// データベース追加画面を表示
addDatabaseButton.addEventListener('click', () => {
    // フォームをリセット
    currentDbId = null;
    dbFormTitle.textContent = document.documentElement.lang === 'ja' ? 'データベースを追加' : 'Add Database';
    document.getElementById('db-name').value = '';
    document.getElementById('db-provider').value = 'mysql';
    document.getElementById('db-host').value = 'localhost';
    document.getElementById('db-port').value = '3306';
    document.getElementById('db-user').value = 'root';
    document.getElementById('db-password').value = '';
    document.getElementById('db-database').value = '';
    
    // エラーをクリア
    clearErrors();
    
    // 検索結果を更新
    renderSearchResults(databases);
    
    // 検索タブをアクティブに
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabButtons[0].classList.add('active');
    
    tabContents.forEach(content => content.classList.remove('active'));
    document.getElementById('search-tab').classList.add('active');
    
    // 画面切り替え
    settingsPage.style.display = 'none';
    databaseForm.style.display = 'block';
});

// 設定画面に戻る
backToSettingsButton.addEventListener('click', () => {
    settingsPage.style.display = 'block';
    databaseForm.style.display = 'none';
});

cancelDbButton.addEventListener('click', () => {
    settingsPage.style.display = 'block';
    databaseForm.style.display = 'none';
});

// フォームのバリデーション
function validateForm() {
    let isValid = true;
    const fieldErrors = {};
    
    clearErrors();
    
    if (!nameInput.value.trim()) {
        fieldErrors.name = document.documentElement.lang === 'ja' ? '名前を入力してください' : 'Name is required';
        isValid = false;
    }
    
    if (!hostInput.value.trim()) {
        fieldErrors.host = document.documentElement.lang === 'ja' ? 'ホストを入力してください' : 'Host is required';
        isValid = false;
    }
    
    if (!portInput.value) {
        fieldErrors.port = document.documentElement.lang === 'ja' ? 'ポートを入力してください' : 'Port is required';
        isValid = false;
    } else if (isNaN(parseInt(portInput.value))) {
        fieldErrors.port = document.documentElement.lang === 'ja' ? 'ポートは数値で入力してください' : 'Port must be a number';
        isValid = false;
    }
    
    if (!userInput.value.trim()) {
        fieldErrors.user = document.documentElement.lang === 'ja' ? 'ユーザーを入力してください' : 'User is required';
        isValid = false;
    }
    
    if (!databaseInput.value.trim()) {
        fieldErrors.database = document.documentElement.lang === 'ja' ? 'データベース名を入力してください' : 'Database name is required';
        isValid = false;
    }
    
    if (!isValid) {
        showError(document.documentElement.lang === 'ja' ? '必須項目を入力してください' : 'Please fill in all required fields', fieldErrors);
    }
    
    return isValid;
}

// データベースを保存
saveDbButton.addEventListener('click', () => {
    if (!validateForm()) {
        return;
    }
    
    const name = nameInput.value;
    const provider = document.getElementById('db-provider').value;
    const host = hostInput.value;
    const port = portInput.value;
    const user = userInput.value;
    const password = passwordInput.value;
    const database = databaseInput.value;
    
    vscode.postMessage({
        command: 'saveDatabase',
        database: {
            id: currentDbId,
            name,
            provider,
            host,
            port: parseInt(port),
            user,
            password,
            database
        }
    });
});

// データベース一覧のイベント
databaseList.addEventListener('click', (e) => {
    const target = e.target.closest('.edit-database, .delete-database');
    if (!target) return;
    
    if (target.classList.contains('edit-database')) {
        const databaseId = target.dataset.id;
        const database = databases.find(db => db.id === databaseId);
        
        if (database) {
            dbFormTitle.textContent = document.documentElement.lang === 'ja' ? 'データベースを編集' : 'Edit Database';
            selectDatabase(database);
            settingsPage.style.display = 'none';
            databaseForm.style.display = 'block';
        }
    } else if (target.classList.contains('delete-database')) {
        vscode.postMessage({
            command: 'deleteDatabase',
            databaseId: target.dataset.id
        });
    }
});

// AI settings
const aiModelDropdown = document.getElementById('ai-model');
const apiKeyInput = document.getElementById('api-key');
const saveAiConfigButton = document.getElementById('save-ai-config');

saveAiConfigButton.addEventListener('click', () => {
    vscode.postMessage({
        command: 'updateAIConfig',
        model: aiModelDropdown.value,
        apiKey: apiKeyInput.value
    });
});

// Handle messages from extension
window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.command) {
        case 'updateDatabases':
            databases = message.databases;
            databaseList.innerHTML = '';
            databases.forEach(db => {
                databaseList.appendChild(createDatabaseElement(db));
            });
            break;
        case 'updateLanguage':
            languageDropdown.value = message.language;
            break;
        case 'updateAIConfig':
            aiModelDropdown.value = message.model;
            apiKeyInput.value = message.apiKey;
            break;
        case 'showDatabaseError':
            showError(message.message, message.fieldErrors || {});
            break;
        case 'databaseSaved':
            settingsPage.style.display = 'block';
            databaseForm.style.display = 'none';
            break;
    }
});