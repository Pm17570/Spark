// ชั้นเข้าถึงข้อมูล (SQL ทั้งหมดอยู่ที่นี่)
import crypto from 'node:crypto';
import { db } from './db';
import { rid, TYPES, blankPart, cleanCode } from './model';

const now = () => Date.now();
const S = (v, max = 4000) => String(v ?? '').slice(0, max);
const N = (v, lo, hi, dflt = 0) => {
  const x = Number(v);
  return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : dflt;
};
const safeJson = (s, d) => {
  try {
    return JSON.parse(s);
  } catch {
    return d;
  }
};

/* ============================ ตั้งค่าระบบ ============================ */
export const getSetting = (k) => db().prepare('SELECT value FROM settings WHERE key=?').get(k)?.value ?? null;
export const setSetting = (k, v) => db().prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, String(v));

/* ============================ ข้อสอบ ============================ */
const examRow = (r) => ({
  id: r.id,
  title: r.title,
  description: r.description,
  status: r.status,
  openAt: r.open_at,
  closeAt: r.close_at,
  durationMin: r.duration_min,
  extraMin: r.extra_min,
  showResult: !!r.show_result,
  shuffle: !!r.shuffle,
  createdAt: r.created_at,
});

export function loadExam(id) {
  const d = db();
  const e = d.prepare('SELECT * FROM exams WHERE id=?').get(id);
  if (!e) return null;
  const exam = examRow(e);
  const subs = d.prepare('SELECT * FROM subjects WHERE exam_id=? ORDER BY pos').all(id);
  const qs = d.prepare('SELECT * FROM questions WHERE exam_id=? ORDER BY pos').all(id);
  const ps = d.prepare('SELECT * FROM parts WHERE exam_id=? ORDER BY pos').all(id);
  const partsByQ = new Map();
  for (const p of ps) {
    const part = { ...safeJson(p.data, {}), id: p.id, type: p.type, points: p.points, text: p.text, image: p.image };
    if (!partsByQ.has(p.question_id)) partsByQ.set(p.question_id, []);
    partsByQ.get(p.question_id).push(part);
  }
  const qBySub = new Map();
  for (const q of qs) {
    if (!qBySub.has(q.subject_id)) qBySub.set(q.subject_id, []);
    qBySub.get(q.subject_id).push({ id: q.id, title: q.title, stem: q.stem, stemImage: q.stem_image, layout: q.layout, parts: partsByQ.get(q.id) || [] });
  }
  exam.subjects = subs.map((s) => ({ id: s.id, title: s.title, description: s.description, questions: qBySub.get(s.id) || [] }));
  return exam;
}

export function listExams() {
  const d = db();
  const rows = d.prepare('SELECT * FROM exams ORDER BY created_at DESC').all();
  return rows.map((r) => {
    const exam = examRow(r);
    const c = d.prepare(
      `SELECT (SELECT COUNT(*) FROM subjects WHERE exam_id=@id) subjects,
              (SELECT COUNT(*) FROM questions WHERE exam_id=@id) questions,
              (SELECT COUNT(*) FROM parts WHERE exam_id=@id) parts,
              (SELECT COALESCE(SUM(points),0) FROM parts WHERE exam_id=@id) points,
              (SELECT COUNT(*) FROM participants WHERE exam_id=@id) participants,
              (SELECT COUNT(*) FROM attempts WHERE exam_id=@id) started,
              (SELECT COUNT(*) FROM attempts WHERE exam_id=@id AND submitted_at IS NOT NULL) submitted`
    ).get({ id: r.id });
    return { ...exam, ...c, phase: phaseOf(exam) };
  });
}

export function createExam(title = 'ข้อสอบใหม่') {
  const id = rid('e');
  const d = db();
  d.transaction(() => {
    d.prepare('INSERT INTO exams(id,title,created_at) VALUES(?,?,?)').run(id, S(title, 200) || 'ข้อสอบใหม่', now());
    saveContent(id, { title: S(title, 200) || 'ข้อสอบใหม่', description: '', subjects: [{ id: rid('s'), title: 'วิชาที่ 1', description: '', questions: [{ id: rid('q'), title: '', stem: '', stemImage: '', layout: 'same', parts: [blankPart('mcq')] }] }] });
  })();
  return id;
}

