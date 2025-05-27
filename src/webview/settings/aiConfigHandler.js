// AI設定関連の処理

// VertexAI設定の表示/非表示を切り替える
function toggleVertexConfig() {
  const aiModelDropdown = document.getElementById('ai-model');
  const vertexConfig = document.getElementById('vertex-config');
  const anthropicConfig = document.getElementById('anthropic-config');

  if (aiModelDropdown && vertexConfig && anthropicConfig) {
    const isVertexModel = aiModelDropdown.value.startsWith('vertex-');

    if (isVertexModel) {
      // VertexAI設定を表示
      vertexConfig.style.display = 'block';
      // Anthropic設定を非表示
      anthropicConfig.style.display = 'none';
    } else {
      // VertexAI設定を非表示
      vertexConfig.style.display = 'none';
      // Anthropic設定を表示
      anthropicConfig.style.display = 'block';
    }
  }
}

// AI設定の保存処理
function saveAIConfig() {
  const aiModelDropdown = document.getElementById('ai-model');
  const apiKeyInput = document.getElementById('api-key');
  const vertexProjectIdInput = document.getElementById('vertex-project-id');
  const vertexLocationInput = document.getElementById('vertex-location');

  const config = {
    model: aiModelDropdown.value,
  };

  // Vertex AI設定がある場合は追加
  if (aiModelDropdown.value.startsWith('vertex-')) {
    config.vertexProjectId = vertexProjectIdInput.value;
    config.vertexLocation = vertexLocationInput.value;
    // VertexAIの場合はAPIキーは不要
    config.apiKey = '';
  } else {
    // Anthropicの場合はAPIキーが必要
    config.apiKey = apiKeyInput.value;
  }

  vscode.postMessage({
    command: 'updateAIConfig',
    ...config,
  });
}

// AI設定の更新処理
function updateAIConfig(message) {
  const aiModelDropdown = document.getElementById('ai-model');
  const apiKeyInput = document.getElementById('api-key');
  const vertexProjectIdInput = document.getElementById('vertex-project-id');
  const vertexLocationInput = document.getElementById('vertex-location');

  if (aiModelDropdown) aiModelDropdown.value = message.model;
  if (apiKeyInput) apiKeyInput.value = message.apiKey || '';

  // VertexAI設定がある場合は更新
  if (message.vertexProjectId && vertexProjectIdInput) {
    vertexProjectIdInput.value = message.vertexProjectId;
  }
  if (message.vertexLocation && vertexLocationInput) {
    vertexLocationInput.value = message.vertexLocation;
  }

  // VertexAI設定の表示/非表示を更新
  toggleVertexConfig();
}

// AI設定のテスト処理
function testAIConfig() {
  console.log('testAIConfig called');

  const aiModelDropdown = document.getElementById('ai-model');
  const apiKeyInput = document.getElementById('api-key');
  const vertexProjectIdInput = document.getElementById('vertex-project-id');
  const vertexLocationInput = document.getElementById('vertex-location');

  console.log('Elements found:', {
    aiModelDropdown: !!aiModelDropdown,
    apiKeyInput: !!apiKeyInput,
    vertexProjectIdInput: !!vertexProjectIdInput,
    vertexLocationInput: !!vertexLocationInput,
  });

  const config = {
    model: aiModelDropdown.value,
  };

  // Vertex AI設定がある場合は追加
  if (aiModelDropdown.value.startsWith('vertex-')) {
    config.vertexProjectId = vertexProjectIdInput.value;
    config.vertexLocation = vertexLocationInput.value;
    config.apiKey = '';
  } else {
    // Anthropicの場合はAPIキーが必要
    config.apiKey = apiKeyInput.value;
  }

  console.log('AI config for test:', config);

  // テストボタンを無効化
  const testButton = document.getElementById('test-ai-config');
  if (testButton) {
    testButton.disabled = true;
    testButton.textContent = document.documentElement.lang === 'ja' ? 'テスト中...' : 'Testing...';
    console.log('Test button disabled');
  } else {
    console.error('Test button not found');
  }

  console.log('Sending testAIConfig message');
  vscode.postMessage({
    command: 'testAIConfig',
    ...config,
  });
}

// AI設定のイベントリスナーを初期化
function initializeAIEventListeners() {
  // AI model selection change
  const aiModelDropdown = document.getElementById('ai-model');
  if (aiModelDropdown) {
    aiModelDropdown.addEventListener('change', toggleVertexConfig);
  }

  // AI settings
  const saveAiConfigButton = document.getElementById('save-ai-config');
  if (saveAiConfigButton) {
    saveAiConfigButton.addEventListener('click', saveAIConfig);
  }

  // Test AI settings
  const testAiConfigButton = document.getElementById('test-ai-config');
  if (testAiConfigButton) {
    testAiConfigButton.addEventListener('click', testAIConfig);
  }

  // 初期状態でVertexAI設定を非表示にする
  toggleVertexConfig();
}
