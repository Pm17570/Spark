import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { json, fail, isAdmin, noAdmin } from '@/lib/auth';
import { UPLOAD_DIR } from '@/lib/db';

export async function POST(req) {
  if (!(await isAdmin())) return noAdmin();
  let f;
  try {
    f = (await req.formData()).get('file');
  } catch {
    return fail('อ่านไฟล์ไม่ได้');
  }
  if (!f || typeof f === 'string') return fail('ไม่พบไฟล์');
  if (f.size > 5 * 1024 * 1024) return fail('ไฟล์ใหญ่เกิน 5MB');
  const buf = Buffer.from(await f.arrayBuffer());
  // ตรวจชนิดจากเนื้อไฟล์จริง ไม่เชื่อนามสกุล
  let ext = null;
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ext = 'png';
  else if (buf[0] === 0xff && buf[1] === 0xd8) ext = 'jpg';
  else if (buf.slice(0, 3).toString() === 'GIF') ext = 'gif';
  else if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') ext = 'webp';
  if (!ext) return fail('รองรับเฉพาะรูป PNG, JPG, GIF, WEBP');
  const name = `${crypto.randomBytes(8).toString('hex')}.${ext}`;
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return json({ name });
}
