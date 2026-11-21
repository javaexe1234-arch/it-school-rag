/* =========================================================
   Таблица «Преподаватели и расписание» (Excel / Google Таблицы)
   → список преподавателей для сайта
   → Markdown-документ для базы знаний ассистента
   Колонки определяются по названиям, порядок колонок не важен.
   ========================================================= */

const DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const DAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

function findSheet(sheets, re) {
  const name = Object.keys(sheets).find(n => re.test(norm(n)));
  return name ? { name, rows: sheets[name] } : null;
}

/* Находит строку заголовков и сопоставляет колонки по регулярным выражениям */
function mapColumns(rows, spec) {
  for (let h = 0; h < Math.min(rows.length, 5); h++) {
    const header = (rows[h] || []).map(norm);
    const cols = {};
    for (const [key, re] of Object.entries(spec)) {
      const i = header.findIndex((c, idx) => re.test(c) && !Object.values(cols).includes(idx));
      if (i >= 0) cols[key] = i;
    }
    if (Object.keys(cols).length >= 3) return { headerRow: h, cols };
  }
  return null;
}

const TEACHER_COLS = {
  id: /^id$|^код/,
  nameUz: /^имя.*\buz\b|^ism/,
  nameEn: /^имя.*\ben\b|^name/,
  nameRu: /^имя|^фио|^преподаватель$/,
  roleUz: /^должность.*\buz\b/,
  roleEn: /^должность.*\ben\b|^position|^role/,
  roleRu: /^должность|^специальн|^профессия/,
  courses: /^курс|^направлен/,
  experience: /^опыт|^стаж/,
  company: /^компан|^место работы/,
  photo: /^фото|^photo/,
  bioUz: /^(о преподав|о себе|описан|био).*\buz\b/,
  bioEn: /^(о преподав|о себе|описан|био).*\ben\b/,
  bioRu: /^(о преподав|о себе|описан|био)/
};
const SCHEDULE_COLS = {
  teacherId: /^id/,
  teacher: /^преподаватель|^учитель|^фио/,
  day: /^день/,
  time: /^время/,
  start: /^начало/,
  end: /^конец|^окончание/,
  course: /^курс|^занятие|^предмет/,
  group: /^групп/,
  format: /^формат/,
  note: /^примеч|^комментар/,
  capacity: /^мест|^вместим/
};

