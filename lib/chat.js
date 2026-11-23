// ผู้ช่วยดูแล (moderator) + ข้อความระหว่างผู้เข้าสอบกับทีมงาน (SQL ทั้งหมดอยู่ที่นี่)
import { db } from './db';
import { rid } from './model';

const now = () => Date.now();
const S = (v, n) => String(v ?? '').slice(0, n);

/* ============================ Moderator ============================ */
const modRow = (r) => ({ id: r.id, username: r.username, name: r.name, active: !!r.active, createdAt: r.created_at });
export const cleanUsername = (u) => String(u ?? '').trim().toLowerCase();
export const validUsername = (u) => /^[a-z0-9._-]{3,30}$/.test(u) && u !== 'admin';

export const listModerators = () => db().prepare('SELECT * FROM moderators ORDER BY created_at').all().map(modRow);
export const modRawByUsername = (u) => db().prepare('SELECT * FROM moderators WHERE username=?').get(cleanUsername(u));
export const modRawById = (id) => db().prepare('SELECT * FROM moderators WHERE id=?').get(id);
export function createModerator({ username, name, hash }) {
  const id = rid('m');
  db().prepare('INSERT INTO moderators(id,username,name,hash,created_at) VALUES(?,?,?,?,?)').run(id, cleanUsername(username), S(name, 100), hash, now());
  return id;
}
export function updateModerator(id, { name, hash, active }) {
  const cur = modRawById(id);
  if (!cur) return false;
  db().prepare('UPDATE moderators SET name=?, hash=?, active=? WHERE id=?').run(
    name !== undefined ? S(name, 100) : cur.name,
    hash ?? cur.hash,
    active !== undefined ? (active ? 1 : 0) : cur.active,
    id
  );
  return true;
}
export const deleteModerator = (id) => db().prepare('DELETE FROM moderators WHERE id=?').run(id);

/* ============================ ข้อความ ============================ */
export const MAX_LEN = { participant: 500, staff: 1500 };

export function addMessage({ examId, participantId, fromRole, fromName, body }) {
  const text = S(body, fromRole === 'participant' ? MAX_LEN.participant : MAX_LEN.staff).trim();
  if (!text) return null;
  return Number(
    db().prepare('INSERT INTO messages(exam_id,participant_id,from_role,from_name,body,created_at) VALUES(?,?,?,?,?,?)')
      .run(examId, participantId, fromRole, S(fromName, 100), text, now()).lastInsertRowid
  );
}

// ผู้เข้าสอบส่งได้ไม่เกิน 6 ข้อความ/นาที และ 60 ข้อความ/ชั่วโมง (กันสแปมทีมงาน)
export function participantSendLimited(pid) {
  const d = db();
  const t = now();
  const a = d.prepare("SELECT COUNT(*) c FROM messages WHERE participant_id=? AND from_role='participant' AND created_at>?").get(pid, t - 60_000).c;
  const b = d.prepare("SELECT COUNT(*) c FROM messages WHERE participant_id=? AND from_role='participant' AND created_at>?").get(pid, t - 3_600_000).c;
  return a >= 6 || b >= 60;
}

const msgRow = (r) => ({ id: r.id, from: r.from_role, name: r.from_name, body: r.body, at: r.created_at, read: !!r.read_at });
export const threadOf = (pid, limit = 200) =>
  db().prepare('SELECT * FROM (SELECT * FROM messages WHERE participant_id=? ORDER BY id DESC LIMIT ?) ORDER BY id').all(pid, limit).map(msgRow);

// ผู้เข้าสอบเปิดอ่าน → ข้อความจากทีมงานเป็น "อ่านแล้ว"; ทีมงานเปิดอ่าน → ข้อความจากผู้เข้าสอบเป็น "อ่านแล้ว"
export function markRead(pid, byParticipant) {
  db().prepare(`UPDATE messages SET read_at=? WHERE participant_id=? AND read_at IS NULL AND from_role ${byParticipant ? "!=" : "="} 'participant'`).run(now(), pid);
}

export function participantChatMeta(pid) {
  const r = db().prepare("SELECT COUNT(*) unread, COALESCE(MAX(id),0) last FROM messages WHERE participant_id=? AND from_role!='participant' AND read_at IS NULL").get(pid);
  const l = db().prepare("SELECT COALESCE(MAX(id),0) last FROM messages WHERE participant_id=? AND from_role!='participant'").get(pid);
  return { unread: r.unread, lastStaffId: l.last };
}

// กล่องข้อความของทีมงาน: ข้อความใหม่จากผู้เข้าสอบ (ทุกการสอบ)
export function staffInbox(since) {
  const d = db();
  const maxId = d.prepare("SELECT COALESCE(MAX(id),0) m FROM messages WHERE from_role='participant'").get().m;
  const unread = d.prepare("SELECT COUNT(*) c FROM messages WHERE from_role='participant' AND read_at IS NULL").get().c;
  let items = [];
  if (since !== null && since < maxId) {
    items = d.prepare(
      `SELECT m.id, m.exam_id, m.participant_id, m.body, m.created_at, p.name, e.title
         FROM messages m JOIN participants p ON p.id=m.participant_id JOIN exams e ON e.id=m.exam_id
        WHERE m.from_role='participant' AND m.id>? ORDER BY m.id LIMIT 20`
    ).all(since).map((r) => ({ id: r.id, examId: r.exam_id, participantId: r.participant_id, name: r.name, examTitle: r.title, body: r.body, at: r.created_at }));
  }
  return { maxId, unread, items };
}

export function threadsForExam(examId) {
  return db().prepare(
    `SELECT p.id, p.name, p.school,
            (SELECT COUNT(*) FROM messages m WHERE m.participant_id=p.id AND m.from_role='participant' AND m.read_at IS NULL) AS unread,
            (SELECT body FROM messages m WHERE m.participant_id=p.id ORDER BY m.id DESC LIMIT 1) AS last_body,
            (SELECT from_role FROM messages m WHERE m.participant_id=p.id ORDER BY m.id DESC LIMIT 1) AS last_from,
            (SELECT created_at FROM messages m WHERE m.participant_id=p.id ORDER BY m.id DESC LIMIT 1) AS last_at
       FROM participants p WHERE p.exam_id=? AND EXISTS (SELECT 1 FROM messages m WHERE m.participant_id=p.id)
      ORDER BY unread DESC, last_at DESC`
  ).all(examId).map((r) => ({ participantId: r.id, name: r.name, school: r.school, unread: r.unread, lastBody: r.last_body, lastFrom: r.last_from, lastAt: r.last_at }));
}
export const unreadForExam = (examId) =>
  db().prepare("SELECT COUNT(*) c FROM messages WHERE exam_id=? AND from_role='participant' AND read_at IS NULL").get(examId).c;
