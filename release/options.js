const keys = ['aiProvider', 'openaiApiKey', 'geminiApiKey', 'claudeApiKey', 'openaiModel', 'geminiModel', 'claudeModel', 'prompt'];

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('shortcutLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });
});

function setStatus(message, color = '#166534') {
  const status = document.getElementById('status');
  status.textContent = message;
  status.style.color = color;
  if (setStatus.timer) clearTimeout(setStatus.timer);
  setStatus.timer = setTimeout(() => { status.textContent = ''; }, 3500);
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

  const model = (document.getElementById(modelKey)?.value || '').trim();
  if (!model) {
    setStatus(`${labelByProvider[provider]}モデル名を入力してください。`, '#b91c1c');
    return false;
  }
  return true;
}

async function restore() {
  const data = await chrome.storage.sync.get(keys);
  for (const k of keys) {
    const el = document.getElementById(k);
    if (el) el.value = data[k] || '';
  }
  updatePreview();
}

async function save() {
  if (!validateSelectedModel()) return;

  const out = {};
  for (const k of keys) {
    const el = document.getElementById(k);
    if (!el) {
      out[k] = '';
      continue;
    }
    out[k] = k === 'prompt' ? el.value : el.value.trim();
  }
  await chrome.storage.sync.set(out);
  setStatus('保存しました');
}

document.getElementById('save').addEventListener('click', save);
document.getElementById('openaiModel').addEventListener('blur', validateSelectedModel);
document.getElementById('geminiModel').addEventListener('blur', validateSelectedModel);
document.getElementById('claudeModel').addEventListener('blur', validateSelectedModel);
document.getElementById('aiProvider').addEventListener('change', validateSelectedModel);
document.getElementById('prompt').addEventListener('input', updatePreview);
restore();
