const DEFAULTS = {
  aiProvider: 'openai',
  openaiApiKey: '',
  geminiApiKey: '',
  claudeApiKey: '',
  openaiModel: 'gpt-4.1-mini',
  geminiModel: 'gemini-2.0-flash',
  claudeModel: 'claude-3-5-haiku-latest',
  prompt: ''
};

let latestRunId = 0;
const DEBUG_STEP_POPUP = false;
const DEBUG_USE_ALERT = false;

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get(Object.keys(DEFAULTS));
  const next = {};
  for (const [k, v] of Object.entries(DEFAULTS)) {
    if (existing[k] === undefined) next[k] = v;
  }
  if (Object.keys(next).length) await chrome.storage.sync.set(next);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'run-clip-ai-paste') return;
  const runId = ++latestRunId;
  await runPipeline(runId);
});

async function runPipeline(runId) {
  try {
    await setBusy(true);
    await debugStep('処理開始', { runId });

    const settings = await chrome.storage.sync.get(Object.keys(DEFAULTS));
    await debugStep('設定読み込み完了', { provider: settings.aiProvider });
    const validationError = validateSettings(settings);
    if (validationError) {
      await showErrorPopup(validationError);
      return;
    }

    const clipboardText = await readClipboardText();
    await debugStep('クリップボード読み取り完了', { preview: toPreview(clipboardText) });
    if (!clipboardText || !clipboardText.trim()) return;

    if (runId !== latestRunId) return;
    const payload = buildPrompt(settings.prompt, clipboardText);
    await debugStep('AIリクエスト作成完了', { payloadPreview: toPreview(payload) });
    const aiText = await askAI(settings, payload, runId);
    await debugStep('AI応答受信完了', { preview: toPreview(aiText) });

    if (runId !== latestRunId) return;
    if (!aiText || !aiText.trim()) {
      notifyError('AIの回答が空です。');
      return;
    }

    await writeClipboardText(aiText);
    await debugStep('クリップボード書き込み完了', { preview: toPreview(aiText) });
    if (runId !== latestRunId) return;
    await pasteToActiveTab(aiText);
    await debugStep('アクティブタブへの貼り付け完了');
  } catch (error) {
    await debugStep('エラー発生', { message: error?.message || 'unknown error' });
    notifyError(error?.message || '実行中にエラーが発生しました。');
  } finally {
    await setBusy(false);
    await debugStep('処理終了');
  }
}

function toPreview(text, max = 80) {
  const src = String(text || '').replace(/\s+/g, ' ').trim();
  if (!src) return '(empty)';
  return src.length > max ? `${src.slice(0, max)}...` : src;
}

async function debugStep(step, details = null) {
  if (!DEBUG_STEP_POPUP) return;
  const body = details ? `${step}\n${JSON.stringify(details)}` : step;
  try {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icon128.png'),
      title: 'Clip AI Paste / Debug',
      message: body.slice(0, 300)
    });
  } catch {
    // 通知アイコン取得失敗時はデバッグ表示のみ継続
  }
  await showDebugOverlay(body);
}

