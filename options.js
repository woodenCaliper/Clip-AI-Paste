const keys = ['aiProvider', 'openaiApiKey', 'geminiApiKey', 'claudeApiKey', 'openaiModel', 'geminiModel', 'claudeModel', 'prompt'];

async function restore() {
  const data = await chrome.storage.sync.get(keys);
  for (const k of keys) {
    const el = document.getElementById(k);
    if (el) el.value = data[k] || '';
  }
}

async function save() {
  const out = {};
  for (const k of keys) {
    const el = document.getElementById(k);
    out[k] = el ? el.value : '';
  }
  await chrome.storage.sync.set(out);
  const status = document.getElementById('status');
  status.textContent = '保存しました';
  setTimeout(() => { status.textContent = ''; }, 1500);
}

document.getElementById('save').addEventListener('click', save);
restore();
