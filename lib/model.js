// โครงสร้างข้อสอบ + ฟังก์ชันที่ใช้ร่วมกันทั้งฝั่งเซิร์ฟเวอร์และเบราว์เซอร์
// ข้อสอบ → วิชา (subjects) → ข้อใหญ่ (questions) → ข้อย่อย (parts)

export const TYPES = ['mcq', 'tf', 'fill', 'match', 'text'];
export const TYPE_LABEL = {
  mcq: 'ปรนัยเลือกตอบ (ช้อยส์ / เช็คบอกซ์)',
  tf: 'ถูก–ผิด (มี/ไม่มีให้แก้ข้อความ)',
  fill: 'ลากคำมาเติมช่องว่าง',
  match: 'จับคู่',
  text: 'พิมพ์ตอบ',
};
export const TYPE_SHORT = { mcq: 'ปรนัย', tf: 'ถูก/ผิด', fill: 'เติมคำ', match: 'จับคู่', text: 'พิมพ์ตอบ' };
export const OPT_LABELS = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ', 'ช', 'ซ', 'ฌ', 'ญ'];

export const PHASE = {
  draft: ['ฉบับร่าง (ผู้เข้าสอบไม่เห็น)', 'gray'],
  open: ['เปิดสอบอยู่', 'ok'],
  waiting: ['รอถึงเวลาเปิด', 'warn'],
  closed: ['ปิดสอบแล้ว', 'bad'],
};

// ---------- ตัวช่วยทั่วไป ----------
export const rid = (prefix = 'x') => {
  const a = new Uint8Array(6);
  globalThis.crypto.getRandomValues(a);
  return prefix + '_' + [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
};
export const lines = (s) => String(s ?? '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
export const splitList = (s) => String(s ?? '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
// เทียบข้อความ: ตัดช่องว่าง, ตัวพิมพ์เล็ก, ตัด $ ของ LaTeX
export const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
export const hasMath = (s) => /\$|\\\(|\\\[/.test(String(s ?? ''));

export const formatCode = (c) => (c && c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c || '');
export const cleanCode = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export function fmtDuration(ms) {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '-';
  const neg = ms < 0;
  let s = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const p = (n) => String(n).padStart(2, '0');
  return (neg ? '-' : '') + (h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`);
}

// ---------- เติมคำ: "น้ำเดือดที่ [[100]] องศา" หรือ [[ตอบ|คำที่รับได้อื่น]] ----------
export function parseFill(template) {
  const t = String(template ?? '');
  const re = /\[\[([^\]]*?)\]\]/g;
  const parts = [];
  const blanks = [];
  let last = 0;
  let m;
  while ((m = re.exec(t))) {
    if (m.index > last) parts.push(t.slice(last, m.index));
    const alts = m[1].split('|').map((x) => x.trim()).filter(Boolean);
    parts.push({ blank: blanks.length });
    blanks.push({ answers: alts.length ? alts : [''] });
    last = m.index + m[0].length;
  }
  if (last < t.length) parts.push(t.slice(last));
  return { parts, blanks, answers: blanks.map((b) => b.answers[0]) };
}

// ---------- สร้างข้อมูลเปล่า ----------
export const blankSubject = (title = '') => ({ id: rid('s'), title, description: '', questions: [blankQuestion()] });
export const blankQuestion = () => ({ id: rid('q'), title: '', stem: '', stemImage: '', layout: 'same', parts: [blankPart('mcq')] });
export function blankPart(type) {
  const base = { id: rid('p'), type, text: '', image: '', points: 1 };
  switch (type) {
    case 'mcq':
      return { ...base, multiple: false, partial: true, options: [0, 1, 2, 3].map(() => ({ text: '', image: '', correct: false })) };
    case 'tf':
      return { ...base, correctable: false, statements: [{ text: '', correct: true, fixes: '' }] };
    case 'fill':
      return { ...base, template: '', distractors: '' };
    case 'match':
      return { ...base, pairs: [0, 1, 2].map(() => ({ left: '', leftImage: '', right: '' })), extras: '' };
    default:
      return { ...base, type: 'text', long: false, accepted: '', manual: false, matchMode: 'exact', tolerance: 0 };
  }
}

// ---------- ไล่ข้อย่อยทั้งหมดพร้อมเลขข้อ ----------
// full = "วิชา · ข้อ 2.1", label = "2.1" (เลขข้อนับใหม่ในแต่ละวิชา)
export function allParts(exam) {
  const out = [];
  exam.subjects.forEach((s, si) => {
    s.questions.forEach((q, qi) => {
      q.parts.forEach((p, pi) => {
        const label = q.parts.length > 1 ? `${qi + 1}.${pi + 1}` : `${qi + 1}`;
        out.push({ p, q, s, si, qi, pi, label, subjectName: s.title || `วิชา ${si + 1}`, full: `${s.title || `วิชา ${si + 1}`} · ข้อ ${label}` });
      });
    });
  });
  return out;
}
export function examCounts(exam) {
  let questions = 0, parts = 0, points = 0;
  for (const s of exam.subjects) {
    questions += s.questions.length;
    for (const q of s.questions) for (const p of q.parts) { parts++; points += Number(p.points) || 0; }
  }
  return { subjects: exam.subjects.length, questions, parts, points: Math.round(points * 100) / 100 };
}

// ---------- เตือนข้อที่ตั้งค่าไม่ครบ ----------
export function partWarnings(p) {
  const w = [];
  if (!(Number(p.points) > 0)) w.push('คะแนนต้องมากกว่า 0');
  if (!String(p.text || '').trim() && !p.image) w.push('ยังไม่มีโจทย์');
  if (p.type === 'mcq') {
    if (p.options.some((o) => !o.text.trim() && !o.image)) w.push('มีตัวเลือกที่ว่าง');
    if (!p.options.some((o) => o.correct)) w.push('ยังไม่ได้เลือกข้อที่ถูก');
  } else if (p.type === 'tf') {
    if (p.statements.some((s) => !s.text.trim())) w.push('มีข้อความที่ว่าง');
  } else if (p.type === 'fill') {
    if (!parseFill(p.template).blanks.length) w.push('ยังไม่มีช่องว่าง — ใช้ [[คำตอบ]] ในข้อความ');
  } else if (p.type === 'match') {
    if (p.pairs.some((x) => (!x.left.trim() && !x.leftImage) || !x.right.trim())) w.push('มีคู่ที่ยังไม่ครบ');
  } else if (p.type === 'text') {
    if (!p.manual && !lines(p.accepted).length) w.push('ไม่มีเฉลย → ต้องตรวจเอง');
  }
  return w;
}

// สลับลำดับแบบคงที่ตามค่า seed (ผู้เข้าสอบแต่ละคนเห็นลำดับของตัวเองคงเดิมทุกครั้งที่โหลด)
export function seededShuffle(arr, seed) {
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const rand = () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