async function showDebugOverlay(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    if (DEBUG_USE_ALERT) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        args: [message.slice(0, 200)],
        func: (text) => {
          alert(`[Clip AI Debug]\n${text}`);
        }
      });
      return;
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      args: [message.slice(0, 300)],
      func: (text) => {
        const rootId = '__clip_ai_paste_debug_overlay__';
        let root = document.getElementById(rootId);
        if (!root) {
          root = document.createElement('div');
          root.id = rootId;
          root.style.position = 'fixed';
          root.style.top = '12px';
          root.style.right = '12px';
          root.style.zIndex = '2147483647';
          root.style.display = 'flex';
          root.style.flexDirection = 'column';
          root.style.gap = '8px';
          root.style.pointerEvents = 'none';
          document.documentElement.appendChild(root);
        }

        const item = document.createElement('div');
        item.textContent = `[Clip AI Debug] ${text}`;
        item.style.maxWidth = '420px';
        item.style.whiteSpace = 'pre-wrap';
        item.style.wordBreak = 'break-word';
        item.style.fontSize = '12px';
        item.style.lineHeight = '1.4';
        item.style.color = '#fff';
        item.style.background = 'rgba(17, 24, 39, 0.92)';
        item.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        item.style.borderRadius = '8px';
        item.style.padding = '8px 10px';
        item.style.boxShadow = '0 6px 20px rgba(0,0,0,0.35)';
        root.appendChild(item);

        if (root.childElementCount > 6) {
          root.removeChild(root.firstElementChild);
        }

        setTimeout(() => {
          item.remove();
          if (!root.childElementCount) root.remove();
        }, 6000);
      }
    });
  } catch {
    // chrome:// など script 注入不可ページでは無視
  }
}


function validateSettings(settings) {
  const provider = settings.aiProvider;
  if (!['openai', 'gemini', 'claude'].includes(provider)) {
    return '使用AIが正しく設定されていません。オプションページで設定してください。';
  }
  if (provider === 'openai') {
    if (!settings.openaiApiKey) return 'OpenAI APIキーが設定されていません。オプションページで設定してください。';
    if (!settings.openaiModel) return 'OpenAIのモデル名が設定されていません。オプションページで設定してください。';
  }
  if (provider === 'gemini') {
    if (!settings.geminiApiKey) return 'Gemini APIキーが設定されていません。オプションページで設定してください。';
    if (!settings.geminiModel) return 'Geminiのモデル名が設定されていません。オプションページで設定してください。';
  }
  if (provider === 'claude') {
    if (!settings.claudeApiKey) return 'Claude APIキーが設定されていません。オプションページで設定してください。';
    if (!settings.claudeModel) return 'Claudeのモデル名が設定されていません。オプションページで設定してください。';
  }
  if (!settings.prompt || !settings.prompt.trim()) {
    return '指示プロンプトが設定されていません。オプションページで設定してください。';
  }
  return null;
}

async function showErrorPopup(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    notifyError(message);
    return;
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      args: [message],
      func: (text) => {
        const rootId = '__clip_ai_paste_error_popup__';
        if (document.getElementById(rootId)) return;

        const popup = document.createElement('div');
        popup.id = rootId;
        popup.style.cssText = [
          'position:fixed', 'top:20px', 'left:50%', 'transform:translateX(-50%)',
          'z-index:2147483647', 'min-width:280px', 'max-width:480px',
          'background:#fff', 'border:2px solid #dc2626', 'border-radius:10px',
          'box-shadow:0 8px 32px rgba(0,0,0,0.22)', 'padding:16px 20px',
          'font-family:sans-serif', 'pointer-events:auto'
        ].join(';');

        const header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:10px';

        const icon = document.createElement('span');
        icon.textContent = '⚠️';
        icon.style.fontSize = '18px';

        const title = document.createElement('span');
        title.textContent = 'Clip AI Paste — 設定エラー';
        title.style.cssText = 'font-weight:700;font-size:14px;color:#dc2626;flex:1';

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = [
          'background:none', 'border:none', 'cursor:pointer',
          'font-size:16px', 'color:#6b7280', 'padding:0 2px', 'line-height:1'
        ].join(';');
        closeBtn.addEventListener('click', () => popup.remove());

        header.append(icon, title, closeBtn);

        const body = document.createElement('p');
        body.textContent = text;
        body.style.cssText = 'margin:0;font-size:13px;color:#374151;line-height:1.5';

        popup.append(header, body);
        document.documentElement.appendChild(popup);

        setTimeout(() => popup.remove(), 8000);
      }
    });
  } catch {
    notifyError(message);
  }
}

