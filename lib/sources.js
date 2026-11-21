/* =========================================================
   Источники документов базы знаний
   - LocalSource:       папка на диске (knowledge/)
   - GoogleDriveSource: папка на Google Drive (сервисный аккаунт Google Cloud)
   Оба отдают одинаковый список: { id, name, kind, version, url } и содержимое файла (Buffer).
   kind: 'docx' | 'xlsx' | 'md'
   ========================================================= */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KIND_BY_EXT = { '.docx': 'docx', '.xlsx': 'xlsx', '.md': 'md', '.txt': 'md' };

class LocalSource {
  constructor(dir) {
    this.type = 'local';
    this.dir = dir;
  }
  describe() { return { type: this.type, location: this.dir }; }
  get cacheKey() { return 'local:' + this.dir; }

  async list() {
    return fs.readdirSync(this.dir, { withFileTypes: true })
      .filter(e => e.isFile() && !e.name.startsWith('~$') && !e.name.startsWith('.') && KIND_BY_EXT[path.extname(e.name).toLowerCase()])
      .map(e => {
        const st = fs.statSync(path.join(this.dir, e.name));
        return { id: e.name, name: e.name, kind: KIND_BY_EXT[path.extname(e.name).toLowerCase()], version: `${st.mtimeMs}-${st.size}`, modified: st.mtime.toISOString() };
      });
  }
  async read(file) { return fs.readFileSync(path.join(this.dir, file.id)); }

  /* Текущая версия файла — для защиты от одновременной правки */
  async stat(file) {
    const st = fs.statSync(path.join(this.dir, file.id));
    return { version: `${st.mtimeMs}-${st.size}` };
  }
  /* Запись: сначала во временный файл, затем замена — файл не останется «наполовину записанным» */
  async write(file, buf) {
    const p = path.join(this.dir, file.id), tmp = p + '.tmp';
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, p);
  }

  /* Мгновенная реакция на сохранение файла (дополнительно к периодической проверке) */
  watch(onChange) {
    try {
      let t = null;
      fs.watch(this.dir, () => { clearTimeout(t); t = setTimeout(onChange, 800); });
    } catch (e) { /* не критично */ }
  }
}

