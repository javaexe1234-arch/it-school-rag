/* =========================================================
   RAG: индекс по базе знаний (lib/kb.js) и поиск
   Гибридный поиск: эмбеддинги Gemini (если доступны) + BM25
   ========================================================= */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildKnowledgeBase } = require('./kb');

/* ---------- BM25 ---------- */
const STOP = new Set(('и в во не что он на я с со как а то все она так его но да ты к у же вы за бы по только ее мне было вот от меня еще нет о из ему ' +
  'теперь когда даже ну вдруг ли если уже или ни быть был него до вас нибудь опять уж вам ведь там потом себя ничего ей может они тут где есть надо ' +
  'ней для мы тебя их чем была сам чтоб без будто чего раз тоже себе под будет ж тогда кто этот того потому этого какой совсем ним здесь этом один ' +
  'почти мой тем чтобы нее сейчас были куда зачем всех никогда можно при наконец два об другой хоть после над больше тот через эти нас про всего ' +
  'них какая много разве три эту моя впрочем хорошо свою этой перед иногда лучше чуть том нельзя такой им более всегда конечно всю между ' +
  'the a an and or of to in on for is are be with what how do does can i you your it this that at by from ' +
  'va bu u men siz qanday nima uchun bilan ham da qancha bor'
).split(' '));

function tokenize(str) {
  return String(str).toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[‘’'ʻʼ`]/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(w => w && !STOP.has(w))
    // Грубый стемминг: первые 5 символов — достаточно для русских/узбекских окончаний
    .map(w => (w.length > 5 && /\p{L}/u.test(w) ? w.slice(0, 5) : w));
}

class BM25 {
  constructor(docs, k1 = 1.4, b = 0.75) {
    this.k1 = k1; this.b = b;
    this.docs = docs.map(d => {
      const tf = new Map();
      const toks = tokenize(d);
      toks.forEach(t => tf.set(t, (tf.get(t) || 0) + 1));
      return { tf, len: toks.length };
    });
    this.avg = this.docs.reduce((s, d) => s + d.len, 0) / Math.max(1, this.docs.length);
    this.df = new Map();
    this.docs.forEach(d => d.tf.forEach((_, t) => this.df.set(t, (this.df.get(t) || 0) + 1)));
  }
  scores(query) {
    const q = [...new Set(tokenize(query))];
    const N = this.docs.length;
    return this.docs.map(d => q.reduce((s, t) => {
      const f = d.tf.get(t); if (!f) return s;
      const n = this.df.get(t);
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      return s + idf * (f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + this.b * d.len / this.avg));
    }, 0));
  }
}

/* ---------- Векторный индекс ---------- */
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

class RagIndex {
  /**
   * @param {object} opts
   * @param {function} opts.getDocs  () => [{ file, markdown }] — текущие документы из KnowledgeStore
   * @param {string} opts.cacheFile файл кэша эмбеддингов
   * @param {object} opts.gemini    клиент Gemini (embedDocuments / embedQuery) или null
   */
  constructor({ getDocs, cacheFile, kbFile, gemini }) {
    this.getDocs = getDocs;
    this.cacheFile = cacheFile;
    this.kbFile = kbFile;
    this.gemini = gemini;
    this.chunks = [];
    this.bm25 = new BM25([]);
    this.vectors = null;
    this._building = null;   // текущая пересборка
    this._dirty = false;     // файлы изменились во время пересборки
    this._retryTimer = null;
  }

  /**
   * Пересборка индекса. Вызовы не пересекаются: если сборка уже идёт,
   * после неё будет выполнена ещё одна — с самыми свежими файлами.
   */
  build() {
    if (this._building) { this._dirty = true; return this._building; }
    this._building = (async () => {
      do {
        this._dirty = false;
        await this._buildOnce();
      } while (this._dirty);
    })().finally(() => { this._building = null; });
    return this._building;
  }

