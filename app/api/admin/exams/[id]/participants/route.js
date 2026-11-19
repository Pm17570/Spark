import { json, fail, readJson, isAdmin, noAdmin } from '@/lib/auth';
import { loadExam, createParticipants } from '@/lib/repo';

export async function POST(req, { params }) {
  if (!(await isAdmin())) return noAdmin();
  const id = (await params).id;
  if (!loadExam(id)) return fail('ไม่พบข้อสอบ', 404);
  const b = (await readJson(req, 2_000_000)) || {};
  let list = [];
  if (b.mode === 'generate') {
    const n = Math.floor(Number(b.count));
    if (!(n >= 1 && n <= 2000)) return fail('จำนวนต้องอยู่ระหว่าง 1–2000');
    list = Array.from({ length: n }, () => ({ name: '', school: '' }));
  } else if (b.mode === 'import') {
    list = String(b.text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
      const [name, ...rest] = l.split(/[,\t]/);
      return { name: name.trim(), school: rest.join(',').trim() };
    });
    if (!list.length) return fail('ไม่พบรายชื่อ');
  } else if (b.mode === 'add') list = [{ name: b.name || '', school: b.school || '' }];
  else return fail('คำสั่งไม่ถูกต้อง');
  return json({ created: createParticipants(id, list) });
}