export function updateExamSettings(id, patch) {
  const cur = db().prepare('SELECT * FROM exams WHERE id=?').get(id);
  if (!cur) return null;
  const v = {
    status: patch.status ?? cur.status,
    open_at: 'openAt' in patch ? patch.openAt : cur.open_at,
    close_at: 'closeAt' in patch ? patch.closeAt : cur.close_at,
    duration_min: 'durationMin' in patch ? N(patch.durationMin, 0, 1440) : cur.duration_min,
    extra_min: 'extraMin' in patch ? N(patch.extraMin, -1440, 1440) : cur.extra_min,
    show_result: 'showResult' in patch ? (patch.showResult ? 1 : 0) : cur.show_result,
    shuffle: 'shuffle' in patch ? (patch.shuffle ? 1 : 0) : cur.shuffle,
  };
  db().prepare('UPDATE exams SET status=@status, open_at=@open_at, close_at=@close_at, duration_min=@duration_min, extra_min=@extra_min, show_result=@show_result, shuffle=@shuffle WHERE id=@id').run({ ...v, id });
  return loadExam(id);
}

export function deleteExam(id) {
  db().prepare('DELETE FROM exams WHERE id=?').run(id); // ลบต่อเนื่องทุกตารางด้วย FOREIGN KEY CASCADE
  db().prepare('DELETE FROM subjects WHERE exam_id=?').run(id);
}

/* ---------- ทำความสะอาด + บันทึกเนื้อหาข้อสอบ ---------- */
function cleanPart(p) {
  const type = TYPES.includes(p?.type) ? p.type : 'text';
  const base = { id: /^p_[0-9a-f]{12}$/.test(p?.id) ? p.id : rid('p'), type, text: S(p?.text, 6000), image: S(p?.image, 100), points: N(p?.points, 0, 1000, 1) };
  const b = blankPart(type);
  switch (type) {
    case 'mcq': {
      const opts = (Array.isArray(p.options) ? p.options : b.options).slice(0, 10).map((o) => ({ text: S(o?.text, 1000), image: S(o?.image, 100), correct: !!o?.correct }));
      while (opts.length < 2) opts.push({ text: '', image: '', correct: false });
      const multiple = !!p.multiple;
      if (!multiple) {
        let seen = false;
        for (const o of opts) if (o.correct) { if (seen) o.correct = false; seen = true; }
      }
      return { ...base, multiple, partial: p.partial !== false, options: opts };
    }
    case 'tf': {
      const st = (Array.isArray(p.statements) ? p.statements : b.statements).slice(0, 30).map((s) => ({ text: S(s?.text, 1000), correct: s?.correct !== false, fixes: S(s?.fixes, 1000) }));
      return { ...base, correctable: !!p.correctable, statements: st.length ? st : b.statements };
    }
    case 'fill':
      return { ...base, template: S(p.template, 6000), distractors: S(p.distractors, 1000) };
    case 'match': {
      const pairs = (Array.isArray(p.pairs) ? p.pairs : b.pairs).slice(0, 20).map((x) => ({ left: S(x?.left, 1000), leftImage: S(x?.leftImage, 100), right: S(x?.right, 1000) }));
      return { ...base, pairs, extras: S(p.extras, 1000) };
    }
    default:
      return { ...base, type: 'text', long: !!p.long, accepted: S(p.accepted, 2000), manual: !!p.manual, matchMode: ['exact', 'contains', 'numeric'].includes(p.matchMode) ? p.matchMode : 'exact', tolerance: N(p.tolerance, 0, 1e9, 0) };
  }
}