function formatOpenAIError(status, detail = '') {
  const normalized = String(detail || '');
  if (status === 429) {
    if (normalized.includes('You exceeded your current quota')) {
      return 'OpenAI APIエラー: 429。利用上限を超えています。OpenAIのBilling/Usageで上限と支払い設定を確認してください。';
    }
    return `OpenAI APIエラー: 429。課金上限・無料枠超過・レート制限・モデル利用権限不足の可能性があります。${normalized ? ` 詳細: ${normalized}` : ''}`;
  }
  return `OpenAI APIエラー: ${status}${normalized ? ` (${normalized})` : ''}`;
}

function buildPrompt(prompt, inputText) {
  return `"入力テキスト"の内容に対して下記の指示を適用してください\n\n# 指示\n${prompt}\n\n# 入力テキスト\n${inputText}`;
}

async function askAI(settings, payload, runId) {
  const provider = settings.aiProvider;
  if (provider === 'openai') {
    return withTimeout(callOpenAI(settings.openaiApiKey, settings.openaiModel, payload), 10000, runId);
  }
  if (provider === 'gemini') {
    return withTimeout(callGemini(settings.geminiApiKey, settings.geminiModel, payload), 10000, runId);
  }
  if (provider === 'claude') {
    return withTimeout(callClaude(settings.claudeApiKey, settings.claudeModel, payload), 10000, runId);
  }
  throw new Error('使用AIの設定が不正です。');
}

async function callOpenAI(apiKey, model, content) {
  if (!apiKey) throw new Error('OpenAI APIキーが未設定です。');
  if (!model || !model.trim()) throw new Error('OpenAIモデル名が未設定です。');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: model.trim(), messages: [{ role: 'user', content }] })
  });

  if (!res.ok) {
    let detail = '';
    try {
      const err = await res.json();
      detail = err?.error?.message || '';
    } catch {
      // JSON以外のエラー本文は無視
    }

    throw new Error(formatOpenAIError(res.status, detail));
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

async function callGemini(apiKey, model, content) {
  if (!apiKey) throw new Error('Gemini APIキーが未設定です。');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: content }] }] })
  });
  if (!res.ok) throw new Error(`Gemini APIエラー: ${res.status}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
}

async function callClaude(apiKey, model, content) {
  if (!apiKey) throw new Error('Claude APIキーが未設定です。');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: 'user', content }] })
  });
  if (!res.ok) throw new Error(`Claude APIエラー: ${res.status}`);
  const data = await res.json();
  return (data?.content || []).map((b) => b?.text || '').join('');
}

async function withTimeout(promise, ms, runId) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('AI APIがタイムアウトしました（10秒）。')), ms);
  });
  const result = await Promise.race([promise, timeout]);
  clearTimeout(timer);
  if (runId !== latestRunId) throw new Error('中断されました。');
  return result;
}

async function readClipboardText() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('アクティブタブを取得できません。');
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    func: async () => {
      try { return await navigator.clipboard.readText(); } catch { return ''; }
    }
  });
  return result || '';
}

async function writeClipboardText(text) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('アクティブタブを取得できません。');
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    args: [text],
    func: async (v) => {
      await navigator.clipboard.writeText(v);
    }
  });
}

async function pasteToActiveTab(text) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('アクティブタブを取得できません。');
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    args: [text],
    func: (value) => {
      const el = document.activeElement;
      if (!el) return;
      const isTextInput = el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && /^(text|search|url|tel|password|email)$/i.test(el.type));
      if (isTextInput) {
        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? el.value.length;
        el.setRangeText(value, start, end, 'end');
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
      if (el instanceof HTMLElement && el.isContentEditable) {
        document.execCommand('insertText', false, value);
      }
    }
  });
}

async function setBusy(busy) {
  await chrome.action.setBadgeBackgroundColor({ color: '#4b5563' });
  await chrome.action.setBadgeText({ text: busy ? '…' : '' });
}

function notifyError(message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Zq1cAAAAASUVORK5CYII=',
    title: 'Clip AI Paste',
    message
  });
}
