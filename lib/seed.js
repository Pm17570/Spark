// ข้อสอบตัวอย่าง: 3 วิชา ครบทั้ง 5 รูปแบบ มีสูตร LaTeX และรูปประกอบโจทย์
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { UPLOAD_DIR } from './db';
import { createExam, saveExamContent, updateExamSettings, createParticipants, listParticipants } from './repo';
import { rid } from './model';

function copyAsset(file) {
  const src = path.join(process.cwd(), 'seed-assets', file);
  if (!fs.existsSync(src)) return '';
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const name = crypto.randomBytes(8).toString('hex') + path.extname(file);
  fs.copyFileSync(src, path.join(UPLOAD_DIR, name));
  return name;
}

const opt = (text, correct = false) => ({ text, image: '', correct });
const P = (type, o) => ({ id: rid('p'), type, text: '', image: '', points: 1, ...o });

export function createSampleExam() {
  const chart = copyAsset('sample-chart.png');
  const id = createExam('SPARK ตัวอย่าง — คณิต วิทย์ ภาษา');
  const math = {
    id: rid('s'),
    title: 'คณิตศาสตร์',
    description: 'ใช้สูตร LaTeX ได้ทุกช่อง เช่น $x^2$ หรือ $$\\int_0^1 x^2\\,dx$$',
    questions: [
      {
        id: rid('q'),
        title: 'ฟังก์ชันกำลังสอง',
        stem: 'กำหนดฟังก์ชัน $f(x) = x^2 - 5x + 6$ สำหรับจำนวนจริง $x$',
        stemImage: '',
        layout: 'same',
        parts: [
          P('mcq', { text: 'ค่าของ $f(3)$ เท่ากับข้อใด', points: 2, multiple: false, partial: true, options: [opt('$0$', true), opt('$6$'), opt('$-6$'), opt('$12$')] }),
          P('mcq', { text: 'ข้อใดเป็นรากของสมการ $f(x)=0$ (เลือกได้หลายข้อ)', points: 3, multiple: true, partial: true, options: [opt('$x=1$'), opt('$x=2$', true), opt('$x=3$', true), opt('$x=6$')] }),
          P('fill', { text: 'เติมคำตอบลงในช่องว่าง', points: 2, template: 'ผลบวกของรากทั้งสองคือ [[5]] และผลคูณของรากทั้งสองคือ [[6]]', distractors: '-5, 1' }),
        ],
      },
      {
        id: rid('q'),
        title: 'แคลคูลัสเบื้องต้น',
        stem: 'พิจารณาการอินทิเกรตและอนุพันธ์ของฟังก์ชันพื้นฐาน (ข้อย่อยแต่ละข้อแสดงคนละหน้า)',
        stemImage: '',
        layout: 'split',
        parts: [
          P('text', { text: 'จงหาค่าของ $$\\int_0^1 x^2\\,dx$$ (ตอบเป็นเศษส่วนหรือทศนิยมก็ได้)', points: 3, accepted: '1/3', matchMode: 'numeric', tolerance: 0.001 }),
          P('tf', {
            text: 'พิจารณาข้อความต่อไปนี้ ตอบถูกหรือผิด ถ้าผิดให้แก้ให้ถูกต้อง',
            points: 4,
            correctable: true,
            statements: [
              { text: '$\\dfrac{d}{dx}\\sin x = \\cos x$', correct: true, fixes: '' },
              { text: '$\\dfrac{d}{dx}x^3 = 2x^2$ จึงเท่ากับ $2x^2$', correct: false, fixes: '3x^2\n$3x^2$' },
            ],
          }),
          P('match', {
            text: 'จับคู่ฟังก์ชันกับอนุพันธ์',
            points: 4,
            pairs: [
              { left: '$x^2$', leftImage: '', right: '$2x$' },
              { left: '$\\sin x$', leftImage: '', right: '$\\cos x$' },
              { left: '$e^x$', leftImage: '', right: '$e^x$' },
              { left: '$\\ln x$', leftImage: '', right: '$\\dfrac{1}{x}$' },
            ],
            extras: '$x$',
          }),
        ],
      },
    ],
  };
  const sci = {
    id: rid('s'),
    title: 'วิทยาศาสตร์',
    description: '',
    questions: [
      {
        id: rid('q'),
        title: 'อ่านกราฟ',
        stem: 'กราฟแสดงยอดขายน้ำผลไม้ของ 4 ร้านต่อวัน (ขวด)',
        stemImage: chart,
        layout: 'same',
        parts: [
          P('mcq', { text: 'ร้านใดขายได้มากที่สุด', points: 1, multiple: false, partial: true, options: [opt('ร้าน A'), opt('ร้าน B'), opt('ร้าน C'), opt('ร้าน D', true)] }),
          P('text', { text: 'ยอดขายของร้าน A และร้าน B รวมกันกี่ขวด', points: 2, accepted: '105', matchMode: 'numeric', tolerance: 0 }),
          P('text', { text: 'อธิบายความแตกต่างของยอดขายระหว่างร้านที่สูงที่สุดและต่ำที่สุด (กรรมการตรวจ)', points: 3, long: true, manual: true, accepted: '' }),
        ],
      },
      {
        id: rid('q'),
        title: 'แรงและการเคลื่อนที่',
        stem: 'วัตถุมวล $m = 2\\,\\text{kg}$ เคลื่อนที่ด้วยความเร่ง $a = 3\\,\\text{m/s}^2$',
        stemImage: '',
        layout: 'same',
        parts: [
          P('mcq', { text: 'แรงลัพธ์ $F = ma$ มีค่าเท่าใด', points: 2, multiple: false, partial: true, options: [opt('$1.5\\,\\text{N}$'), opt('$5\\,\\text{N}$'), opt('$6\\,\\text{N}$', true), opt('$9\\,\\text{N}$')] }),
          P('fill', { text: 'เติมคำ', points: 2, template: 'น้ำเดือดที่ [[100]] องศาเซลเซียส และน้ำแข็งละลายที่ [[0]] องศาเซลเซียส', distractors: '50, -273' }),
        ],
      },
    ],
  };
  const eng = {
    id: rid('s'),
    title: 'ภาษาอังกฤษ',
    description: '',
    questions: [
      {
        id: rid('q'),
        title: 'Reading',
        stem: 'Mia gets up at 6 a.m. every day. She walks to school with her brother and they usually arrive before 7:30.',
        stemImage: '',
        layout: 'same',
        parts: [
          P('mcq', { text: 'How does Mia go to school?', points: 1, multiple: false, partial: true, options: [opt('By bus'), opt('On foot', true), opt('By bike')] }),
          P('tf', {
            text: 'True or False?',
            points: 2,
            correctable: false,
            statements: [
              { text: 'Mia wakes up at 7 a.m.', correct: false, fixes: '' },
              { text: 'Mia walks with her brother.', correct: true, fixes: '' },
            ],
          }),
          P('fill', { text: 'Complete the sentence.', points: 1, template: 'Mia [[walks]] to school every day.', distractors: 'walk, ride' }),
        ],
      },
    ],
  };
  saveExamContent(id, { title: 'SPARK ตัวอย่าง — คณิต วิทย์ ภาษา', description: 'ข้อสอบตัวอย่างสำหรับทดลองระบบ — มีทั้งหมด 3 วิชา ทำได้ตามลำดับหรือสลับวิชาได้ตามสะดวก', subjects: [math, sci, eng] });
  updateExamSettings(id, { status: 'open', durationMin: 30, showResult: true });
  createParticipants(id, Array.from({ length: 5 }, (_, i) => ({ name: `ผู้เข้าสอบตัวอย่าง ${i + 1}`, school: 'โรงเรียนตัวอย่าง' })));
  const codes = listParticipants(id).map((p) => p.code);
  return { examId: id, code: codes[0], codes };
}
