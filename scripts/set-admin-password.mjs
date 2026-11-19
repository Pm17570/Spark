// ตั้ง/รีเซ็ตรหัสผ่านแอดมิน:  node scripts/set-admin-password.mjs "รหัสใหม่"
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

const pw = process.argv[2];
if (!pw || pw.length < 8) { console.error('ใช้: node scripts/set-admin-password.mjs "รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)"'); process.exit(1); }
const dir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const file = path.join(dir, 'spark.db');
if (!fs.existsSync(file)) { console.error('ไม่พบฐานข้อมูล ' + file + ' — เปิดเซิร์ฟเวอร์ครั้งแรกก่อน'); process.exit(1); }
const db = new Database(file);
const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(pw, salt, 32);
db.prepare("INSERT INTO settings(key,value) VALUES('admin_hash',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(`scrypt$${salt.toString('hex')}$${hash.toString('hex')}`);
console.log('ตั้งรหัสผ่านแอดมินใหม่แล้ว (เซสชันแอดมินเดิมทั้งหมดถูกยกเลิก)');
