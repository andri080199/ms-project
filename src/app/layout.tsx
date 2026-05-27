import type { Metadata, Viewport } from 'next';
import './globals.css';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'FIERSA',
  description: 'Finance, Integrated Employee Reimbursement System & Approval',
};

// Match iOS Safari chrome to the body's declared background-color
// (--color-bg-base = #EEEDF2). Gradient + aurora overlays will still tint
// the visible viewport edges slightly differently, but this is the
// canonical base color of the design system.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#eeedf2',
};

// Root HTML shell. Providers wraps all children with session, AntD config, and i18n context.
// Aurora background layers are injected here so they persist across all route groups.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* Decorative aurora gradient layers — aria-hidden so they don't pollute the a11y tree */}
        <div className="aurora-bg" aria-hidden>
          <div className="aurora aurora-1" />
          <div className="aurora aurora-2" />
          <div className="aurora aurora-3" />
        </div>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
