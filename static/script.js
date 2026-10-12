(() => {
  const form = document.querySelector('#chat-form');
  const input = document.querySelector('#message-input');
  const messages = document.querySelector('#chat-messages');
  const typing = document.querySelector('#typing-indicator');
  const sendButton = document.querySelector('#send-button');
  const count = document.querySelector('#character-count');
  const suggestions = document.querySelector('#suggestions');
  const clearButton = document.querySelector('#clear-chat');
  const faqList = document.querySelector('#faq-list');
  const faqStatus = document.querySelector('#faq-status');
  const faqCount = document.querySelector('#faq-count');
  const faqSearch = document.querySelector('#faq-search');
  const faqCategories = document.querySelector('#faq-categories');
  const faqMore = document.querySelector('#faq-more');
  const guidePanel = document.querySelector('#guide-panel');
  const feedbackSummary = document.querySelector('#feedback-summary');
  const themeToggle = document.querySelector('#theme-toggle');
  const themeToggleIcon = document.querySelector('#theme-toggle-icon');
  const themeToggleLabel = document.querySelector('#theme-toggle-label');

  const initialGreeting = "Hi! I’m BankAssist. Ask me a general banking question and I’ll help you find a next step.";
  const visibleFaqLimit = 8;
  let busy = false;
  let faqs = [];
  let selectedCategory = 'All';
  let showAllFaqs = false;
  const feedbackCounts = { helpful: 0, notHelpful: 0 };

  function applyTheme(isDark, saveChoice = true) {
    const theme = isDark ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    themeToggle.setAttribute('aria-pressed', String(isDark));
    themeToggle.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} mode`);
    themeToggle.title = `Switch to ${isDark ? 'light' : 'dark'} mode`;
    themeToggleIcon.textContent = isDark ? '☀' : '☾';
    themeToggleLabel.textContent = isDark ? 'Light mode' : 'Dark mode';

    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = isDark ? '#0c1726' : '#0d2850';
    if (saveChoice) {
      try {
        localStorage.setItem('bankassist-theme', theme);
      } catch (_error) {
        // Theme still works for this page view if browser storage is disabled.
      }
    }
  }

  let savedTheme = null;
  try {
    savedTheme = localStorage.getItem('bankassist-theme');
  } catch (_error) {
    // Use the default light theme when browser storage is unavailable.
  }
  applyTheme(savedTheme === 'dark', false);
  themeToggle.addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme !== 'dark');
  });

  const guideContent = {
    'lost-card': {
      title: 'If your card is lost or stolen',
      steps: [
        'Freeze or block the card immediately using your bank’s official app, website, or verified support number. If you cannot sign in, call the number printed on another bank document or card.',
        'Check recent transactions in an official bank channel. Report any transaction you do not recognize and ask the bank to secure the affected card.',
        'Ask the bank how to request a replacement card and whether any linked digital payment settings need attention.',
        'Keep the time you noticed the loss and the bank complaint reference for your own records.'
      ],
      note: 'Never share a PIN, OTP, CVV, password, or full card number with this chatbot or with someone who contacts you unexpectedly.'
    },
    'upi-issue': {
      title: 'If a UPI payment failed or is pending',
      steps: [
        'Open the transaction in your bank or UPI app and check its current status before trying again.',
        'If the payment is pending or the account was debited, save the transaction reference, date, and amount for your own records.',
        'Use the app’s “Help” or “Report issue” option for that transaction, if available. Contact your bank or payment provider through its official support channel if it remains unresolved.',
        'Avoid repeating a payment until you have checked its status, to reduce the chance of paying twice.'
      ],
      note: 'Share transaction details only with your bank or UPI provider through an official channel. Never disclose your UPI PIN or OTP.',
      sources: [{ label: 'NPCI UPI FAQs', url: 'https://www.npci.org.in/what-we-do/upi/faqs' }]
    },
    'suspected-scam': {
      title: 'If you suspect a banking scam',
      steps: [
        'Stop responding. Do not click links, install apps, scan payment QR codes, or follow instructions from the caller or message.',
        'Contact your bank using its official app, website, or verified phone number. Tell the bank if you clicked a link or shared any information so it can help secure the affected service.',
        'Save the message, phone number, or other evidence for your records. Report the incident through the appropriate official fraud-reporting channel in your area.',
        'Ignore anyone asking for a fee to recover money or promising a guaranteed refund.'
      ],
      note: 'Never share an OTP, PIN, password, CVV, or screen-sharing / remote-access permissions.'
    },
    'unauthorized-transaction': {
      title: 'If you see a transaction you did not make',
      steps: [
        'Contact your bank immediately through its official app, website, or verified phone number. Ask it to report the transaction and secure the affected card or digital banking access.',
        'Use the bank’s official dispute or fraud-reporting process. Save the complaint or acknowledgement number.',
        'Check recent account activity for any other transactions you do not recognize and report them through the same official channel.',
        'Follow the bank’s instructions to reset access details using a trusted device, if the bank advises it.'
      ],
      note: 'Report it promptly. Do not post account or transaction details here; never share your OTP, PIN, or password.',
      sources: [{ label: 'RBI guidance on unauthorised electronic transactions', url: 'https://www.rbi.org.in/commonman/English/scripts/Notification.aspx?Id=2623' }]
    },
    'atm-cash': {
      title: 'If an ATM debited your account but gave no cash',
      steps: [
        'Check your bank app or transaction alert to confirm whether the account was debited. Do not repeat the withdrawal until you have checked.',
        'Note the date, time, ATM location or ID, amount, and transaction reference. Keep the receipt if one was printed.',
        'Report the failed withdrawal to the card-issuing bank through its official app, website, or verified support number. Follow the bank’s complaint process.',
        'Keep the complaint reference and check the transaction status through the bank’s official channel.'
      ],
      note: 'RBI advises customers to lodge a complaint with the card-issuing bank for a failed ATM transaction. Keep transaction details private in this chatbot.',
      sources: [{ label: 'RBI FAQ on failed ATM transactions', url: 'https://www.rbi.org.in/scripts/FS_FAQs.aspx?Id=75' }]
    },
    'lost-phone': {
      title: 'If your phone with banking apps is lost',
      steps: [
        'Contact your mobile provider through an official channel to suspend the SIM, especially if it can receive banking alerts or verification messages.',
        'Contact your bank through its official website, verified number, or branch. Ask how to temporarily secure mobile banking, UPI, and cards linked to the phone.',
        'From a trusted device, review recent account activity with the bank and report anything you do not recognize.',
        'Restore access only by following the bank’s official recovery steps. Update passwords from a trusted device if the bank recommends it.'
      ],
      note: 'Never tell anyone an OTP or PIN, and do not grant remote access to a device to “recover” your account.'
    }
  };

  function timeLabel() {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date());
  }

  function updateFeedbackSummary() {
    feedbackSummary.hidden = false;
    feedbackSummary.textContent = `Session ratings · Helpful: ${feedbackCounts.helpful} · Not helpful: ${feedbackCounts.notHelpful}. Ratings stay in this page session only.`;
  }

  function addFeedback(content) {
    const feedback = document.createElement('div');
    feedback.className = 'answer-feedback';
    const prompt = document.createElement('span');
    prompt.className = 'feedback-prompt';
    prompt.textContent = 'Was this answer helpful?';
    const note = document.createElement('span');
    note.className = 'feedback-note';

    const helpful = document.createElement('button');
    helpful.type = 'button';
    helpful.className = 'feedback-button';
    helpful.dataset.rating = 'helpful';
    helpful.textContent = '👍 Helpful';
    helpful.setAttribute('aria-pressed', 'false');

    const notHelpful = document.createElement('button');
    notHelpful.type = 'button';
    notHelpful.className = 'feedback-button';
    notHelpful.dataset.rating = 'notHelpful';
    notHelpful.textContent = '👎 Not helpful';
    notHelpful.setAttribute('aria-pressed', 'false');

    feedback.append(prompt, helpful, notHelpful, note);
    feedback.querySelectorAll('.feedback-button').forEach((button) => {
      button.addEventListener('click', () => {
        const rating = button.dataset.rating;
        feedbackCounts[rating] += 1;
        feedback.querySelectorAll('.feedback-button').forEach((choice) => {
          choice.disabled = true;
          choice.setAttribute('aria-pressed', String(choice === button));
        });
        note.textContent = 'Thanks. This rating is not sent with your question.';
        updateFeedbackSummary();
      });
    });
    content.append(feedback);
  }

  function addRelatedQuestions(content, currentTag) {
    if (currentTag === 'greeting' || currentTag === 'goodbye') return;
    const currentFaq = faqs.find((faq) => faq.tag === currentTag);
    if (!currentFaq) return;

    const categoryFaqs = faqs.filter((faq) => faq.category === currentFaq.category);
    if (categoryFaqs.length < 2) return;
    const currentIndex = categoryFaqs.findIndex((faq) => faq.tag === currentTag);
    const related = Array.from({ length: categoryFaqs.length - 1 }, (_, offset) =>
      categoryFaqs[(currentIndex + offset + 1) % categoryFaqs.length]
    ).slice(0, 3);
    if (!related.length) return;

    const group = document.createElement('div');
    group.className = 'related-questions';
    const label = document.createElement('span');
    label.className = 'related-label';
    label.textContent = 'Related questions';
    const list = document.createElement('div');
    list.className = 'related-list';
    related.forEach((faq) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'related-chip';
      button.textContent = faq.question;
      button.addEventListener('click', () => sendMessage(faq.question));
      list.append(button);
    });
    group.append(label, list);
    content.append(group);
  }

  function addMessage(text, kind, variant = '', withFeedback = true, intentTag = '') {
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
    if (kind === 'bot' && variant !== 'error' && withFeedback) addFeedback(content);
    if (kind === 'bot' && !variant && intentTag) addRelatedQuestions(content, intentTag);
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
        addMessage(result.reply || 'I could not prepare a response. Please try again.', 'bot', result.fallback ? 'fallback' : '', true, result.fallback ? '' : result.intent);
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

  function matchingFaqs() {
    const query = faqSearch.value.trim().toLowerCase();
    return faqs.filter((faq) => {
      const inCategory = selectedCategory === 'All' || faq.category === selectedCategory;
      const inSearch = !query || `${faq.question} ${faq.category} ${faq.answer}`.toLowerCase().includes(query);
      return inCategory && inSearch;
    });
  }

  function renderFaqs() {
    const matched = matchingFaqs();
    const shown = showAllFaqs ? matched : matched.slice(0, visibleFaqLimit);
    faqList.replaceChildren();
    faqCount.textContent = `${matched.length} ${matched.length === 1 ? 'topic' : 'topics'}`;
    faqStatus.hidden = matched.length > 0;
    faqStatus.textContent = faqs.length ? 'No questions match that search. Try another word or category.' : 'Questions could not be loaded. You can still ask the chatbot below.';

    shown.forEach((faq) => {
      const card = document.createElement('button');
      card.className = 'faq-card';
      card.type = 'button';
      const category = document.createElement('span');
      category.className = 'faq-card-category';
      category.textContent = faq.category;
      const question = document.createElement('strong');
      question.className = 'faq-card-question';
      question.textContent = faq.question;
      const action = document.createElement('span');
      action.className = 'faq-card-action';
      action.textContent = 'Ask assistant →';
      card.append(category, question, action);
      card.addEventListener('click', () => {
        window.location.hash = '#chat';
        sendMessage(faq.question);
      });
      faqList.append(card);
    });

    faqMore.hidden = matched.length <= visibleFaqLimit;
    faqMore.textContent = showAllFaqs ? 'Show fewer questions' : 'Show more questions';
  }

  function renderCategoryFilters() {
    const categories = ['All', ...new Set(faqs.map((faq) => faq.category))];
    faqCategories.replaceChildren();
    categories.forEach((category) => {
      const button = document.createElement('button');
      button.className = `faq-filter${category === selectedCategory ? ' is-active' : ''}`;
      button.type = 'button';
      button.textContent = category;
      button.setAttribute('aria-pressed', String(category === selectedCategory));
      button.addEventListener('click', () => {
        selectedCategory = category;
        showAllFaqs = false;
        renderCategoryFilters();
        renderFaqs();
      });
      faqCategories.append(button);
    });
  }

  async function loadFaqs() {
    try {
      const response = await fetch('/api/faqs');
      if (!response.ok) throw new Error('FAQ request failed');
      const result = await response.json();
      faqs = Array.isArray(result.faqs) ? result.faqs : [];
      renderCategoryFilters();
      renderFaqs();
    } catch (_error) {
      faqCount.textContent = '';
      faqStatus.hidden = false;
      faqStatus.textContent = 'Questions could not be loaded. You can still ask the chatbot below.';
    }
  }

  function showGuide(button) {
    const guideId = button.dataset.guide;
    const guide = guideContent[guideId];
    const wasOpen = button.getAttribute('aria-expanded') === 'true';
    document.querySelectorAll('.guide-card').forEach((card) => card.setAttribute('aria-expanded', 'false'));
    guidePanel.replaceChildren();
    if (wasOpen || !guide) {
      guidePanel.hidden = true;
      return;
    }

    button.setAttribute('aria-expanded', 'true');
    const heading = document.createElement('h3');
    heading.textContent = guide.title;
    const list = document.createElement('ol');
    guide.steps.forEach((step) => {
      const item = document.createElement('li');
      item.textContent = step;
      list.append(item);
    });
    guidePanel.append(heading, list);
    if (guide.note) {
      const note = document.createElement('p');
      note.className = 'guide-safety-note';
      note.textContent = guide.note;
      guidePanel.append(note);
    }
    if (guide.sources?.length) {
      const sources = document.createElement('div');
      sources.className = 'guide-sources';
      const sourceLabel = document.createElement('span');
      sourceLabel.textContent = 'Official guidance: ';
      sources.append(sourceLabel);
      guide.sources.forEach((source, index) => {
        if (index) sources.append(document.createTextNode(' · '));
        const link = document.createElement('a');
        link.href = source.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = source.label;
        sources.append(link);
      });
      guidePanel.append(sources);
    }
    guidePanel.hidden = false;
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
  document.querySelectorAll('.guide-card').forEach((button) => {
    button.addEventListener('click', () => showGuide(button));
  });

  faqSearch.addEventListener('input', () => {
    showAllFaqs = false;
    renderFaqs();
  });
  faqMore.addEventListener('click', () => {
    showAllFaqs = !showAllFaqs;
    renderFaqs();
  });

  clearButton.addEventListener('click', () => {
    messages.replaceChildren();
    addMessage(initialGreeting, 'bot', '', false);
    suggestions.hidden = false;
    input.value = '';
    updateComposer();
    input.focus();
  });

  loadFaqs();
})();