function saveContent(id, body) {
  const d = db();
  d.prepare('UPDATE exams SET title=?, description=? WHERE id=?').run(S(body.title, 200) || 'ข้อสอบ', S(body.description, 6000), id);
  d.prepare('DELETE FROM subjects WHERE exam_id=?').run(id);
  d.prepare('DELETE FROM questions WHERE exam_id=?').run(id);
  d.prepare('DELETE FROM parts WHERE exam_id=?').run(id);
  const iS = d.prepare('INSERT INTO subjects(id,exam_id,pos,title,description) VALUES(?,?,?,?,?)');
  const iQ = d.prepare('INSERT INTO questions(id,subject_id,exam_id,pos,title,stem,stem_image,layout) VALUES(?,?,?,?,?,?,?,?)');
  const iP = d.prepare('INSERT INTO parts(id,question_id,exam_id,pos,type,points,text,image,data) VALUES(?,?,?,?,?,?,?,?,?)');
  const used = new Set();
  const uid = (v, pre) => {
    let x = new RegExp(`^${pre}_[0-9a-f]{12}$`).test(v) && !used.has(v) ? v : rid(pre);
    used.add(x);
    return x;
  };
  (body.subjects || []).slice(0, 30).forEach((s, si) => {
    const sid = uid(s.id, 's');
    iS.run(sid, id, si, S(s.title, 200), S(s.description, 6000));
    (s.questions || []).slice(0, 300).forEach((q, qi) => {
      const qid = uid(q.id, 'q');
      iQ.run(qid, sid, id, qi, S(q.title, 300), S(q.stem, 8000), S(q.stemImage, 100), q.layout === 'split' ? 'split' : 'same');
      (q.parts || []).slice(0, 50).forEach((p, pi) => {
        const c = cleanPart(p);
        c.id = uid(c.id, 'p');
        const { id: pid, type, points, text, image, ...data } = c;
        iP.run(pid, qid, id, pi, type, points, text, image, JSON.stringify(data));
      });
    });
  });
}

export function saveExamContent(id, body) {
  db().transaction(() => saveContent(id, body))();
  return loadExam(id);
}

/* ============================ เวลา / สถานะสอบ ============================ */
export function phaseOf(exam, t = now()) {
  if (exam.status === 'draft') return 'draft';
  if (exam.status === 'closed') return 'closed';
  if (exam.closeAt && t >= exam.closeAt) return 'closed';
  if (exam.status === 'scheduled' && (!exam.openAt || t < exam.openAt)) return 'waiting';
  return 'open';
}

export function deadlineOf(exam, a) {
  if (!a) return null;
  let dl = null;
  if (exam.durationMin > 0) dl = a.startedAt + Math.max(1, exam.durationMin + exam.extraMin + (a.extraMin || 0)) * 60000;
  if (exam.closeAt) dl = dl === null ? exam.closeAt : Math.min(dl, exam.closeAt);
  return dl;
}

// ส่งอัตโนมัติ: คนที่หมดเวลา หรือเมื่อแอดมินปิดสอบ
export function finalizeExpired(exam, t = now()) {
  const d = db();
  const rows = d.prepare('SELECT participant_id, started_at, extra_min FROM attempts WHERE exam_id=? AND submitted_at IS NULL').all(exam.id);
  if (!rows.length) return 0;
  const closed = phaseOf(exam, t) === 'closed';
  const up = d.prepare('UPDATE attempts SET submitted_at=?, auto=1 WHERE participant_id=? AND submitted_at IS NULL');
  let n = 0;
  d.transaction(() => {
    for (const r of rows) {
      const dl = deadlineOf(exam, { startedAt: r.started_at, extraMin: r.extra_min });
      if (closed || (dl !== null && dl <= t)) {
        up.run(closed && (dl === null || dl > t) ? t : dl, r.participant_id);
        n++;
      }
    }
  })();
  return n;
}

