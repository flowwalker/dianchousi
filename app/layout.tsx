import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '点筹司 · 课程抽签投点策',
  description: '依据票池抽签机制、竞争者分布和全局动态规划，推演九十九点的最优去处。',
  openGraph: {
    title: '点筹司 · 课程抽签投点策',
    description: '把运气，算进山河。推演九十九点的最优去处。',
    images: [{ url: '/og.png', width: 1672, height: 941, alt: '点筹司像素宫阙云海' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '点筹司 · 课程抽签投点策',
    description: '把运气，算进山河。推演九十九点的最优去处。',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
