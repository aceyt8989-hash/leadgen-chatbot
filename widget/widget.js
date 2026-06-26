(function () {
  var API_URL = 'https://leadgen-chatbot-psi.vercel.app/api/chat';
  var PRIMARY_COLOR = '#2563eb';
  var BOT_NAME = 'Sales Assistant';
  var GREETING = 'Hi there! 👋 Got any questions? Happy to help.';

  var state = {
    open: false,
    messages: [],
    leadCaptured: false,
    loading: false
  };

  var container, bubble, panel, messagesEl, inputEl, sendBtn;

  function init() {
    var existing = document.getElementById('lcw-container');
    if (existing) return;

    var css = document.createElement('style');
    css.textContent = `
      #lcw-container * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      #lcw-container { all: initial; position: fixed; z-index: 999999; bottom: 20px; right: 20px; font-size: 14px; line-height: 1.4; }
      .lcw-bubble { width: 56px; height: 56px; border-radius: 50%; background: ${PRIMARY_COLOR}; color: #fff; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; transition: transform 0.2s; position: absolute; bottom: 0; right: 0; }
      .lcw-bubble:hover { transform: scale(1.08); }
      .lcw-bubble svg { width: 26px; height: 26px; }
      .lcw-panel { position: absolute; bottom: 68px; right: 0; width: 360px; height: 520px; max-height: calc(100vh - 120px); background: #fff; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.18); display: none; flex-direction: column; overflow: hidden; animation: lcwSlideUp 0.25s ease; }
      .lcw-panel.open { display: flex; }
      @keyframes lcwSlideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      .lcw-header { background: ${PRIMARY_COLOR}; color: #fff; padding: 16px 20px; font-weight: 600; font-size: 15px; display: flex; align-items: center; gap: 10px; }
      .lcw-header-dot { width: 8px; height: 8px; border-radius: 50%; background: #4ade80; display: inline-block; }
      .lcw-close { margin-left: auto; background: none; border: none; color: #fff; cursor: pointer; padding: 4px; border-radius: 4px; }
      .lcw-close:hover { background: rgba(255,255,255,0.2); }
      .lcw-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; scroll-behavior: smooth; }
      .lcw-msg { max-width: 85%; padding: 10px 14px; border-radius: 14px; font-size: 14px; line-height: 1.45; word-wrap: break-word; animation: lcwFadeIn 0.2s ease; }
      @keyframes lcwFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      .lcw-msg.bot { align-self: flex-start; background: #f1f5f9; color: #1e293b; border-bottom-left-radius: 4px; }
      .lcw-msg.user { align-self: flex-end; background: ${PRIMARY_COLOR}; color: #fff; border-bottom-right-radius: 4px; }
      .lcw-msg.lead-done { align-self: center; background: #fef3c7; color: #92400e; font-size: 12px; border-radius: 8px; padding: 6px 12px; }
      .lcw-input-area { display: flex; border-top: 1px solid #e2e8f0; padding: 12px 16px; gap: 8px; background: #fff; }
      .lcw-input { flex: 1; border: 1px solid #e2e8f0; border-radius: 24px; padding: 10px 16px; font-size: 14px; outline: none; }
      .lcw-input:focus { border-color: ${PRIMARY_COLOR}; }
      .lcw-send { width: 38px; height: 38px; border-radius: 50%; background: ${PRIMARY_COLOR}; color: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .lcw-send:disabled { opacity: 0.5; cursor: not-allowed; }
      .lcw-send svg { width: 18px; height: 18px; }
      .lcw-typing { align-self: flex-start; background: #f1f5f9; color: #94a3b8; padding: 10px 18px; border-radius: 14px; font-size: 14px; border-bottom-left-radius: 4px; }
      .lcw-typing span { animation: lcwDots 1.4s infinite; }
      .lcw-typing span:nth-child(2) { animation-delay: 0.2s; }
      .lcw-typing span:nth-child(3) { animation-delay: 0.4s; }
      @keyframes lcwDots { 0%, 80%, 100% { opacity: 0; } 40% { opacity: 1; } }
      @media (max-width: 480px) {
        .lcw-panel { width: calc(100vw - 24px); right: -8px; bottom: 64px; height: calc(100vh - 140px); }
      }
    `;
    document.head.appendChild(css);

    container = document.createElement('div');
    container.id = 'lcw-container';

    bubble = document.createElement('button');
    bubble.className = 'lcw-bubble';
    bubble.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>';
    bubble.addEventListener('click', toggle);
    container.appendChild(bubble);

    panel = document.createElement('div');
    panel.className = 'lcw-panel';

    panel.innerHTML = `
      <div class="lcw-header">
        <span class="lcw-header-dot"></span>
        ${BOT_NAME}
        <button class="lcw-close" id="lcw-close-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="lcw-messages" id="lcw-messages"></div>
      <div class="lcw-input-area">
        <input class="lcw-input" id="lcw-input" placeholder="Type your message..." />
        <button class="lcw-send" id="lcw-send-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    `;

    container.appendChild(panel);
    document.body.appendChild(container);

    messagesEl = document.getElementById('lcw-messages');
    inputEl = document.getElementById('lcw-input');
    sendBtn = document.getElementById('lcw-send-btn');

    document.getElementById('lcw-close-btn').addEventListener('click', toggle);
    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') sendMessage();
    });

    addMessage('bot', GREETING);
  }

  function toggle() {
    state.open = !state.open;
    panel.classList.toggle('open', state.open);
    if (state.open) {
      inputEl.focus();
      scrollDown();
    }
  }

  function addMessage(role, text) {
    state.messages.push({ role: role, text: {text} });
    var el = document.createElement('div');
    el.className = 'lcw-msg ' + role;
    el.textContent = text;
    messagesEl.appendChild(el);
    scrollDown();
  }

  function showTyping() {
    var el = document.createElement('div');
    el.className = 'lcw-msg lcw-typing';
    el.id = 'lcw-typing';
    el.innerHTML = '<span>.</span><span>.</span><span>.</span>';
    messagesEl.appendChild(el);
    scrollDown();
  }

  function hideTyping() {
    var el = document.getElementById('lcw-typebot');
    if (el) el.remove();
  }

  function scrollDown() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showLeadCapturedMessage() {
    var el = document.createElement('div');
    el.className = 'lcw-msg lead-done';
    el.textContent = 'Thanks! We have your details and will be in touch soon.';
    messagesEl.appendChild(el);
    scrollDown();
  }

  async function sendMessage() {
    var text = inputEl.value.trim();
    if (!text || state.loading) return;

    inputEl.value = '';
    addMessage('user', text);

    state.loading = true;
    sendBtn.disabled = true;
    showTyping();

    try {
      var history = state.messages.map(function (m) {
        return { role: m.role === 'lead-done' ? 'bot' : m.role, text: m.text };
      });

      var resp = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: history, leadCaptured: state.leadCaptured })
      });

      var data = await resp.json();
      hideTyping();
      addMessage('bot', data.reply);

      if (data.leadCaptured && !state.leadCaptured) {
        state.leadCaptured = true;
        showLeadCapturedMessage();
      }
    } catch (err) {
      hideTyping();
      addMessage('bot', 'Sorry, something went wrong. Please try again.');
    } finally {
      state.loading = false;
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
