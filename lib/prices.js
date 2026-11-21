/* =========================================================
   Цены курсов из прайс-листа (документ базы знаний)
   Ищется таблица, где есть колонки «Курс» и «Цена за месяц».
   Остальные колонки (длительность, полная стоимость, оплата сразу,
   рассрочка) — по возможности. Порядок колонок не важен.
   ========================================================= */
const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
const cells = line => line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
const isTable = l => /^\s*\|.*\|\s*$/.test(l);
const isSep = l => /^[\s|:-]+$/.test(l) && l.includes('-');

const COLS = {
  course: /^курс|^направлен|^название/,
  duration: /длительн|^срок|продолжит/,
  monthly: /цена за мес|в месяц|за 1 мес|\/\s*мес|^цена$|^стоимость в месяц/,
  total: /полная|за весь курс|^итого/,
  prepay: /сразу|скидк|предоплат/,
  installment: /рассроч/
};

/* «1 250 000сум» → 1250000 */
const toNumber = s => {
  const m = String(s || '').replace(/ /g, ' ').match(/\d[\d\s]*\d|\d/);
  return m ? Number(m[0].replace(/\s/g, '')) : null;
};

function parsePrices(markdown, file) {
  const lines = String(markdown || '').split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (!isTable(lines[i])) continue;
    const table = [];
    while (i < lines.length && isTable(lines[i])) table.push(lines[i++]);
    const rows = table.filter(l => !isSep(l)).map(cells);
    if (rows.length < 2) continue;
    const header = rows[0].map(norm);
    const col = {};
    for (const [key, re] of Object.entries(COLS)) {
      const idx = header.findIndex((h, j) => re.test(h) && !Object.values(col).includes(j));
      if (idx >= 0) col[key] = idx;
    }
    if (col.course == null || col.monthly == null) continue;
    for (const r of rows.slice(1)) {
      const course = (r[col.course] || '').trim();
      const monthly = toNumber(r[col.monthly]);
      if (!course || monthly == null) continue;
      const get = k => (col[k] != null ? (r[col[k]] || '').trim() : '');
      const inst = get('installment');
      out.push({
        course,
        months: toNumber(get('duration')),
        monthly,
        total: toNumber(get('total')),
        prepay: toNumber(get('prepay')),
        installment: inst ? !/^(нет|—|-|–|не|no)$/i.test(inst) : null,
        source: file
      });
    }
  }
  return out;
}

module.exports = { parsePrices, toNumber };