/* ============================ ผู้เข้าสอบ ============================ */
// รหัส 8 ตัว สุ่มด้วย crypto, ตัดตัวที่สับสน (0/O, 1/I/L) — ปริภูมิ 31^8 ≈ 8.5×10^11
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const newCode = () => Array.from({ length: 8 }, () => ALPHA[crypto.randomInt(ALPHA.length)]).join('');

function insertWithUniqueCode(examId, name, school) {
  const d = db();
  const stmt = d.prepare('INSERT INTO participants(id,exam_id,code,name,school,created_at) VALUES(?,?,?,?,?,?)');
  for (let i = 0; i < 50; i++) {
    const code = newCode();
    try {
      stmt.run(rid('u'), examId, code, S(name, 200), S(school, 200), now());
      return code;
    } catch (e) {
      if (!String(e.code).startsWith('SQLITE_CONSTRAINT')) throw e; // ชนรหัสเดิม → สุ่มใหม่
    }
  }
  throw new Error('สุ่มรหัสไม่สำเร็จ');
}

export function createParticipants(examId, list) {
  let n = 0;
  db().transaction(() => {
    for (const x of list.slice(0, 5000)) {
      insertWithUniqueCode(examId, x.name || '', x.school || '');
      n++;
    }
  })();
  return n;
}

const pRow = (r) => ({
  id: r.id,
  code: r.code,
  name: r.name,
  school: r.school,
  lastSeen: r.last_seen,
  answered: r.answered ?? 0,
  attempt: r.started_at
    ? { startedAt: r.started_at, submittedAt: r.submitted_at, auto: !!r.auto, extraMin: r.a_extra || 0, blurCount: r.blur_count || 0 }
    : null,
});

export function listParticipants(examId) {
  return db()
    .prepare(
      `SELECT p.*, a.started_at, a.submitted_at, a.auto, a.extra_min AS a_extra, a.blur_count,
              (SELECT COUNT(*) FROM answers x WHERE x.participant_id = p.id) AS answered
         FROM participants p LEFT JOIN attempts a ON a.participant_id = p.id
        WHERE p.exam_id = ? ORDER BY p.created_at, p.rowid`
    )
    .all(examId)
    .map(pRow);
}

export const participantById = (id) => db().prepare('SELECT * FROM participants WHERE id=?').get(id);
export const participantByCode = (code) => db().prepare('SELECT * FROM participants WHERE code=?').get(cleanCode(code));
export function updateParticipant(id, { name, school }) {
  db().prepare('UPDATE participants SET name=?, school=? WHERE id=?').run(S(name, 200), S(school, 200), id);
}
export function regenCode(id) {
  const d = db();
  for (let i = 0; i < 50; i++) {
    const code = newCode();
    try {
      d.prepare('UPDATE participants SET code=?, session=NULL WHERE id=?').run(code, id);
      return code;
    } catch (e) {
      if (!String(e.code).startsWith('SQLITE_CONSTRAINT')) throw e;
    }
  }
  throw new Error('สุ่มรหัสไม่สำเร็จ');
}
export const deleteParticipant = (id) => db().prepare('DELETE FROM participants WHERE id=?').run(id);
export const touchParticipant = (id) => db().prepare('UPDATE participants SET last_seen=? WHERE id=?').run(now(), id);
export function newSession(id) {
  const tok = crypto.randomBytes(18).toString('base64url');
  db().prepare('UPDATE participants SET session=?, last_seen=? WHERE id=?').run(tok, now(), id);
  return tok;
}

/* ============================ การทำข้อสอบ ============================ */
export function getAttempt(pid) {
  const r = db().prepare('SELECT * FROM attempts WHERE participant_id=?').get(pid);
  return r ? { startedAt: r.started_at, submittedAt: r.submitted_at, auto: !!r.auto, extraMin: r.extra_min, blurCount: r.blur_count } : null;
}
export const startAttempt = (pid, examId) => db().prepare('INSERT OR IGNORE INTO attempts(participant_id,exam_id,started_at) VALUES(?,?,?)').run(pid, examId, now());
export const submitAttempt = (pid, auto = false) => db().prepare('UPDATE attempts SET submitted_at=?, auto=? WHERE participant_id=? AND submitted_at IS NULL').run(now(), auto ? 1 : 0, pid);
export const addBlur = (pid) => db().prepare('UPDATE attempts SET blur_count = blur_count + 1 WHERE participant_id=? AND submitted_at IS NULL').run(pid);

