import type { Metadata } from 'next';
import './globals.css';
import { AppProvider } from '@/src/ui/context/AppContext';
import { AccessModal } from '@/src/ui/components/AccessModal';

export const metadata: Metadata = {
  title: 'Brand Gate | Pre-publication Brand Governance',
  description:
    'A pre-publication brand-governance platform for Thrift-It. Multi-model debate, deterministic gates, and human oversight.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
        <AppProvider>
          {children}
          <AccessModal />
        </AppProvider>
      </body>
    </html>
  );
}
