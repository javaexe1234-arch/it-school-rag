/* =========================================================
   Чтение офисных документов без внешних зависимостей
   - readZip:        ZIP-архив → { имя файла: Buffer }
   - docxToMarkdown: Word (.docx, в т.ч. экспорт Google Docs) → Markdown
   - readXlsx:       Excel (.xlsx, в т.ч. экспорт Google Таблиц) → { лист: [[ячейки]] }
   ========================================================= */
const zlib = require('zlib');

/* ---------- ZIP ---------- */
function readZip(buf) {
  // Конец центрального каталога (EOCD) ищем с конца файла
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Файл не является ZIP-архивом (docx/xlsx)');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Повреждённый ZIP-каталог');
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nameLen).toString('utf8');
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/')) continue;
    const lNameLen = buf.readUInt16LE(localOffset + 26);
    const lExtraLen = buf.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + lNameLen + lExtraLen;
    const data = buf.slice(start, start + compSize);
    if (method === 0) files[name] = data;
    else if (method === 8) files[name] = zlib.inflateRawSync(data);
    else throw new Error(`Неподдерживаемое сжатие ZIP (${method}) в ${name}`);
  }
  return files;
}

/* ---------- XML-утилиты ---------- */
const decode = s => String(s)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&amp;/g, '&');
const attr = (tag, name) => { const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`)); return m ? decode(m[1]) : null; };

/* Верхнеуровневые элементы с учётом вложенности одноимённых тегов */
function topLevel(xml, tags) {
  const re = new RegExp(`<(/?)(${tags.join('|')})(?=[\\s>/])[^>]*?(/?)>`, 'g');
  const out = [];
  let depth = 0, start = 0, cur = null, m;
  while ((m = re.exec(xml))) {
    const [full, closing, tag, selfClose] = m;
    if (!closing && !selfClose) {
      if (depth === 0) { cur = tag; start = m.index; }
      if (tag === cur) depth++;
    } else if (closing && tag === cur) {
      depth--;
      if (depth === 0) { out.push({ tag, xml: xml.slice(start, m.index + full.length) }); cur = null; }
    } else if (selfClose && depth === 0) {
      out.push({ tag, xml: full });
    }
  }
  return out;
}

/* ---------- DOCX → Markdown ---------- */
function headingLevels(stylesXml) {
  // styleId → уровень заголовка (Title = 0, Heading N = N)
  const map = {};
  for (const m of (stylesXml || '').matchAll(/<w:style\b[^>]*>[\s\S]*?<\/w:style>/g)) {
    const s = m[0];
    const id = attr(s.match(/<w:style\b[^>]*>/)[0], 'w:styleId');
    const name = ((s.match(/<w:name\b[^>]*>/) || [''])[0] && attr(s.match(/<w:name\b[^>]*>/)[0], 'w:val')) || '';
    const outline = s.match(/<w:outlineLvl\b[^>]*w:val="(\d+)"/);
    let level = null;
    if (/^title$/i.test(name) || /^title$/i.test(id || '')) level = 0;
    else if (/heading\s*(\d)/i.test(name)) level = Number(name.match(/heading\s*(\d)/i)[1]);
    else if (/^heading(\d)$/i.test(id || '')) level = Number(id.match(/(\d)/)[1]);
    else if (outline) level = Number(outline[1]) + 1;
    if (id && level != null) map[id] = level;
  }
  return map;
}

function runText(runXml) {
  let text = '';
  for (const m of runXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\b[^>]*\/>|<w:noBreakHyphen\s*\/>/g)) {
    if (m[1] != null) text += decode(m[1]);
    else if (m[0].startsWith('<w:tab')) text += ' ';
    else if (m[0].startsWith('<w:br')) text += '\n';
    else text += '-';
  }
  return text;
}

function paragraphText(pXml, { markBold = true } = {}) {
  let out = '';
  for (const m of pXml.matchAll(/<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g)) {
    const r = m[1];
    if (/<w:instrText/.test(r)) continue; // служебный код поля
    const t = runText(r);
    if (!t) continue;
    const bold = /<w:b(?:\s+w:val="(?:true|1|on)")?\s*\/>/.test(r) && !/<w:b\s+w:val="(?:false|0|off)"/.test(r);
    out += markBold && bold && t.trim() ? t.replace(/^(\s*)(.*?)(\s*)$/s, '$1**$2**$3') : t;
  }
  return out.replace(/\*\*\*\*/g, '').replace(/[ \t]+/g, ' ').trim();
}

function tableToMarkdown(tblXml) {
  const rows = topLevel(tblXml.replace(/^<w:tbl\b[^>]*>|<\/w:tbl>$/g, ''), ['w:tr'])
    .filter(e => e.tag === 'w:tr')
    .map(tr => topLevel(tr.xml.replace(/^<w:tr\b[^>]*>|<\/w:tr>$/g, ''), ['w:tc'])
      .filter(e => e.tag === 'w:tc')
      .map(tc => topLevel(tc.xml, ['w:p']).map(p => paragraphText(p.xml, { markBold: false })).filter(Boolean).join('; ').replace(/\|/g, '/')));
  if (!rows.length) return '';
  const n = Math.max(...rows.map(r => r.length));
  const line = r => '| ' + Array.from({ length: n }, (_, i) => r[i] || '').join(' | ') + ' |';
  return [line(rows[0]), '|' + ' --- |'.repeat(n), ...rows.slice(1).map(line)].join('\n');
}

function docxToMarkdown(buf) {
  const files = readZip(buf);
  const docXml = files['word/document.xml'] && files['word/document.xml'].toString('utf8');
  if (!docXml) throw new Error('В docx нет word/document.xml');
  const levels = headingLevels(files['word/styles.xml'] && files['word/styles.xml'].toString('utf8'));
  const body = (docXml.match(/<w:body\b[^>]*>([\s\S]*)<\/w:body>/) || [, docXml])[1];

  const blocks = [];
  for (const el of topLevel(body, ['w:p', 'w:tbl', 'w:sdt'])) {
    const items = el.tag === 'w:sdt' ? topLevel(el.xml.replace(/^<w:sdt\b[^>]*>|<\/w:sdt>$/g, ''), ['w:p', 'w:tbl']) : [el];
    for (const it of items) {
      if (it.tag === 'w:tbl') { blocks.push({ type: 'table', text: tableToMarkdown(it.xml) }); continue; }
      const style = (it.xml.match(/<w:pStyle\b[^>]*w:val="([^"]+)"/) || [])[1];
      const outline = it.xml.match(/<w:pPr>[\s\S]*?<w:outlineLvl\b[^>]*w:val="(\d+)"/);
      const level = style && levels[style] != null ? levels[style] : (outline ? Number(outline[1]) + 1 : null);
      const text = paragraphText(it.xml, { markBold: level == null });
      if (!text) continue;
      if (level != null) blocks.push({ type: 'heading', level, text: text.replace(/\*\*/g, '') });
      else if (/<w:numPr>/.test(it.xml)) blocks.push({ type: 'item', text });
      else blocks.push({ type: 'para', text });
    }
  }

  // Нормализуем уровни: первый (самый крупный) заголовок → «#», следующие уровни → «##», «###»
  const used = [...new Set(blocks.filter(b => b.type === 'heading').map(b => b.level))].sort((a, b) => a - b);
  const rank = lvl => Math.min(used.indexOf(lvl) + 1, 3);
  return blocks.map(b => {
    if (b.type === 'heading') return '\n' + '#'.repeat(rank(b.level)) + ' ' + b.text + '\n';
    if (b.type === 'item') return '- ' + b.text;
    if (b.type === 'table') return '\n' + b.text + '\n';
    return '\n' + b.text + '\n';
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/* ---------- XLSX → таблицы ---------- */
const BUILTIN_DATE = new Set([14, 15, 16, 17, 22, 27, 30, 36, 50, 57]);
const BUILTIN_TIME = new Set([18, 19, 20, 21, 45, 46, 47]);

function colIndex(ref) {
  let n = 0;
  for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function excelNumber(v, kind) {
  const num = Number(v);
  if (kind === 'time' || (kind === 'date' && num < 1)) {
    const mins = Math.round((num % 1) * 24 * 60);
    return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;
  }
  if (kind === 'date') {
    const d = new Date(Math.round((num - 25569) * 86400000));
    return d.toISOString().slice(0, 10);
  }
  return Number.isInteger(num) ? String(num) : String(Math.round(num * 1e6) / 1e6);
}

function readXlsx(buf) {
  const files = readZip(buf);
  const text = name => (files[name] ? files[name].toString('utf8') : '');
  const strings = [...text('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map(m => [...m[1].replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(t => decode(t[1])).join(''));

  // Форматы ячеек: определяем даты и время (Excel хранит их числами)
  const styles = text('xl/styles.xml');
  const custom = {};
  for (const m of styles.matchAll(/<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g)) custom[m[1]] = decode(m[2]);
  const xfs = ((styles.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/) || [])[1] || '');
  const styleKind = [...xfs.matchAll(/<xf\b[^>]*>/g)].map(m => {
    const id = Number(attr(m[0], 'numFmtId') || 0);
    if (BUILTIN_TIME.has(id)) return 'time';
    if (BUILTIN_DATE.has(id)) return 'date';
    const code = (custom[id] || '').replace(/"[^"]*"|\[[^\]]*\]/g, '');
    if (/[hs]/i.test(code) && !/[dy]/i.test(code)) return 'time';
    if (/[dy]/i.test(code)) return 'date';
    return null;
  });

  const rels = {};
  for (const m of text('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g)) rels[attr(m[0], 'Id')] = attr(m[0], 'Target');
  const sheets = {};
  for (const m of text('xl/workbook.xml').matchAll(/<sheet\b[^>]*>/g)) {
    const name = attr(m[0], 'name');
    let target = rels[attr(m[0], 'r:id')] || '';
    target = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
    const xml = text(target);
    const rows = [];
    for (const r of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g)) {
      const rowNum = Number(attr(r[0].match(/<row\b[^>]*>/)[0], 'r')) - 1;
      const row = [];
      for (const c of (r[1] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const tag = '<c ' + c[1] + '>';
        const ref = attr(tag, 'r');
        const type = attr(tag, 't');
        const s = Number(attr(tag, 's') || 0);
        const inner = c[2] || '';
        const v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        let val = '';
        if (type === 's') val = strings[Number(v)] || '';
        else if (type === 'inlineStr') val = [...inner.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(t => decode(t[1])).join('');
        else if (type === 'b') val = v === '1' ? 'TRUE' : 'FALSE';
        else if (type === 'str' || type === 'e') val = v != null ? decode(v) : '';
        else if (v != null) val = excelNumber(v, styleKind[s]);
        row[ref ? colIndex(ref) : row.length] = String(val).trim();
      }
      rows[rowNum >= 0 ? rowNum : rows.length] = Array.from(row, x => x || '');
    }
    sheets[name] = Array.from(rows, r => r || []);
  }
  return sheets;
}

module.exports = { readZip, docxToMarkdown, readXlsx };
