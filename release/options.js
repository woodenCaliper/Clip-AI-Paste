const keys = ['aiProvider', 'openaiApiKey', 'geminiApiKey', 'claudeApiKey', 'openaiModel', 'geminiModel', 'claudeModel', 'prompt'];
let lastSavedState = null;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('shortcutLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });
});

function setStatus(message, color = '#166534', persist = false) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.style.color = color;
  if (setStatus.timer) clearTimeout(setStatus.timer);
  if (persist) return;
  setStatus.timer = setTimeout(() => { status.textContent = ''; }, 3500);
}

function setHeaderValidation(message = '') {
  const el = document.getElementById('headerValidation');
  if (!el) return;
  el.textContent = message;
}

const PREVIEW_CLIPBOARD_PLACEHOLDER = '＜ここにクリップボードの内容＞';

function buildPrompt(prompt, inputText) {
  return `"入力テキスト"の内容に対して下記の"指示"を適用してください\n\n# 指示\n\n${prompt}\n\n# 入力テキスト\n\n${inputText}`;
}

function updatePreview() {
  const prompt = document.getElementById('prompt')?.value || '';
  const previewArea = document.getElementById('previewArea');
  if (!previewArea) return;
  previewArea.value = buildPrompt(prompt, PREVIEW_CLIPBOARD_PLACEHOLDER);
}

function syncProviderUI() {
  const provider = document.getElementById('aiProvider')?.value;
  const groups = document.querySelectorAll('.provider-group');
  groups.forEach((group) => {
    const isActive = group.dataset.provider === provider;
    group.classList.toggle('active', isActive);
    group.classList.toggle('inactive', !isActive);
  });
}

function collectCurrentState() {
  const out = {};
  for (const k of keys) {
    const el = document.getElementById(k);
    if (!el) {
      out[k] = '';
      continue;
    }
    out[k] = k === 'prompt' ? el.value : el.value.trim();
  }
  return out;
}

function updateDirtyState() {
  const dirtyState = document.getElementById('dirtyState');
  if (!dirtyState || !lastSavedState) return;
  const currentState = JSON.stringify(collectCurrentState());
  dirtyState.textContent = currentState === lastSavedState ? '' : '（未保存の変更があります）';
}


function validateSelectedModel() {
  const provider = document.getElementById('aiProvider')?.value;
  const modelKeyByProvider = {
    openai: 'openaiModel',
    gemini: 'geminiModel',
    claude: 'claudeModel'
  };
  const labelByProvider = {
    openai: 'OpenAI',
    gemini: 'Gemini',
    claude: 'Claude'
  };

  const modelKey = modelKeyByProvider[provider];
  if (!modelKey) return true;

  const modelError = document.getElementById('modelError');
  const model = (document.getElementById(modelKey)?.value || '').trim();
  if (!model) {
    if (modelError) modelError.textContent = `${labelByProvider[provider]}モデル名を入力してください。`;
    return false;
  }
  if (modelError) modelError.textContent = '';
  return true;
}

function validateSelectedApiKey(required = false) {
  const provider = document.getElementById('aiProvider')?.value;
  const apiKeyByProvider = {
    openai: 'openaiApiKey',
    gemini: 'geminiApiKey',
    claude: 'claudeApiKey'
  };
  const labelByProvider = {
    openai: 'OpenAI',
    gemini: 'Gemini',
    claude: 'Claude'
  };
  const providerError = document.getElementById('providerError');
  const apiKey = (document.getElementById(apiKeyByProvider[provider])?.value || '').trim();
  if (!apiKey) {
    const message = required
      ? `${labelByProvider[provider]} APIキーを入力してください。`
      : `${labelByProvider[provider]} APIキーが未設定です。`;
    if (providerError) providerError.textContent = message;
    setHeaderValidation(required ? message : '');
    return !required;
  }
  if (providerError) providerError.textContent = '';
  setHeaderValidation('');
  return true;
}

async function validateShortcutKey(showHeaderError = false) {
  const shortcutError = document.getElementById('shortcutError');
  const commands = await chrome.commands.getAll();
  const runCommand = commands.find((command) => command.name === 'run-clip-ai-paste');
  const hasShortcut = Boolean(runCommand?.shortcut);
  if (!hasShortcut) {
    const message = 'ショートカットキーを設定してください。';
    if (shortcutError) shortcutError.textContent = message;
    if (showHeaderError) setHeaderValidation(message);
    return false;
  }
  if (shortcutError) shortcutError.textContent = '';
  return true;
}

async function restore() {
  const data = await chrome.storage.sync.get(keys);
  for (const k of keys) {
    const el = document.getElementById(k);
    if (el) el.value = data[k] || '';
  }
  syncProviderUI();
  updatePreview();
  lastSavedState = JSON.stringify(collectCurrentState());
  updateDirtyState();
  validateSelectedApiKey();
  await validateShortcutKey();
}

async function save() {
  if (!validateSelectedApiKey(true)) return;
  if (!validateSelectedModel()) return;
  if (!await validateShortcutKey(true)) return;

  const out = collectCurrentState();
  await chrome.storage.sync.set(out);
  lastSavedState = JSON.stringify(out);
  updateDirtyState();
  setStatus('保存しました');
}

document.getElementById('save').addEventListener('click', save);
document.getElementById('openaiModel').addEventListener('blur', validateSelectedModel);
document.getElementById('geminiModel').addEventListener('blur', validateSelectedModel);
document.getElementById('claudeModel').addEventListener('blur', validateSelectedModel);
document.getElementById('openaiApiKey').addEventListener('blur', validateSelectedApiKey);
document.getElementById('openaiApiKey').addEventListener('input', validateSelectedApiKey);
document.getElementById('geminiApiKey').addEventListener('blur', validateSelectedApiKey);
document.getElementById('geminiApiKey').addEventListener('input', validateSelectedApiKey);
document.getElementById('claudeApiKey').addEventListener('blur', validateSelectedApiKey);
document.getElementById('claudeApiKey').addEventListener('input', validateSelectedApiKey);
document.getElementById('aiProvider').addEventListener('change', () => {
  syncProviderUI();
  validateSelectedApiKey();
  validateSelectedModel();
  updateDirtyState();
});
document.getElementById('prompt').addEventListener('input', () => {
  updatePreview();
  updateDirtyState();
});
for (const k of keys) {
  const el = document.getElementById(k);
  if (!el || k === 'prompt' || k === 'aiProvider') continue;
  el.addEventListener('input', updateDirtyState);
}
setInterval(() => {
  validateShortcutKey();
}, 3000);
restore();
