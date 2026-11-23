import { fail, getStaff, noStaff, forbidden } from '@/lib/auth';
import { computeResults } from '@/lib/results';
import { listParticipants, loadExam } from '@/lib/repo';
import { formatCode } from '@/lib/model';

const q = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // กัน CSV injection
  return `"${s.replace(/"/g, '""')}"`;
};
const csv = (rows, name) =>
  new Response('﻿' + rows.map((r) => r.map(q).join(',')).join('\r\n'), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' },
  });

export async function GET(req, { params }) {
  const st = await getStaff();
  if (!st) return noStaff();
  const id = (await params).id;
  const kind = new URL(req.url).searchParams.get('kind');
  if (kind === 'credentials') {
    if (st.role !== 'admin') return forbidden();
    const exam = loadExam(id);
    if (!exam) return fail('ไม่พบข้อสอบ', 404);
    return csv([['ลำดับ', 'ชื่อ', 'โรงเรียน/สังกัด', 'รหัสเข้าสอบ'], ...listParticipants(id).map((p, i) => [i + 1, p.name, p.school, formatCode(p.code)])], 'spark-codes.csv');
  }
  const r = computeResults(id);
  if (!r) return fail('ไม่พบข้อสอบ', 404);
  const subs = r.exam.subjects;
  const head = ['อันดับ', 'ชื่อ', 'โรงเรียน/สังกัด', 'รหัส', 'สถานะ', ...subs.map((s) => s.title), 'คะแนนรวม', 'คะแนนเต็ม', 'รอตรวจ', 'เวลาที่ใช้(นาที)', 'ออกจากหน้าจอ(ครั้ง)'];
  const rows = [...r.rows].sort((a, b) => (a.rank || 1e9) - (b.rank || 1e9) || a.name.localeCompare(b.name, 'th')).map((x) => [
    x.rank || '', x.name, x.school, st.role === 'admin' ? formatCode(x.code) : '',
    !x.attempt ? 'ยังไม่เริ่ม' : x.attempt.submittedAt ? (x.attempt.auto ? 'ส่งอัตโนมัติ' : 'ส่งแล้ว') : 'กำลังทำ',
    ...subs.map((s) => x.subjects[s.id]?.score ?? ''), x.score, x.max, x.pending, x.used != null ? Math.round(x.used / 600) / 100 : '', x.attempt?.blurCount ?? '',
  ]);
  return csv([head, ...rows], 'spark-results.csv');
}
