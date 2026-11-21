/* =========================================================
   Админ-панель: управление контентом сайта
   Внимание: это клиентская демо-админка (данные в localStorage).
   Для реального сайта нужен сервер с авторизацией и базой данных.
   ========================================================= */
(function () {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const SESSION_KEY = 'itschool_admin_session';
  const LANGS = [['ru', 'RU'], ['uz', 'UZ'], ['en', 'EN']];
  let data = Store.get();
  let currentTab = 'dashboard';

  const CATEGORIES = [['dev', 'Разработка'], ['design', 'Дизайн'], ['data', 'Данные и ИИ'], ['infra', 'Инфраструктура']];

  /* ---------- Схемы коллекций ---------- */
  const SCHEMAS = {
    stats: {
      title: 'Статистика', single: 'показатель', prefix: 's',
      columns: [
        { label: '', render: i => `<span class="thumb">${escapeHtml(i.icon)}</span>` },
        { label: 'Значение', render: i => `<b>${escapeHtml(i.value)}${escapeHtml(i.suffix)}</b>` },
        { label: 'Подпись', render: i => escapeHtml(tr(i.label, 'ru')) }
      ],
      fields: [
        { key: 'icon', label: 'Иконка (эмодзи)', type: 'text', half: true },
        { key: 'value', label: 'Значение (число)', type: 'number', step: 'any', required: true, half: true },
        { key: 'suffix', label: 'Суффикс (+, %, x)', type: 'text', half: true },
        { key: 'label', label: 'Подпись', type: 'i18n', required: true }
      ]
    },
    directions: {
      title: 'Направления', single: 'направление', prefix: 'd',
      columns: [
        { label: '', render: i => `<span class="thumb" style="background:${escapeHtml(i.color)}22">${escapeHtml(i.icon)}</span>` },
        { label: 'Название', render: i => `<b>${escapeHtml(tr(i.title, 'ru'))}</b><br><small style="color:var(--text-muted)">${escapeHtml((CATEGORIES.find(c => c[0] === i.category) || [, ''])[1])}</small>` },
        { label: 'Срок', render: i => escapeHtml(i.months) + ' мес.' },
        { label: 'Цена', render: i => escapeHtml(i.price) + ' сум' }
      ],
      fields: [
        { key: 'icon', label: 'Иконка (эмодзи)', type: 'text', half: true },
        { key: 'color', label: 'Цвет акцента', type: 'color', half: true },
        { key: 'category', label: 'Категория', type: 'select', options: () => CATEGORIES, half: true },
        { key: 'months', label: 'Длительность (мес.)', type: 'number', half: true },
        { key: 'price', label: 'Стоимость в месяц (сум)', type: 'text', half: true },
        { key: 'title', label: 'Название', type: 'i18n', required: true },
        { key: 'short', label: 'Краткое описание', type: 'i18nArea' },
        { key: 'details', label: 'Подробное описание', type: 'i18nArea' },
        { key: 'skills', label: 'Навыки / технологии (через запятую)', type: 'tags' }
      ]
    },
    teachers: {
      title: 'Учителя', single: 'учителя', prefix: 't',
      columns: [
        { label: '', render: i => i.photo ? `<img class="thumb" src="${escapeHtml(i.photo)}" alt="">` : `<span class="thumb">👤</span>` },
        { label: 'Имя', render: i => `<b>${escapeHtml(tr(i.name, 'ru'))}</b><br><small style="color:var(--text-muted)">${escapeHtml(tr(i.role, 'ru'))}</small>` },
        { label: 'Направление', render: i => {
          const list = [i.directionId, i.directionId2].filter(Boolean).map(id => data.directions.find(x => x.id === id)).filter(Boolean);
          return list.length ? list.map(d => escapeHtml(d.icon + ' ' + tr(d.title, 'ru'))).join('<br>') : '—';
        } },
        { label: 'Опыт', render: i => escapeHtml(i.experience || '—') + ' лет' }
      ],
      fields: [
        { key: 'name', label: 'Имя и фамилия', type: 'i18n', required: true },
        { key: 'role', label: 'Должность / профессия', type: 'i18n', required: true },
        { key: 'directionId', label: 'Направление', type: 'select', options: () => [['', '— не выбрано —'], ...data.directions.map(d => [d.id, tr(d.title, 'ru')])], half: true },
        { key: 'directionId2', label: 'Второе направление (необязательно)', type: 'select', options: () => [['', '— нет —'], ...data.directions.map(d => [d.id, tr(d.title, 'ru')])], half: true },
        { key: 'experience', label: 'Опыт (лет)', type: 'number', half: true },
        { key: 'company', label: 'Компания', type: 'text', half: true },
        { key: 'photo', label: 'Фото (URL или загрузка файла)', type: 'image' },
        { key: 'bio', label: 'О преподавателе', type: 'i18nArea' }
      ]
    },
    news: {
      title: 'Новости и события', single: 'публикацию', prefix: 'n',
      sort: (a, b) => new Date(b.date) - new Date(a.date),
      columns: [
        { label: '', render: i => i.image ? `<img class="thumb" src="${escapeHtml(i.image)}" alt="">` : `<span class="thumb">📰</span>` },
        { label: 'Заголовок', render: i => `<b>${escapeHtml(tr(i.title, 'ru'))}</b>` },
        { label: 'Тип', render: i => i.type === 'event' ? '🎉 Мероприятие' : '📰 Новость' },
        { label: 'Дата', render: i => escapeHtml(i.date) }
      ],
      fields: [
        { key: 'type', label: 'Тип', type: 'select', options: () => [['news', 'Новость'], ['event', 'Мероприятие']], half: true },
        { key: 'date', label: 'Дата', type: 'date', required: true, half: true },
        { key: 'title', label: 'Заголовок', type: 'i18n', required: true },
        { key: 'text', label: 'Текст', type: 'i18nArea' },
        { key: 'image', label: 'Изображение (URL или загрузка файла)', type: 'image' }
      ]
    }
  };

  const SCHOOL_FIELDS = [
    { key: 'name', label: 'Название школы', type: 'text', required: true },
    { key: 'tagline', label: 'Слоган (над заголовком)', type: 'i18n' },
    { key: 'description', label: 'Краткое описание школы', type: 'i18nArea' },
    { key: 'heroType', label: 'Медиа в Hero-блоке', type: 'select', options: () => [['image', 'Фото'], ['video', 'Видео (mp4 или YouTube)']], half: true },
    { key: 'heroUrl', label: 'Ссылка на фото / видео (для фото можно загрузить файл)', type: 'image' },
    { key: 'phone', label: 'Телефон', type: 'text', half: true },
    { key: 'email', label: 'Email', type: 'text', half: true },
    { key: 'telegram', label: 'Telegram (ссылка)', type: 'text', half: true },
    { key: 'instagram', label: 'Instagram (ссылка)', type: 'text', half: true },
    { key: 'mapQuery', label: 'Адрес для карты', type: 'text' },
    { key: 'address', label: 'Адрес', type: 'i18n' },
    { key: 'hours', label: 'Режим работы', type: 'i18n' }
  ];

  /* ---------- Утилиты ---------- */
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200);
  }
  function save() { if (Store.save(data)) toast('✓ Изменения сохранены'); }

  /* Сжатие загружаемого изображения в dataURL (чтобы влезло в localStorage) */
  function fileToDataUrl(file, maxSize = 1000) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) return reject(new Error('Выберите файл изображения'));
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const k = Math.min(1, maxSize / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = () => reject(new Error('Не удалось прочитать изображение'));
        img.src = reader.result;
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  /* ---------- Рендер полей формы ---------- */
  /* Учителя из RAG: эти поля задают документы базы знаний, в админке они только для чтения */
  // Поля, которые задают документы базы знаний (в админке — только для чтения)
  const RAG_LOCKED = {
    teachers: { name: 'ru', role: 'ru', directionId: true, directionId2: true }, // таблица преподавателей
    directions: { price: true, months: true }                                    // прайс-лист
  };
  const ragLocked = collection => (collection === 'teachers' && RagSync.enabled) || (collection === 'directions' && RagSync.pricesEnabled);
  const lockFields = (fields, collection) => fields.map(f => {
    const l = (RAG_LOCKED[collection] || {})[f.key];
    return l ? { ...f, locked: l } : f;
  });
  const PRICE_NOTE = () => {
    const from = RagSync.pricesFrom || {};
    const link = from.url ? ` — <a href="${escapeHtml(from.url)}" target="_blank" rel="noopener">открыть прайс-лист ↗</a>` : '';
    return `<div class="panel" style="border-color:var(--primary);display:flex;gap:12px;align-items:flex-start">
      <span style="font-size:22px">🔗</span><div><b>Цены и длительность курсов берутся из «${escapeHtml(from.file || 'прайс-листа')}»</b>${link}
      <p style="color:var(--text-muted);margin-top:4px">Измените прайс-лист — цены на сайте обновятся автоматически. Остальные поля направлений редактируются здесь.</p></div></div>`;
  };
  const RAG_NOTE = () => {
    const from = RagSync.from || {};
    const file = escapeHtml(from.file || 'документы базы знаний');
    const link = from.url ? ` — <a href="${escapeHtml(from.url)}" target="_blank" rel="noopener">открыть таблицу ↗</a>` : '';
    const text = RagSync.full
      ? `Все данные учителей — имена и должности на 3 языках, курсы, фото, описание, опыт, компания и расписание — ведутся в таблице.
         Измените таблицу — сайт и ассистент обновятся автоматически (в течение ~15 секунд). Здесь данные только для просмотра.`
      : `Состав, порядок, имена, должности и направления берутся из разделов <code>### Имя — Должность</code> и строки <code>Курсы: …</code>.
         Здесь можно менять фото, описание, опыт, компанию и переводы на UZ/EN.`;
    return `<div class="panel" style="border-color:var(--primary);display:flex;gap:12px;align-items:flex-start">
      <span style="font-size:22px">🔗</span><div><b>Учителя синхронизированы: «${file}»</b>${link}
      <p style="color:var(--text-muted);margin-top:4px">${text}</p></div></div>`;
  };

  function fieldHtml(f, value) {
    const req = f.required ? 'required' : '';
    const lockAttr = l => (f.locked === true || f.locked === l ? 'readonly tabindex="-1" style="opacity:.65" title="Берётся из документов базы знаний"' : '');
    const name = `name="${f.key}"`;
    switch (f.type) {
      case 'i18n':
      case 'i18nArea': {
        const v = value || {};
        return `<fieldset class="lang-group"><legend>${f.label}${f.required ? ' *' : ''}</legend>${LANGS.map(([l, lbl]) => `
          <div class="lang-row field"><span>${lbl}</span>${f.type === 'i18n'
            ? `<input data-key="${f.key}" data-lang="${l}" value="${escapeHtml(v[l] || '')}" ${f.required && l === 'ru' ? 'required' : ''} ${lockAttr(l)}>`
            : `<textarea rows="3" data-key="${f.key}" data-lang="${l}">${escapeHtml(v[l] || '')}</textarea>`}</div>`).join('')}</fieldset>`;
      }
      case 'select':
        return `<label class="field"><span>${f.label}${f.locked ? ' 🔗' : ''}</span><select ${name} ${f.locked ? 'disabled title="Берётся из документов базы знаний"' : ''}>${f.options().map(([v, l]) =>
          `<option value="${escapeHtml(v)}" ${String(value ?? '') === v ? 'selected' : ''}>${escapeHtml(l)}</option>`).join('')}</select></label>`;
      case 'tags':
        return `<label class="field"><span>${f.label}</span><input ${name} value="${escapeHtml((value || []).join(', '))}"></label>`;
      case 'color':
        return `<label class="field"><span>${f.label}</span><input type="color" ${name} value="${escapeHtml(value || '#4f6bff')}" style="height:46px;padding:4px"></label>`;
      case 'image':
        return `<div class="field"><span>${f.label}</span>
          <div style="display:flex;gap:10px;align-items:center">
            <img data-preview="${f.key}" src="${escapeHtml(value || '')}" alt="" style="width:56px;height:56px;border-radius:10px;object-fit:cover;background:var(--surface-2);flex-shrink:0;${value ? '' : 'visibility:hidden'}" onerror="this.style.visibility='hidden'">
            <input ${name} value="${escapeHtml(value || '')}" placeholder="https://..." style="flex:1">
            <label class="btn btn--ghost btn--sm" style="cursor:pointer">📁 Файл<input type="file" accept="image/*" data-upload="${f.key}" hidden></label>
          </div></div>`;
      default:
        return `<label class="field"><span>${f.label}${f.required ? ' *' : ''}${f.locked ? ' 🔗' : ''}</span><input type="${f.type}" ${name} value="${escapeHtml(value ?? '')}" ${f.step ? `step="${f.step}"` : ''} ${req} ${lockAttr(true)}></label>`;
    }
  }

  function formFieldsHtml(fields, item) {
    // Группируем подряд идущие «половинные» поля в сетку
    let html = '', buf = [];
    const flush = () => { if (buf.length) { html += `<div class="grid-2">${buf.join('')}</div>`; buf = []; } };
    fields.forEach(f => {
      const h = fieldHtml(f, item[f.key]);
      if (f.half) buf.push(h); else { flush(); html += h; }
    });
    flush();
    return html;
  }

  function bindImageInputs(form) {
    $$('input[data-upload]', form).forEach(inp => inp.addEventListener('change', async () => {
      const file = inp.files[0]; if (!file) return;
      try {
        const url = await fileToDataUrl(file);
        const key = inp.dataset.upload;
        form.querySelector(`[name="${key}"]`).value = url;
        const p = form.querySelector(`[data-preview="${key}"]`); p.src = url; p.style.visibility = 'visible';
      } catch (e) { alert(e.message); }
    }));
    $$('input[name]', form).forEach(inp => {
      const p = form.querySelector(`[data-preview="${inp.name}"]`);
      if (p) inp.addEventListener('input', () => { p.src = inp.value; p.style.visibility = inp.value ? 'visible' : 'hidden'; });
    });
  }

  function readForm(form, fields, target) {
    fields.forEach(f => {
      if (f.type === 'i18n' || f.type === 'i18nArea') {
        const obj = {};
        $$(`[data-key="${f.key}"]`, form).forEach(el => { obj[el.dataset.lang] = el.value.trim(); });
        target[f.key] = obj;
      } else {
        const el = form.querySelector(`[name="${f.key}"]`);
        if (!el) return;
        let v = el.value.trim();
        if (f.type === 'number') v = v === '' ? '' : Number(v);
        if (f.type === 'tags') v = v.split(',').map(s => s.trim()).filter(Boolean);
        target[f.key] = v;
      }
    });
    return target;
  }

  /* ---------- Модалка редактирования ---------- */
  function openEditor(collection, id) {
    const schema = SCHEMAS[collection];
    const existing = id ? data[collection].find(x => x.id === id) : null;
    const item = existing ? JSON.parse(JSON.stringify(existing)) : {};
    $('#editTitle').textContent = (existing ? 'Редактировать ' : 'Добавить ') + schema.single;
    const form = $('#editForm');
    const locked = ragLocked(collection);
    const fields = locked ? lockFields(schema.fields, collection) : schema.fields;
    const lockNote = collection === 'directions'
      ? '🔗 Цена и длительность берутся из прайс-листа.'
      : '🔗 Имя (RU), должность (RU) и направления берутся из документов базы знаний.';
    form.innerHTML = (locked ? `<p style="color:var(--text-muted);font-size:13.5px">${lockNote}</p>` : '') +
      formFieldsHtml(fields, item) +
      `<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:6px">
        <button type="button" class="btn btn--ghost" data-close>Отмена</button>
        <button class="btn btn--primary">Сохранить</button></div>`;
    bindImageInputs(form);
    form.onsubmit = e => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      // Заблокированные поля не читаем из формы — их значение остаётся из RAG
      readForm(form, fields.filter(f => f.locked !== true), item);
      if (locked && existing) {
        if (existing.name) item.name = { ...item.name, ru: existing.name.ru };
        if (existing.role) item.role = { ...item.role, ru: existing.role.ru };
      }
      if (existing) Object.assign(existing, item);
      else { item.id = uid(schema.prefix); data[collection].push(item); }
      save(); closeEditor(); render();
    };
    $('#editModal').classList.add('open');
    setTimeout(() => { const first = form.querySelector('input,textarea,select'); first && first.focus(); }, 50);
  }
  function closeEditor() { $('#editModal').classList.remove('open'); }

  /* ---------- Страницы ---------- */
  function pageCollection(collection) {
    const schema = SCHEMAS[collection];
    let list = data[collection].slice();
    if (schema.sort) list.sort(schema.sort);
    const locked = ragLocked(collection);
    // Для учителей состав задаёт таблица; у направлений из прайса берутся только цена и срок
    const fixedList = locked && collection === 'teachers';
    setTopActions(fixedList ? '' : `<button class="btn btn--primary btn--sm" data-add="${collection}">+ Добавить</button>`);
    const readOnly = fixedList && RagSync.full; // всё ведётся в таблице — редактировать здесь нечего
    const note = !locked ? '' : collection === 'teachers' ? RAG_NOTE() : PRICE_NOTE();
    return note + (list.length ? `<div class="table-wrap"><table class="table">
      <thead><tr>${schema.columns.map(c => `<th>${c.label}</th>`).join('')}<th></th></tr></thead>
      <tbody>${list.map(i => `<tr>${schema.columns.map(c => `<td>${c.render(i)}</td>`).join('')}
        <td><div class="actions">
          ${schema.sort || fixedList ? '' : `<button class="btn btn--ghost btn--sm" data-move="${collection}:${i.id}:-1" title="Выше">↑</button><button class="btn btn--ghost btn--sm" data-move="${collection}:${i.id}:1" title="Ниже">↓</button>`}
          ${readOnly ? '' : `<button class="btn btn--ghost btn--sm" data-edit="${collection}:${i.id}">✏️</button>`}
          ${fixedList ? '' : `<button class="btn btn--danger btn--sm" data-del="${collection}:${i.id}">🗑</button>`}
        </div></td></tr>`).join('')}</tbody></table></div>`
      : `<div class="panel empty">Пока пусто. Нажмите «Добавить».</div>`);
  }

  function pageSchool() {
    setTopActions('');
    return `<form class="panel" id="schoolForm" style="display:grid;gap:14px">
      ${formFieldsHtml(SCHOOL_FIELDS, data.school)}
      <div><button class="btn btn--primary">💾 Сохранить</button></div></form>`;
  }

  function pageDashboard() {
    setTopActions('');
    const msgs = Store.getMessages();
    const unread = msgs.filter(m => !m.read).length;
    const upcoming = data.news.filter(n => n.type === 'event' && new Date(n.date) >= new Date(new Date().toDateString())).length;
    const cards = [
      ['💻', data.directions.length, 'направлений', 'directions'],
      ['👩‍🏫', data.teachers.length, 'учителей', 'teachers'],
      ['🎉', upcoming, 'предстоящих событий', 'news'],
      ['✉️', `${msgs.length} / ${unread}`, 'заявок / новых', 'messages']
    ];
    return `<div class="dash">${cards.map(([ic, v, l, tab]) => `
      <button class="stat" data-go="${tab}" style="text-align:left;cursor:pointer;color:inherit">
        <div class="stat__icon">${ic}</div><div><div class="stat__value">${v}</div><div class="stat__label">${l}</div></div></button>`).join('')}</div>
      <div class="panel"><h3>Последние заявки</h3>${msgs.length ? messagesTable(msgs.slice(0, 5), true) : '<p class="empty">Заявок пока нет</p>'}</div>
      <div class="panel"><h3>Подсказка</h3><p style="color:var(--text-muted)">Все изменения сразу появляются на сайте (в том числе в соседней вкладке). Тексты заполняются на трёх языках: если перевод не указан, будет показан русский вариант.</p></div>`;
  }

  function messagesTable(list, compact) {
    return `<div class="table-wrap"><table class="table"><thead><tr>
      <th>Дата</th><th>Имя</th><th>Телефон</th>${compact ? '' : '<th>Email</th>'}<th>Направление</th>${compact ? '' : '<th>Сообщение</th>'}<th></th></tr></thead>
      <tbody>${list.map(m => `<tr class="${m.read ? '' : 'unread'}">
        <td style="white-space:nowrap">${new Date(m.date).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}</td>
        <td>${escapeHtml(m.name)} <small style="color:var(--text-muted)">${escapeHtml((m.lang || '').toUpperCase())}</small></td>
        <td style="white-space:nowrap"><a href="tel:${escapeHtml(m.phone.replace(/[^\d+]/g, ''))}">${escapeHtml(m.phone)}</a></td>
        ${compact ? '' : `<td>${m.email ? `<a href="mailto:${escapeHtml(m.email)}">${escapeHtml(m.email)}</a>` : '—'}</td>`}
        <td>${escapeHtml(m.directionTitle || '—')}</td>
        ${compact ? '' : `<td style="min-width:200px">${escapeHtml(m.message || '—')}</td>`}
        <td><div class="actions">
          <button class="btn btn--ghost btn--sm" data-read="${m.id}" title="${m.read ? 'Отметить новой' : 'Отметить обработанной'}">${m.read ? '↺' : '✓'}</button>
          ${compact ? '' : `<button class="btn btn--danger btn--sm" data-delmsg="${m.id}">🗑</button>`}
        </div></td></tr>`).join('')}</tbody></table></div>`;
  }

  function pageMessages() {
    const msgs = Store.getMessages();
    setTopActions(msgs.length ? `<button class="btn btn--ghost btn--sm" id="exportCsv">⬇ CSV</button>` : '');
    return msgs.length ? messagesTable(msgs, false) : `<div class="panel empty">Заявок пока нет. Они появятся после отправки формы на сайте.</div>`;
  }

  function pageSettings() {
    setTopActions('');
    return `
      <form class="panel" id="accountForm" style="display:grid;gap:14px">
        <h3>Данные для входа</h3>
        <div class="grid-2">
          <label class="field"><span>Логин</span><input name="login" value="${escapeHtml(data.admin.login)}" required></label>
          <label class="field"><span>Новый пароль</span><input name="password" type="password" minlength="6" placeholder="не менее 6 символов" autocomplete="new-password"></label>
        </div>
        <div><button class="btn btn--primary">Сохранить</button></div>
      </form>
      <div class="panel">
        <h3>Резервная копия</h3>
        <p style="color:var(--text-muted);margin-bottom:14px">Экспортируйте весь контент в JSON-файл или восстановите его из файла.</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn--ghost" id="exportJson">⬇ Экспорт JSON</button>
          <label class="btn btn--ghost" style="cursor:pointer">⬆ Импорт JSON<input type="file" accept="application/json" id="importJson" hidden></label>
          <button class="btn btn--danger" id="resetData">Сбросить к стандартным данным</button>
        </div>
      </div>`;
  }

  /* ---------- Навигация ---------- */
  const PAGES = {
    dashboard: ['Обзор', pageDashboard],
    school: ['О школе и Hero-блок', pageSchool],
    stats: ['Статистика результатов', () => pageCollection('stats')],
    directions: ['Направления обучения', () => pageCollection('directions')],
    teachers: ['Учителя', () => pageCollection('teachers')],
    news: ['Новости и мероприятия', () => pageCollection('news')],
    messages: ['Заявки с сайта', pageMessages],
    settings: ['Настройки', pageSettings]
  };

  function setTopActions(html) { $('#topActions').innerHTML = html; }

  function updateUnread() {
    const n = Store.getMessages().filter(m => !m.read).length;
    const el = $('#unreadCount'); el.textContent = n; el.hidden = !n;
  }

  function render() {
    const [title, fn] = PAGES[currentTab];
    $('#pageTitle').textContent = title;
    $('#adminContent').innerHTML = fn();
    $$('.admin__tab').forEach(t => t.classList.toggle('active', t.dataset.tab === currentTab));
    updateUnread();
    const sf = $('#schoolForm');
    if (sf) {
      bindImageInputs(sf);
      sf.onsubmit = e => { e.preventDefault(); if (!sf.reportValidity()) return; readForm(sf, SCHOOL_FIELDS, data.school); save(); };
    }
    const af = $('#accountForm');
    if (af) af.onsubmit = e => {
      e.preventDefault(); if (!af.reportValidity()) return;
      data.admin.login = af.login.value.trim();
      if (af.password.value) data.admin.password = af.password.value;
      save(); af.password.value = '';
    };
  }

  function go(tab) { currentTab = tab; render(); $('#adminSide').classList.remove('open'); window.scrollTo(0, 0); }

  /* ---------- Делегирование кликов ---------- */
  function initEvents() {
    $$('.admin__tab').forEach(t => t.addEventListener('click', () => go(t.dataset.tab)));
    $('#adminBurger').addEventListener('click', () => $('#adminSide').classList.toggle('open'));
    $('#themeToggle').addEventListener('click', Theme.toggle);
    $('#logoutBtn').addEventListener('click', () => { try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {} location.reload(); });

    $('#editModal').addEventListener('click', e => { if (e.target.closest('[data-close]')) closeEditor(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeEditor(); });

    document.addEventListener('click', e => {
      const t = e.target.closest('button, [data-go]');
      if (!t) return;
      const d = t.dataset;
      if (d.go) go(d.go);
      if (d.add) openEditor(d.add);
      if (d.edit) { const [c, id] = d.edit.split(':'); openEditor(c, id); }
      if (d.del) {
        const [c, id] = d.del.split(':');
        if (confirm('Удалить эту запись?')) { data[c] = data[c].filter(x => x.id !== id); save(); render(); }
      }
      if (d.move) {
        const [c, id, dir] = d.move.split(':');
        const arr = data[c], i = arr.findIndex(x => x.id === id), j = i + Number(dir);
        if (j >= 0 && j < arr.length) { [arr[i], arr[j]] = [arr[j], arr[i]]; save(); render(); }
      }
      if (d.read) {
        const list = Store.getMessages(); const m = list.find(x => x.id === d.read);
        if (m) { m.read = !m.read; Store.saveMessages(list); render(); }
      }
      if (d.delmsg && confirm('Удалить заявку?')) {
        Store.saveMessages(Store.getMessages().filter(x => x.id !== d.delmsg)); render();
      }
      if (t.id === 'exportJson') download('itschool-backup.json', JSON.stringify(data, null, 2), 'application/json');
      if (t.id === 'exportCsv') exportCsv();
      if (t.id === 'resetData' && confirm('Все изменения контента будут потеряны. Продолжить?')) {
        Store.reset(); data = Store.get(); Store.save(data); render(); toast('Данные сброшены');
        Promise.all([RagSync.sync(data), RagSync.syncPrices(data)]).then(() => render()); // учителя и цены снова из базы знаний
      }
    });

    document.addEventListener('change', e => {
      if (e.target.id !== 'importJson') return;
      const file = e.target.files[0]; if (!file) return;
      file.text().then(txt => {
        const obj = JSON.parse(txt);
        if (!obj.school || !Array.isArray(obj.directions)) throw new Error('Неверный формат файла');
        data = obj; save(); render();
      }).catch(err => alert('Ошибка импорта: ' + err.message));
    });

    // Новые заявки из другой вкладки
    window.addEventListener('storage', e => {
      if (e.key === MESSAGES_KEY) { updateUnread(); if (currentTab === 'messages' || currentTab === 'dashboard') render(); }
    });
  }

  function download(name, content, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function exportCsv() {
    const rows = [['Дата', 'Имя', 'Телефон', 'Email', 'Направление', 'Сообщение', 'Язык', 'Статус']];
    Store.getMessages().forEach(m => rows.push([new Date(m.date).toLocaleString('ru-RU'), m.name, m.phone, m.email, m.directionTitle, m.message, m.lang, m.read ? 'обработана' : 'новая']));
    const csv = '﻿' + rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
    download('zayavki.csv', csv, 'text/csv;charset=utf-8');
  }

  /* ---------- Авторизация ---------- */
  function isLogged() { try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch (e) { return false; } }
  function showApp() {
    $('#loginScreen').hidden = true; $('#adminApp').hidden = false; render();
    // Подтягиваем учителей из базы знаний и перерисовываем (появится пометка о синхронизации)
    Promise.all([RagSync.sync(data), RagSync.syncPrices(data)]).then(() => render());
  }

  $('#loginForm').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target;
    data = Store.get();
    if (f.login.value.trim() === data.admin.login && f.password.value === data.admin.password) {
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (err) {}
      showApp();
    } else {
      $('#loginError').textContent = 'Неверный логин или пароль';
    }
  });

  initEvents();
  if (isLogged()) showApp();
})();
