/* =========================================================
   Хранилище данных сайта (localStorage)
   Все тексты контента хранятся в трёх языках: ru / uz / en
   ========================================================= */
const STORAGE_KEY = 'itschool_data_v1';
const MESSAGES_KEY = 'itschool_messages_v1';

const IMG = (id, w = 800) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

/* Преподаватели, синхронизированные с базой знаний.
   Вынесены в константы, чтобы их же использовать в миграции сохранённых данных. */

// Абдулла Алиев — QA (заменил Нигору Хасанову; Flutter теперь ведёт Владислав Андреевич)
const QA_ROLE = { ru: 'QA Automation-инженер', uz: 'QA Automation muhandisi', en: 'QA Automation Engineer' };
const QA_BIO = { ru: 'Внедряет автотестирование в продуктовых командах.', uz: 'Mahsulot jamoalarida avtotestlashni joriy qiladi.', en: 'Introduces test automation in product teams.' };
const ABDULLA_ALIEV = {
  id: 't8', directionId: 'd8', experience: 6, company: 'Exadel', photo: IMG('photo-1519085360753-af0119f7cbe7', 500),
  name: { ru: 'Абдулла Алиев', uz: 'Abdulla Aliyev', en: 'Abdulla Aliev' },
  role: QA_ROLE,
  bio: QA_BIO
};

// Кислов Влад — DevOps (заменил Сардора Назарова)
const KISLOV_VLAD_NAME = { ru: 'Кислов Влад', uz: 'Kislov Vlad', en: 'Vlad Kislov' };

// Владислав Андреевич — Flutter
const VLADISLAV_ANDREEVICH = {
  id: 't6', directionId: 'd3', experience: 5, company: 'Click', photo: IMG('photo-1560250097-0b93528c311a', 500),
  name: { ru: 'Владислав Андреевич', uz: 'Vladislav Andreyevich', en: 'Vladislav Andreevich' },
  role: { ru: 'Flutter-разработчик', uz: 'Flutter dasturchi', en: 'Flutter Developer' },
  bio: { ru: 'Разрабатывает кроссплатформенные мобильные приложения для iOS и Android.', uz: 'iOS va Android uchun krossplatforma mobil ilovalar ishlab chiqadi.', en: 'Builds cross-platform mobile apps for iOS and Android.' }
};

const DATA_VERSION = 3;

