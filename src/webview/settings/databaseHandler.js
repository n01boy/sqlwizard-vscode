// データベース設定関連の処理

// SSH設定の表示/非表示を切り替える
function toggleSshConfig() {
  const sshEnabled = document.getElementById('ssh-enabled');
  const sshConfig = document.getElementById('ssh-config');

  console.log('toggleSshConfig called');
  console.log('sshEnabled element:', sshEnabled);
  console.log('sshConfig element:', sshConfig);

  if (sshEnabled && sshConfig) {
    const isChecked = sshEnabled.checked;
    console.log('SSH checkbox is checked:', isChecked);

    if (isChecked) {
      sshConfig.style.display = 'block';
      console.log('SSH config shown');
    } else {
      sshConfig.style.display = 'none';
      console.log('SSH config hidden');
    }
  } else {
    console.log('SSH elements not found');
  }
}

// データベース追加フォームを表示
function showAddDatabaseForm() {
  console.log('showAddDatabaseForm called');

  // フォームをリセット
  currentDbId = null;
  const dbFormTitle = document.getElementById('db-form-title');
  console.log('dbFormTitle element:', dbFormTitle);
  if (dbFormTitle) {
    dbFormTitle.textContent =
      document.documentElement.lang === 'ja' ? 'データベースを追加' : 'Add Database';
  }

  // フィールドをリセット
  console.log('Resetting database form...');
  resetDatabaseForm();

  // 画面切り替え
  const settingsPage = document.querySelector('.container');
  const databaseForm = document.getElementById('database-form');

  console.log('settingsPage element:', settingsPage);
  console.log('databaseForm element:', databaseForm);

  if (settingsPage) {
    settingsPage.style.display = 'none';
    console.log('Settings page hidden');
  }
  if (databaseForm) {
    databaseForm.style.display = 'block';
    console.log('Database form shown');
  }

  // SSH設定を初期化
  setTimeout(() => {
    const sshEnabledCheckbox = document.getElementById('ssh-enabled');
    if (sshEnabledCheckbox) {
      sshEnabledCheckbox.checked = false;
    }
    toggleSshConfig();
  }, 100);
}

// 設定画面を表示
function showSettingsPage() {
  const settingsPage = document.querySelector('.container');
  const databaseForm = document.getElementById('database-form');

  if (settingsPage) settingsPage.style.display = 'block';
  if (databaseForm) databaseForm.style.display = 'none';
}

// データベースフォームをリセット
function resetDatabaseForm() {
  const fields = [
    { id: 'db-name', value: '' },
    { id: 'db-provider', value: 'mysql' },
    { id: 'db-host', value: 'localhost' },
    { id: 'db-port', value: '3306' },
    { id: 'db-user', value: 'root' },
    { id: 'db-password', value: '' },
    { id: 'db-database', value: '' },
    { id: 'ssh-enabled', checked: false },
    { id: 'ssh-host', value: '' },
    { id: 'ssh-port', value: '22' },
    { id: 'ssh-user', value: '' },
    { id: 'ssh-private-key', value: '' },
    { id: 'ssh-passphrase', value: '' },
  ];

  fields.forEach((field) => {
    const element = document.getElementById(field.id);
    if (element) {
      if (field.hasOwnProperty('checked')) {
        element.checked = field.checked;
      } else {
        element.value = field.value;
      }
    }
  });

  clearErrors();
}

// データベースを選択
function selectDatabase(db) {
  currentDbId = db.id;

  const fields = [
    { id: 'db-name', value: db.name || '' },
    { id: 'db-provider', value: db.provider || 'mysql' },
    { id: 'db-host', value: db.host || 'localhost' },
    { id: 'db-port', value: db.port || 3306 },
    { id: 'db-user', value: db.user || 'root' },
    { id: 'db-password', value: db.password || '' },
    { id: 'db-database', value: db.database || '' },
  ];

  fields.forEach((field) => {
    const element = document.getElementById(field.id);
    if (element) {
      element.value = field.value;
    }
  });

  // SSH設定
  const sshConfig = db.sshConfig;
  const sshEnabledCheckbox = document.getElementById('ssh-enabled');
  if (sshEnabledCheckbox) {
    // SSH設定が存在し、かつenabledがtrueの場合のみチェック
    sshEnabledCheckbox.checked = !!(sshConfig && sshConfig.enabled);
  }

  if (sshConfig) {
    const sshFields = [
      { id: 'ssh-host', value: sshConfig.host || '' },
      { id: 'ssh-port', value: sshConfig.port || 22 },
      { id: 'ssh-user', value: sshConfig.username || '' },
      { id: 'ssh-private-key', value: sshConfig.privateKey || '' },
      { id: 'ssh-passphrase', value: sshConfig.passphrase || '' },
    ];

    sshFields.forEach((field) => {
      const element = document.getElementById(field.id);
      if (element) {
        element.value = field.value;
      }
    });
  } else {
    // SSH設定がない場合はデフォルト値をクリア
    const sshFields = [
      { id: 'ssh-host', value: '' },
      { id: 'ssh-port', value: '22' },
      { id: 'ssh-user', value: '' },
      { id: 'ssh-private-key', value: '' },
      { id: 'ssh-passphrase', value: '' },
    ];

    sshFields.forEach((field) => {
      const element = document.getElementById(field.id);
      if (element) {
        element.value = field.value;
      }
    });
  }

  toggleSshConfig();
}

