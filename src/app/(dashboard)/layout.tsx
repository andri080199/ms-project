'use client';

import { useState, type ReactNode } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative z-10 min-h-screen flex">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header onToggleSidebar={() => setOpen((v) => !v)} />
        <main className="flex-1 px-4 pb-8 pt-2">
          <div className="page-enter">{children}</div>
        </main>
      </div>
    </div>
  );
}
