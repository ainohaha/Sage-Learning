import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Session',
  description: 'Study Session',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-white text-black">
        {children}
      </body>
    </html>
  );
}
