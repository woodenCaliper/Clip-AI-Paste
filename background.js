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
    const clipboardText = await readClipboardText();
    if (!clipboardText || !clipboardText.trim()) return;

    if (runId !== latestRunId) return;

    const settings = await chrome.storage.sync.get(Object.keys(DEFAULTS));
    const payload = buildPrompt(settings.prompt || '', clipboardText);
    const aiText = await askAI(settings, payload, runId);

    if (runId !== latestRunId) return;
    if (!aiText || !aiText.trim()) {
      notifyError('AIの回答が空です。');
      return;
    }

    await writeClipboardText(aiText);
    if (runId !== latestRunId) return;
    await pasteToActiveTab(aiText);
  } catch (error) {
    notifyError(error?.message || '実行中にエラーが発生しました。');
  } finally {
    await setBusy(false);
  }
}

function buildPrompt(prompt, inputText) {
  return `# 指示\n\n${prompt}\n\n# 入力テキスト\n\n${inputText}`;
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
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content }] })
  });
  if (!res.ok) throw new Error(`OpenAI APIエラー: ${res.status}`);
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
