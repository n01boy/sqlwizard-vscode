// VSCodeのAPIを取得
const vscode = acquireVsCodeApi();
let currentSQL = '';

// DOM要素
let databaseDropdown;
let promptTextarea;
let generateButton;
let loadingContainer;
let promptHistoryList;
let tableListSection;
let tableList;
let tableSearchInput;
let tableLoadingContainer;

// DOMが読み込まれたら実行
document.addEventListener('DOMContentLoaded', () => {
    // DOM要素の取得
    databaseDropdown = document.getElementById('database');
    promptTextarea = document.getElementById('prompt');
    generateButton = document.getElementById('generate');
    loadingContainer = document.getElementById('loading-container');
    promptHistoryList = document.getElementById('prompt-history');
    tableListSection = document.getElementById('table-list-section');
    tableList = document.getElementById('table-list');
    tableSearchInput = document.getElementById('table-search');
    tableLoadingContainer = document.getElementById('table-loading-container');

    // イベントリスナーの設定
    setupEventListeners();
});

// イベントリスナーの設定
function setupEventListeners() {
    // データベース選択時のイベント
    databaseDropdown.addEventListener('change', () => {
        if (databaseDropdown.value) {
            // データベースが選択されたらスキーマ情報を取得
            tableListSection.style.display = 'block';
            showTableLoading();
            vscode.postMessage({
                command: 'fetchDatabaseSchema',
                databaseId: databaseDropdown.value
            });
        } else {
            // 選択が解除されたらテーブル一覧を非表示
            tableListSection.style.display = 'none';
        }
    });
    
    // テーブル検索のイベント
    tableSearchInput.addEventListener('input', () => {
        filterTableList();
    });

    // 生成ボタンのクリックイベント
    generateButton.addEventListener('click', () => {
        // データベースが選択されていない場合はエラー
        if (!databaseDropdown.value) {
            vscode.postMessage({
                command: 'showError',
                message: 'データベースを選択してください'
            });
            return;
        }
        
        // プロンプトが空の場合は何もしない
        if (!promptTextarea.value.trim()) {
            vscode.postMessage({
                command: 'showError',
                message: 'プロンプトを入力してください'
            });
            return;
        }

        // ローディング表示
        showLoading();

        vscode.postMessage({
            command: 'generateSQL',
            databaseId: databaseDropdown.value,
            prompt: promptTextarea.value
        });
    });

    // メッセージイベントリスナー
    window.addEventListener('message', (event) => {
        const message = event.data;
        switch (message.command) {
            case 'updateDatabases':
                updateDatabases(message.databases);
                break;

            case 'showResult':
                // ローディング非表示
                hideLoading();
                
                // 注意: エディタは既にストリーミングAPIによって開かれているため、
                // ここでは再度開かない
                break;
                
            case 'showError':
                // エラー時もローディング非表示
                hideLoading();
                break;
                
            case 'updatePromptHistory':
                // プロンプト履歴の更新
                updatePromptHistory(message.history);
                break;
                
            case 'updateTableList':
                // テーブル一覧の更新
                updateTableList(message.schema);
                hideTableLoading();
                break;
                
            case 'databaseSchemaFetched':
                // スキーマ取得完了
                hideTableLoading();
                break;
        }
    });
}

// ローディング表示の切り替え
function showLoading() {
    loadingContainer.style.display = 'block';
    generateButton.disabled = true;
}

function hideLoading() {
    loadingContainer.style.display = 'none';
    generateButton.disabled = false;
}

// テーブル一覧用ローディング表示の切り替え
function showTableLoading() {
    tableLoadingContainer.style.display = 'block';
    tableList.style.display = 'none';
}

function hideTableLoading() {
    tableLoadingContainer.style.display = 'none';
    tableList.style.display = 'block';
}

