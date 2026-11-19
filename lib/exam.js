// เตรียมข้อสอบส่งให้ผู้เข้าสอบ (ตัดเฉลยออกทั้งหมด) และตรวจรูปแบบคำตอบที่รับเข้ามา
import { parseFill, seededShuffle, allParts } from './model';

export function partMap(exam) {
  return new Map(allParts(exam).map((x) => [x.p.id, x.p]));
}

function studentPart(p, seed, shuffle) {
  const base = { id: p.id, type: p.type, text: p.text, image: p.image, points: p.points };
  switch (p.type) {
    case 'mcq': {
      const idx = p.options.map((_, i) => i);
      return {
        ...base,
        multiple: p.multiple,
        options: p.options.map((o) => ({ text: o.text, image: o.image })),
        order: shuffle ? seededShuffle(idx, `${seed}:${p.id}`) : idx,
      };
    }
    case 'tf':
      return { ...base, correctable: p.correctable, statements: p.statements.map((s) => ({ text: s.text })) };
    case 'fill': {
      const { parts, answers } = parseFill(p.template);
      const extras = String(p.distractors || '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
      return { ...base, parts, bank: seededShuffle([...answers, ...extras], `${seed}:${p.id}`) };
    }
    case 'match': {
      const extras = String(p.extras || '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
      return {
        ...base,
        left: p.pairs.map((x) => ({ text: x.left, image: x.leftImage })),
        right: seededShuffle([...p.pairs.map((x) => x.right), ...extras], `${seed}:${p.id}`),
      };
    }
    default:
      return { ...base, long: p.long };
  }
}

export function studentPaper(exam, seed) {
  return {
    subjects: exam.subjects.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      questions: s.questions.map((q) => ({
        id: q.id,
        title: q.title,
        stem: q.stem,
        stemImage: q.stemImage,
        layout: q.layout,
        parts: q.parts.map((p) => studentPart(p, seed, exam.shuffle)),
      })),
    })),
  };
}

// ตรวจรูปแบบคำตอบ — คืน undefined ถ้าไม่ถูกต้อง
export function cleanAnswer(p, v) {
  const str = (x, n) => String(x ?? '').slice(0, n);
  switch (p.type) {
    case 'mcq': {
      if (!Array.isArray(v)) return undefined;
      const set = [...new Set(v.filter((i) => Number.isInteger(i) && i >= 0 && i < p.options.length))].sort((a, b) => a - b);
      return p.multiple ? set : set.slice(0, 1);
    }
    case 'tf': {
      if (!Array.isArray(v)) return undefined;
      return p.statements.map((_, i) => {
        const x = v[i] || {};
        const o = {};
        if (typeof x.v === 'boolean') o.v = x.v;
        if (x.fix) o.fix = str(x.fix, 300);
        return o;
      });
    }
    case 'fill': {
      if (!Array.isArray(v)) return undefined;
      const n = parseFill(p.template).blanks.length;
      return Array.from({ length: n }, (_, i) => str(v[i], 300));
    }
    case 'match': {
      if (!Array.isArray(v)) return undefined;
      return p.pairs.map((_, i) => str(v[i], 300));
    }
    default:
      return typeof v === 'string' ? str(v, 20000) : undefined;
  }
}
