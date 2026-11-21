/* =========================================================
   Хранилище знаний: следит за документами источника (папка или Google Drive),
   скачивает только изменённые файлы и превращает их в:
   - docs:     [{ file, markdown }] — для базы знаний ассистента
   - teachers: [...]                — для сайта (из таблицы «Преподаватели и расписание»)
   ========================================================= */
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { docxToMarkdown, readXlsx } = require('./office');
const { parseTeacherWorkbook, teachersToMarkdown } = require('./teachers-sheet');
const { parseTeachers } = require('./teachers');
const { parsePrices } = require('./prices');
const { parseEnrollments } = require('./enrollments');
const { appendRows } = require('./xlsx-write');

class KnowledgeStore extends EventEmitter {
  constructor({ source, cacheFile, pollSeconds = 15 }) {
    super();
    this.source = source;
    this.cacheFile = cacheFile;
    this.pollMs = Math.max(5, pollSeconds) * 1000;
    this.files = new Map();   // id → { meta, markdown?, teachers?, warnings, error? }
    this.docs = [];
    this.teachers = [];
    this.teachersFrom = null;  // откуда взяты учителя
    this.warnings = [];
    this.lastCheck = 0;
    this.lastChange = null;
    this.lastError = null;
    this._refreshing = null;
    this._loadCache();
  }

  /* Кэш на диске: если источник временно недоступен, сервер стартует с последними данными */
  _cacheKey() { return this.source.cacheKey || JSON.stringify(this.source.describe()); }
  _loadCache() {
    try {
      const c = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
      if (c.source !== this._cacheKey()) return;
      for (const f of c.files || []) this.files.set(f.meta.id, f);
      this._derive();
    } catch (e) { /* кэша нет */ }
  }
  _saveCache() {
    try {
      fs.mkdirSync(path.dirname(this.cacheFile), { recursive: true });
      fs.writeFileSync(this.cacheFile, JSON.stringify({ source: this._cacheKey(), files: [...this.files.values()] }));
    } catch (e) { console.warn('[knowledge] Не удалось сохранить кэш:', e.message); }
  }

  /* Конвертация одного файла */
  _convert(meta, buf) {
    const entry = { meta, warnings: [] };
    if (meta.kind === 'docx') entry.markdown = docxToMarkdown(buf);
    else if (meta.kind === 'md') entry.markdown = buf.toString('utf8');
    else if (meta.kind === 'xlsx') {
      const sheets = readXlsx(buf);
      const parsed = parseTeacherWorkbook(sheets, meta.name);
      // Записи студентов: только ключи групп, хэши телефонов и статусы (без имён и контактов)
      entry.enrollments = parseEnrollments(sheets);
      if (parsed) {
        entry.teachers = parsed.teachers;
        entry.warnings = parsed.warnings;
        entry.markdown = teachersToMarkdown(parsed.teachers, meta.name);
      } else {
        entry.warnings = [`${meta.name}: в таблице нет листа «Преподаватели» — файл пропущен`];
      }
    }
    return entry;
  }

  /* Пересобирает docs / teachers из файлов */
  _derive() {
    const entries = [...this.files.values()].sort((a, b) => a.meta.name.localeCompare(b.meta.name, 'ru'));
    this.docs = entries.filter(e => e.markdown).map(e => ({ file: e.meta.name, markdown: e.markdown, url: e.meta.url }));
    const sheet = entries.find(e => e.teachers && e.teachers.length);
    this.teachersFile = sheet ? sheet.meta : null;
    this.enrollments = sheet ? (sheet.enrollments || []) : [];
    if (sheet) {
      this.teachers = sheet.teachers;
      this.teachersFrom = { file: sheet.meta.name, url: sheet.meta.url || null, full: true };
    } else {
      // Запасной вариант: учителя из разделов «### Имя — Должность» в документах
      this.teachers = this.docs.flatMap(d => parseTeachers(d.markdown, d.file)).map(t => ({
        id: '', name: { ru: t.name }, role: { ru: t.role }, courses: t.courses, schedule: []
      }));
      this.teachersFrom = this.teachers.length ? { file: 'документы', full: false } : null;
    }
    this.warnings = entries.flatMap(e => [...(e.warnings || []), ...(e.error ? [`${e.meta.name}: ${e.error}`] : [])]);

    // Цены курсов из прайс-листа (для карточек направлений на сайте)
    this.prices = [];
    this.pricesFrom = null;
    for (const d of this.docs) {
      const rows = parsePrices(d.markdown, d.file);
      if (!rows.length) continue;
      this.prices.push(...rows);
      if (!this.pricesFrom) this.pricesFrom = { file: d.file, url: d.url || null };
    }
    // Проверка арифметики: полная стоимость = цена × месяцы; оплата сразу = полная − 10%
    const fmt = n => Number(n).toLocaleString('ru-RU').replace(/ /g, ' ');
    for (const p of this.prices) {
      const where = `${p.source}, «${p.course}»`;
      if (p.months && p.total != null && p.total !== p.monthly * p.months) {
        this.warnings.push(`${where}: полная стоимость ${fmt(p.total)} сум ≠ ${fmt(p.monthly)} × ${p.months} мес. = ${fmt(p.monthly * p.months)} сум`);
      }
      if (p.total != null && p.prepay != null && Math.abs(p.prepay - p.total * 0.9) > 1) {
        this.warnings.push(`${where}: цена при оплате сразу ${fmt(p.prepay)} сум ≠ полная стоимость − 10% = ${fmt(Math.round(p.total * 0.9))} сум`);
      }
    }
  }

