// TestMaktab 2.0 — umumiy sozlamalar va namunaviy savollar banki
export const SUBJECTS = [
  { id: 'math', name: 'Matematika', icon: '🍎', color: '#ff6b6b' },
  { id: 'informatics', name: 'Informatika', icon: '🤖', color: '#6c8cff' },
  { id: 'nature', name: 'Tabiatshunoslik', icon: '🍃', color: '#4cc38a' },
  { id: 'mothertongue', name: 'Ona tili', icon: '📖', color: '#f2a93b' },
  { id: 'english', name: 'Ingliz tili', icon: '🌍', color: '#3fb8e0' },
  { id: 'history', name: 'Tarix', icon: '🍊', color: '#ff9a3c' },
  { id: 'physics', name: 'Fizika', icon: '🍌', color: '#e8c93a' },
  { id: 'chemistry', name: 'Kimyo', icon: '🍓', color: '#e4547f' },
];

export const LANGS = { uz: 'O‘zbek', tg: 'Tojik', ru: 'Rus', en: 'Ingliz' };
export const DIFFICULTIES = { easy: 'Oson', medium: 'O‘rta', hard: 'Qiyin' };
export const DEFAULT_THRESHOLDS = { gold: 90, silver: 75, bronze: 60 };
export const DEFAULT_SETTINGS = { thresholds: DEFAULT_THRESHOLDS, defaultDuck: 'duck' };

export const AVATAR_PRESETS = ['🦊', '🐼', '🐯', '🐸', '🦄', '🐙', '🦉', '🐬', '🦁', '🐧', '🤖', '🚀'];

export const IMAGE_RULES = { maxBytes: 2 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp'] };
export const AUDIO_RULES = { maxBytes: 15 * 1024 * 1024, types: ['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/aac', 'audio/mp4'] };

// Tezkor test uchun ichki namunaviy savollar (AI testlari tasdiqlanmaguncha ham ilova ishlashi uchun)
export const SAMPLE_BANK = {
  math: [
    { q: '7 × 8 = ?', options: ['54', '56', '58', '64'], correct: 1 },
    { q: '144 ning kvadrat ildizi nechaga teng?', options: ['10', '11', '12', '14'], correct: 2 },
    { q: '3/4 + 1/4 = ?', options: ['1', '4/8', '3/8', '2'], correct: 0 },
    { q: 'Uchburchak ichki burchaklari yig‘indisi necha gradus?', options: ['90', '180', '270', '360'], correct: 1 },
  ],
  informatics: [
    { q: '1 bayt necha bitga teng?', options: ['4', '8', '16', '10'], correct: 1 },
    { q: 'Quyidagilardan qaysi biri kiritish qurilmasi?', options: ['Monitor', 'Printer', 'Klaviatura', 'Karnay'], correct: 2 },
    { q: 'CPU nima?', options: ['Xotira', 'Markaziy protsessor', 'Monitor', 'Tarmoq kartasi'], correct: 1 },
  ],
  nature: [
    { q: 'O‘simliklar fotosintezda qaysi gazni yutadi?', options: ['Kislorod', 'Azot', 'Karbonat angidrid', 'Vodorod'], correct: 2 },
    { q: 'Suv necha gradusda qaynaydi (dengiz sathida)?', options: ['50', '90', '100', '120'], correct: 2 },
    { q: 'Quyoshga eng yaqin sayyora qaysi?', options: ['Venera', 'Merkuriy', 'Mars', 'Yer'], correct: 1 },
  ],
  mothertongue: [
    { q: 'Quyidagilardan qaysi biri unli tovush?', options: ['b', 'd', 'o', 'k'], correct: 2 },
    { q: '"Kitob" so‘zida nechta bo‘g‘in bor?', options: ['1', '2', '3', '4'], correct: 1 },
    { q: 'Ot qaysi savolga javob beradi?', options: ['Nima qildi?', 'Kim? Nima?', 'Qanday?', 'Nechta?'], correct: 1 },
  ],
  english: [
    { q: 'Choose the correct word: She ___ a student.', options: ['am', 'is', 'are', 'be'], correct: 1 },
    { q: '"Apple" so‘zining tarjimasi?', options: ['Banan', 'Olma', 'Nok', 'Uzum'], correct: 1 },
    { q: 'Plural of "child":', options: ['childs', 'childes', 'children', 'child'], correct: 2 },
  ],
  history: [
    { q: 'Amir Temur qaysi shaharda tug‘ilgan?', options: ['Samarqand', 'Kesh (Shahrisabz)', 'Buxoro', 'Xiva'], correct: 1 },
    { q: 'O‘zbekiston mustaqilligi qaysi yilda e’lon qilingan?', options: ['1989', '1990', '1991', '1992'], correct: 2 },
  ],
  physics: [
    { q: 'Tezlik birligi SI da qaysi?', options: ['m/s', 'kg', 'N', 'J'], correct: 0 },
    { q: 'Kuch birligi qaysi?', options: ['Joul', 'Nyuton', 'Vatt', 'Paskal'], correct: 1 },
  ],
  chemistry: [
    { q: 'Suvning kimyoviy formulasi?', options: ['CO2', 'H2O', 'O2', 'NaCl'], correct: 1 },
    { q: 'Osh tuzining formulasi?', options: ['KCl', 'NaCl', 'CaCO3', 'HCl'], correct: 1 },
  ],
};
