// รันตอนเซิร์ฟเวอร์เริ่มทำงาน เพื่อให้แสดงรหัสผ่านแอดมินใน console ทันที
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { boot } = await import('./lib/boot');
    boot();
  }
}