export function adminAttemptAction(pid, action, minutes = 0) {
  const d = db();
  if (action === 'reset') {
    d.transaction(() => {
      d.prepare('DELETE FROM attempts WHERE participant_id=?').run(pid);
      d.prepare('DELETE FROM answers WHERE participant_id=?').run(pid);
      d.prepare('DELETE FROM grades WHERE participant_id=?').run(pid);
    })();
  } else if (action === 'unsubmit') d.prepare('UPDATE attempts SET submitted_at=NULL, auto=0 WHERE participant_id=?').run(pid);
  else if (action === 'extend') d.prepare('UPDATE attempts SET extra_min = extra_min + ? WHERE participant_id=?').run(minutes, pid);
}

export function getAnswers(pid) {
  const out = {};
  for (const r of db().prepare('SELECT part_id, value FROM answers WHERE participant_id=?').all(pid)) out[r.part_id] = safeJson(r.value, null);
  return out;
}
export function saveAnswers(pid, map) {
  const d = db();
  const up = d.prepare('INSERT INTO answers(participant_id,part_id,value,updated_at) VALUES(?,?,?,?) ON CONFLICT(participant_id,part_id) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at');
  const t = now();
  d.transaction(() => {
    for (const [partId, v] of Object.entries(map)) up.run(pid, partId, JSON.stringify(v), t);
  })();
}
export function answersOfExam(examId) {
  const m = new Map();
  for (const r of db().prepare('SELECT a.participant_id, a.part_id, a.value FROM answers a JOIN participants p ON p.id=a.participant_id WHERE p.exam_id=?').all(examId)) {
    if (!m.has(r.participant_id)) m.set(r.participant_id, {});
    m.get(r.participant_id)[r.part_id] = safeJson(r.value, null);
  }
  return m;
}

/* ============================ คะแนนที่กรรมการให้เอง ============================ */
export function gradesOf(pid) {
  const out = {};
  for (const r of db().prepare('SELECT part_id, score FROM grades WHERE participant_id=?').all(pid)) out[r.part_id] = r.score;
  return out;
}
export function gradesOfExam(examId) {
  const m = new Map();
  for (const r of db().prepare('SELECT g.participant_id, g.part_id, g.score FROM grades g JOIN participants p ON p.id=g.participant_id WHERE p.exam_id=?').all(examId)) {
    if (!m.has(r.participant_id)) m.set(r.participant_id, {});
    m.get(r.participant_id)[r.part_id] = r.score;
  }
  return m;
}
export function setGrade(pid, partId, score) {
  if (score === null) db().prepare('DELETE FROM grades WHERE participant_id=? AND part_id=?').run(pid, partId);
  else db().prepare('INSERT INTO grades(participant_id,part_id,score) VALUES(?,?,?) ON CONFLICT(participant_id,part_id) DO UPDATE SET score=excluded.score').run(pid, partId, score);
}
// คำตอบของข้อหนึ่งของทุกคนที่ตอบ (ใช้ในหน้าตรวจทีละข้อ)
export function rowsForPart(examId, partId) {
  return db()
    .prepare(
      `SELECT p.id, p.name, p.code, p.school, t.submitted_at AS submittedAt, a.value, g.score AS manual
         FROM answers a
         JOIN participants p ON p.id = a.participant_id
         JOIN attempts t ON t.participant_id = p.id
         LEFT JOIN grades g ON g.participant_id = p.id AND g.part_id = a.part_id
        WHERE p.exam_id = ? AND a.part_id = ?
        ORDER BY p.name, p.created_at`
    )
    .all(examId, partId)
    .map((r) => ({ ...r, value: safeJson(r.value, null) }));
}
