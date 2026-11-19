import { json, fail, readJson, isAdmin, noAdmin } from '@/lib/auth';
import { participantById, updateParticipant, regenCode, deleteParticipant, adminAttemptAction } from '@/lib/repo';

async function load(params) {
  const { id, pid } = await params;
  const p = participantById(pid);
  return p && p.exam_id === id ? p : null;
}
export async function PATCH(req, { params }) {
  if (!(await isAdmin())) return noAdmin();
  const p = await load(params);
  if (!p) return fail('ไม่พบผู้เข้าสอบ', 404);
  const b = (await readJson(req, 5000)) || {};
  switch (b.action) {
    case 'rename':
      updateParticipant(p.id, { name: b.name ?? p.name, school: b.school ?? p.school });
      return json({ ok: true });
    case 'regen':
      return json({ code: regenCode(p.id) });
    case 'reset':
    case 'unsubmit':
      adminAttemptAction(p.id, b.action);
      return json({ ok: true });
    case 'extend':
      adminAttemptAction(p.id, 'extend', Math.max(-600, Math.min(600, Math.round(Number(b.minutes) || 0))));
      return json({ ok: true });
    default:
      return fail('คำสั่งไม่ถูกต้อง');
  }
}
export async function DELETE(_r, { params }) {
  if (!(await isAdmin())) return noAdmin();
  const p = await load(params);
  if (!p) return fail('ไม่พบผู้เข้าสอบ', 404);
  deleteParticipant(p.id);
  return json({ ok: true });
}
