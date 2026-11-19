// เริ่มระบบครั้งแรก: สร้างรหัสผ่านแอดมิน, ข้อสอบตัวอย่าง (ครั้งเดียว)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './db';
import { getSetting, setSetting } from './repo';
import { setAdminPassword } from './auth';
import { createSampleExam } from './seed';

export function boot() {
  const g = globalThis;
  if (g.__sparkBooted) return;
  g.__sparkBooted = true;
  if (!getSetting('admin_hash')) {
    const fromEnv = process.env.ADMIN_PASSWORD;
    const pw = fromEnv || crypto.randomBytes(9).toString('base64url');
    setAdminPassword(pw);
    if (!fromEnv) {
      const file = path.join(DATA_DIR, 'ADMIN-PASSWORD.txt');
      fs.writeFileSync(file, `รหัสผ่านแอดมินครั้งแรก: ${pw}\nเข้าสู่ระบบที่ /admin แล้วเปลี่ยนรหัสผ่าน จากนั้นลบไฟล์นี้\n`);
      console.log(`\n┌──────────────────────────────────────────────┐\n│  SPARK — รหัสผ่านแอดมินครั้งแรก: ${pw.padEnd(13)}   │\n│  (บันทึกไว้ที่ ${path.relative(process.cwd(), file)})\n└──────────────────────────────────────────────┘\n`);
    }
  }
  if (!getSetting('seeded')) {
    setSetting('seeded', '1');
    try {
      const { code, codes } = createSampleExam();
      console.log(`[SPARK] สร้างข้อสอบตัวอย่างแล้ว — ลองเข้าสอบด้วยรหัส: ${codes.slice(0, 3).join('  ')}  (${code})`);
    } catch (e) {
      console.error('[SPARK] สร้างข้อสอบตัวอย่างไม่สำเร็จ', e);
    }
  }
}
