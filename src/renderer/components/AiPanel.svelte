<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';

  export let open = false;
  export let contextJson = '';

  interface Message {
    role: 'user' | 'assistant';
    content: string;
  }

  let messages: Message[] = [];
  let input = '';
  let streaming = false;
  let streamingText = '';
  let scrollEl: HTMLDivElement;
  let inputEl: HTMLTextAreaElement;
  let hasKey = false;
  let keyInput = '';
  let savingKey = false;

  onMount(async () => {
    hasKey = (await window.api?.aiHasKey()) ?? false;
    window.api?.onAiChunk((text) => {
      streamingText += text;
      scrollToBottom();
    });
    window.api?.onAiDone(() => {
      messages = [...messages, { role: 'assistant', content: streamingText }];
      streamingText = '';
      streaming = false;
      scrollToBottom();
    });
  });

  onDestroy(() => {
    window.api?.offAiListeners();
  });

  async function scrollToBottom() {
    await tick();
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  async function saveKey() {
    if (!keyInput.trim()) return;
    savingKey = true;
    await window.api?.aiSaveKey(keyInput.trim());
    hasKey = true;
    keyInput = '';
    savingKey = false;
  }

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    input = '';
    messages = [...messages, { role: 'user', content: text }];
    streaming = true;
    streamingText = '';
    await scrollToBottom();
    window.api?.aiSend(messages, contextJson);
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  $: if (open && inputEl) {
    tick().then(() => inputEl?.focus());
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="overlay" class:open on:click|self={() => open = false}></div>

<aside class="panel" class:open>
  <div class="panel-header">
    <span class="panel-title">Ask AI</span>
    <span class="panel-subtitle">Powered by Claude</span>
    <button class="close-btn" on:click={() => open = false} title="Close">✕</button>
  </div>

  {#if !hasKey}
    <div class="key-setup">
      <div class="key-title">Anthropic API Key</div>
      <p class="key-desc">Enter your Anthropic API key to enable AI analysis of your retirement plan.</p>
      <div class="key-row">
        <input
          class="key-input"
          type="password"
          placeholder="sk-ant-..."
          bind:value={keyInput}
          on:keydown={(e) => e.key === 'Enter' && saveKey()}
        />
        <button class="key-save-btn" on:click={saveKey} disabled={savingKey || !keyInput.trim()}>
          {savingKey ? '...' : 'Save'}
        </button>
      </div>
    </div>
  {:else}
    <div class="messages" bind:this={scrollEl}>
      {#if messages.length === 0 && !streaming}
        <div class="empty-hint">
          <div class="hint-icon">✦</div>
          <div class="hint-text">Ask me anything about your retirement plan — projections, drawdown rates, tax implications, what-if scenarios.</div>
        </div>
      {/if}

      {#each messages as msg}
        <div class="message {msg.role}">
          <div class="bubble">{msg.content}</div>
        </div>
      {/each}

      {#if streaming}
        <div class="message assistant">
          <div class="bubble">
            {streamingText}<span class="cursor">▊</span>
          </div>
        </div>
      {/if}
    </div>

    <div class="input-area">
      <textarea
        bind:this={inputEl}
        class="chat-input"
        placeholder="Ask about your plan…"
        rows="3"
        bind:value={input}
        on:keydown={onKeydown}
        disabled={streaming}
      ></textarea>
      <button class="send-btn" on:click={send} disabled={streaming || !input.trim()}>
        {streaming ? '…' : 'Send'}
      </button>
    </div>
  {/if}
</aside>

<style>
  .overlay {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 98;
    background: rgba(26, 26, 46, 0.15);
  }

  .overlay.open { display: block; }

  .panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 420px;
    z-index: 99;
    background: var(--paper);
    border-left: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    transform: translateX(100%);
    transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: -4px 0 24px rgba(26, 26, 46, 0.1);
  }

  .panel.open { transform: translateX(0); }

  /* ── Header ─────────────────────────── */
  .panel-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 1rem;
    height: 44px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    background: var(--paper);
  }

  .panel-title {
    font-family: var(--sans);
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--ink);
  }

  .panel-subtitle {
    font-family: var(--mono);
    font-size: 0.6rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--gray);
    flex: 1;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 0.8rem;
    color: var(--gray);
    cursor: pointer;
    padding: 0.25rem 0.4rem;
    border-radius: 2px;
    line-height: 1;
  }

  .close-btn:hover { color: var(--ink); background: var(--accent-light); }

  /* ── Key setup ──────────────────────── */
  .key-setup {
    padding: 1.5rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .key-title {
    font-family: var(--sans);
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--ink);
  }

  .key-desc {
    font-family: var(--sans);
    font-size: 0.75rem;
    color: var(--gray);
    line-height: 1.5;
  }

  .key-row {
    display: flex;
    gap: 0.5rem;
  }

  .key-input {
    flex: 1;
    font-family: var(--mono);
    font-size: 0.75rem;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--ink);
    outline: none;
  }

  .key-input:focus { border-color: var(--accent); }

  .key-save-btn {
    font-family: var(--sans);
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.4rem 0.9rem;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: var(--radius);
    cursor: pointer;
  }

  .key-save-btn:disabled { opacity: 0.45; cursor: default; }

  /* ── Messages ───────────────────────── */
  .messages {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .empty-hint {
    margin: auto;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 2rem 1rem;
  }

  .hint-icon {
    font-size: 1.4rem;
    color: var(--accent);
    opacity: 0.6;
  }

  .hint-text {
    font-family: var(--sans);
    font-size: 0.78rem;
    color: var(--gray);
    line-height: 1.6;
    max-width: 280px;
  }

  .message {
    display: flex;
    flex-direction: column;
  }

  .message.user {
    align-items: flex-end;
  }

  .message.assistant {
    align-items: flex-start;
  }

  .bubble {
    max-width: 88%;
    padding: 0.55rem 0.8rem;
    border-radius: 6px;
    font-family: var(--sans);
    font-size: 0.78rem;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .message.user .bubble {
    background: var(--accent);
    color: white;
    border-bottom-right-radius: 2px;
  }

  .message.assistant .bubble {
    background: var(--surface);
    color: var(--ink);
    border: 1px solid var(--border);
    border-bottom-left-radius: 2px;
  }

  .cursor {
    display: inline-block;
    animation: blink 1s step-end infinite;
    color: var(--accent);
    font-size: 0.7rem;
    vertical-align: middle;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0; }
  }

  /* ── Input area ─────────────────────── */
  .input-area {
    flex-shrink: 0;
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem;
    border-top: 1px solid var(--border);
    background: var(--paper);
  }

  .chat-input {
    flex: 1;
    font-family: var(--sans);
    font-size: 0.78rem;
    line-height: 1.5;
    padding: 0.45rem 0.65rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--ink);
    resize: none;
    outline: none;
  }

  .chat-input:focus { border-color: var(--accent); }
  .chat-input:disabled { opacity: 0.5; }

  .send-btn {
    align-self: flex-end;
    font-family: var(--sans);
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.45rem 1rem;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: var(--radius);
    cursor: pointer;
    white-space: nowrap;
  }

  .send-btn:disabled { opacity: 0.45; cursor: default; }
  .send-btn:not(:disabled):hover { background: #a84d22; }
</style>