/* ---------- Google Drive ---------- */
const DRIVE = 'https://www.googleapis.com/drive/v3';
const MIME = {
  gdoc: 'application/vnd.google-apps.document',
  gsheet: 'application/vnd.google-apps.spreadsheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

class GoogleDriveSource {
  /**
   * @param {object} o
   * @param {string} [o.folderId]  ID папки Google Drive; если не задан — ищется папка,
   *                               которой поделились с сервисным аккаунтом (автопоиск)
   * @param {object} o.credentials JSON-ключ сервисного аккаунта
   */
  constructor({ folderId, credentials }) {
    if (!credentials || !credentials.client_email || !credentials.private_key) {
      throw new Error('Неверный JSON-ключ сервисного аккаунта (нет client_email / private_key)');
    }
    this.type = 'google-drive';
    this.folderId = folderId || null;
    this.auto = !folderId;
    this.folderName = null;
    this.creds = credentials;
    this.token = null;
    this.tokenExp = 0;
  }
  describe() {
    return {
      type: this.type,
      location: this.folderId ? `https://drive.google.com/drive/folders/${this.folderId}` : `Google Drive: файлы, открытые для ${this.creds.client_email}`,
      folder: this.folderName, auto: this.auto, account: this.creds.client_email, skipped: this.skipped || []
    };
  }

  get cacheKey() { return `gdrive:${this.auto ? 'auto' : this.folderId}:${this.creds.client_email}`; }

  /* Автопоиск: папка, которой поделились с сервисным аккаунтом.
     Если папок несколько — предпочитается та, где в названии есть «база знаний» / «knowledge» / «rag». */
  async discoverFolder() {
    const q = encodeURIComponent("mimeType = 'application/vnd.google-apps.folder' and trashed = false");
    const fields = encodeURIComponent('files(id, name, modifiedTime)');
    const { files } = await this.api(`${DRIVE}/files?q=${q}&fields=${fields}&pageSize=50&orderBy=modifiedTime desc&supportsAllDrives=true&includeItemsFromAllDrives=true`);
    if (!files.length) return null;
    return files.find(f => /баз[аы] знаний|knowledge|rag|ассистент/i.test(f.name)) || files[0];
  }

  /* OAuth 2.0 для сервисного аккаунта: подписанный JWT → access token (живёт 1 час) */
  async accessToken() {
    if (this.token && Date.now() < this.tokenExp - 60000) return this.token;
    const b64 = o => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const tokenUri = this.creds.token_uri || 'https://oauth2.googleapis.com/token';
    const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
      iss: this.creds.client_email,
      scope: 'https://www.googleapis.com/auth/drive', // чтение + запись в таблицу «Записи»; права ограничены доступом, выданным сервисному аккаунту
      aud: tokenUri, iat: now, exp: now + 3600
    });
    const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(this.creds.private_key).toString('base64url');
    const res = await fetch(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
      signal: AbortSignal.timeout(15000)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Google OAuth ${res.status}: ${json.error_description || json.error || res.statusText}`);
    this.token = json.access_token;
    this.tokenExp = Date.now() + (json.expires_in || 3600) * 1000;
    return this.token;
  }

  async api(url, { binary = false } = {}) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${await this.accessToken()}` }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      const msg = (j.error && j.error.message) || res.statusText;
      const hint = res.status === 404 ? ' (проверьте ID папки и что папка открыта для сервисного аккаунта)'
        : res.status === 403 ? ' (включите Google Drive API в проекте Google Cloud и выдайте сервисному аккаунту доступ к папке)' : '';
      throw new Error(`Google Drive ${res.status}: ${msg}${hint}`);
    }
    return binary ? Buffer.from(await res.arrayBuffer()) : res.json();
  }

  async list() {
    let query;
    if (this.auto) {
      // Повторяем поиск при каждой проверке: папку могли открыть, переименовать или заменить
      const folder = await this.discoverFolder();
      this.folderId = folder ? folder.id : null;
      this.folderName = folder ? folder.name : null;
      // Папкой не поделились — берём файлы, которыми поделились с сервисным аккаунтом напрямую
      query = folder
        ? `'${folder.id}' in parents and trashed = false`
        : "mimeType != 'application/vnd.google-apps.folder' and trashed = false";
      if (!folder) this.folderName = 'файлы, открытые напрямую';
    } else {
      query = `'${this.folderId}' in parents and trashed = false`;
    }
    const files = [];
    let pageToken = '';
    do {
      const q = encodeURIComponent(query);
      const fields = encodeURIComponent('nextPageToken, files(id, name, mimeType, modifiedTime, version, webViewLink)');
      const json = await this.api(`${DRIVE}/files?q=${q}&fields=${fields}&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true${pageToken ? '&pageToken=' + pageToken : ''}`);
      files.push(...json.files);
      pageToken = json.nextPageToken || '';
    } while (pageToken);

    const docs = files.map(f => {
      let kind = null, mode = 'download';
      if (f.mimeType === MIME.gdoc) { kind = 'docx'; mode = 'export'; }
      else if (f.mimeType === MIME.gsheet) { kind = 'xlsx'; mode = 'export'; }
      else if (f.mimeType === MIME.docx || /\.docx$/i.test(f.name)) kind = 'docx';
      else if (f.mimeType === MIME.xlsx || /\.xlsx$/i.test(f.name)) kind = 'xlsx';
      else if (/^text\/(markdown|plain)$/.test(f.mimeType) || /\.(md|txt)$/i.test(f.name)) kind = 'md';
      if (!kind) return null;
      return {
        id: f.id, name: f.name, kind, mode,
        version: `${f.modifiedTime}-${f.version || ''}`,
        modified: f.modifiedTime, url: f.webViewLink
      };
    }).filter(Boolean);

    // Копии одного документа («Прайс-лист.docx» и Google Документ «Прайс-лист», который появляется
    // после «Сохранить как Google Документ»): берём самую свежую, остальные пропускаем —
    // иначе в базе знаний окажутся старые и новые данные одновременно
    const base = n => n.replace(/\.(docx|xlsx|md|txt)$/i, '').replace(/^копия\s+|^copy of\s+/i, '').trim().toLowerCase();
    const newest = new Map();
    for (const d of docs) {
      const k = base(d.name), cur = newest.get(k);
      if (!cur || d.modified > cur.modified) newest.set(k, d);
    }
    this.skipped = docs.filter(d => newest.get(base(d.name)) !== d)
      .map(d => `«${d.name}» пропущен: есть более свежая версия «${newest.get(base(d.name)).name}». Удалите или переименуйте старую копию.`);
    return docs.filter(d => newest.get(base(d.name)) === d);
  }

  async read(file) {
    if (file.mode === 'export') {
      return this.api(`${DRIVE}/files/${file.id}/export?mimeType=${encodeURIComponent(MIME[file.kind])}`, { binary: true });
    }
    return this.api(`${DRIVE}/files/${file.id}?alt=media&supportsAllDrives=true`, { binary: true });
  }

  watch() { /* у Google Drive — периодическая проверка (см. KnowledgeStore) */ }

  async stat(file) {
    const f = await this.api(`${DRIVE}/files/${file.id}?fields=modifiedTime,version,capabilities(canModifyContent)&supportsAllDrives=true`);
    return { version: `${f.modifiedTime}-${f.version || ''}`, canWrite: !!(f.capabilities && f.capabilities.canModifyContent) };
  }

  /* Новая версия содержимого файла (.xlsx остаётся .xlsx, владелец и доступы не меняются) */
  async write(file, buf) {
    if (file.mode === 'export') {
      throw new Error('Запись поддерживается для таблицы в формате .xlsx; Google Таблицу (нативный формат) пока изменить нельзя');
    }
    const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=media&supportsAllDrives=true`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${await this.accessToken()}`, 'Content-Type': MIME.xlsx },
      body: buf,
      signal: AbortSignal.timeout(60000)
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      const msg = (j.error && j.error.message) || res.statusText;
      const hint = res.status === 403 ? ' (выдайте сервисному аккаунту роль «Редактор» для таблицы или папки)' : '';
      throw new Error(`Google Drive запись ${res.status}: ${msg}${hint}`);
    }
  }
}