// データベース一覧を更新
function updateDatabases(databases) {
    // 最初のオプションを保持
    const firstOption = databaseDropdown.options[0];
    
    // 一旦クリア
    databaseDropdown.innerHTML = '';
    databaseDropdown.appendChild(firstOption);
    
    // データベース一覧を追加
    databases.forEach(db => {
        const option = document.createElement('option');
        option.value = db.id;
        option.textContent = db.name;
        databaseDropdown.appendChild(option);
    });
}

// プロンプト履歴を表示する関数
function updatePromptHistory(historyItems) {
    promptHistoryList.innerHTML = '';
    
    if (historyItems.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.textContent = '履歴はありません';
        emptyItem.className = 'prompt-history-empty';
        promptHistoryList.appendChild(emptyItem);
        return;
    }
    
    historyItems.forEach(item => {
        const historyItem = document.createElement('li');
        historyItem.className = 'prompt-history-item';
        historyItem.dataset.id = item.id;
        historyItem.dataset.databaseId = item.databaseId;
        historyItem.dataset.prompt = item.prompt;
        
        // 日時のフォーマット
        const date = new Date(item.timestamp);
        const formattedDate = `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        
        historyItem.innerHTML = `
            <div class="prompt-history-content">${item.prompt}</div>
            <div class="prompt-history-meta">
                <span class="prompt-history-database">${item.databaseName}</span>
                <span class="prompt-history-time">${formattedDate}</span>
            </div>
        `;
        
        // クリックイベントの追加
        historyItem.addEventListener('click', () => {
            // データベースの選択
            for (let i = 0; i < databaseDropdown.options.length; i++) {
                if (databaseDropdown.options[i].value === item.databaseId) {
                    databaseDropdown.selectedIndex = i;
                    break;
                }
            }
            
            // プロンプトの設定
            promptTextarea.value = item.prompt;
            
            // データベースが選択されたらスキーマ情報を取得
            if (databaseDropdown.value) {
                tableListSection.style.display = 'block';
                showTableLoading();
                vscode.postMessage({
                    command: 'fetchDatabaseSchema',
                    databaseId: databaseDropdown.value
                });
            }
        });
        
        promptHistoryList.appendChild(historyItem);
    });
}

// 現在のスキーマ情報を保持する変数
let currentSchema = null;

// テーブル一覧を表示する関数
function updateTableList(schema) {
    if (!schema || !schema.tables || schema.tables.length === 0) {
        tableListSection.style.display = 'none';
        return;
    }
    
    // スキーマ情報を保存
    currentSchema = schema;
    
    // 検索欄をクリア
    tableSearchInput.value = '';
    
    // テーブル一覧を表示
    renderTableList(schema.tables);
    
    // テーブル一覧を表示
    tableListSection.style.display = 'block';
}

// テーブル一覧をレンダリングする関数
function renderTableList(tables) {
    tableList.innerHTML = '';
    
    if (tables.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'table-empty-message';
        emptyMessage.textContent = '該当するテーブルがありません';
        tableList.appendChild(emptyMessage);
        return;
    }
    
    // テーブル一覧を表示
    tables.forEach(table => {
        const tableItem = document.createElement('div');
        tableItem.className = 'table-item';
        tableItem.dataset.tableName = table.tableName.toLowerCase();
        
        // テーブル名
        const tableName = document.createElement('div');
        tableName.className = 'table-name';
        tableName.textContent = table.tableName;
        tableItem.appendChild(tableName);
        
        // カラム一覧（折りたたみ可能）
        const columnsContainer = document.createElement('div');
        columnsContainer.className = 'columns-container';
        
        // カラム一覧のヘッダー
        const columnsHeader = document.createElement('div');
        columnsHeader.className = 'columns-header';
        columnsHeader.textContent = 'カラム';
        columnsHeader.addEventListener('click', () => {
            columnsContainer.classList.toggle('expanded');
        });
        columnsContainer.appendChild(columnsHeader);
        
        // カラム一覧
        const columnsList = document.createElement('ul');
        columnsList.className = 'columns-list';
        
        // カラム名を保存（検索用）
        const columnNames = [];
        
        table.columns.forEach(column => {
            const columnItem = document.createElement('li');
            columnItem.className = 'column-item';
            columnItem.textContent = `${column.name} (${column.type})${column.key ? ' [' + column.key + ']' : ''}`;
            columnsList.appendChild(columnItem);
            
            // 検索用にカラム名を保存
            columnNames.push(column.name.toLowerCase());
        });
        
        // データ属性にカラム名を保存（検索用）
        tableItem.dataset.columnNames = columnNames.join(',');
        
        columnsContainer.appendChild(columnsList);
        tableItem.appendChild(columnsContainer);
        
        // インデックス一覧（折りたたみ可能）
        if (table.indexes && table.indexes.length > 0) {
            const indexesContainer = document.createElement('div');
            indexesContainer.className = 'indexes-container';
            
            // インデックス一覧のヘッダー
            const indexesHeader = document.createElement('div');
            indexesHeader.className = 'indexes-header';
            indexesHeader.textContent = 'インデックス';
            indexesHeader.addEventListener('click', () => {
                indexesContainer.classList.toggle('expanded');
            });
            indexesContainer.appendChild(indexesHeader);
            
            // インデックス一覧
            const indexesList = document.createElement('ul');
            indexesList.className = 'indexes-list';
            
            table.indexes.forEach(index => {
                const indexItem = document.createElement('li');
                indexItem.className = 'index-item';
                indexItem.textContent = `${index.name} (${index.type}) - カラム: ${index.columns.join(', ')}${index.method ? ' - 方式: ' + index.method : ''}`;
                indexesList.appendChild(indexItem);
            });
            
            indexesContainer.appendChild(indexesList);
            tableItem.appendChild(indexesContainer);
        }
        
        // 外部キー一覧（折りたたみ可能）
        if (table.foreignKeys && table.foreignKeys.length > 0) {
            const foreignKeysContainer = document.createElement('div');
            foreignKeysContainer.className = 'foreign-keys-container';
            
            // 外部キー一覧のヘッダー
            const foreignKeysHeader = document.createElement('div');
            foreignKeysHeader.className = 'foreign-keys-header';
            foreignKeysHeader.textContent = '外部キー';
            foreignKeysHeader.addEventListener('click', () => {
                foreignKeysContainer.classList.toggle('expanded');
            });
            foreignKeysContainer.appendChild(foreignKeysHeader);
            
            // 外部キー一覧
            const foreignKeysList = document.createElement('ul');
            foreignKeysList.className = 'foreign-keys-list';
            
            table.foreignKeys.forEach(fk => {
                const fkItem = document.createElement('li');
                fkItem.className = 'foreign-key-item';
                fkItem.textContent = `${fk.columnName} → ${fk.referencedTable}.${fk.referencedColumn}`;
                foreignKeysList.appendChild(fkItem);
            });
            
            foreignKeysContainer.appendChild(foreignKeysList);
            tableItem.appendChild(foreignKeysContainer);
        }
        
        tableList.appendChild(tableItem);
    });
}

// テーブル一覧をフィルターする関数
function filterTableList() {
    if (!currentSchema) return;
    
    const searchText = tableSearchInput.value.trim().toLowerCase();
    
    if (!searchText) {
        // 検索テキストが空の場合は全て表示
        renderTableList(currentSchema.tables);
        return;
    }
    
    // 検索テキストに一致するテーブルをフィルタリング
    const filteredTables = currentSchema.tables.filter(table => {
        // テーブル名で検索
        if (table.tableName.toLowerCase().includes(searchText)) {
            return true;
        }
        
        // カラム名で検索
        for (const column of table.columns) {
            if (column.name.toLowerCase().includes(searchText)) {
                return true;
            }
        }
        
        return false;
    });
    
    // フィルタリングされたテーブル一覧を表示
    renderTableList(filteredTables);
}