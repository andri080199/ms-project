'use client';

import { type ReactNode } from 'react';
import Sidebar from '@/components/Sidebar';
import MobileBottomNav from '@/components/MobileBottomNav';

// Dashboard shell layout shared by all authenticated pages.
// Structure:
//   <aside>  Sidebar — desktop-only, fixed on the left
//   <main>
//     #page-header-slot — portal target for PageHeader injections (title, breadcrumbs, tabs)
//     #page-scroll      — scrollable content area; passed to sticky AntD table headers
//   <MobileBottomNav>  — fixed bottom bar on mobile
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative z-10 h-screen flex overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Empty slot filled by PageHeader portals in individual pages */}
          <div id="page-header-slot" className="px-2 md:px-4 pt-4 md:pt-6 pb-3 md:pb-4 shrink-0" />
          {/* pb-28 on mobile leaves room above the bottom nav bar */}
          <div
            id="page-scroll"
            className="flex-1 overflow-y-auto px-2 md:px-4 pb-28 md:pb-8"
          >
            <div className="page-enter">{children}</div>
          </div>
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
