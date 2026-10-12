(() => {
  const form = document.querySelector('#chat-form');
  const input = document.querySelector('#message-input');
  const messages = document.querySelector('#chat-messages');
  const typing = document.querySelector('#typing-indicator');
  const sendButton = document.querySelector('#send-button');
  const count = document.querySelector('#character-count');
  const suggestions = document.querySelector('#suggestions');
  const clearButton = document.querySelector('#clear-chat');

  const initialGreeting = "Hi! I’m BankAssist. Ask me a general banking question and I’ll help you find a next step.";
  let busy = false;

  function timeLabel() {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date());
  }

  function addMessage(text, kind, variant = '') {
    const row = document.createElement('div');
    row.className = `message-row ${kind === 'user' ? 'user-row' : 'bot-row'}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = kind === 'user' ? 'Y' : 'B';

    const content = document.createElement('div');
    content.className = 'message-content';
    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${kind === 'user' ? 'user-bubble' : 'bot-bubble'}${variant ? ` ${variant}-bubble` : ''}`;
    bubble.textContent = text;
    const time = document.createElement('span');
    time.className = 'message-time';
    time.textContent = timeLabel();
    bubble.append(time);
    content.append(bubble);
    row.append(avatar, content);
    messages.append(row);
    messages.scrollTop = messages.scrollHeight;
  }

  function setBusy(value) {
    busy = value;
    sendButton.disabled = value;
    input.disabled = value;
    typing.hidden = !value;
    if (value) messages.scrollTop = messages.scrollHeight;
  }

  async function sendMessage(value) {
    const message = value.trim();
    if (!message || busy) return;

    addMessage(message, 'user');
    input.value = '';
    updateComposer();
    suggestions.hidden = true;
    setBusy(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const result = await response.json();
      if (!response.ok) {
        addMessage(result.error || result.reply || 'Please check your message and try again.', 'bot', 'error');
      } else {
        addMessage(result.reply || 'I could not prepare a response. Please try again.', 'bot', result.fallback ? 'fallback' : '');
      }
    } catch (_error) {
      addMessage('I could not connect to the assistant. Check your connection and try again.', 'bot', 'error');
    } finally {
      setBusy(false);
      input.focus();
    }
  }

  function updateComposer() {
    count.textContent = `${input.value.length} / 1000`;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 98)}px`;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    sendMessage(input.value);
  });

  input.addEventListener('input', updateComposer);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  document.querySelectorAll('.suggestion-chip').forEach((button) => {
    button.addEventListener('click', () => sendMessage(button.textContent));
  });

  clearButton.addEventListener('click', () => {
    messages.replaceChildren();
    addMessage(initialGreeting, 'bot');
    suggestions.hidden = false;
    input.value = '';
    updateComposer();
    input.focus();
  });
})();
