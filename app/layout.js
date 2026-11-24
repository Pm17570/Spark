import 'katex/dist/katex.min.css';
import './globals.css';

export const metadata = { title: 'SPARK — Examination System', description: 'SPARK online individual exam system' };
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#2a1f78' };

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