const DEFAULT_DATA = {
  version: DATA_VERSION,
  admin: { login: 'admin', password: 'admin123' },

  school: {
    name: 'CodeCraft Academy',
    tagline: {
      ru: 'IT-школа нового поколения в Ташкенте',
      uz: 'Toshkentdagi yangi avlod IT-maktabi',
      en: 'A new-generation IT school in Tashkent'
    },
    description: {
      ru: 'Учим программированию, дизайну и работе с данными с нуля до первой работы. Практика на реальных проектах, менторы из ведущих IT-компаний и помощь в трудоустройстве.',
      uz: 'Dasturlash, dizayn va ma’lumotlar bilan ishlashni noldan birinchi ishgacha o‘rgatamiz. Real loyihalarda amaliyot, yetakchi IT-kompaniyalardan mentorlar va ishga joylashishda yordam.',
      en: 'We teach programming, design and data from zero to your first job. Hands-on real projects, mentors from leading IT companies and career support.'
    },
    heroType: 'image', // 'image' | 'video'
    heroUrl: IMG('photo-1522202176988-66273c2fd55f', 1400),
    address: {
      ru: 'г. Ташкент, ул. Амира Темура, 108',
      uz: 'Toshkent sh., Amir Temur ko‘chasi, 108',
      en: '108 Amir Temur St., Tashkent'
    },
    hours: {
      ru: 'Пн–Сб: 9:00 – 20:00',
      uz: 'Du–Sha: 9:00 – 20:00',
      en: 'Mon–Sat: 9:00 AM – 8:00 PM'
    },
    phone: '+998 71 200 00 00',
    email: 'info@codecraft.uz',
    telegram: 'https://t.me/',
    instagram: 'https://instagram.com/',
    mapQuery: 'Amir Temur 108, Tashkent'
  },

  stats: [
    { id: 's1', icon: '🎓', value: 2400, suffix: '+', label: { ru: 'выпускников', uz: 'bitiruvchi', en: 'graduates' } },
    { id: 's2', icon: '💼', value: 87, suffix: '%', label: { ru: 'нашли работу в IT', uz: 'IT sohasida ish topdi', en: 'got a job in IT' } },
    { id: 's3', icon: '🏢', value: 120, suffix: '+', label: { ru: 'компаний-партнёров', uz: 'hamkor kompaniya', en: 'partner companies' } },
    { id: 's4', icon: '⭐', value: 4.9, suffix: '', label: { ru: 'средняя оценка курсов', uz: 'kurslarning o‘rtacha bahosi', en: 'average course rating' } },
    { id: 's5', icon: '🚀', value: 650, suffix: '+', label: { ru: 'реальных проектов', uz: 'real loyiha', en: 'real projects' } },
    { id: 's6', icon: '📈', value: 3, suffix: 'x', label: { ru: 'рост дохода выпускников', uz: 'bitiruvchilar daromadi o‘sishi', en: 'graduate income growth' } }
  ],

  directions: [
    {
      id: 'd1', icon: '💻', color: '#4f6bff', category: 'dev', months: 8, price: '1 200 000',
      title: { ru: 'Frontend-разработка', uz: 'Frontend dasturlash', en: 'Frontend Development' },
      short: { ru: 'Создание современных интерфейсов на HTML, CSS, JavaScript и React.', uz: 'HTML, CSS, JavaScript va React’da zamonaviy interfeyslar yaratish.', en: 'Build modern interfaces with HTML, CSS, JavaScript and React.' },
      details: { ru: 'Пройдёте путь от вёрстки первой страницы до полноценного SPA на React с TypeScript. Освоите Git, работу с API, адаптивный дизайн и деплой. В портфолио — 5 проектов.', uz: 'Birinchi sahifani yaratishdan TypeScript bilan React’dagi to‘liq SPA’gacha yo‘l bosasiz. Git, API bilan ishlash, moslashuvchan dizayn va deployni o‘rganasiz. Portfolioda — 5 ta loyiha.', en: 'Go from your first web page to a full React SPA with TypeScript. Learn Git, APIs, responsive design and deployment. Finish with 5 portfolio projects.' },
      skills: ['HTML5', 'CSS3', 'JavaScript', 'React', 'TypeScript', 'Git']
    },
    {
      id: 'd2', icon: '🐍', color: '#16a34a', category: 'dev', months: 9, price: '1 300 000',
      title: { ru: 'Backend на Python', uz: 'Python’da Backend', en: 'Python Backend' },
      short: { ru: 'Серверная разработка на Python, Django и FastAPI, базы данных.', uz: 'Python, Django va FastAPI’da server dasturlash, ma’lumotlar bazalari.', en: 'Server-side development with Python, Django, FastAPI and databases.' },
      details: { ru: 'Научитесь проектировать REST API, работать с PostgreSQL и Redis, писать тесты и упаковывать сервисы в Docker. Итоговый проект — собственный веб-сервис.', uz: 'REST API loyihalash, PostgreSQL va Redis bilan ishlash, testlar yozish va servislarni Docker’ga joylashni o‘rganasiz. Yakuniy loyiha — o‘z veb-servisingiz.', en: 'Learn to design REST APIs, work with PostgreSQL and Redis, write tests and ship services in Docker. Final project: your own web service.' },
      skills: ['Python', 'Django', 'FastAPI', 'PostgreSQL', 'Docker', 'Redis']
    },
    {
      id: 'd3', icon: '📱', color: '#0ea5e9', category: 'dev', months: 8, price: '1 300 000',
      title: { ru: 'Мобильная разработка', uz: 'Mobil dasturlash', en: 'Mobile Development' },
      short: { ru: 'Кроссплатформенные приложения для iOS и Android на Flutter.', uz: 'Flutter’da iOS va Android uchun krossplatforma ilovalar.', en: 'Cross-platform iOS and Android apps with Flutter.' },
      details: { ru: 'Изучите Dart и Flutter, архитектуру приложений, работу с Firebase и публикацию в App Store и Google Play.', uz: 'Dart va Flutter, ilova arxitekturasi, Firebase bilan ishlash va App Store hamda Google Play’ga joylashni o‘rganasiz.', en: 'Learn Dart and Flutter, app architecture, Firebase and publishing to the App Store and Google Play.' },
      skills: ['Dart', 'Flutter', 'Firebase', 'REST', 'Bloc']
    },
    {
      id: 'd4', icon: '🎨', color: '#ec4899', category: 'design', months: 6, price: '1 000 000',
      title: { ru: 'UI/UX дизайн', uz: 'UI/UX dizayn', en: 'UI/UX Design' },
      short: { ru: 'Проектирование удобных и красивых интерфейсов в Figma.', uz: 'Figma’da qulay va chiroyli interfeyslarni loyihalash.', en: 'Design usable and beautiful interfaces in Figma.' },
      details: { ru: 'Исследования пользователей, прототипирование, дизайн-системы и анимация. Соберёте кейсы для портфолио на Behance.', uz: 'Foydalanuvchi tadqiqotlari, prototiplash, dizayn-tizimlar va animatsiya. Behance uchun portfolio keyslarini to‘playsiz.', en: 'User research, prototyping, design systems and motion. Build case studies for your Behance portfolio.' },
      skills: ['Figma', 'UX Research', 'Prototyping', 'Design Systems']
    },
    {
      id: 'd5', icon: '📊', color: '#f59e0b', category: 'data', months: 10, price: '1 500 000',
      title: { ru: 'Data Science и ИИ', uz: 'Data Science va SI', en: 'Data Science & AI' },
      short: { ru: 'Анализ данных, машинное обучение и нейросети на Python.', uz: 'Python’da ma’lumotlar tahlili, mashinali o‘qitish va neyron tarmoqlar.', en: 'Data analysis, machine learning and neural networks in Python.' },
      details: { ru: 'Pandas, визуализация, статистика, классические ML-модели и глубокое обучение. Работа с реальными датасетами и LLM.', uz: 'Pandas, vizualizatsiya, statistika, klassik ML modellari va chuqur o‘qitish. Real datasetlar va LLM bilan ishlash.', en: 'Pandas, visualization, statistics, classic ML models and deep learning. Work with real datasets and LLMs.' },
      skills: ['Python', 'Pandas', 'SQL', 'scikit-learn', 'PyTorch']
    },
    {
      id: 'd6', icon: '⚙️', color: '#8b5cf6', category: 'infra', months: 7, price: '1 400 000',
      title: { ru: 'DevOps-инженер', uz: 'DevOps muhandisi', en: 'DevOps Engineering' },
      short: { ru: 'Linux, CI/CD, Docker, Kubernetes и облачная инфраструктура.', uz: 'Linux, CI/CD, Docker, Kubernetes va bulutli infratuzilma.', en: 'Linux, CI/CD, Docker, Kubernetes and cloud infrastructure.' },
      details: { ru: 'Автоматизация сборки и доставки кода, мониторинг, Infrastructure as Code и работа с AWS.', uz: 'Kodni yig‘ish va yetkazishni avtomatlashtirish, monitoring, Infrastructure as Code va AWS bilan ishlash.', en: 'Automate builds and delivery, monitoring, Infrastructure as Code and AWS.' },
      skills: ['Linux', 'Docker', 'Kubernetes', 'GitHub Actions', 'Terraform', 'AWS']
    },
    {
      id: 'd7', icon: '🛡️', color: '#ef4444', category: 'infra', months: 8, price: '1 400 000',
      title: { ru: 'Кибербезопасность', uz: 'Kiberxavfsizlik', en: 'Cybersecurity' },
      short: { ru: 'Защита сетей и приложений, этичный хакинг и пентест.', uz: 'Tarmoqlar va ilovalarni himoya qilish, etik xakerlik va pentest.', en: 'Network and application security, ethical hacking and pentesting.' },
      details: { ru: 'Сетевые протоколы, анализ уязвимостей, OWASP Top 10, SOC и реагирование на инциденты. Практика на CTF.', uz: 'Tarmoq protokollari, zaifliklarni tahlil qilish, OWASP Top 10, SOC va hodisalarga javob berish. CTF’da amaliyot.', en: 'Network protocols, vulnerability analysis, OWASP Top 10, SOC and incident response. CTF practice.' },
      skills: ['Networking', 'Kali Linux', 'OWASP', 'SIEM', 'CTF']
    },
    {
      id: 'd8', icon: '🧪', color: '#14b8a6', category: 'dev', months: 5, price: '900 000',
      title: { ru: 'QA-тестирование', uz: 'QA testlash', en: 'QA Testing' },
      short: { ru: 'Ручное и автоматизированное тестирование ПО.', uz: 'Dasturiy ta’minotni qo‘lda va avtomatlashtirilgan testlash.', en: 'Manual and automated software testing.' },
      details: { ru: 'Тест-дизайн, баг-репорты, тестирование API в Postman и автотесты на Playwright.', uz: 'Test-dizayn, bag-reportlar, Postman’da API testlash va Playwright’da avtotestlar.', en: 'Test design, bug reports, API testing with Postman and automated tests with Playwright.' },
      skills: ['Test Design', 'Postman', 'SQL', 'Playwright', 'Jira']
    }
  ],

  teachers: [
    {
      id: 't1', directionId: 'd1', experience: 8, company: 'EPAM', photo: IMG('photo-1507003211169-0a1dd7228f2d', 500),
      name: { ru: 'Азиз Каримов', uz: 'Aziz Karimov', en: 'Aziz Karimov' },
      role: { ru: 'Senior Frontend-разработчик', uz: 'Senior Frontend dasturchi', en: 'Senior Frontend Developer' },
      bio: { ru: 'Разрабатывает интерфейсы для финтех-продуктов. Обучил более 300 студентов.', uz: 'Fintex mahsulotlari uchun interfeyslar ishlab chiqadi. 300 dan ortiq talabani o‘qitgan.', en: 'Builds interfaces for fintech products. Has taught over 300 students.' }
    },
    {
      id: 't2', directionId: 'd2', experience: 10, company: 'Uzum', photo: IMG('photo-1500648767791-00dcc994a43e', 500),
      name: { ru: 'Тимур Юсупов', uz: 'Temur Yusupov', en: 'Temur Yusupov' },
      role: { ru: 'Python Backend-разработчик', uz: 'Python Backend dasturchi', en: 'Python Backend Developer' },
      bio: { ru: 'Проектирует высоконагруженные сервисы электронной коммерции.', uz: 'Yuqori yuklamali elektron tijorat servislarini loyihalaydi.', en: 'Designs high-load e-commerce services.' }
    },
    {
      id: 't3', directionId: 'd4', experience: 6, company: 'Payme', photo: IMG('photo-1494790108377-be9c29b29330', 500),
      name: { ru: 'Малика Рахимова', uz: 'Malika Rahimova', en: 'Malika Rakhimova' },
      role: { ru: 'Lead UI/UX дизайнер', uz: 'Lead UI/UX dizayner', en: 'Lead UI/UX Designer' },
      bio: { ru: 'Создала дизайн-систему для мобильного банкинга с миллионом пользователей.', uz: 'Million foydalanuvchili mobil banking uchun dizayn-tizim yaratgan.', en: 'Created a design system for a mobile banking app with a million users.' }
    },
    {
      id: 't4', directionId: 'd5', experience: 7, company: 'Yandex', photo: IMG('photo-1438761681033-6461ffad8d80', 500),
      name: { ru: 'Дилноза Алиева', uz: 'Dilnoza Aliyeva', en: 'Dilnoza Aliyeva' },
      role: { ru: 'Data Scientist', uz: 'Data Scientist', en: 'Data Scientist' },
      bio: { ru: 'Строит рекомендательные системы и ML-модели прогнозирования спроса.', uz: 'Tavsiya tizimlari va talabni prognozlash ML modellarini quradi.', en: 'Builds recommender systems and demand-forecasting ML models.' }
    },
    {
      id: 't5', directionId: 'd6', experience: 9, company: 'Beeline', photo: IMG('photo-1472099645785-5658abf4ff4e', 500),
      name: KISLOV_VLAD_NAME,
      role: { ru: 'DevOps-инженер', uz: 'DevOps muhandisi', en: 'DevOps Engineer' },
      bio: { ru: 'Автоматизирует инфраструктуру в Kubernetes для сотен микросервисов.', uz: 'Yuzlab mikroservislar uchun Kubernetes infratuzilmasini avtomatlashtiradi.', en: 'Automates Kubernetes infrastructure for hundreds of microservices.' }
    },
    VLADISLAV_ANDREEVICH,
    {
      id: 't7', directionId: 'd7', experience: 11, company: 'Kapitalbank', photo: IMG('photo-1506794778202-cad84cf45f1d', 500),
      name: { ru: 'Бахтиёр Ташпулатов', uz: 'Baxtiyor Toshpo‘latov', en: 'Bakhtiyor Tashpulatov' },
      role: { ru: 'Специалист по кибербезопасности', uz: 'Kiberxavfsizlik mutaxassisi', en: 'Cybersecurity Specialist' },
      bio: { ru: 'Руководит отделом информационной безопасности, сертифицирован OSCP.', uz: 'Axborot xavfsizligi bo‘limiga rahbarlik qiladi, OSCP sertifikatiga ega.', en: 'Heads an information security department, OSCP certified.' }
    },
    ABDULLA_ALIEV
  ],

  news: [
    {
      id: 'n1', type: 'event', date: '2026-12-05', image: IMG('photo-1540575467063-178a50c2df87'),
      title: { ru: 'День открытых дверей', uz: 'Ochiq eshiklar kuni', en: 'Open Day' },
      text: { ru: 'Познакомьтесь с преподавателями, посетите пробные уроки и выберите направление. Вход свободный.', uz: 'O‘qituvchilar bilan tanishing, sinov darslariga qatnashing va yo‘nalishni tanlang. Kirish bepul.', en: 'Meet our teachers, attend trial lessons and choose your track. Free entry.' }
    },
    {
      id: 'n2', type: 'event', date: '2026-12-19', image: IMG('photo-1504384308090-c894fdcc538d'),
      title: { ru: 'Хакатон CodeCraft 2026', uz: 'CodeCraft 2026 xakatoni', en: 'CodeCraft Hackathon 2026' },
      text: { ru: '48 часов, командная разработка и призовой фонд 30 000 000 сум для лучших проектов.', uz: '48 soat, jamoaviy dasturlash va eng yaxshi loyihalar uchun 30 000 000 so‘m mukofot jamg‘armasi.', en: '48 hours of team development and a 30,000,000 UZS prize pool for the best projects.' }
    },
    {
      id: 'n3', type: 'news', date: '2026-11-10', image: IMG('photo-1531482615713-2afd69097998'),
      title: { ru: 'Открыт набор на курс «Кибербезопасность»', uz: '«Kiberxavfsizlik» kursiga qabul ochildi', en: 'Enrollment open for Cybersecurity' },
      text: { ru: 'Новый курс с практикой на CTF-соревнованиях стартует в январе. Количество мест ограничено.', uz: 'CTF musobaqalarida amaliyot bilan yangi kurs yanvarda boshlanadi. O‘rinlar soni cheklangan.', en: 'A new course with CTF practice starts in January. Limited seats.' }
    },
    {
      id: 'n4', type: 'news', date: '2026-10-28', image: IMG('photo-1517694712202-14dd9538aa97'),
      title: { ru: '45 выпускников получили офферы', uz: '45 bitiruvchi ish taklifi oldi', en: '45 graduates received job offers' },
      text: { ru: 'Осенний поток Frontend и Backend завершился: 45 студентов уже работают в компаниях-партнёрах.', uz: 'Frontend va Backend kuzgi oqimi yakunlandi: 45 talaba allaqachon hamkor kompaniyalarda ishlamoqda.', en: 'The autumn Frontend and Backend cohort graduated: 45 students already work at partner companies.' }
    },
    {
      id: 'n5', type: 'event', date: '2027-01-15', image: IMG('photo-1515187029135-18ee286d815b'),
      title: { ru: 'Митап: ИИ в разработке', uz: 'Mitap: Dasturlashda SI', en: 'Meetup: AI in Development' },
      text: { ru: 'Как нейросети меняют работу программистов — доклады и дискуссия с экспертами.', uz: 'Neyron tarmoqlar dasturchilar ishini qanday o‘zgartirmoqda — ma’ruzalar va mutaxassislar bilan muhokama.', en: 'How neural networks are changing developers’ work — talks and a panel with experts.' }
    }
  ]
};

