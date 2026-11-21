/* =========================================================
   Дописывание строк в лист .xlsx без внешних зависимостей.
   Остальные листы и форматирование книги не трогаются:
   меняется только XML нужного листа (и книга — если лист создаётся).
   ========================================================= */
const zlib = require('zlib');
const { readZip } = require('./office');

/* ---------- ZIP (запись) ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buf) >>> 0;
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function writeZip(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const comp = zlib.deflateRawSync(data);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8); local.writeUInt32LE(0, 10); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, comp);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10); central.writeUInt32LE(0, 12);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(comp.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28); central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

/* ---------- XML ---------- */
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  // управляющие символы недопустимы в XML
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const colName = i => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
const attr = (tag, name) => { const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`)); return m ? m[1] : null; };

function rowXml(r, values, styleId) {
  const s = styleId != null ? ` s="${styleId}"` : '';
  const cells = values.map((v, i) => {
    if (v === '' || v == null) return '';
    return `<c r="${colName(i)}${r}" t="inlineStr"${s}><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
  }).join('');
  return `<row r="${r}">${cells}</row>`;
}

/**
 * Дописывает строки в конец листа; если листа нет — создаёт его с заголовком.
 * @param {Buffer} buf     исходный .xlsx
 * @param {string} sheet   название листа
 * @param {string[]} header заголовок (для нового листа)
 * @param {Array<string[]>} rows строки
 * @returns {{ buffer: Buffer, firstRow: number, created: boolean }}
 */
function appendRows(buf, sheet, header, rows) {
  const files = readZip(buf);
  const text = n => (files[n] ? files[n].toString('utf8') : '');
  const set = (n, s) => { files[n] = Buffer.from(s, 'utf8'); };

  let workbook = text('xl/workbook.xml');
  let rels = text('xl/_rels/workbook.xml.rels');
  if (!workbook || !rels) throw new Error('Файл не похож на книгу Excel');

  // Ищем лист по имени
  let target = null;
  for (const m of workbook.matchAll(/<sheet\b[^>]*>/g)) {
    if ((attr(m[0], 'name') || '').trim().toLowerCase() === sheet.toLowerCase()) {
      const rid = attr(m[0], 'r:id');
      const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map(x => x[0]).find(x => attr(x, 'Id') === rid);
      const t = rel && attr(rel, 'Target');
      if (t) target = t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '');
    }
  }

  let created = false;
  if (!target) {
    // Новый лист: файл листа + запись в книге + связь + тип содержимого
    const nums = Object.keys(files).map(n => (n.match(/^xl\/worksheets\/sheet(\d+)\.xml$/) || [])[1]).filter(Boolean).map(Number);
    const n = (nums.length ? Math.max(...nums) : 0) + 1;
    target = `xl/worksheets/sheet${n}.xml`;
    const ids = [...rels.matchAll(/Id="rId(\d+)"/g)].map(m => Number(m[1]));
    const rid = `rId${(ids.length ? Math.max(...ids) : 0) + 1}`;
    const sheetIds = [...workbook.matchAll(/<sheet\b[^>]*sheetId="(\d+)"/g)].map(m => Number(m[1]));
    const sheetId = (sheetIds.length ? Math.max(...sheetIds) : 0) + 1;
    const rNs = (workbook.match(/xmlns:(\w+)="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships"/) || [, 'r'])[1];
    workbook = workbook.replace(/<\/sheets>/, `<sheet name="${esc(sheet)}" sheetId="${sheetId}" ${rNs}:id="${rid}"/></sheets>`);
    rels = rels.replace(/<\/Relationships>/, `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${n}.xml"/></Relationships>`);
    let ct = text('[Content_Types].xml');
    ct = ct.replace(/<\/Types>/, `<Override PartName="/${target}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
    set('xl/workbook.xml', workbook);
    set('xl/_rels/workbook.xml.rels', rels);
    set('[Content_Types].xml', ct);
    const widths = header.map((h, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.min(Math.max(String(h).length + 4, 12), 40)}" customWidth="1"/>`).join('');
    set(target, '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
      `<cols>${widths}</cols><sheetData>${rowXml(1, header)}</sheetData></worksheet>`);
    created = true;
  }

  let xml = text(target);
  if (!/<sheetData/.test(xml)) throw new Error(`Лист «${sheet}» повреждён`);
  // Последняя занятая строка (пустые строки в конце не считаем)
  let last = 0;
  for (const m of xml.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    if (/<v>|<is>|<t[ >]/.test(m[2])) last = Math.max(last, Number(m[1]));
  }
  // Пустые «заготовки» строк ниже последней заполненной убираем — иначе номера пересекутся
  xml = xml.replace(/<row\b[^>]*\br="(\d+)"[^>]*\/>|<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g, (full, r1, r2) => (Number(r1 || r2) > last ? '' : full));
  const firstRow = last + 1;
  const add = rows.map((r, i) => rowXml(firstRow + i, r)).join('');
  xml = /<sheetData\s*\/>/.test(xml)
    ? xml.replace(/<sheetData\s*\/>/, `<sheetData>${add}</sheetData>`)
    : xml.replace(/<\/sheetData>/, `${add}</sheetData>`);
  // Диапазон листа
  const lastRow = firstRow + rows.length - 1;
  const lastCol = colName(Math.max(header.length, ...rows.map(r => r.length)) - 1);
  xml = xml.replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:${lastCol}${lastRow}"/>`);
  set(target, xml);

  // calcChain может ссылаться на старые ячейки — Excel пересоздаст его сам
  if (files['xl/calcChain.xml']) {
    delete files['xl/calcChain.xml'];
    set('[Content_Types].xml', text('[Content_Types].xml').replace(/<Override[^>]*calcChain[^>]*\/>/, ''));
    set('xl/_rels/workbook.xml.rels', text('xl/_rels/workbook.xml.rels').replace(/<Relationship[^>]*calcChain[^>]*\/>/, ''));
  }

  // [Content_Types].xml должен идти первым
  const names = Object.keys(files).sort((a, b) => (a === '[Content_Types].xml' ? -1 : b === '[Content_Types].xml' ? 1 : 0));
  return { buffer: writeZip(names.map(name => ({ name, data: files[name] }))), firstRow, created };
}

module.exports = { appendRows, writeZip };
