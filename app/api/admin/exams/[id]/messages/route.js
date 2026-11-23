import { json, fail, readJson, getStaff, noStaff } from '@/lib/auth';
import { loadExam, participantById } from '@/lib/repo';
import { threadsForExam, threadOf, markRead, addMessage } from '@/lib/chat';

export const dynamic = 'force-dynamic';

// GET            → รายการสนทนาของการสอบนี้
// GET ?participantId= → ข้อความในสนทนา (และทำเครื่องหมายอ่านแล้ว)
export async function GET(req, { params }) {
  const st = await getStaff();
  if (!st) return noStaff();
  const id = (await params).id;
  if (!loadExam(id)) return fail('ไม่พบข้อสอบ', 404);
  const pid = new URL(req.url).searchParams.get('participantId');
  if (pid) {
    const p = participantById(pid);
    if (!p || p.exam_id !== id) return fail('ไม่พบผู้เข้าสอบ', 404);
    markRead(pid, false);
    return json({ participant: { id: p.id, name: p.name, school: p.school }, messages: threadOf(pid) });
  }
  return json({ threads: threadsForExam(id) });
}

// POST { participantId, body } → ส่งข้อความหาผู้เข้าสอบ (เด้งขึ้นหน้าจอเขา)
export async function POST(req, { params }) {
  const st = await getStaff();
  if (!st) return noStaff();
  const id = (await params).id;
  const b = (await readJson(req, 5000)) || {};
  const p = participantById(b.participantId);
  if (!p || p.exam_id !== id) return fail('ไม่พบผู้เข้าสอบ', 404);
  const mid = addMessage({ examId: id, participantId: p.id, fromRole: st.role, fromName: st.name, body: b.body });
  if (!mid) return fail('ข้อความว่างเปล่า');
  markRead(p.id, false); // ทีมงานกำลังคุยอยู่ → ข้อความเก่าจากผู้เข้าสอบนับว่าอ่านแล้ว
  return json({ id: mid });
}