  /**
   * Проверяет источник; скачивает новые/изменённые файлы.
   * @returns {Promise<boolean>} изменились ли данные
   */
  refresh() {
    if (this._refreshing) return this._refreshing;
    this._refreshing = (async () => {
      let changed = false;
      try {
        const list = await this.source.list();
        this.lastError = null;
        // Пропущенные копии документов (см. GoogleDriveSource.list) — показываем в предупреждениях
        const skipped = this.source.describe().skipped || [];
        if (JSON.stringify(skipped) !== JSON.stringify(this.sourceWarnings || [])) {
          skipped.forEach(w => console.warn('[knowledge] ⚠ ' + w));
          this.sourceWarnings = skipped;
        }
        const ids = new Set(list.map(f => f.id));
        for (const id of [...this.files.keys()]) {
          if (!ids.has(id)) { this.files.delete(id); changed = true; console.log(`[knowledge] Убран из базы знаний: ${id}`); }
        }
        for (const meta of list) {
          const old = this.files.get(meta.id);
          if (old && old.meta.version === meta.version && old.meta.name === meta.name) continue;
          try {
            const buf = await this.source.read(meta);
            this.files.set(meta.id, this._convert(meta, buf));
            console.log(`[knowledge] ${old ? 'Обновлён' : 'Загружен'}: ${meta.name}`);
          } catch (e) {
            console.error(`[knowledge] Ошибка чтения ${meta.name}:`, e.message);
            // Оставляем прошлую версию файла, но показываем ошибку
            this.files.set(meta.id, { ...(old || { meta }), meta: old ? old.meta : { ...meta, version: 'error' }, error: e.message });
          }
          changed = true;
        }
        if (changed) {
          this._derive();
          this._saveCache();
          this.lastChange = new Date().toISOString();
          this.warnings.forEach(w => console.warn('[knowledge] ⚠ ' + w));
        }
      } catch (e) {
        if (this.lastError !== e.message) console.error('[knowledge] Источник недоступен:', e.message);
        this.lastError = e.message;
      } finally {
        this.lastCheck = Date.now();
      }
      if (changed) this.emit('change');
      return changed;
    })().finally(() => { this._refreshing = null; });
    return this._refreshing;
  }

  /**
   * Дописывает строки в лист таблицы преподавателей (например, «Записи»).
   * Записи идут строго по очереди; если файл изменился между чтением и записью — повтор.
   * @returns {Promise<{firstRow:number, created:boolean}>}
   */
  appendToTeachersBook(sheet, header, rows) {
    const run = async () => {
      const meta = this.teachersFile;
      if (!meta) throw new Error('Не найдена таблица «Преподаватели и расписание»');
      if (!this.source.write) throw new Error('Источник не поддерживает запись');
      for (let attempt = 1; ; attempt++) {
        const before = await this.source.stat(meta);
        if (before.canWrite === false) throw new Error('У сервисного аккаунта нет права «Редактор» для таблицы');
        const buf = await this.source.read(meta);
        const result = appendRows(buf, sheet, header, rows);
        const now = await this.source.stat(meta);
        if (now.version !== before.version && attempt < 3) continue; // таблицу правили в эту секунду — перечитываем
        await this.source.write(meta, result.buffer);
        console.log(`[knowledge] Записано в «${meta.name}» → лист «${sheet}», строка ${result.firstRow}${result.created ? ' (лист создан)' : ''}`);
        await this.refresh(); // сразу перечитываем таблицу: свободные места пересчитаются
        return { firstRow: result.firstRow, created: result.created };
      }
    };
    const p = (this._writeQueue || Promise.resolve()).then(run, run);
    this._writeQueue = p.catch(() => {});
    return p;
  }

  /* Свежие данные перед ответом: если последняя проверка была давно — проверяем сейчас */
  async ensureFresh(maxAgeMs = 5000) {
    if (Date.now() - this.lastCheck < maxAgeMs) return this._refreshing ? this._refreshing : false;
    return this.refresh();
  }

  start() {
    this._timer = setInterval(() => this.refresh(), this.pollMs);
    this._timer.unref && this._timer.unref();
    this.source.watch(() => this.refresh());
  }

  status() {
    return {
      source: this.source.describe(),
      pollSeconds: this.pollMs / 1000,
      lastCheck: this.lastCheck ? new Date(this.lastCheck).toISOString() : null,
      lastChange: this.lastChange,
      lastError: this.lastError,
      teachersFrom: this.teachersFrom,
      pricesFrom: this.pricesFrom,
      prices: (this.prices || []).length,
      files: [...this.files.values()].map(e => ({
        name: e.meta.name, kind: e.meta.kind, modified: e.meta.modified, url: e.meta.url,
        teachers: e.teachers ? e.teachers.length : undefined, error: e.error
      })),
      warnings: [...(this.sourceWarnings || []), ...this.warnings]
    };
  }
}

module.exports = { KnowledgeStore };