/* ---------- Google Drive с запасным локальным источником ----------
   Пока в Google Drive нет документов (папкой ещё не поделились) — работаем с локальной папкой.
   Как только документы появляются — автоматически переключаемся на Google Drive. */
class DriveWithLocalFallback {
  constructor(google, local) {
    this.google = google;
    this.local = local;
    this.active = 'local';
    this.note = null;
  }
  get type() { return this.active === 'google' ? this.google.type : this.local.type; }
  get cacheKey() { return `fallback:${this.google.cacheKey}|${this.local.cacheKey}`; }
  describe() {
    const d = this.active === 'google' ? this.google.describe() : this.local.describe();
    return { ...d, googleAccount: this.google.creds.client_email, note: this.note };
  }
  async list() {
    try {
      const files = await this.google.list();
      if (files.length) {
        if (this.active !== 'google') console.log(`[knowledge] Google Drive: ${this.google.folderId ? `найдена папка «${this.google.folderName}»` : "найдены файлы, открытые напрямую"} — переключаюсь на Google Drive`);
        this.active = 'google';
        this.note = null;
        return files.map(f => ({ ...f, origin: 'google' }));
      }
      this.note = `В Google Drive нет документов для ${this.google.creds.client_email}: поделитесь с ним папкой (роль «Читатель»). Пока используются локальные файлы.`;
    } catch (e) {
      this.note = 'Google Drive: ' + e.message;
      // Если уже работали с Google — не переключаемся молча на локальные файлы, оставляем последние данные из Google
      if (this.active === 'google') throw e;
    }
    this.active = 'local';
    return (await this.local.list()).map(f => ({ ...f, origin: 'local' }));
  }
  read(file) { return file.origin === 'google' ? this.google.read(file) : this.local.read(file); }
  stat(file) { return file.origin === 'google' ? this.google.stat(file) : this.local.stat(file); }
  write(file, buf) { return file.origin === 'google' ? this.google.write(file, buf) : this.local.write(file, buf); }
  watch(onChange) { this.local.watch(() => { if (this.active === 'local') onChange(); }); }
}

function readCredentials(env, root) {
  const keyFile = path.resolve(root, env.GOOGLE_SERVICE_ACCOUNT_FILE || 'google-service-account.json');
  if (!fs.existsSync(keyFile)) return { keyFile, credentials: null };
  try { return { keyFile, credentials: JSON.parse(fs.readFileSync(keyFile, 'utf8')) }; }
  catch (e) { throw new Error(`Не удалось прочитать ключ сервисного аккаунта ${keyFile}: ${e.message}`); }
}

/**
 * - RAG_SOURCE=local                      → только папка knowledge/
 * - GOOGLE_DRIVE_FOLDER_ID задан          → только эта папка Google Drive
 * - есть google-service-account.json      → автопоиск папки в Google Drive, до этого — knowledge/
 * - иначе                                 → knowledge/
 */
function createSource(env, root) {
  const local = new LocalSource(path.resolve(root, env.RAG_LOCAL_DIR || 'knowledge'));
  if ((env.RAG_SOURCE || '').toLowerCase() === 'local') return local;
  const folderId = (env.GOOGLE_DRIVE_FOLDER_ID || '').trim();
  const { keyFile, credentials } = readCredentials(env, root);
  if (folderId) {
    if (!credentials) throw new Error(`Не найден ключ сервисного аккаунта ${keyFile}`);
    return new GoogleDriveSource({ folderId, credentials });
  }
  if (credentials) return new DriveWithLocalFallback(new GoogleDriveSource({ credentials }), local);
  return local;
}

module.exports = { LocalSource, GoogleDriveSource, DriveWithLocalFallback, createSource };
