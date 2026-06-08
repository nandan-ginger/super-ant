/**
 * Ginger LiveChat AI Copilot — Widget Entry Point
 * =================================================
 * Injected into any host website via the standard Ginger script snippet.
 *
 * Reads config from: window.ginger_chat.salesiq
 * Connects to backend via Socket.IO
 * Builds a floating chat UI injected into the host page DOM
 */

(function () {
  'use strict';

  // ─── Config ─────────────────────────────────────────────────────────────────
  const cfg = (window.ginger_chat && window.ginger_chat.salesiq) || {};
  const BACKEND_URL = cfg.livechatURL || 'http://localhost:3001';
  const WIDGET_CODE = cfg.widgetcode || 'demo';

  // Unique session ID persisted for this browser tab
  const SESSION_ID = (() => {
    const key = 'ginger_session_' + WIDGET_CODE;
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
      sessionStorage.setItem(key, id);
    }
    return id;
  })();

  // ─── State ───────────────────────────────────────────────────────────────────
  let socket = null;
  let isOpen = false;
  let isTyping = false;
  let currentStreamEl = null;
  let leadFormShown = false;
  let contextIndexed = false;

  // ─── Styles ──────────────────────────────────────────────────────────────────
  const STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    .gc-widget * { box-sizing: border-box; font-family: 'Inter', sans-serif; }

    /* ── Launcher Button ── */
    .gc-launcher {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6C63FF 0%, #4F46E5 100%);
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 24px rgba(108, 99, 255, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483646;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      outline: none;
    }
    .gc-launcher:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 32px rgba(108, 99, 255, 0.65);
    }
    .gc-launcher svg { width: 26px; height: 26px; fill: white; transition: transform 0.3s ease; }
    .gc-launcher.gc-open svg { transform: rotate(90deg); }

    /* Notification dot */
    .gc-dot {
      position: absolute;
      top: 4px; right: 4px;
      width: 12px; height: 12px;
      background: #22C55E;
      border-radius: 50%;
      border: 2px solid white;
      animation: gc-pulse 2s infinite;
    }
    @keyframes gc-pulse {
      0%,100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.2); opacity: 0.8; }
    }

    /* ── Chat Panel ── */
    .gc-panel {
      position: fixed;
      bottom: 100px;
      right: 24px;
      width: 380px;
      max-height: 600px;
      background: #0F0F1A;
      border-radius: 20px;
      box-shadow: 0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06);
      display: flex;
      flex-direction: column;
      z-index: 2147483645;
      overflow: hidden;
      transform: translateY(20px) scale(0.95);
      opacity: 0;
      pointer-events: none;
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease;
    }
    .gc-panel.gc-visible {
      transform: translateY(0) scale(1);
      opacity: 1;
      pointer-events: all;
    }

    /* ── Header ── */
    .gc-header {
      background: linear-gradient(135deg, #6C63FF 0%, #4F46E5 100%);
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }
    .gc-avatar {
      width: 40px; height: 40px;
      background: rgba(255,255,255,0.15);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px;
      flex-shrink: 0;
    }
    .gc-header-info { flex: 1; }
    .gc-header-name { color: white; font-weight: 700; font-size: 15px; }
    .gc-header-status { color: rgba(255,255,255,0.75); font-size: 12px; display: flex; align-items: center; gap: 5px; }
    .gc-status-dot { width: 7px; height: 7px; background: #22C55E; border-radius: 50%; }
    .gc-close-btn {
      background: rgba(255,255,255,0.15);
      border: none; cursor: pointer;
      width: 32px; height: 32px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      color: white; font-size: 18px; line-height: 1;
      transition: background 0.2s;
    }
    .gc-close-btn:hover { background: rgba(255,255,255,0.25); }

    /* ── Messages ── */
    .gc-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      scroll-behavior: smooth;
    }
    .gc-messages::-webkit-scrollbar { width: 4px; }
    .gc-messages::-webkit-scrollbar-track { background: transparent; }
    .gc-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

    /* ── Message Bubbles ── */
    .gc-msg {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      animation: gc-fadeUp 0.3s ease;
    }
    @keyframes gc-fadeUp {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .gc-msg.gc-user { flex-direction: row-reverse; }
    .gc-bubble {
      max-width: 78%;
      padding: 10px 14px;
      border-radius: 18px;
      font-size: 13.5px;
      line-height: 1.55;
      word-break: break-word;
      white-space: pre-wrap;
    }
    .gc-msg.gc-bot .gc-bubble {
      background: #1E1E30;
      color: #E2E8F0;
      border-bottom-left-radius: 4px;
    }
    .gc-msg.gc-user .gc-bubble {
      background: linear-gradient(135deg, #6C63FF, #4F46E5);
      color: white;
      border-bottom-right-radius: 4px;
    }
    .gc-msg-avatar {
      width: 28px; height: 28px;
      background: linear-gradient(135deg, #6C63FF, #4F46E5);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px;
      flex-shrink: 0;
    }

    /* ── Typing Indicator ── */
    .gc-typing { display: flex; align-items: center; gap: 4px; padding: 12px 14px; }
    .gc-typing span {
      width: 7px; height: 7px;
      background: #6C63FF; border-radius: 50%;
      animation: gc-bounce 1.2s infinite ease-in-out;
    }
    .gc-typing span:nth-child(2) { animation-delay: 0.15s; }
    .gc-typing span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes gc-bounce {
      0%,60%,100% { transform: translateY(0); }
      30% { transform: translateY(-6px); }
    }

    /* ── Input Area ── */
    .gc-input-area {
      padding: 12px 16px 16px;
      background: #0F0F1A;
      border-top: 1px solid rgba(255,255,255,0.06);
      flex-shrink: 0;
    }
    .gc-input-row {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      background: #1E1E30;
      border-radius: 14px;
      padding: 8px 8px 8px 14px;
      border: 1px solid rgba(108,99,255,0.2);
      transition: border-color 0.2s;
    }
    .gc-input-row:focus-within { border-color: rgba(108,99,255,0.6); }
    .gc-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: #E2E8F0;
      font-size: 14px;
      font-family: 'Inter', sans-serif;
      resize: none;
      max-height: 120px;
      line-height: 1.5;
    }
    .gc-input::placeholder { color: #4A4A6A; }
    .gc-send-btn {
      width: 36px; height: 36px;
      background: linear-gradient(135deg, #6C63FF, #4F46E5);
      border: none; border-radius: 10px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition: transform 0.15s, opacity 0.15s;
    }
    .gc-send-btn:hover { transform: scale(1.08); }
    .gc-send-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
    .gc-send-btn svg { width: 18px; height: 18px; fill: white; }

    /* ── Powered by ── */
    .gc-footer {
      text-align: center;
      padding: 8px;
      font-size: 10px;
      color: #3A3A5A;
    }
    .gc-footer a { color: #6C63FF; text-decoration: none; }

    /* ── Lead Capture Form ── */
    .gc-lead-form {
      background: #1E1E30;
      border-radius: 16px;
      padding: 16px;
      margin: 4px 0;
      border: 1px solid rgba(108,99,255,0.3);
      animation: gc-fadeUp 0.3s ease;
    }
    .gc-lead-form h4 {
      color: #E2E8F0; font-size: 14px; font-weight: 600; margin: 0 0 4px;
    }
    .gc-lead-form p { color: #94A3B8; font-size: 12px; margin: 0 0 12px; }
    .gc-lead-input {
      width: 100%;
      background: #0F0F1A;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px;
      padding: 8px 12px;
      color: #E2E8F0;
      font-size: 13px;
      font-family: 'Inter', sans-serif;
      margin-bottom: 8px;
      outline: none;
      transition: border-color 0.2s;
    }
    .gc-lead-input:focus { border-color: rgba(108,99,255,0.5); }
    .gc-lead-input::placeholder { color: #4A4A6A; }
    .gc-lead-submit {
      width: 100%;
      background: linear-gradient(135deg, #6C63FF, #4F46E5);
      border: none;
      border-radius: 8px;
      padding: 9px;
      color: white;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      transition: opacity 0.2s;
      font-family: 'Inter', sans-serif;
    }
    .gc-lead-submit:hover { opacity: 0.9; }

    /* ── Context indicator ── */
    .gc-context-badge {
      font-size: 11px;
      color: #6C63FF;
      text-align: center;
      padding: 4px 8px;
    }

    /* ── Responsive ── */
    @media (max-width: 430px) {
      .gc-panel { width: calc(100vw - 16px); right: 8px; bottom: 88px; }
      .gc-launcher { right: 16px; bottom: 16px; }
    }
  `;

  // ─── SVG Icons ───────────────────────────────────────────────────────────────
  const ICON_CHAT = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/><path d="M7 9h10M7 13h7" stroke="white" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>`;
  const ICON_CLOSE = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
  const ICON_SEND = `<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;

  // ─── DOM Builder ─────────────────────────────────────────────────────────────
  function buildWidget() {
    // Inject styles
    const styleEl = document.createElement('style');
    styleEl.textContent = STYLES;
    document.head.appendChild(styleEl);

    // Root wrapper (namespace isolation)
    const root = document.createElement('div');
    root.className = 'gc-widget ginger-livechat-widget';
    root.id = 'ginger-livechat-widget';

    // ── Launcher button
    const launcher = document.createElement('button');
    launcher.className = 'gc-launcher';
    launcher.id = 'gc-launcher-btn';
    launcher.setAttribute('aria-label', 'Open AI Chat');
    launcher.innerHTML = `${ICON_CHAT}<span class="gc-dot"></span>`;

    // ── Chat panel
    const panel = document.createElement('div');
    panel.className = 'gc-panel';
    panel.id = 'gc-chat-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'AI Copilot Chat');

    // Header
    const header = document.createElement('div');
    header.className = 'gc-header';
    header.innerHTML = `
      <div class="gc-avatar">🤖</div>
      <div class="gc-header-info">
        <div class="gc-header-name">Ginger AI Assistant</div>
        <div class="gc-header-status">
          <span class="gc-status-dot"></span>
          <span id="gc-status-text">Analysing page…</span>
        </div>
      </div>
      <button class="gc-close-btn" id="gc-close-btn" aria-label="Close chat">✕</button>
    `;

    // Messages container
    const messages = document.createElement('div');
    messages.className = 'gc-messages';
    messages.id = 'gc-messages';
    messages.setAttribute('aria-live', 'polite');

    // Input area
    const inputArea = document.createElement('div');
    inputArea.className = 'gc-input-area';
    inputArea.innerHTML = `
      <div class="gc-input-row">
        <textarea
          class="gc-input"
          id="gc-input"
          placeholder="Ask me anything about this page…"
          rows="1"
          aria-label="Chat input"
        ></textarea>
        <button class="gc-send-btn" id="gc-send-btn" aria-label="Send message" disabled>
          ${ICON_SEND}
        </button>
      </div>
    `;

    // Footer
    const footer = document.createElement('div');
    footer.className = 'gc-footer';
    footer.innerHTML = `Powered by <a href="https://gingertechnologies.app" target="_blank" rel="noopener">Ginger AI</a>`;

    panel.appendChild(header);
    panel.appendChild(messages);
    panel.appendChild(inputArea);
    panel.appendChild(footer);

    root.appendChild(launcher);
    root.appendChild(panel);
    document.body.appendChild(root);

    return {
      launcher,
      panel,
      messages,
      input: document.getElementById('gc-input'),
      sendBtn: document.getElementById('gc-send-btn'),
      closeBtn: document.getElementById('gc-close-btn'),
      statusText: document.getElementById('gc-status-text'),
    };
  }

  // ─── Message Rendering ───────────────────────────────────────────────────────
  function appendMessage(els, role, text, streaming = false) {
    const msgEl = document.createElement('div');
    msgEl.className = `gc-msg gc-${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'gc-msg-avatar';
    avatar.textContent = role === 'bot' ? '🤖' : '👤';

    const bubble = document.createElement('div');
    bubble.className = 'gc-bubble';
    bubble.textContent = text;

    if (role === 'bot') {
      msgEl.appendChild(avatar);
      msgEl.appendChild(bubble);
    } else {
      msgEl.appendChild(bubble);
      msgEl.appendChild(avatar);
    }

    els.messages.appendChild(msgEl);
    scrollToBottom(els.messages);

    return bubble; // return bubble so we can update it during streaming
  }

  function showTyping(els) {
    const typingEl = document.createElement('div');
    typingEl.className = 'gc-msg gc-bot';
    typingEl.id = 'gc-typing';

    const avatar = document.createElement('div');
    avatar.className = 'gc-msg-avatar';
    avatar.textContent = '🤖';

    const bubble = document.createElement('div');
    bubble.className = 'gc-bubble gc-typing';
    bubble.innerHTML = '<span></span><span></span><span></span>';

    typingEl.appendChild(avatar);
    typingEl.appendChild(bubble);
    els.messages.appendChild(typingEl);
    scrollToBottom(els.messages);
    return typingEl;
  }

  function removeTyping() {
    const el = document.getElementById('gc-typing');
    if (el) el.remove();
  }

  function scrollToBottom(container) {
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }

  // ─── Lead Capture Form ────────────────────────────────────────────────────────
  function showLeadForm(els, intent) {
    if (leadFormShown) return;
    leadFormShown = true;

    const formEl = document.createElement('div');
    formEl.className = 'gc-lead-form';
    formEl.innerHTML = `
      <h4>💬 Let's connect you with our team</h4>
      <p>Leave your details and someone will be in touch shortly.</p>
      <input class="gc-lead-input" id="gc-lead-name" type="text" placeholder="Your name" autocomplete="name"/>
      <input class="gc-lead-input" id="gc-lead-email" type="email" placeholder="Email address *" autocomplete="email" required/>
      <input class="gc-lead-input" id="gc-lead-phone" type="tel" placeholder="Phone (optional)" autocomplete="tel"/>
      <textarea class="gc-lead-input" id="gc-lead-req" placeholder="Brief requirement…" rows="2" style="resize:none"></textarea>
      <button class="gc-lead-submit" id="gc-lead-submit-btn">Send my details →</button>
    `;

    els.messages.appendChild(formEl);
    scrollToBottom(els.messages);

    document.getElementById('gc-lead-submit-btn').addEventListener('click', () => {
      const name     = document.getElementById('gc-lead-name')?.value?.trim();
      const email    = document.getElementById('gc-lead-email')?.value?.trim();
      const phone    = document.getElementById('gc-lead-phone')?.value?.trim();
      const req      = document.getElementById('gc-lead-req')?.value?.trim();

      if (!email) {
        document.getElementById('gc-lead-email').style.borderColor = '#EF4444';
        return;
      }

      socket.emit('lead_form_submit', {
        name, email, phone,
        requirement: req,
        intent,
        pageUrl: window.location.href,
      });

      formEl.innerHTML = `
        <h4 style="color:#22C55E">✅ Thanks, ${name || 'there'}!</h4>
        <p style="color:#94A3B8">We've received your details and will reach out to you soon.</p>
      `;
    });
  }

  // ─── Socket.IO ───────────────────────────────────────────────────────────────
  function loadSocketIO(callback) {
    if (window.io) return callback();
    const s = document.createElement('script');
    s.src = BACKEND_URL + '/socket.io/socket.io.js';
    s.onload = callback;
    s.onerror = () => console.error('[Ginger] Failed to load Socket.IO client');
    document.head.appendChild(s);
  }

  function connectSocket(els) {
    socket = window.io(BACKEND_URL, {
      query: { sessionId: SESSION_ID, widgetCode: WIDGET_CODE },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      els.statusText.textContent = 'Connected · AI ready';
      els.sendBtn.disabled = false;

      // Send page context immediately on connect
      sendContextUpdate(els);
    });

    socket.on('disconnect', () => {
      els.statusText.textContent = 'Reconnecting…';
      els.sendBtn.disabled = true;
    });

    socket.on('connect_error', () => {
      els.statusText.textContent = 'Connection failed';
    });

    socket.on('context_indexed', (data) => {
      contextIndexed = true;
      els.statusText.textContent = `Ready · ${data.strategy === 'direct' ? 'Full context' : data.chunkCount + ' chunks'}`;
    });

    // Streaming response handler
    socket.on('chat_response', (data) => {
      if (!data.done) {
        // First chunk — replace typing indicator with streaming bubble
        if (!currentStreamEl) {
          removeTyping();
          currentStreamEl = appendMessage(els, 'bot', '');
        }
        currentStreamEl.textContent += data.chunk;
        scrollToBottom(els.messages);
      } else {
        // Stream complete
        currentStreamEl = null;
        isTyping = false;
        els.sendBtn.disabled = false;
        els.input.disabled = false;
        els.input.focus();
      }
    });

    socket.on('lead_detected', (data) => {
      if (!leadFormShown) {
        showLeadForm(els, data.intent);
      }
    });

    socket.on('lead_saved', (data) => {
      appendMessage(els, 'bot', data.message);
    });

    socket.on('error', (data) => {
      removeTyping();
      appendMessage(els, 'bot', data.message || 'Something went wrong. Please try again.');
      isTyping = false;
      els.sendBtn.disabled = false;
      els.input.disabled = false;
    });
  }

  // ─── Context Update ───────────────────────────────────────────────────────────
  function sendContextUpdate(els) {
    if (!socket || !socket.connected) return;

    // Load context extractor if not yet loaded
    const doExtract = () => {
      if (!window.GingerContextExtractor) return;
      try {
        const pageContext = window.GingerContextExtractor.extractPageContext();
        socket.emit('context_update', { pageContext });
        els.statusText.textContent = 'Analysing page…';
      } catch (err) {
        console.error('[Ginger] Context extraction failed', err);
      }
    };

    if (window.GingerContextExtractor) {
      doExtract();
    } else {
      const s = document.createElement('script');
      s.src = BACKEND_URL + '/livechat/contextExtractor.js';
      s.onload = doExtract;
      s.onerror = () => console.warn('[Ginger] Could not load contextExtractor.js');
      document.head.appendChild(s);
    }
  }

  // ─── Send Message ─────────────────────────────────────────────────────────────
  function sendMessage(els) {
    if (!socket || isTyping) return;

    const message = els.input.value.trim();
    if (!message) return;

    // Render user message
    appendMessage(els, 'user', message);
    els.input.value = '';
    autoResizeTextarea(els.input);

    // Show typing indicator
    showTyping(els);
    isTyping = true;
    els.sendBtn.disabled = true;
    els.input.disabled = true;

    socket.emit('chat_message', { message });
  }

  // ─── UI Utils ─────────────────────────────────────────────────────────────────
  function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  function togglePanel(els, open) {
    isOpen = open;
    els.panel.classList.toggle('gc-visible', open);
    els.launcher.classList.toggle('gc-open', open);
    els.launcher.setAttribute('aria-expanded', String(open));
    if (open) {
      // Remove notification dot once opened
      const dot = els.launcher.querySelector('.gc-dot');
      if (dot) dot.style.display = 'none';
      els.input.focus();
    }
  }

  // ─── SPA URL Change Detection ─────────────────────────────────────────────────
  function watchForNavigation(els) {
    let lastUrl = window.location.href;
    const observer = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        // Page navigated — re-extract context
        setTimeout(() => sendContextUpdate(els), 500);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Also hook into popstate (back/forward)
    window.addEventListener('popstate', () => setTimeout(() => sendContextUpdate(els), 500));
  }

  // ─── Welcome Message ──────────────────────────────────────────────────────────
  function showWelcomeMessage(els) {
    const pageTitle = document.title || 'this page';
    appendMessage(
      els,
      'bot',
      `👋 Hi! I'm your AI assistant for "${pageTitle}". Ask me anything — I'll answer using the content on this page.`
    );
  }

  // ─── Init ─────────────────────────────────────────────────────────────────────
  function init() {
    // Don't init twice
    if (document.getElementById('ginger-livechat-widget')) return;

    const els = buildWidget();

    // Welcome message
    showWelcomeMessage(els);

    // Event listeners
    els.launcher.addEventListener('click', () => togglePanel(els, !isOpen));
    els.closeBtn.addEventListener('click', () => togglePanel(els, false));

    els.input.addEventListener('input', () => {
      autoResizeTextarea(els.input);
      els.sendBtn.disabled = !els.input.value.trim();
    });

    els.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(els);
      }
    });

    els.sendBtn.addEventListener('click', () => sendMessage(els));

    // Connect Socket.IO
    loadSocketIO(() => connectSocket(els));

    // Watch for SPA navigation
    watchForNavigation(els);

    // Call ready callback if provided
    if (typeof cfg.ready === 'function') {
      try { cfg.ready(); } catch (_) {}
    }
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
