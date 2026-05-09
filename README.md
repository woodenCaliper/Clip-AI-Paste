# Clip AI Paste

`Clip AI Paste` は、**ショートカット1回**で以下を実行する Chrome 拡張です。

1. クリップボードのテキストを読む
2. 設定した指示プロンプトと結合して AI に送る
3. AI の回答をクリップボードへ上書きする
4. 現在の入力先へ自動で貼り付ける

> 想定用途: Chrome Web Store から導入し、一般利用者が利用することを想定

---

## 機能

- 対応 AI プロバイダ
  - OpenAI
  - Gemini
  - Claude
- 1つのショートカットで実行（初期値: `Ctrl+Shift+Y` / macOS: `Command+Shift+Y`）
- 指示プロンプトは1つ（設定画面で編集）
- 設定画面で「最終送信プロンプト」のプレビュー確認
- AI ごとに API キーとモデル名を設定可能
- 10秒タイムアウト
- エラー通知（Chrome 通知）
- 実行中表示（拡張バッジ）

---

## インストール（Chrome Web Store）

1. Chrome Web Store で `Clip AI Paste` を検索
2. 拡張ページで **Chrome に追加** をクリック
3. 確認ダイアログで **拡張機能を追加** をクリック
4. インストール完了後、Chrome ツールバーの拡張機能一覧から本拡張を固定（任意）

> 補足（開発者向け）: 検証時のみ `chrome://extensions` の「パッケージ化されていない拡張機能を読み込む」を利用してください。

---

## 初期設定

1. 拡張機能の詳細画面から **拡張機能のオプション** を開く
2. 以下を入力して保存
   - 使用AI（OpenAI / Gemini / Claude）
   - 各 API キー
   - 各モデル名
   - 指示プロンプト
3. 設定画面のプレビュー欄で、AIへ送る最終プロンプト形式を確認
4. 必要なら `chrome://extensions/shortcuts` でショートカットを変更

---

## 使い方

1. 変換したいテキストをクリップボードに入れる（コピー）
2. テキスト入力欄（input / textarea / contenteditable）にカーソルを置く
3. ショートカット（初期値: `Ctrl+Shift+Y` / macOS: `Command+Shift+Y`）を押す
4. AI 応答が自動で貼り付けられる

---

## 送信フォーマット

AI には次の形式で送信します。

```text
"入力テキスト"の内容に対して下記の指示を適用してください

# 指示
{指示プロンプト}

# 入力テキスト
{クリップボード本文}
```

---

## 注意事項

- クリップボードが空、または空文字テキストの場合は何もしません。
- 元のクリップボード内容は復元しません（AI回答で上書きされます）。
- ブラウザやページの制約により、貼り付け挙動が一部ページで異なる可能性があります。
- API キーは `chrome.storage.sync` に保存されます。取り扱いには注意してください。
- 対応サイトは通常の Web ページ（`http://` / `https://`）です。`chrome://` などブラウザ内部ページ、Chrome Web Store ページ、拡張機能管理ページでは動作しません。
- 権限利用理由:
  - `clipboardRead` / `clipboardWrite`: クリップボード読取と AI 応答の書き戻しのため
  - `activeTab`: 現在のタブで貼り付け対象要素へ操作を行うため
  - `storage`: API キー、モデル名、プロンプト設定を保存するため
- お問い合わせ先: 不具合報告・要望は本リポジトリの [Issue](https://github.com/woodenCaliper/Clip-AI-Paste/issues) へお願いします。
- プライバシーポリシー: [https://woodencaliper.github.io/Clip-AI-Paste/legal/privacy-policy.html](https://woodencaliper.github.io/Clip-AI-Paste/legal/privacy-policy.html)

---

## トラブルシュート

- **APIキー未設定エラー**
  - オプション画面で、選択中 AI の API キーが入っているか確認
- **タイムアウト（10秒）**
  - モデル変更、入力短縮、ネットワーク状態を確認
- **貼り付けされない**
  - 入力欄にフォーカスがあるか確認
  - 権限制約の強いページ（ブラウザ内部ページ等）では動作しない場合があります

---