const dayIndex = d => {
  const n = norm(d);
  const i = DAYS.findIndex(x => norm(x) === n);
  return i >= 0 ? i : DAY_SHORT.findIndex(x => norm(x) === n.slice(0, 2));
};
const timeStart = t => {
  const m = String(t).match(/(\d{1,2})[:.](\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
};

/**
 * @returns {{ teachers: object[], warnings: string[] }} или null, если в книге нет листа преподавателей
 */
function parseTeacherWorkbook(sheets, fileName = 'таблица') {
  const warnings = [];
  const tSheet = findSheet(sheets, /препод|учител|teacher/);
  if (!tSheet) return null;
  const tMap = mapColumns(tSheet.rows, TEACHER_COLS);
  if (!tMap || tMap.cols.nameRu == null) {
    return { teachers: [], warnings: [`${fileName}: на листе «${tSheet.name}» не найдена колонка «Имя (RU)»`] };
  }

  const get = (row, cols, key) => (cols[key] != null ? String(row[cols[key]] || '').trim() : '');
  const teachers = [];
  const ids = new Set();
  tSheet.rows.slice(tMap.headerRow + 1).forEach((row, i) => {
    const c = tMap.cols;
    const nameRu = get(row, c, 'nameRu');
    if (!row || !row.some(Boolean)) return;
    const line = tMap.headerRow + i + 2;
    if (!nameRu) { warnings.push(`${fileName}, лист «${tSheet.name}», строка ${line}: не заполнено имя`); return; }
    let id = get(row, c, 'id') || 'row' + line;
    if (ids.has(id)) { warnings.push(`${fileName}, лист «${tSheet.name}», строка ${line}: повторяется ID «${id}»`); id += '-' + line; }
    ids.add(id);
    teachers.push({
      id,
      name: { ru: nameRu, uz: get(row, c, 'nameUz'), en: get(row, c, 'nameEn') },
      role: { ru: get(row, c, 'roleRu'), uz: get(row, c, 'roleUz'), en: get(row, c, 'roleEn') },
      courses: get(row, c, 'courses').split(/\s*[;\n]\s*/).map(s => s.replace(/\.$/, '').trim()).filter(Boolean),
      experience: get(row, c, 'experience'),
      company: get(row, c, 'company'),
      photo: get(row, c, 'photo'),
      bio: { ru: get(row, c, 'bioRu'), uz: get(row, c, 'bioUz'), en: get(row, c, 'bioEn') },
      schedule: []
    });
  });

  const sSheet = findSheet(sheets, /распис|schedule/);
  const sMap = sSheet && mapColumns(sSheet.rows, SCHEDULE_COLS);
  if (sSheet && !sMap) warnings.push(`${fileName}: на листе «${sSheet.name}» не найдены колонки (День, Время, Курс…)`);
  if (sMap) {
    const c = sMap.cols;
    sSheet.rows.slice(sMap.headerRow + 1).forEach((row, i) => {
      if (!row || !row.some(Boolean)) return;
      const line = sMap.headerRow + i + 2;
      const where = `${fileName}, лист «${sSheet.name}», строка ${line}`;
      const tid = get(row, c, 'teacherId'), tname = get(row, c, 'teacher');
      let t = tid && teachers.find(x => x.id === tid);
      if (!t && tname) t = teachers.find(x => norm(x.name.ru) === norm(tname));
      if (!t) { warnings.push(`${where}: преподаватель «${tid || tname}» не найден на листе «${tSheet.name}»`); return; }
      if (tid && tname && norm(t.name.ru) !== norm(tname)) {
        warnings.push(`${where}: ID «${tid}» — это ${t.name.ru}, а в колонке «Преподаватель» указано «${tname}» (используется ID)`);
      }
      const day = get(row, c, 'day');
      const di = dayIndex(day);
      if (di < 0) { warnings.push(`${where}: непонятный день «${day}»`); return; }
      let time = get(row, c, 'time');
      if (!time && (get(row, c, 'start') || get(row, c, 'end'))) time = `${get(row, c, 'start')}–${get(row, c, 'end')}`;
      t.schedule.push({
        day: DAYS[di], dayIndex: di, time: time.replace(/\s*[-–—]\s*/, '–'),
        course: get(row, c, 'course'), group: get(row, c, 'group'),
        format: get(row, c, 'format'), note: get(row, c, 'note'),
        capacity: Number(get(row, c, 'capacity')) || null
      });
    });
    teachers.forEach(t => t.schedule.sort((a, b) => a.dayIndex - b.dayIndex || timeStart(a.time) - timeStart(b.time)));
  }
  return { teachers, warnings, sheetName: tSheet.name };
}

/* ---------- Markdown для базы знаний ---------- */
/* «утренняя» → «утренняя группа», «Вт/Чт» → «группа Вт/Чт» */
const isAdjective = g => /^[а-яё]+(ая|яя)$/i.test(String(g || '').trim());
const groupLabel = g => (/групп/i.test(g) ? g : isAdjective(g) ? `${g} группа` : `группа ${g}`);

function lessonText(l) {
  const extra = [];
  if (l.group) extra.push(groupLabel(l.group));
  if (l.format && !/^очно$/i.test(l.format)) extra.push(l.format.toLowerCase());
  if (l.note) extra.push(l.note);
  return (l.course || 'Занятие') + (extra.length ? ` (${extra.join('; ')})` : '');
}

function teachersToMarkdown(teachers, fileName) {
  const out = [];
  out.push('# Преподаватели и расписание занятий IT-школы CodeCraft Academy');
  out.push('');
  out.push(`Документ: преподаватели всех направлений, их данные и расписание занятий (источник — таблица «${fileName}»). ` +
           'Время занятия группы — 2 часа (детские курсы и «Компьютерная грамотность» — 1,5 часа). ' +
           '«Консультация» — время, когда к преподавателю можно прийти с вопросами без записи на курс. Воскресенье — выходной.');
  out.push('');
  out.push('## Расписание преподавателей');
  for (const t of teachers) {
    out.push('');
    out.push(`### ${t.name.ru} — ${t.role.ru || 'преподаватель'}`);
    out.push('');
    if (t.courses.length) out.push(`${t.courses.length > 1 ? 'Курсы' : 'Курс'}: ${t.courses.join('; ')}.`);
    const about = [];
    if (t.experience) about.push(`опыт работы — ${t.experience} лет`);
    if (t.company) about.push(`работает в компании ${t.company}`);
    if (about.length) out.push(`О преподавателе: ${about.join(', ')}.${t.bio.ru ? ' ' + t.bio.ru : ''}`);
    else if (t.bio.ru) out.push(`О преподавателе: ${t.bio.ru}`);
    out.push('');
    if (t.schedule.length) {
      out.push('| День | Время | Занятие |');
      out.push('|---|---|---|');
      t.schedule.forEach(l => out.push(`| ${l.day} | ${l.time} | ${lessonText(l).replace(/\|/g, '/')} |`));
      const free = DAYS.filter((_, i) => !t.schedule.some(l => l.dayIndex === i));
      if (free.length) { out.push(''); out.push(`Дни без занятий: ${free.join(', ')}.`); }
    } else {
      out.push('Расписание пока не заполнено.');
    }
  }

  // Сводка строится автоматически — она всегда совпадает с расписанием
  const byCourse = new Map();
  for (const t of teachers) {
    for (const l of t.schedule) {
      if (/^консультац/i.test(l.course)) continue;
      const key = l.course;
      if (!byCourse.has(key)) byCourse.set(key, { teachers: new Set(), slots: new Map() });
      const e = byCourse.get(key);
      e.teachers.add(t.name.ru);
      const gkey = `${t.name.ru}|${l.group || ''}|${l.time}|${l.format || ''}`;
      if (!e.slots.has(gkey)) e.slots.set(gkey, { group: l.group, time: l.time, format: l.format, days: [] });
      e.slots.get(gkey).days.push(l.dayIndex);
    }
    for (const c of t.courses) if (!byCourse.has(c)) byCourse.set(c, { teachers: new Set([t.name.ru]), slots: new Map() });
  }
  out.push('');
  out.push('## Сводка: какой курс в какие дни');
  out.push('');
  out.push('| Курс | Преподаватель | Дни и время групп |');
  out.push('|---|---|---|');
  for (const [course, e] of byCourse) {
    const slots = [...e.slots.values()].map(s => {
      const days = [...new Set(s.days)].sort((a, b) => a - b).map(i => DAY_SHORT[i]).join('/');
      // «Вт/Чт», «выходного дня» и т.п. видны по дням — подписываем только «утренняя/вечерняя…»
      const extra = [isAdjective(s.group) ? `${s.group} группа` : null, s.format && !/^очно$/i.test(s.format) ? s.format.toLowerCase() : null].filter(Boolean);
      return `${days} ${s.time}${extra.length ? ` (${extra.join(', ')})` : ''}`;
    });
    out.push(`| ${course} | ${[...e.teachers].join(', ')} | ${slots.join('; ') || 'расписание уточняйте'} |`);
  }
  return out.join('\n') + '\n';
}

module.exports = { parseTeacherWorkbook, teachersToMarkdown, DAYS };
