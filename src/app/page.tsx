import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Root redirect page: authenticated users go to /dashboard, unauthenticated users go to /login.
// Keeps the root "/" URL from showing a blank page.
export default async function RootPage() {
  const session = await auth();
  if (session?.user) redirect('/dashboard');
  redirect('/login');
}
