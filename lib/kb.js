/* =========================================================
   Преобразование Markdown-документов в базу знаний RAG
   по навыку google-ai-studio-rag:
   - формат записи: { id, title, text } (+ метаданные source, section, part)
   - размер фрагмента: 300–1500 символов, у каждого понятный заголовок
   - таблицы переписываются в строки «Поле: значение» — так они лучше
     векторизуются и остаются понятными без шапки таблицы
   ========================================================= */
const fs = require('fs');
const path = require('path');

const MIN_CHARS = 300;
const MAX_CHARS = 1500;

/* ---------- Таблицы Markdown → строки «Поле: значение» ---------- */
const cells = line => line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
const isTableLine = line => /^\s*\|.*\|\s*$/.test(line);
const isSeparator = line => /^\s*\|?\s*:?-{2,}/.test(line) && /^[\s|:-]+$/.test(line);

function tableToLines(lines) {
  const header = cells(lines[0]);
  return lines.slice(1).filter(l => !isSeparator(l)).map(l => {
    const row = cells(l);
    // Прочерк в ячейке — это осмысленное «нет» (например, рассрочки нет), а не пустота
    const pairs = header
      .map((h, i) => [h || `Колонка ${i + 1}`, /^[—–-]$/.test(row[i] || '') ? 'нет' : row[i]])
      .filter(([, v]) => v);
    return '- ' + pairs.map(([h, v]) => (h === '№' ? `№${v}` : `${h}: ${v}`)).join('; ');
  });
}

/* Тело раздела → список блоков (абзацы, пункты списков, строки таблиц).
   Блоки — минимальные единицы, которые не разрываются при делении. */
function toBlocks(body) {
  const lines = body.split(/\r?\n/);
  const blocks = [];
  let para = [];
  const flushPara = () => { if (para.length) { blocks.push({ type: 'text', text: para.join('\n') }); para = []; } };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isTableLine(line)) {
      flushPara();
      const table = [];
      while (i < lines.length && isTableLine(lines[i])) table.push(lines[i++]);
      i--;
      tableToLines(table).forEach(t => blocks.push({ type: 'row', text: t }));
    } else if (/^\s*(?:[-*]|\d+\.)\s+/.test(line)) {
      flushPara();
      blocks.push({ type: 'item', text: line.trim() });
    } else if (!line.trim()) {
      flushPara();
    } else {
      para.push(line.trim());
    }
  }
  flushPara();
  return blocks;
}