/* ---------- API хранилища ---------- */
const Store = {
  get() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return Store.migrate(JSON.parse(raw));
    } catch (e) { /* storage недоступен */ }
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  },
  /* Обновление данных, сохранённых через админку до изменений в коде */
  migrate(data) {
    const v = data.version || 1;
    if (v < 2 && Array.isArray(data.teachers)) {
      // Камила Усманова и Нигора Хасанова заменены одним преподавателем — Абдуллой Алиевым
      const isOld = t => t && t.name && ['Камила Усманова', 'Нигора Хасанова'].includes(t.name.ru);
      const idx = data.teachers.findIndex(isOld);
      const hasAbdulla = data.teachers.some(t => t && t.name && t.name.ru === 'Абдулла Алиев');
      const abdulla = JSON.parse(JSON.stringify(ABDULLA_ALIEV));
      if (data.teachers.some(t => t && t.id === abdulla.id && !isOld(t))) abdulla.id = uid('t');
      if (!hasAbdulla && idx >= 0) data.teachers.splice(idx, 1, abdulla);
      data.teachers = data.teachers.filter(t => !isOld(t));
    }
    if (v < 3 && Array.isArray(data.teachers)) {
      // Синхронизация с базой знаний: Сардор Назаров → Кислов Влад,
      // Flutter у Абдуллы Алиева забрал новый преподаватель Владислав Андреевич
      const clone = o => JSON.parse(JSON.stringify(o));
      const byName = n => data.teachers.findIndex(t => t && t.name && t.name.ru === n);

      const sardor = byName('Сардор Назаров');
      if (sardor >= 0) data.teachers[sardor].name = clone(KISLOV_VLAD_NAME);

      const abdulla = data.teachers[byName('Абдулла Алиев')];
      if (abdulla) {
        if (abdulla.directionId2 === 'd3') delete abdulla.directionId2;
        // Роль и описание меняем, только если они остались прежними (не правились в админке)
        if (abdulla.role && /Flutter/.test(abdulla.role.ru || '')) { abdulla.role = clone(QA_ROLE); abdulla.bio = clone(QA_BIO); }
      }

      if (byName('Владислав Андреевич') < 0) {
        const vlad = clone(VLADISLAV_ANDREEVICH);
        if (data.teachers.some(t => t && t.id === vlad.id)) vlad.id = uid('t');
        const after = byName('Кислов Влад');
        data.teachers.splice(after >= 0 ? after + 1 : data.teachers.length, 0, vlad);
      }
    }
    if (v < DATA_VERSION) {
      data.version = DATA_VERSION;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
    }
    return data;
  },
  save(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; }
    catch (e) { alert('Не удалось сохранить данные: ' + e.message); return false; }
  },
  reset() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  },
  getMessages() {
    try { return JSON.parse(localStorage.getItem(MESSAGES_KEY)) || []; } catch (e) { return []; }
  },
  saveMessages(list) {
    try { localStorage.setItem(MESSAGES_KEY, JSON.stringify(list)); return true; } catch (e) { return false; }
  },
  addMessage(msg) {
    const list = Store.getMessages();
    list.unshift({ id: 'm' + Date.now(), date: new Date().toISOString(), read: false, ...msg });
    return Store.saveMessages(list);
  }
};

