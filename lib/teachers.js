/* =========================================================
   Запасной способ получить список преподавателей — из документов (Markdown / Word),
   если в базе знаний нет таблицы «Преподаватели и расписание».
   Источник — разделы вида:
     ### Имя Фамилия — Должность
     Курсы: Курс 1; Курс 2.
   ========================================================= */
const fs = require('fs');
const path = require('path');

function parseTeachers(markdown, source) {
  const teachers = [];
  let current = null;
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    const h = line.match(/^###\s+(.+?)\s+[—–-]\s+(.+)$/);
    if (h) {
      current = { name: h[1].trim(), role: h[2].trim(), courses: [], source };
      teachers.push(current);
      continue;
    }
    if (/^#{1,2}\s/.test(line)) { current = null; continue; } // новый раздел верхнего уровня
    const c = current && line.match(/^Курсы?\s*:\s*(.+)$/i);
    if (c) {
      current.courses = c[1].replace(/\.\s*$/, '').split(/\s*;\s*/).map(s => s.trim()).filter(Boolean);
    }
  }
  return teachers;
}

function loadTeachers(docsDir) {
  return fs.readdirSync(docsDir)
    .filter(f => f.endsWith('.md'))
    .sort()
    .flatMap(f => parseTeachers(fs.readFileSync(path.join(docsDir, f), 'utf8'), f));
}

module.exports = { loadTeachers, parseTeachers };