  /* Markdown → база знаний { id, title, text } (навык google-ai-studio-rag).
     Результат сохраняется в kb/knowledge-base.json, чтобы его можно было посмотреть. */
  _loadKnowledgeBase() {
    const kb = buildKnowledgeBase(this.getDocs());
    this.warnings = kb.warnings || [];
    this.warnings.forEach(w => console.warn('[rag] ⚠ Несогласованные данные: ' + w));
    if (this.kbFile) {
      try {
        fs.mkdirSync(path.dirname(this.kbFile), { recursive: true });
        fs.writeFileSync(this.kbFile, JSON.stringify(kb, null, 2));
      } catch (e) { console.warn('[rag] Не удалось сохранить базу знаний:', e.message); }
    }
    return kb.map(c => ({
      id: c.id,
      source: c.source,
      title: c.title,
      docTitle: c.title.split(' — ')[0],
      heading: c.section,
      text: c.text
    }));
  }

  _readCache() {
    try {
      const c = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
      if (c.model === this.gemini.embedModel && c.items) return c.items;
    } catch (e) { /* кэша нет или старый формат */ }
    return {};
  }

  async _buildOnce() {
    // Всё собираем в локальные переменные и подменяем разом —
    // поиск никогда не видит наполовину собранный индекс
    const chunks = this._loadKnowledgeBase();
    const bm25 = new BM25(chunks.map(c => c.text));
    let vectors = null;

    if (this.gemini) {
      // Кэш по хэшу каждого фрагмента: заново считаются только изменённые
      const cache = this._readCache();
      const hashes = chunks.map(c => crypto.createHash('sha256').update(c.heading + '\n' + c.text).digest('hex'));
      const missing = chunks.map((c, i) => i).filter(i => !cache[hashes[i]]);
      try {
        if (missing.length) {
          const vecs = await this.gemini.embedDocuments(missing.map(i => ({ title: chunks[i].heading, text: chunks[i].text })));
          missing.forEach((i, k) => { cache[hashes[i]] = vecs[k]; });
          console.log(`[rag] Новых эмбеддингов: ${missing.length}`);
        }
        vectors = hashes.map(h => cache[h]);
        const items = {};
        hashes.forEach(h => { items[h] = cache[h]; }); // старые фрагменты удаляем из кэша
        fs.mkdirSync(path.dirname(this.cacheFile), { recursive: true });
        fs.writeFileSync(this.cacheFile, JSON.stringify({ model: this.gemini.embedModel, items }));
      } catch (e) {
        vectors = null;
        const wait = Math.min(Math.max(Number((e.message.match(/retry in ([\d.]+)s/) || [])[1]) || 30, 5), 120);
        console.warn(`[rag] Эмбеддинги недоступны (${e.status || 'ошибка'}), пока работает только BM25. Повтор через ${Math.ceil(wait)} с.`);
        clearTimeout(this._retryTimer);
        this._retryTimer = setTimeout(() => this.build(), wait * 1000);
        this._retryTimer.unref && this._retryTimer.unref();
      }
    }

    this.chunks = chunks;
    this.bm25 = bm25;
    this.vectors = vectors;
    console.log(`[rag] Индекс готов: фрагментов ${chunks.length}, поиск: ${vectors ? 'эмбеддинги + BM25' : 'только BM25'}`);
  }

  async search(query, k = 5) {
    // Снимок индекса: если во время запроса он пересоберётся, данные не перемешаются
    const { chunks, bm25, vectors } = this;
    const bm = bm25.scores(query);
    const bmMax = Math.max(...bm, 1e-9);
    let vec = null;
    if (vectors) {
      try {
        const qv = await this.gemini.embedQuery(query);
        vec = vectors.map(v => cosine(qv, v));
      } catch (e) {
        console.warn('[rag] Ошибка эмбеддинга запроса, fallback на BM25:', e.message);
      }
    }
    const scored = chunks.map((c, i) => ({
      chunk: c,
      score: vec ? 0.7 * vec[i] + 0.3 * (bm[i] / bmMax) : bm[i] / bmMax,
      // Косинусное сходство в процентах (как similarityPercent в навыке); null без эмбеддингов
      similarityPercent: vec ? Math.round(vec[i] * 100) : null
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
  }
}

module.exports = { RagIndex, tokenize };
