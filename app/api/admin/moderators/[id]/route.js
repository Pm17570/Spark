import { json, fail, readJson, isAdmin, noAdmin, hashPassword } from '@/lib/auth';
import { updateModerator, deleteModerator, modRawById } from '@/lib/chat';

export async function PATCH(req, { params }) {
  if (!(await isAdmin())) return noAdmin();
  const { id } = await params;
  if (!modRawById(id)) return fail('ไม่พบบัญชี', 404);
  const b = (await readJson(req, 3000)) || {};
  const patch = {};
  if (typeof b.name === 'string') patch.name = b.name.trim();
  if (typeof b.active === 'boolean') patch.active = b.active;
  if (b.password !== undefined) {
    if (String(b.password).length < 8) return fail('รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร');
    patch.hash = hashPassword(String(b.password)); // เปลี่ยนรหัส → เซสชันเดิมของ moderator คนนั้นหลุดทันที
  }
  updateModerator(id, patch);
  return json({ ok: true });
}
export async function DELETE(_r, { params }) {
  if (!(await isAdmin())) return noAdmin();
  deleteModerator((await params).id);
  return json({ ok: true });
}
