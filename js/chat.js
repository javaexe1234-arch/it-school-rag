/* =========================================================
   Чат-виджет RAG-ассистента (запросы идут на /api/chat)
   ========================================================= */
(function () {
  const $ = s => document.querySelector(s);
  const fab = $('#chatFab'), box = $('#chat'), body = $('#chatBody'), form = $('#chatForm'),
        input = $('#chatInput'), suggest = $('#chatSuggest'), sendBtn = form.querySelector('.chat__send');
  const HISTORY_KEY = 'itschool_chat_v1';
  let history = [];   // [{role:'user'|'model', text, sources?}]
  let busy = false;

  try { history = JSON.parse(sessionStorage.getItem(HISTORY_KEY)) || []; } catch (e) { history = []; }
  const persist = () => { try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-30))); } catch (e) {} };

  /* Безопасный мини-markdown: **жирный**, списки, переносы, ссылки tel/http */
  function md(text) {
    const esc = escapeHtml(text);
    const inline = s => s
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/(^|[\s(])(\+998[\d\s-]{9,16}\d)/g, (m, p, tel) => `${p}<a href="tel:${tel.replace(/[^\d+]/g, '')}">${tel}</a>`)
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    const out = []; let list = null;
    esc.split(/\n/).forEach(line => {
      const m = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)/);
      if (m) { if (!list) { list = []; } list.push(`<li>${inline(m[1])}</li>`); return; }
      if (list) { out.push(`<ul>${list.join('')}</ul>`); list = null; }
      if (line.trim()) out.push(`<p>${inline(line)}</p>`);
    });
    if (list) out.push(`<ul>${list.join('')}</ul>`);
    return out.join('');
  }

  function bubble(role, html, extraClass = '') {
    const el = document.createElement('div');
    el.className = `msg msg--${role === 'user' ? 'user' : 'bot'} ${extraClass}`;
    el.innerHTML = html;
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    return el;
  }

  function sourcesHtml(sources) {
    if (!sources || !sources.length) return '';
    return `<div class="msg__sources">📄 ${Lang.t('chat.sources')}: ${sources.map(s =>
      escapeHtml(s.section) + (s.relevance != null ? ` <b>${Number(s.relevance)}%</b>` : '')).join(' · ')}</div>`;
  }

  function render() {
    body.innerHTML = '';
    bubble('model', md(Lang.t('chat.greeting')));
    history.forEach(h => bubble(h.role, h.role === 'user' ? escapeHtml(h.text) : md(h.text) + sourcesHtml(h.sources)));
    renderSuggest();
  }

  function renderSuggest() {
    const list = history.length ? [] : (Lang.t('chat.s') || []);
    suggest.innerHTML = list.map(q => `<button type="button">${escapeHtml(q)}</button>`).join('');
  }

  async function send(text) {
    text = text.trim();
    if (!text || busy) return;
    busy = true; sendBtn.disabled = true;
    const prev = history.slice(-6).map(h => ({ role: h.role, text: h.text }));
    history.push({ role: 'user', text });
    bubble('user', escapeHtml(text));
    suggest.innerHTML = '';
    input.value = ''; autosize();
    const typing = bubble('model', '<span class="typing"><span></span><span></span><span></span></span>');

    try {
      if (location.protocol === 'file:') throw Object.assign(new Error('offline'), { code: 'offline' });
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: prev, lang: Lang.current })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(json.error || res.status), { code: res.status === 429 ? 'rate' : 'error' });
      typing.innerHTML = md(json.answer) + sourcesHtml(json.sources);
      history.push({ role: 'model', text: json.answer, sources: json.sources });
      persist();
    } catch (e) {
      history.pop(); // неудачный вопрос не сохраняем в историю
      typing.classList.add('msg--error');
      typing.textContent = Lang.t(e.code === 'rate' ? 'chat.rate' : e.code === 'offline' ? 'chat.offline' : 'chat.error');
    } finally {
      busy = false; sendBtn.disabled = false;
      body.scrollTop = body.scrollHeight;
      input.focus();
    }
  }

  function autosize() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 110) + 'px'; }

  function toggle(open) {
    open = open ?? !box.classList.contains('open');
    box.classList.toggle('open', open);
    fab.classList.toggle('open', open);
    fab.setAttribute('aria-expanded', open);
    box.setAttribute('aria-hidden', !open);
    if (open) { body.scrollTop = body.scrollHeight; setTimeout(() => input.focus(), 150); }
  }

  fab.addEventListener('click', () => toggle());
  form.addEventListener('submit', e => { e.preventDefault(); send(input.value); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input.value); } });
  input.addEventListener('input', autosize);
  suggest.addEventListener('click', e => { const b = e.target.closest('button'); if (b) send(b.textContent); });
  $('#chatClear').addEventListener('click', () => { history = []; persist(); render(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && box.classList.contains('open')) toggle(false); });
  // Смена языка — перерисовать приветствие и подсказки
  document.querySelectorAll('.lang__btn').forEach(b => b.addEventListener('click', () => {
    setTimeout(() => { render(); $('#chatClear').title = Lang.t('chat.clear'); }, 0);
  }));

  $('#chatClear').title = Lang.t('chat.clear');
  render();
})();
