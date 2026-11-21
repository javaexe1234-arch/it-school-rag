/* =========================================================
   Запись студентов в группы (общая логика для формы сайта и AI-агента)
   ========================================================= */
const {
  ENROLL_SHEET, HEADER, buildGroups, withSeats, findGroups, publicGroup, phoneHash, phoneDigits, norm
} = require('./enrollments');

const nowTashkent = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Tashkent' }).slice(0, 16);

class EnrollError extends Error {
  constructor(code, message, extra = {}) { super(message); this.code = code; Object.assign(this, extra); }
}

class EnrollService {
  constructor({ knowledge, capacity = 12 }) {
    this.knowledge = knowledge;
    this.capacity = capacity;
  }

  groups() {
    return withSeats(buildGroups(this.knowledge.teachers, this.capacity), this.knowledge.enrollments || []);
  }

  /** Свободные группы по фильтрам (для сайта и агента) — без персональных данных */
  find(filters = {}) {
    return findGroups(this.groups(), filters).map(publicGroup);
  }

  /** Подбор группы: по коду, иначе по курсу/названию группы/преподавателю */
  resolve({ groupCode, course, group, teacher }) {
    const all = this.groups();
    if (groupCode) {
      const g = all.find(x => norm(x.code) === norm(groupCode));
      if (g) return { group: g };
    }
    if (!course) return { group: null };
    let list = findGroups(all, { course, teacher, only_free: false });
    if (group) {
      const byName = list.filter(g => norm(g.group) && (norm(g.group).includes(norm(group)) || norm(group).includes(norm(g.group))));
      if (byName.length) list = byName;
    }
    if (list.length === 1) return { group: list[0] };
    return { group: null, options: list };
  }

  /**
   * Запись студента.
   * @param {object} p name, phone, email, groupCode | course (+group, teacher), comment, trial, source
   */
  async enroll(p) {
    const name = String(p.name || '').trim().replace(/\s+/g, ' ');
    const phone = String(p.phone || '').trim();
    const email = String(p.email || '').trim();
    if (name.length < 2 || name.length > 80) throw new EnrollError('bad_name', 'Укажите имя студента');
    const digits = phoneDigits(phone);
    if (digits.length < 9 || digits.length > 15) throw new EnrollError('bad_phone', 'Укажите корректный номер телефона');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new EnrollError('bad_email', 'Некорректный email');
    const trial = !!p.trial;

    await this.knowledge.ensureFresh(0); // самые свежие записи — чтобы не переполнить группу
    const { group: g, options } = this.resolve(p);

    if (!g && options && options.length > 1) {
      throw new EnrollError('choose_group', 'Уточните группу', { options: options.map(publicGroup) });
    }
    if (!g && (p.groupCode || (!p.course && !p.allowNoGroup))) {
      throw new EnrollError('no_group', 'Группа не найдена', { options: this.find({ course: p.course }) });
    }

    const hash = phoneHash(phone);
    if (g) {
      const dup = (this.knowledge.enrollments || []).find(e => e.active && e.key === g.key && e.phone === hash);
      if (dup && !trial) return { ok: true, duplicate: true, group: publicGroup(g) };
      if (!trial && g.free <= 0) {
        throw new EnrollError('no_seats', 'В группе нет свободных мест',
          { options: this.find({ course: g.course }).filter(x => x.code !== g.code) });
      }
    }

    const status = trial ? 'Пробное занятие' : g ? 'Новая' : 'Заявка (группа не выбрана)';
    const row = [
      nowTashkent(), name, phone, email,
      g ? g.course : String(p.course || ''), g ? g.group : '', g ? g.teacher : '', g ? g.schedule : '',
      g ? g.code : '', status, String(p.source || ''), String(p.comment || '').slice(0, 500)
    ];
    const res = await this.knowledge.appendToTeachersBook(ENROLL_SHEET, HEADER, [row]);
    const fresh = g ? this.groups().find(x => x.key === g.key) : null;
    return { ok: true, row: res.firstRow, status, group: fresh ? publicGroup(fresh) : null };
  }
}

module.exports = { EnrollService, EnrollError };
