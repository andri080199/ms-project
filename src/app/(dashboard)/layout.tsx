'use client';

import { type ReactNode } from 'react';
import Sidebar from '@/components/Sidebar';
import MobileBottomNav from '@/components/MobileBottomNav';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative z-10 h-screen flex overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 flex flex-col overflow-hidden">
          <div id="page-header-slot" className="px-4 pt-4 md:pt-6 pb-3 md:pb-4 shrink-0" />
          <div
            id="page-scroll"
            className="flex-1 overflow-y-auto px-4 pb-28 md:pb-8"
          >
            <div className="page-enter">{children}</div>
          </div>
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
