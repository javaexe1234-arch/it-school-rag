/* =========================================================
   Группы, свободные места и записи студентов
   - Группа = преподаватель + курс + название группы из листа «Расписание»
     (например: Азиз Каримов, Frontend-разработка, «утренняя»).
   - Записи хранятся в листе «Записи» той же таблицы.
   - Свободные места = вместимость группы − активные записи
     (отменённые и записи на пробное занятие место не занимают).
   ========================================================= */
const crypto = require('crypto');

const ENROLL_SHEET = 'Записи';
const HEADER = ['Дата записи', 'Студент', 'Телефон', 'Email', 'Курс', 'Группа', 'Преподаватель',
  'Дни и время', 'Код группы', 'Статус', 'Источник', 'Комментарий'];
const DAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"']/g, '').replace(/\s+/g, ' ').trim();
const phoneDigits = p => String(p || '').replace(/\D/g, '');
const phoneHash = p => crypto.createHash('sha256').update(phoneDigits(p).slice(-9)).digest('hex').slice(0, 16);
const startMin = t => { const m = String(t).match(/(\d{1,2})[:.](\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : 0; };
const groupKey = (course, group, teacher) => [norm(course), norm(group), norm(teacher)].join('|');

/* ---------- Группы из расписания ---------- */
function buildGroups(teachers, defaultCapacity = 12) {
  const groups = [];
  for (const t of teachers || []) {
    const byKey = new Map();
    for (const l of t.schedule || []) {
      if (!l.course || /^консультац/i.test(l.course)) continue;
      const k = norm(l.course) + '|' + norm(l.group);
      if (!byKey.has(k)) byKey.set(k, { course: l.course, group: l.group || '', slots: [], capacity: null });
      const g = byKey.get(k);
      g.slots.push({ day: l.day, dayIndex: l.dayIndex, time: l.time, format: l.format || '' });
      if (l.capacity && !g.capacity) g.capacity = Number(l.capacity) || null;
    }
    let n = 0;
    for (const g of byKey.values()) {
      n++;
      g.slots.sort((a, b) => a.dayIndex - b.dayIndex || startMin(a.time) - startMin(b.time));
      groups.push({
        code: `${t.id || 'T'}-${n}`,
        key: groupKey(g.course, g.group, t.name.ru),
        teacherId: t.id, teacher: t.name.ru,
        course: g.course, group: g.group,
        schedule: scheduleText(g.slots),
        slots: g.slots,
        capacity: g.capacity || defaultCapacity
      });
    }
  }
  return groups;
}

/* «Пн/Ср/Пт 9:00–11:00» (одинаковое время объединяется) */
function scheduleText(slots) {
  const byTime = new Map();
  for (const s of slots) {
    const k = s.time + (s.format && !/^очно$/i.test(s.format) ? ` (${s.format.toLowerCase()})` : '');
    if (!byTime.has(k)) byTime.set(k, []);
    byTime.get(k).push(s.dayIndex);
  }
  return [...byTime].map(([time, days]) => `${[...new Set(days)].sort((a, b) => a - b).map(i => DAY_SHORT[i]).join('/')} ${time}`).join(', ');
}

/* ---------- Записи из листа ---------- */
const COLS = {
  date: /^дата/, name: /^студент|^имя|^фио/, phone: /^телефон/, email: /^email|^почта/,
  course: /^курс/, group: /^групп/, teacher: /^преподават/, code: /^код/, status: /^статус/
};

/* Активная запись занимает место; отменённая и пробное занятие — нет */
const isActive = status => !/отмен|отказ|удал|пробн/i.test(String(status || ''));

/**
 * Читает лист «Записи». Наружу (в кэш и API) уходят только ключи групп,
 * хэши телефонов и статусы — без имён и контактов.
 */
function parseEnrollments(sheets) {
  const name = Object.keys(sheets || {}).find(n => norm(n) === norm(ENROLL_SHEET));
  if (!name) return [];
  const rows = sheets[name] || [];
  const header = (rows[0] || []).map(norm);
  const col = {};
  for (const [k, re] of Object.entries(COLS)) {
    const i = header.findIndex((h, j) => re.test(h) && !Object.values(col).includes(j));
    if (i >= 0) col[k] = i;
  }
  const get = (r, k) => (col[k] != null ? String(r[col[k]] || '').trim() : '');
  return rows.slice(1).filter(r => r && r.some(Boolean)).map(r => ({
    key: groupKey(get(r, 'course'), get(r, 'group'), get(r, 'teacher')),
    code: get(r, 'code'),
    phone: get(r, 'phone') ? phoneHash(get(r, 'phone')) : '',
    active: isActive(get(r, 'status'))
  }));
}

/* Количество активных записей по каждой группе */
function withSeats(groups, enrollments) {
  return groups.map(g => {
    const taken = enrollments.filter(e => e.active && (e.key === g.key)).length;
    return { ...g, taken, free: Math.max(0, g.capacity - taken) };
  });
}

/* ---------- Поиск подходящих групп ---------- */
const DAY_NAMES = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
function dayIndexOf(s) {
  const n = norm(s);
  if (!n) return -1;
  const i = DAY_NAMES.findIndex(d => d.startsWith(n.slice(0, 3)) || n.startsWith(d.slice(0, 3)));
  if (i >= 0) return i;
  const en = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].findIndex(d => n.startsWith(d));
  if (en >= 0) return en;
  const uz = ['dush', 'sesh', 'chor', 'pay', 'jum', 'shan', 'yak'].findIndex(d => n.startsWith(d));
  return uz;
}
const tokens = s => norm(s).split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 1).map(w => w.slice(0, 5));
function courseScore(query, course) {
  const q = tokens(query); if (!q.length) return 1;
  const c = new Set(tokens(course));
  return q.filter(t => c.has(t)).length / q.length;
}

/**
 * @param {object} f фильтры: course, teacher, day, time_of_day ('утро'|'день'|'вечер'|morning|afternoon|evening), only_free
 */
function findGroups(groups, f = {}) {
  let list = groups.slice();
  if (f.course) {
    const scored = list.map(g => ({ g, s: courseScore(f.course, g.course + ' ' + g.group) })).filter(x => x.s >= 0.5);
    list = scored.sort((a, b) => b.s - a.s).map(x => x.g);
  }
  if (f.teacher) list = list.filter(g => courseScore(f.teacher, g.teacher) >= 0.5);
  const di = dayIndexOf(f.day);
  if (di >= 0) list = list.filter(g => g.slots.some(s => s.dayIndex === di));
  const tod = norm(f.time_of_day);
  if (tod) {
    const range = /утр|morn|ertal/.test(tod) ? [0, 12 * 60] : /ден|after|kun|tush/.test(tod) ? [12 * 60, 17 * 60] : /веч|even|kech/.test(tod) ? [17 * 60, 24 * 60] : null;
    if (range) list = list.filter(g => g.slots.some(s => startMin(s.time) >= range[0] && startMin(s.time) < range[1]));
  }
  if (f.only_free !== false) list = list.filter(g => g.free > 0);
  return list;
}

/* Публичный вид группы (без персональных данных) */
const publicGroup = g => ({
  code: g.code, course: g.course, group: g.group || '', teacher: g.teacher,
  schedule: g.schedule, capacity: g.capacity, free: g.free
});

module.exports = {
  ENROLL_SHEET, HEADER, buildGroups, parseEnrollments, withSeats, findGroups, publicGroup,
  groupKey, phoneHash, phoneDigits, norm
};
