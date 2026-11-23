import { json, fail, readJson, isAdmin, noAdmin, hashPassword } from '@/lib/auth';
import { listModerators, createModerator, modRawByUsername, cleanUsername, validUsername } from '@/lib/chat';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAdmin())) return noAdmin();
  return json({ moderators: listModerators() });
}
export async function POST(req) {
  if (!(await isAdmin())) return noAdmin();
  const b = (await readJson(req, 3000)) || {};
  const username = cleanUsername(b.username);
  if (!validUsername(username)) return fail('ชื่อผู้ใช้ต้องเป็น a-z 0-9 . _ - ยาว 3–30 ตัว (และห้ามใช้ “admin”)');
  if (String(b.password || '').length < 8) return fail('รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร');
  if (modRawByUsername(username)) return fail('ชื่อผู้ใช้นี้ถูกใช้แล้ว', 409);
  const id = createModerator({ username, name: String(b.name || '').trim() || username, hash: hashPassword(String(b.password)) });
  return json({ id });
}
