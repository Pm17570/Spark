// ตรวจคำตอบอัตโนมัติ — ข้อที่ต้องให้คนตรวจ (พิมพ์ตอบไม่มีเฉลย / คำแก้ไม่มีเฉลย) จะถูกทำเครื่องหมาย needsManual
import { lines, norm, parseFill, allParts } from './model';

const r2 = (x) => Math.round(x * 100) / 100;

// แปลงข้อความเป็นตัวเลข: รองรับ 1,234.5 / 1/3 / -0.5 / เลขไทย
export function parseNum(s) {
  let t = String(s ?? '').trim().replace(/[๐-๙]/g, (d) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(d))).replace(/[,\s]/g, '').replace(/^\$|\$$/g, '');
  if (!t) return NaN;
  const f = t.match(/^(-?[\d.]+)\/([\d.]+)$/);
  if (f) return Number(f[1]) / Number(f[2]);
  return /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t) ? Number(t) : NaN;
}

export function canNeedManual(p) {
  if (p.type === 'text') return !!p.manual || !lines(p.accepted).length;
  if (p.type === 'tf') return !!p.correctable && p.statements.some((s) => !s.correct && !lines(s.fixes).length);
  return false;
}

export function autoGradePart(p, v) {
  const max = Number(p.points) || 0;
  const out = (score, extra = {}) => ({ score: r2(Math.max(0, Math.min(max, score))), max, blank: false, needsManual: false, ...extra });
  switch (p.type) {
    case 'mcq': {
      const sel = new Set(Array.isArray(v) ? v.filter((i) => Number.isInteger(i)) : []);
      if (!sel.size) return out(0, { blank: true });
      const correct = p.options.map((o, i) => (o.correct ? i : -1)).filter((i) => i >= 0);
      if (!correct.length) return out(0);
      const hits = correct.filter((i) => sel.has(i)).length;
      const wrong = [...sel].filter((i) => !correct.includes(i)).length;
      if (hits === correct.length && wrong === 0) return out(max);
      if (p.multiple && p.partial) return out((max * Math.max(0, hits - wrong)) / correct.length);
      return out(0);
    }
    case 'tf': {
      const arr = Array.isArray(v) ? v : [];
      const n = p.statements.length || 1;
      let sum = 0;
      let manual = false;
      let any = false;
      p.statements.forEach((s, i) => {
        const x = arr[i] || {};
        if (typeof x.v !== 'boolean') return;
        any = true;
        if (x.v !== s.correct) return;
        if (p.correctable && !s.correct) {
          const keys = lines(s.fixes).map(norm);
          if (!keys.length) {
            manual = true;
            sum += 0.5;
          } else sum += 0.5 + (keys.includes(norm(x.fix)) ? 0.5 : 0);
        } else sum += 1;
      });
      if (!any) return out(0, { blank: true });
      return out((max * sum) / n, { needsManual: manual });
    }
    case 'fill': {
      const { blanks } = parseFill(p.template);
      const arr = Array.isArray(v) ? v : [];
      if (!blanks.length) return out(0);
      if (!arr.some((x) => String(x || '').trim())) return out(0, { blank: true });
      let sum = 0;
      blanks.forEach((b, i) => {
        if (b.answers.map(norm).includes(norm(arr[i]))) sum++;
      });
      return out((max * sum) / blanks.length);
    }
    case 'match': {
      const arr = Array.isArray(v) ? v : [];
      if (!arr.some((x) => String(x || '').trim())) return out(0, { blank: true });
      let sum = 0;
      p.pairs.forEach((x, i) => {
        if (norm(arr[i]) === norm(x.right)) sum++;
      });
      return out((max * sum) / (p.pairs.length || 1));
    }
    default: {
      const s = typeof v === 'string' ? v : '';
      if (!s.trim()) return out(0, { blank: true });
      const keys = lines(p.accepted);
      if (p.manual || !keys.length) return out(0, { needsManual: true });
      let ok = false;
      if (p.matchMode === 'numeric') {
        const x = parseNum(s);
        const tol = Number(p.tolerance) || 0;
        ok = Number.isFinite(x) && keys.some((k) => {
          const y = parseNum(k);
          return Number.isFinite(y) && Math.abs(x - y) <= tol + 1e-12;
        });
      } else if (p.matchMode === 'contains') ok = keys.some((k) => norm(s).includes(norm(k)));
      else ok = keys.map(norm).includes(norm(s));
      return out(ok ? max : 0);
    }
  }
}

export function statusOf({ score, max, blank, needsManual }) {
  if (needsManual) return 'pending';
  if (blank) return 'blank';
  if (score >= max && max > 0) return 'correct';
  if (score > 0) return 'partial';
  return 'wrong';
}

// ตรวจทั้งชุด: manual = { partId: คะแนนที่กรรมการให้ }
export function gradeAttempt(exam, answers, manual = {}) {
  const parts = {};
  const subjects = {};
  let score = 0;
  let max = 0;
  let pending = 0;
  for (const s of exam.subjects) subjects[s.id] = { score: 0, max: 0 };
  for (const { p, s } of allParts(exam)) {
    const auto = autoGradePart(p, answers[p.id]);
    const hasManual = typeof manual[p.id] === 'number';
    const sc = hasManual ? r2(Math.min(auto.max, Math.max(0, manual[p.id]))) : auto.score;
    const needsManual = hasManual ? false : auto.needsManual;
    parts[p.id] = { auto: auto.score, max: auto.max, score: sc, manual: hasManual, needsManual, status: statusOf({ score: sc, max: auto.max, blank: auto.blank && !hasManual, needsManual }) };
    score += sc;
    max += auto.max;
    subjects[s.id].score += sc;
    subjects[s.id].max += auto.max;
    if (needsManual) pending++;
  }
  for (const k of Object.keys(subjects)) {
    subjects[k].score = r2(subjects[k].score);
    subjects[k].max = r2(subjects[k].max);
  }
  return { score: r2(score), max: r2(max), pending, subjects, parts };
}
