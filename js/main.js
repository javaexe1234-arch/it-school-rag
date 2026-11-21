/* =========================================================
   Логика публичного сайта
   ========================================================= */
(function () {
  let data = Store.get();
  let dirCat = 'all';
  let newsType = 'all';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const L = () => Lang.current;

  /* ---------- Вспомогательные ---------- */
  const getPath = (obj, path) => path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
  const initials = name => String(name).split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
  const fmtNum = (v) => {
    const isInt = Number.isInteger(v);
    return isInt ? Number(v).toLocaleString('ru-RU').replace(/,/g, ' ') : String(v);
  };
  const fmtDate = (iso) => {
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return `${d.getDate()} ${Lang.t('months')[d.getMonth()]} ${d.getFullYear()}`;
  };
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

  function youtubeId(url) {
    const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
    return m ? m[1] : null;
  }

  /* ---------- Статические переводы ---------- */
  function applyI18n() {
    document.documentElement.lang = L();
    $$('[data-i18n]').forEach(el => { el.textContent = Lang.t(el.dataset.i18n); });
    $$('[data-i18n-ph]').forEach(el => { el.placeholder = Lang.t(el.dataset.i18nPh); });
    $$('[data-bind]').forEach(el => { el.textContent = getPath(data, el.dataset.bind) || ''; });
    $$('[data-bind-i18n]').forEach(el => { el.textContent = tr(getPath(data, el.dataset.bindI18n), L()); });
    $$('.lang__btn').forEach(b => b.classList.toggle('active', b.dataset.lang === L()));
    document.title = `${data.school.name} — ${tr(data.school.tagline, L())}`;
  }

  /* ---------- Hero ---------- */
  function renderHero() {
    const box = $('#heroMedia');
    const s = data.school;
    let media = '';
    if (s.heroType === 'video' && s.heroUrl) {
      const yt = youtubeId(s.heroUrl);
      media = yt
        ? `<iframe src="https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&mute=1&loop=1&playlist=${yt}&controls=0" allow="autoplay; encrypted-media" title="video"></iframe>`
        : `<video src="${escapeHtml(s.heroUrl)}" autoplay muted loop playsinline></video>`;
    } else if (s.heroUrl) {
      media = `<img src="${escapeHtml(s.heroUrl)}" alt="${escapeHtml(s.name)}" onerror="this.outerHTML='<div class=\\'hero__media-fallback\\'>👩‍💻</div>'">`;
    } else {
      media = `<div class="hero__media-fallback">👩‍💻</div>`;
    }
    const st = data.stats[0];
    const float = st ? `<div class="hero__float"><span style="font-size:24px">${escapeHtml(st.icon)}</span><div><b>${fmtNum(st.value)}${escapeHtml(st.suffix)}</b><br>${escapeHtml(tr(st.label, L()))}</div></div>` : '';
    box.innerHTML = media + float;
  }

  /* ---------- Статистика ---------- */
  function renderStats() {
    $('#statsGrid').innerHTML = data.stats.map(s => `
      <div class="stat reveal">
        <div class="stat__icon">${escapeHtml(s.icon)}</div>
        <div>
          <div class="stat__value" data-count="${Number(s.value) || 0}" data-suffix="${escapeHtml(s.suffix)}">0${escapeHtml(s.suffix)}</div>
          <div class="stat__label">${escapeHtml(tr(s.label, L()))}</div>
        </div>
      </div>`).join('');
    observeCounters();
  }

  function animateCounter(el) {
    const target = parseFloat(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const decimals = Number.isInteger(target) ? 0 : 1;
    const dur = 1400;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = target * eased;
      el.textContent = (decimals ? val.toFixed(decimals) : fmtNum(Math.round(val))) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function observeCounters() {
    const els = $$('[data-count]');
    if (!('IntersectionObserver' in window)) { els.forEach(animateCounter); return; }
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { animateCounter(e.target); io.unobserve(e.target); } });
    }, { threshold: .4 });
    els.forEach(el => io.observe(el));
  }

  /* ---------- Направления ---------- */
  function renderDirections() {
    const list = data.directions.filter(d => dirCat === 'all' || d.category === dirCat);
    $('#dirGrid').innerHTML = list.length ? list.map(d => `
      <article class="card reveal" style="--accent:${escapeHtml(d.color || '#4f6bff')}">
        <div class="card__icon">${escapeHtml(d.icon)}</div>
        <h3 class="card__title">${escapeHtml(tr(d.title, L()))}</h3>
        <p class="card__text">${escapeHtml(tr(d.short, L()))}</p>
        <div class="tags">${(d.skills || []).slice(0, 4).map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('')}</div>
        <div class="card__meta">
          <span>⏱ <b>${escapeHtml(d.months)}</b> ${Lang.t('dir.months')}</span>
          <span><b>${escapeHtml(d.price)}</b> ${Lang.t('dir.currency')}</span>
        </div>
        <button class="btn btn--ghost btn--sm card__btn" data-dir="${escapeHtml(d.id)}">${Lang.t('dir.more')} →</button>
      </article>`).join('') : `<p class="empty">—</p>`;

    // Select в форме
    const sel = $('#formDirection');
    const prev = sel.value;
    sel.innerHTML = `<option value="">${Lang.t('form.anyDirection')}</option>` +
      data.directions.map(d => `<option value="${escapeHtml(d.id)}">${escapeHtml(tr(d.title, L()))}</option>`).join('');
    sel.value = prev;
    updateGroups(); // подписи групп — на текущем языке
  }

  function openDirection(id) {
    const d = data.directions.find(x => x.id === id);
    if (!d) return;
    const teachers = data.teachers.filter(t => t.directionId === id || t.directionId2 === id);
    $('#dirModalBody').innerHTML = `
      <div class="dir-modal" style="--accent:${escapeHtml(d.color)}">
        <div class="dir-modal__head">
          <div class="card__icon" style="--accent:${escapeHtml(d.color)}">${escapeHtml(d.icon)}</div>
          <h3>${escapeHtml(tr(d.title, L()))}</h3>
        </div>
        <p>${escapeHtml(tr(d.details, L()) || tr(d.short, L()))}</p>
        <div class="dir-modal__info">
          <div>${Lang.t('dir.duration')}<b>${escapeHtml(d.months)} ${Lang.t('dir.months')}</b></div>
          <div>${Lang.t('dir.price')}<b>${escapeHtml(d.price)} ${Lang.t('dir.currency')}</b></div>
          <div>${Lang.t('dir.format')}<b>${Lang.t('dir.formatVal')}</b></div>
        </div>
        ${d.priceTotal ? `<p class="dir-modal__price">
          ${Lang.t('dir.total')}: <b>${escapeHtml(d.priceTotal)} ${Lang.t('dir.currency')}</b>
          ${d.pricePrepay ? ` · ${Lang.t('dir.prepay')}: <b>${escapeHtml(d.pricePrepay)} ${Lang.t('dir.currency')}</b>` : ''}
          ${d.installment ? ` · ${Lang.t('dir.installment')}` : ''}</p>` : ''}
        <h4>${Lang.t('dir.skills')}</h4>
        <div class="tags">${(d.skills || []).map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('')}</div>
        ${teachers.length ? `<h4>${Lang.t('dir.teachers')}</h4><div class="mini-teachers">${teachers.map(t => `
          <div class="mini-teacher">${t.photo ? `<img src="${escapeHtml(t.photo)}" alt="">` : `<span class="ava">${escapeHtml(initials(tr(t.name, L())))}</span>`}${escapeHtml(tr(t.name, L()))}</div>`).join('')}</div>` : ''}
        <button class="btn btn--primary btn--block" style="margin-top:24px" data-enroll="${escapeHtml(d.id)}">${Lang.t('dir.enroll')}</button>
      </div>`;
    openModal();
  }

  function openModal() { $('#dirModal').classList.add('open'); $('#dirModal').setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; }
  function closeModal() { $('#dirModal').classList.remove('open'); $('#dirModal').setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; }

  /* ---------- Учителя ---------- */
  function renderTeachers() {
    $('#teachersGrid').innerHTML = data.teachers.map(t => {
      const dirs = [t.directionId, t.directionId2].filter(Boolean)
        .map(id => data.directions.find(d => d.id === id)).filter(Boolean);
      const name = tr(t.name, L());
      return `
      <article class="teacher reveal">
        <div class="teacher__photo">
          <span class="teacher__initials">${escapeHtml(initials(name))}</span>
          ${t.photo ? `<img src="${escapeHtml(t.photo)}" alt="${escapeHtml(name)}" loading="lazy" onerror="this.remove()" style="position:relative">` : ''}
        </div>
        <div class="teacher__body">
          <h3 class="teacher__name">${escapeHtml(name)}</h3>
          <div class="teacher__role">${escapeHtml(tr(t.role, L()))}</div>
          <p class="teacher__bio">${escapeHtml(tr(t.bio, L()))}</p>
          <div class="teacher__meta">
            ${t.experience ? `<span class="tag">${escapeHtml(t.experience)} ${Lang.t('teach.exp')}</span>` : ''}
            ${t.company ? `<span class="tag">🏢 ${escapeHtml(t.company)}</span>` : ''}
            ${dirs.map(dir => `<span class="tag">${escapeHtml(dir.icon)} ${escapeHtml(tr(dir.title, L()))}</span>`).join('')}
          </div>
        </div>
      </article>`;
    }).join('');
  }

  /* ---------- Новости и мероприятия ---------- */
  function renderNews() {
    const now = today();
    const list = data.news
      .filter(n => newsType === 'all' || n.type === newsType)
      .slice()
      .sort((a, b) => {
        // Сначала будущие мероприятия (ближайшие первыми), затем остальное по дате (новые первыми)
        const da = new Date(a.date), db = new Date(b.date);
        const fa = a.type === 'event' && da >= now, fb = b.type === 'event' && db >= now;
        if (fa !== fb) return fa ? -1 : 1;
        return fa ? da - db : db - da;
      });

    $('#newsGrid').innerHTML = list.length ? list.map(n => {
      const d = new Date(n.date + 'T00:00:00');
      const isEvent = n.type === 'event';
      const upcoming = isEvent && d >= now;
      return `
      <article class="post reveal">
        <div class="post__img">
          ${n.image ? `<img src="${escapeHtml(n.image)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
          <span class="post__type ${isEvent ? 'post__type--event' : ''}">${Lang.t(isEvent ? 'news.event' : 'news.newsOne')}</span>
          ${isEvent && !isNaN(d) ? `<div class="post__date-box"><b>${d.getDate()}</b><span>${Lang.t('months')[d.getMonth()]}</span></div>` : ''}
        </div>
        <div class="post__body">
          <span class="post__date">📅 ${fmtDate(n.date)} ${isEvent ? (upcoming ? `<span class="post__soon">${Lang.t('news.soon')}</span>` : `<span class="post__past">· ${Lang.t('news.past')}</span>`) : ''}</span>
          <h3 class="post__title">${escapeHtml(tr(n.title, L()))}</h3>
          <p class="post__text">${escapeHtml(tr(n.text, L()))}</p>
        </div>
      </article>`;
    }).join('') : `<p class="empty">${Lang.t('news.empty')}</p>`;
  }

  /* ---------- Контакты ---------- */
  function renderContacts() {
    const s = data.school;
    const phone = $('#cPhone'); phone.textContent = s.phone; phone.href = 'tel:' + String(s.phone).replace(/[^\d+]/g, '');
    const email = $('#cEmail'); email.textContent = s.email; email.href = 'mailto:' + s.email;
    $('#cTelegram').href = s.telegram || '#';
    $('#cInstagram').href = s.instagram || '#';
    const mapSrc = 'https://maps.google.com/maps?q=' + encodeURIComponent(s.mapQuery || 'Tashkent') + '&z=15&output=embed&hl=' + L();
    if ($('#cMap').src !== mapSrc) $('#cMap').src = mapSrc;
  }

  /* ---------- Форма обратной связи ---------- */
  function initForm() {
    const form = $('#feedbackForm');
    const status = $('#formStatus');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(form);
      const name = String(fd.get('name') || '').trim();
      const phone = String(fd.get('phone') || '').trim();
      const email = String(fd.get('email') || '').trim();
      const agree = form.agree.checked;
      const phoneOk = phone.replace(/\D/g, '').length >= 9;
      const emailOk = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      form.name.closest('.field').classList.toggle('invalid', name.length < 2);
      form.phone.closest('.field').classList.toggle('invalid', !phoneOk);
      form.email.closest('.field').classList.toggle('invalid', !emailOk);
      form.agree.closest('.check').classList.toggle('invalid', !agree);

      if (name.length < 2 || !phoneOk || !emailOk || !agree) {
        status.className = 'form__status err';
        status.textContent = Lang.t('form.err');
        return;
      }
      const dirId = fd.get('direction');
      const dir = data.directions.find(d => d.id === dirId);
      const groupCode = String(fd.get('groupCode') || '');
      const group = slots.find(g => g.code === groupCode);
      const message = String(fd.get('message') || '').trim();
      // Копия заявки — в «Заявки» админ-панели (как раньше)
      Store.addMessage({
        name, phone, email,
        directionId: dirId || '',
        directionTitle: group ? `${group.course} — ${group.schedule}` : (dir ? tr(dir.title, 'ru') : ''),
        message, lang: L()
      });

      const done = (cls, text) => {
        status.className = 'form__status ' + cls;
        status.textContent = text;
        setTimeout(() => { status.textContent = ''; }, 8000);
      };
      if (location.protocol === 'file:') { form.reset(); updateGroups(); return done('ok', Lang.t('form.ok')); }

      // Запись в таблицу «Преподаватели и расписание» → лист «Записи»
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      fetch('/api/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, groupCode, course: dir ? tr(dir.title, 'ru') : '', trial: form.trial.checked, message })
      })
        .then(r => r.json().then(j => ({ status: r.status, j })))
        .then(({ status: code, j }) => {
          if (j.ok) {
            form.reset(); updateGroups(); loadSlots();
            const g = j.group;
            return done('ok', j.duplicate ? Lang.t('form.duplicate')
              : g ? `${Lang.t('form.enrolled')} ${g.course}${g.group ? ' (' + g.group + ')' : ''}, ${g.schedule}. ${Lang.t('form.callback')}`
                : Lang.t('form.ok'));
          }
          if (j.error === 'no_seats') { loadSlots(); return done('err', Lang.t('form.noSeats')); }
          if (code === 429) return done('err', Lang.t('chat.rate'));
          done('err', j.message || Lang.t('form.err'));
        })
        .catch(() => done('ok', Lang.t('form.ok'))) // сервер недоступен — заявка сохранена в админке
        .finally(() => { btn.disabled = false; });
    });

    $('#formDirection').addEventListener('change', updateGroups);
    loadSlots();
  }

  /* ---------- Группы со свободными местами для формы ---------- */
  let slots = [];
  function loadSlots() {
    if (location.protocol === 'file:') return;
    fetch('/api/slots', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (j && Array.isArray(j.groups)) { slots = j.groups; updateGroups(); } })
      .catch(() => {});
  }

  function updateGroups() {
    const dirId = $('#formDirection').value;
    const sel = $('#formGroup');
    const list = dirId ? slots.filter(g => RagSync.courseToDirection(g.course.replace(/\([^)]*\)/g, ' '), data.directions) === dirId) : [];
    $('#formGroupField').hidden = !list.length;
    $('#formTrialField').hidden = !dirId;
    const prev = sel.value;
    sel.innerHTML = `<option value="">${Lang.t('form.anyGroup')}</option>` + list.map(g => {
      const label = `${g.schedule}${g.group ? ' · ' + g.group : ''} · ${g.teacher} — ${g.free > 0 ? Lang.t('form.free') + ': ' + g.free : Lang.t('form.full')}`;
      return `<option value="${escapeHtml(g.code)}" ${g.free > 0 ? '' : 'disabled'}>${escapeHtml(label)}</option>`;
    }).join('');
    if (list.some(g => g.code === prev && g.free > 0)) sel.value = prev;
  }

  /* ---------- Reveal-анимации ---------- */
  let revealIO = null;
  function observeReveal() {
    const els = $$('.reveal:not(.visible)');
    if (!('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('visible')); return; }
    if (!revealIO) {
      revealIO = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); revealIO.unobserve(e.target); } });
      }, { threshold: .12 });
    }
    els.forEach((el, i) => { el.style.transitionDelay = (i % 4) * 70 + 'ms'; revealIO.observe(el); });
  }

  /* ---------- Общий рендер ---------- */
  function renderAll() {
    applyI18n();
    renderHero();
    renderStats();
    renderDirections();
    renderTeachers();
    renderNews();
    renderContacts();
    observeReveal();
  }

  /* ---------- События ---------- */
  function initEvents() {
    // Язык
    $$('.lang__btn').forEach(b => b.addEventListener('click', () => { Lang.set(b.dataset.lang); renderAll(); }));
    // Тема
    $('#themeToggle').addEventListener('click', Theme.toggle);
    // Бургер
    const burger = $('#burger'), nav = $('#nav');
    burger.addEventListener('click', () => { burger.classList.toggle('open'); nav.classList.toggle('open'); });
    $$('#nav a').forEach(a => a.addEventListener('click', () => { burger.classList.remove('open'); nav.classList.remove('open'); }));

    // Фильтры направлений
    $('#dirFilters').addEventListener('click', e => {
      const b = e.target.closest('.chip'); if (!b) return;
      dirCat = b.dataset.cat;
      $$('#dirFilters .chip').forEach(c => c.classList.toggle('active', c === b));
      renderDirections(); observeReveal();
    });
    // Фильтры новостей
    $('#newsFilters').addEventListener('click', e => {
      const b = e.target.closest('.chip'); if (!b) return;
      newsType = b.dataset.type;
      $$('#newsFilters .chip').forEach(c => c.classList.toggle('active', c === b));
      renderNews(); observeReveal();
    });

    // Карточка направления → модалка
    $('#dirGrid').addEventListener('click', e => {
      const b = e.target.closest('[data-dir]'); if (b) openDirection(b.dataset.dir);
    });
    // Модалка
    $('#dirModal').addEventListener('click', e => {
      if (e.target.closest('[data-close]')) closeModal();
      const en = e.target.closest('[data-enroll]');
      if (en) {
        closeModal();
        $('#formDirection').value = en.dataset.enroll;
        updateGroups(); // сразу показать группы выбранного курса
        document.getElementById('contacts').scrollIntoView();
        setTimeout(() => $('#feedbackForm [name=name]').focus({ preventScroll: true }), 500);
      }
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

    // Скролл: шапка, кнопка наверх, активный пункт меню
    const header = $('#header'), toTop = $('#toTop');
    const sections = $$('main section[id]');
    const onScroll = () => {
      const y = window.scrollY;
      header.classList.toggle('scrolled', y > 10);
      toTop.classList.toggle('show', y > 600);
      let current = '';
      sections.forEach(s => { if (y + 120 >= s.offsetTop) current = s.id; });
      $$('#nav a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + current));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    toTop.addEventListener('click', () => window.scrollTo({ top: 0 }));

    // Синхронизация с админкой, открытой в другой вкладке
    window.addEventListener('storage', e => {
      if (e.key === STORAGE_KEY) { data = Store.get(); renderAll(); }
      if (e.key === Theme.KEY && e.newValue) document.documentElement.setAttribute('data-theme', e.newValue);
    });
  }

  $('#year').textContent = new Date().getFullYear();
  renderAll();
  initEvents();
  initForm();

  /* Учителя из базы знаний (таблица «Преподаватели и расписание»): правка появляется на сайте
     при загрузке, при возврате на вкладку и раз в 20 секунд */
  let syncing = false;
  const syncRag = () => {
    if (syncing || document.hidden) return;
    syncing = true;
    // Учителя — из таблицы преподавателей, цены и сроки курсов — из прайс-листа
    Promise.all([RagSync.sync(data), RagSync.syncPrices(data)])
      .then(([teachersChanged, pricesChanged]) => {
        if (teachersChanged || pricesChanged) { renderTeachers(); renderDirections(); observeReveal(); }
      })
      .finally(() => { syncing = false; });
  };
  syncRag();
  window.addEventListener('focus', syncRag);
  document.addEventListener('visibilitychange', syncRag);
  setInterval(syncRag, 20000);
})();
