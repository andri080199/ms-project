'use client';

import { type ReactNode } from 'react';
import Sidebar from '@/components/Sidebar';
import MobileBottomNav from '@/components/MobileBottomNav';

// Dashboard shell layout shared by all authenticated pages.
//
// Desktop (md+): app-shell pattern — sidebar fixed left, main column with
// its own internal scroll on #page-scroll. Sticky AntD table headers anchor
// to that container via getContainer.
//
// Mobile (< md): document/body scrolls instead so iOS Safari can collapse
// its URL bar + bottom toolbar (Safari only collapses on window scroll, not
// internal element scroll). Outer wrapper drops h-screen + overflow-hidden
// chain; #page-scroll degrades to a plain block. All sticky AntD tables are
// hidden below md (replaced by card lists), so detaching the scroll
// container on mobile is safe.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative z-10 md:h-screen md:flex md:overflow-hidden">
      <Sidebar />
      <div className="md:flex-1 md:flex md:flex-col md:min-w-0 md:overflow-hidden">
        <main className="md:flex-1 md:flex md:flex-col md:overflow-hidden">
          {/* Empty slot filled by PageHeader portals in individual pages */}
          <div id="page-header-slot" className="px-2 md:px-4 pt-4 md:pt-6 pb-3 md:pb-4 md:shrink-0" />
          {/* pb-28 on mobile leaves room above the bottom nav bar */}
          <div
            id="page-scroll"
            className="px-2 md:px-4 pb-28 md:pb-8 md:flex-1 md:overflow-y-auto"
          >
            <div className="page-enter">{children}</div>
          </div>
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
