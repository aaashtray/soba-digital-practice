import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'SOBA — Digital практика',
  description: 'Короткие миссии: от бизнес-задачи до digital-тактики.',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
