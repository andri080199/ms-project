// NextAuth v5 catch-all route handler. Delegates all auth requests (/api/auth/*)
// to the handlers object exported from lib/auth.ts which contains the NextAuth config.
import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;