/* ---------- Разбор документа на разделы ---------- */
function parseSections(markdown, file) {
  const sections = [];
  let docTitle = path.basename(file, '.md'), h2 = '', h3 = '', buf = [];
  const flush = () => {
    const body = buf.join('\n').trim();
    buf = [];
    if (body) sections.push({ docTitle, h2, h3, body });
  };
  for (const line of markdown.split(/\r?\n/)) {
    let m;
    if ((m = line.match(/^# (.+)/))) { flush(); docTitle = m[1].trim(); continue; }
    if ((m = line.match(/^## (.+)/))) { flush(); h2 = m[1].trim(); h3 = ''; continue; }
    if ((m = line.match(/^### (.+)/))) { flush(); h3 = m[1].trim(); continue; }
    buf.push(line);
  }
  flush();
  return sections;
}

/* ---------- Сборка фрагментов 300–1500 символов ---------- */
function sectionToChunks(sec) {
  const section = [sec.h2, sec.h3].filter(Boolean).join(' › ') || 'Общая информация';
  const title = `${sec.docTitle} — ${section}`;
  const header = `${sec.docTitle}\nРаздел: ${section}\n`;
  const blocks = toBlocks(sec.body);
  const fullText = header + blocks.map(b => b.text).join('\n');
  if (fullText.length <= MAX_CHARS) return [{ title, section, text: fullText }];

  // Раздел слишком большой: вступительный текст повторяем в каждой части,
  // остальные блоки раскладываем по частям, не превышая MAX_CHARS
  const firstRow = blocks.findIndex(b => b.type !== 'text');
  const intro = firstRow > 0 ? blocks.slice(0, firstRow).map(b => b.text).join('\n') + '\n' : '';
  const rest = firstRow > 0 ? blocks.slice(firstRow) : blocks;
  const prefix = header + (intro.length < MAX_CHARS / 3 ? intro : '');

  const parts = [];
  let cur = [];
  const size = arr => prefix.length + arr.reduce((s, b) => s + b.text.length + 1, 0);
  for (const b of rest) {
    if (cur.length && size([...cur, b]) > MAX_CHARS) { parts.push(cur); cur = []; }
    cur.push(b);
  }
  if (cur.length) parts.push(cur);
  // Последняя часть слишком короткая — равномерно перераспределяем строки
  if (parts.length > 1 && size(parts[parts.length - 1]) < MIN_CHARS) {
    const all = parts.flat(), n = parts.length, per = Math.ceil(all.length / n);
    parts.length = 0;
    for (let i = 0; i < all.length; i += per) parts.push(all.slice(i, i + per));
  }

  return parts.map((p, i) => ({
    title: `${title} (часть ${i + 1} из ${parts.length})`,
    section,
    part: i + 1,
    text: (i === 0 || prefix !== header ? prefix : header + `(продолжение)\n`) + p.map(b => b.text).join('\n')
  }));
}

/* Короткие фрагменты (< 300) присоединяем к соседнему разделу того же уровня */
function mergeSmall(chunks) {
  const out = [];
  for (const c of chunks) {
    const prev = out[out.length - 1];
    const body = c.text.split('\n').slice(1).join('\n'); // без повторного названия документа
    if (prev && c.text.length < MIN_CHARS && !prev.part && prev.text.length + body.length + 1 <= MAX_CHARS) {
      prev.text += '\n' + body;
      prev.section += ' + ' + c.section;
      prev.title = `${prev.title.split(' — ')[0]} — ${prev.section}`;
    } else if (prev && prev.text.length < MIN_CHARS && !prev.part && !c.part && prev.text.length + body.length + 1 <= MAX_CHARS) {
      prev.text += '\n' + body;
      prev.section += ' + ' + c.section;
      prev.title = `${prev.title.split(' — ')[0]} — ${prev.section}`;
    } else {
      out.push({ ...c });
    }
  }
  return out;
}

/**
 * Проверка согласованности: имена в колонке «Преподаватель» любых таблиц
 * должны совпадать с заголовками разделов преподавателей (### Имя — должность).
 * Нужна, потому что при ручной правке легко поменять имя в одном месте и забыть в другом.
 */
function checkTeacherNames(markdown, file) {
  const warnings = [];
  const teachers = new Set();
  for (const line of markdown.split(/\r?\n/)) {
    const m = line.match(/^### (.+?)\s+[—–-]\s+/);
    if (m) teachers.add(m[1].trim());
  }
  if (!teachers.size) return warnings;

  const lines = markdown.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!isTableLine(lines[i])) continue;
    const header = cells(lines[i]);
    const col = header.findIndex(h => /^преподавател/i.test(h));
    while (i + 1 < lines.length && isTableLine(lines[i + 1])) {
      i++;
      if (col < 0 || isSeparator(lines[i])) continue;
      const name = (cells(lines[i])[col] || '').trim();
      if (name && !teachers.has(name)) {
        warnings.push(`${file}, строка ${i + 1}: преподаватель «${name}» не найден среди разделов преподавателей (${[...teachers].join(', ')})`);
      }
    }
  }
  return warnings;
}

function slug(s) {
  return s.toLowerCase().replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

/**
 * Преобразует документы в массив записей базы знаний.
 * @param {Array<{file:string, markdown:string}>|string} docs документы (из KnowledgeStore) или папка с .md
 * @returns {Array<{id:string,title:string,text:string,source:string,section:string,chars:number}>}
 */
function buildKnowledgeBase(docs) {
  if (typeof docs === 'string') {
    const dir = docs;
    docs = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort()
      .map(f => ({ file: f, markdown: fs.readFileSync(path.join(dir, f), 'utf8') }));
  }
  const kb = [];
  kb.warnings = [];
  for (const { file, markdown: md } of docs) {
    kb.warnings.push(...checkTeacherNames(md, file));
    const chunks = mergeSmall(parseSections(md, file).flatMap(sectionToChunks));
    const used = new Set();
    chunks.forEach(c => {
      let id = `${slug(path.basename(file, path.extname(file)))}--${slug(c.section)}${c.part ? '-' + c.part : ''}`;
      while (used.has(id)) id += '-x';
      used.add(id);
      kb.push({ id, title: c.title, text: c.text, source: file, section: c.section, chars: c.text.length });
    });
  }
  return kb;
}

module.exports = { buildKnowledgeBase, MIN_CHARS, MAX_CHARS };

/* Запуск из командной строки: node lib/kb.js → kb/knowledge-base.json
   Читает тот же источник, что и сервер (папка knowledge/ или Google Drive из .env) */
if (require.main === module) {
  (async () => {
    const root = path.join(__dirname, '..');
    require('./env').loadEnv(root);
    const { createSource } = require('./sources');
    const { KnowledgeStore } = require('./knowledge');
    const store = new KnowledgeStore({ source: createSource(process.env, root), cacheFile: path.join(root, '.cache', 'knowledge.json') });
    await store.refresh();
    if (store.lastError) throw new Error(store.lastError);
    const kb = buildKnowledgeBase(store.docs);
    fs.mkdirSync(path.join(root, 'kb'), { recursive: true });
    fs.writeFileSync(path.join(root, 'kb', 'knowledge-base.json'), JSON.stringify(kb, null, 2));
    kb.forEach(c => console.log(String(c.chars).padStart(5), c.chars < MIN_CHARS || c.chars > MAX_CHARS ? '!' : ' ', c.id));
    console.log(`Фрагментов: ${kb.length}`);
    [...store.warnings, ...kb.warnings].forEach(w => console.warn('⚠ ' + w));
  })().catch(e => { console.error('Ошибка:', e.message); process.exit(1); });
}