// データベース一覧のクリックイベント
function handleDatabaseListClick(e) {
  const target = e.target.closest('.edit-database, .delete-database');
  if (!target) return;

  if (target.classList.contains('edit-database')) {
    const databaseId = target.dataset.id;
    const database = databases.find((db) => db.id === databaseId);

    if (database) {
      const dbFormTitle = document.getElementById('db-form-title');
      if (dbFormTitle) {
        dbFormTitle.textContent =
          document.documentElement.lang === 'ja' ? 'データベースを編集' : 'Edit Database';
      }

      selectDatabase(database);
      showDatabaseForm();
    }
  } else if (target.classList.contains('delete-database')) {
    vscode.postMessage({
      command: 'deleteDatabase',
      databaseId: target.dataset.id,
    });
  }
}

// データベースフォームを表示
function showDatabaseForm() {
  const settingsPage = document.querySelector('.container');
  const databaseForm = document.getElementById('database-form');

  if (settingsPage) settingsPage.style.display = 'none';
  if (databaseForm) databaseForm.style.display = 'block';
}

// データベース設定のイベントリスナーを初期化
function initializeDatabaseEventListeners() {
  console.log('Initializing database event listeners...');

  // Database buttons
  const addDatabaseButton = document.getElementById('add-database');
  console.log('Add database button found:', addDatabaseButton);
  if (addDatabaseButton) {
    addDatabaseButton.addEventListener('click', showAddDatabaseForm);
    console.log('Add database button event listener attached');
  } else {
    console.error('Add database button not found!');
  }

  const backToSettingsButton = document.getElementById('back-to-settings');
  if (backToSettingsButton) {
    backToSettingsButton.addEventListener('click', showSettingsPage);
  }

  const cancelDbButton = document.getElementById('cancel-db');
  if (cancelDbButton) {
    cancelDbButton.addEventListener('click', showSettingsPage);
  }

  const saveDbButton = document.getElementById('save-db');
  if (saveDbButton) {
    saveDbButton.addEventListener('click', saveDatabase);
  }

  const testConnectionButton = document.getElementById('test-connection');
  if (testConnectionButton) {
    testConnectionButton.addEventListener('click', testConnection);
  }

  // SSH設定のチェックボックス
  const sshEnabledCheckbox = document.getElementById('ssh-enabled');
  if (sshEnabledCheckbox) {
    sshEnabledCheckbox.addEventListener('change', function () {
      console.log('SSH checkbox changed:', this.checked);
      toggleSshConfig();
    });
  }

  // 秘密鍵ファイル参照ボタン
  const browsePrivateKeyButton = document.getElementById('browse-private-key');
  if (browsePrivateKeyButton) {
    browsePrivateKeyButton.addEventListener('click', () => {
      vscode.postMessage({ command: 'browsePrivateKey' });
    });
  }

  // 秘密鍵ファイルクリアボタン
  const clearPrivateKeyButton = document.getElementById('clear-private-key');
  if (clearPrivateKeyButton) {
    clearPrivateKeyButton.addEventListener('click', () => {
      const sshPrivateKeyInput = document.getElementById('ssh-private-key');
      if (sshPrivateKeyInput) {
        sshPrivateKeyInput.value = '';
      }
    });
  }

  // データベース一覧のイベント
  const databaseList = document.getElementById('database-list');
  if (databaseList) {
    databaseList.addEventListener('click', handleDatabaseListClick);
  }

  // 初期状態でSSH設定を非表示にする
  toggleSshConfig();
}
