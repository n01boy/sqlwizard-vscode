// VSCodeのAPIを取得
const vscode = acquireVsCodeApi();
let currentSQL = '';

// DOM要素
let databaseDropdown;
let promptTextarea;
let generateButton;
let loadingContainer;
let promptHistoryList;

// DOMが読み込まれたら実行
document.addEventListener('DOMContentLoaded', () => {
    // DOM要素の取得
    databaseDropdown = document.getElementById('database');
    promptTextarea = document.getElementById('prompt');
    generateButton = document.getElementById('generate');
    loadingContainer = document.getElementById('loading-container');
    promptHistoryList = document.getElementById('prompt-history');

    // イベントリスナーの設定
    setupEventListeners();
});

// イベントリスナーの設定
function setupEventListeners() {
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
        });
        
        promptHistoryList.appendChild(historyItem);
    });
}