const keys = ['aiProvider', 'openaiApiKey', 'geminiApiKey', 'claudeApiKey', 'openaiModel', 'geminiModel', 'claudeModel', 'prompt'];

function setStatus(message, color = '#166534') {
  const status = document.getElementById('status');
  status.textContent = message;
  status.style.color = color;
  if (setStatus.timer) clearTimeout(setStatus.timer);
  setStatus.timer = setTimeout(() => { status.textContent = ''; }, 3500);
}

function validateOpenAIModel() {
  const provider = document.getElementById('aiProvider')?.value;
  const model = (document.getElementById('openaiModel')?.value || '').trim();
  if (provider !== 'openai') return true;
  if (!model) {
    setStatus('OpenAIモデル名を入力してください。', '#b91c1c');
    return false;
  }
  if (model === 'gpt-5.5') {
    setStatus('注意: gpt-5.5 は利用権限やAPI対応状況によって 429/400 が出る場合があります。権限のあるモデル名を設定してください。', '#92400e');
  }
  return true;
}

async function restore() {
  const data = await chrome.storage.sync.get(keys);
  for (const k of keys) {
    const el = document.getElementById(k);
    if (el) el.value = data[k] || '';
  }
}

async function save() {
  if (!validateOpenAIModel()) return;

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
document.getElementById('openaiModel').addEventListener('blur', validateOpenAIModel);
restore();