/* Текст на нужном языке с запасным вариантом */
function tr(obj, lang) {
  if (obj == null) return '';
  if (typeof obj === 'string') return obj;
  return obj[lang] || obj.ru || obj.en || obj.uz || '';
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function uid(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

/* ---------- Тема (общая для сайта и админки) ---------- */
const Theme = {
  KEY: 'itschool_theme',
  init() {
    let t = null;
    try { t = localStorage.getItem(Theme.KEY); } catch (e) {}
    if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    Theme.apply(t);
  },
  apply(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(Theme.KEY, t); } catch (e) {}
  },
  toggle() {
    Theme.apply(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  }
};
Theme.init();

/* =========================================================
   Синхронизация учителей с RAG-данными (таблица «Преподаватели и расписание» / документы)
   Источник — сервер (/api/teachers):
   - таблица «Преподаватели и расписание» (Excel / Google Таблицы): из неё берутся ВСЕ данные
     учителя — имена и должности на 3 языках, курсы, фото, описание, опыт, компания, расписание;
   - либо разделы «### Имя — Должность» в документах: тогда берутся только состав, имя,
     должность и направления, а фото/описание остаются из админки.
   ========================================================= */
const RagSync = {
  enabled: false,      // true, если список учителей получен с сервера
  full: false,         // true, если все данные учителей ведутся в таблице
  from: null,          // { file, url } — откуда взяты учителя
  teachers: null,

  async fetch() {
    if (location.protocol === 'file:') return null;
    try {
      const res = await fetch('/api/teachers', { cache: 'no-store' });
      if (!res.ok) return null;
      const json = await res.json();
      if (!Array.isArray(json.teachers) || !json.teachers.length) return null;
      RagSync.from = json.from || null;
      RagSync.full = !!(json.from && json.from.full);
      return json.teachers;
    } catch (e) { return null; }
  },

  /* Транслитерация имени для узбекской (латиница) и английской версий */
  translit(str, lang) {
    const common = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', ў: 'o‘', қ: 'q', ғ: 'g‘', ҳ: 'h' };
    const map = lang === 'uz' ? { ...common, х: 'x', ж: 'j' } : { ...common, х: 'kh', ж: 'zh', щ: 'shch' };
    return String(str).split('').map(ch => {
      const low = ch.toLowerCase();
      if (!(low in map)) return ch;
      const t = map[low];
      return ch !== low && t ? t[0].toUpperCase() + t.slice(1) : t;
    }).join('');
  },

  /* Тот же человек, если совпадает набор слов имени или отличие в 1–2 буквы (опечатка) */
  norm(name) { return String(name || '').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(Boolean); },
  sameName(a, b) {
    const wa = RagSync.norm(a), wb = RagSync.norm(b);
    if (!wa.length || !wb.length) return false;
    if ([...wa].sort().join(' ') === [...wb].sort().join(' ')) return true;
    const x = wa.join(' '), y = wb.join(' ');
    if (Math.abs(x.length - y.length) > 2) return false;
    const d = Array.from({ length: x.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= y.length; j++) d[0][j] = j;
    for (let i = 1; i <= x.length; i++) {
      for (let j = 1; j <= y.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
      }
    }
    return d[x.length][y.length] <= 2;
  },

  /* Курс из RAG → направление сайта (по общим значимым словам названия) */
  tokens(s) {
    const STOP = new Set(['и', 'на', 'для', 'в', 'с', 'разра', 'курс', 'основ', 'лет']);
    return String(s || '').toLowerCase().replace(/ё/g, 'е').split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean).map(w => (w.length > 5 ? w.slice(0, 5) : w)).filter(w => !STOP.has(w) && !/^\d+$/.test(w));
  },
  courseToDirection(course, directions) {
    const ct = new Set(RagSync.tokens(course));
    let best = null, bestScore = 0;
    for (const d of directions || []) {
      const dt = RagSync.tokens(tr(d.title, 'ru'));
      if (!dt.length) continue;
      const score = dt.filter(t => ct.has(t)).length / dt.length;
      if (score > bestScore) { best = d; bestScore = score; }
    }
    return bestScore >= 0.5 ? best.id : null;
  },

  capitalize(s) { s = String(s || '').trim(); return s ? s[0].toUpperCase() + s.slice(1) : s; },

  /**
   * Применяет список учителей из RAG к данным сайта.
   * @returns {boolean} изменились ли данные
   */
  apply(data, ragTeachers) {
    if (!Array.isArray(ragTeachers) || !ragTeachers.length || !Array.isArray(data.teachers)) return false;
    const before = JSON.stringify([data.teachers, data.teachersArchive || []]);
    // Архив — учителя, которых убрали из RAG: если вернут, фото и описание восстановятся
    const pool = [...data.teachers, ...(data.teachersArchive || [])];
    const used = new Set();
    const result = [];

    const val = (o, l) => (o && typeof o === 'object' ? String(o[l] || '').trim() : (l === 'ru' ? String(o || '').trim() : ''));

    for (const rt of ragTeachers) {
      const nameRu = val(rt.name, 'ru');
      if (!nameRu) continue;
      const dirIds = [...new Set((rt.courses || []).map(c => RagSync.courseToDirection(c, data.directions)).filter(Boolean))];
      // Сопоставление: по ID из таблицы, затем по имени (точно или с опечаткой)
      let t = (rt.id && pool.find(p => !used.has(p) && p.id === rt.id))
           || pool.find(p => !used.has(p) && p.name && p.name.ru === nameRu)
           || pool.find(p => !used.has(p) && p.name && RagSync.sameName(p.name.ru, nameRu));
      const role = RagSync.capitalize(val(rt.role, 'ru'));

      if (t) {
        used.add(t);
        t = JSON.parse(JSON.stringify(t));
      } else {
        // Новый преподаватель: карточка с инициалами, пока не добавлено фото
        let id = rt.id || 'rag-' + RagSync.translit(nameRu, 'en').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        while (result.some(r => r.id === id) || pool.some(p => p.id === id)) id += '-2';
        t = { id, photo: '', experience: '', company: '', bio: {}, name: {}, role: {} };
      }
      if (rt.id) t.id = rt.id;

      // Имя: переводы из таблицы; если их нет — прежние (для того же имени) или транслитерация
      const sameRu = t.name && t.name.ru === nameRu;
      t.name = {
        ru: nameRu,
        uz: val(rt.name, 'uz') || (sameRu && t.name.uz) || RagSync.translit(nameRu, 'uz'),
        en: val(rt.name, 'en') || (sameRu && t.name.en) || RagSync.translit(nameRu, 'en')
      };

      // Должность: переводы из таблицы; если их нет и должность сменилась — строим из направления
      const dir = data.directions.find(d => d.id === dirIds[0]);
      const roleSame = t.role && (t.role.ru || '').toLowerCase() === role.toLowerCase();
      t.role = {
        ru: role,
        uz: val(rt.role, 'uz') || (roleSame && t.role.uz) || (dir ? `${tr(dir.title, 'uz')} o‘qituvchisi` : role),
        en: val(rt.role, 'en') || (roleSame && t.role.en) || (dir ? `${tr(dir.title, 'en')} Instructor` : role)
      };

      // Таблица — полный источник: фото, описание, опыт, компания и расписание тоже оттуда
      if (RagSync.full) {
        t.photo = String(rt.photo || '').trim();
        t.experience = String(rt.experience || '').trim();
        t.company = String(rt.company || '').trim();
        t.bio = { ru: val(rt.bio, 'ru'), uz: val(rt.bio, 'uz'), en: val(rt.bio, 'en') };
        t.schedule = Array.isArray(rt.schedule) ? rt.schedule : [];
        t.courses = rt.courses || [];
      }
      t.directionId = dirIds[0] || '';
      if (dirIds[1]) t.directionId2 = dirIds[1]; else delete t.directionId2;
      t.fromRag = true;
      result.push(t);
    }

    data.teachers = result;
    data.teachersArchive = pool.filter(p => !used.has(p) && p.name && !result.some(r => r.id === p.id));
    return JSON.stringify([data.teachers, data.teachersArchive]) !== before;
  },

  /** Загрузить учителей с сервера и применить; сохраняет данные, если что-то поменялось */
  async sync(data) {
    const list = await RagSync.fetch();
    if (!list) { RagSync.enabled = false; return false; }
    RagSync.enabled = true;
    RagSync.teachers = list;
    const changed = RagSync.apply(data, list);
    if (changed) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {} }
    return changed;
  },

  /* ---------- Цены из прайс-листа ---------- */
  pricesEnabled: false,
  pricesFrom: null,

  /* 1250000 → «1 250 000» */
  money(n) { return n == null ? '' : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); },

  /**
   * Цена, срок, полная стоимость и рассрочка направлений — из строк прайс-листа.
   * Курс сопоставляется с направлением по названию (без уточнений в скобках).
   * @returns {boolean} изменились ли данные
   */
  applyPrices(data, prices) {
    if (!Array.isArray(prices) || !prices.length || !Array.isArray(data.directions)) return false;
    const before = JSON.stringify(data.directions);
    const byDir = new Map();
    for (const p of prices) {
      const id = RagSync.courseToDirection(String(p.course).replace(/\([^)]*\)/g, ' '), data.directions);
      if (id && !byDir.has(id)) byDir.set(id, p);
    }
    for (const d of data.directions) {
      const p = byDir.get(d.id);
      if (!p) { delete d.fromPrice; continue; }
      d.price = RagSync.money(p.monthly);
      if (p.months) d.months = p.months;
      d.priceTotal = p.total != null ? RagSync.money(p.total) : '';
      d.pricePrepay = p.prepay != null ? RagSync.money(p.prepay) : '';
      d.installment = p.installment;
      d.fromPrice = true;
    }
    return JSON.stringify(data.directions) !== before;
  },

  async syncPrices(data) {
    if (location.protocol === 'file:') return false;
    try {
      const res = await fetch('/api/prices', { cache: 'no-store' });
      if (!res.ok) return false;
      const json = await res.json();
      if (!Array.isArray(json.prices) || !json.prices.length) { RagSync.pricesEnabled = false; return false; }
      RagSync.pricesEnabled = true;
      RagSync.pricesFrom = json.from || null;
      const changed = RagSync.applyPrices(data, json.prices);
      if (changed) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {} }
      return changed;
    } catch (e) { return false; }
  }
};
