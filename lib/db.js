// SQLite (better-sqlite3) — ไฟล์เดียว เร็ว ไม่ต้องติดตั้งเซิร์ฟเวอร์ฐานข้อมูล
// ที่เก็บข้อมูล: ./data/spark.db (เปลี่ยนด้วยตัวแปร DATA_DIR)
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(process.cwd(), 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',          -- draft | open | scheduled | closed
  open_at INTEGER,
  close_at INTEGER,
  duration_min INTEGER NOT NULL DEFAULT 0,        -- 0 = ไม่จำกัด
  extra_min INTEGER NOT NULL DEFAULT 0,
  show_result INTEGER NOT NULL DEFAULT 0,
  shuffle INTEGER NOT NULL DEFAULT 0,             -- สลับลำดับตัวเลือกปรนัยต่อคน
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  pos INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_subjects_exam ON subjects(exam_id, pos);
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  exam_id TEXT NOT NULL,
  pos INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  stem TEXT NOT NULL DEFAULT '',
  stem_image TEXT NOT NULL DEFAULT '',
  layout TEXT NOT NULL DEFAULT 'same'             -- same | split
);
CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject_id, pos);
CREATE TABLE IF NOT EXISTS parts (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  exam_id TEXT NOT NULL,
  pos INTEGER NOT NULL,
  type TEXT NOT NULL,
  points REAL NOT NULL DEFAULT 1,
  text TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL DEFAULT '{}'                 -- JSON เฉพาะชนิดข้อ (ตัวเลือก เฉลย ฯลฯ)
);
CREATE INDEX IF NOT EXISTS idx_parts_question ON parts(question_id, pos);
CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,                      -- รหัสเข้าสอบ สุ่ม ไม่ซ้ำทั้งระบบ
  name TEXT NOT NULL DEFAULT '',
  school TEXT NOT NULL DEFAULT '',
  session TEXT,                                   -- โทเคนเซสชันปัจจุบัน (1 รหัส = 1 เครื่อง)
  last_seen INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_participants_exam ON participants(exam_id, created_at);
CREATE TABLE IF NOT EXISTS attempts (
  participant_id TEXT PRIMARY KEY REFERENCES participants(id) ON DELETE CASCADE,
  exam_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  submitted_at INTEGER,
  auto INTEGER NOT NULL DEFAULT 0,                -- 1 = ถูกส่งอัตโนมัติ (หมดเวลา/ปิดสอบ)
  extra_min INTEGER NOT NULL DEFAULT 0,
  blur_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS answers (
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  part_id TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (participant_id, part_id)
);
CREATE TABLE IF NOT EXISTS grades (
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  part_id TEXT NOT NULL,
  score REAL NOT NULL,
  PRIMARY KEY (participant_id, part_id)
);
`;

export function db() {
  const g = globalThis;
  if (g.__sparkDb) return g.__sparkDb;
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const d = new Database(path.join(DATA_DIR, 'spark.db'));
  d.pragma('journal_mode = WAL');
  d.pragma('synchronous = NORMAL');
  d.pragma('foreign_keys = ON');
  d.pragma('busy_timeout = 5000');
  d.exec(SCHEMA);
  g.__sparkDb = d;
  return d;
}
