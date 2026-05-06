import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import type { Role } from '@prisma/client';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: Role;
      isSuperAdmin: boolean;
      name: string;
      email: string;
    } & DefaultSession['user'];
  }
  interface User {
    id?: string;
    role: Role;
    isSuperAdmin?: boolean;
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id: string;
    role: Role;
    isSuperAdmin: boolean;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === 'string' ? credentials.email : '';
        const password = typeof credentials?.password === 'string' ? credentials.password : '';
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isSuperAdmin: user.isSuperAdmin,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id ?? token.sub ?? '';
        token.role = user.role;
        token.isSuperAdmin = !!user.isSuperAdmin;
      }
      if (trigger === 'update' && token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id },
          select: { role: true, isSuperAdmin: true, name: true, email: true },
        });
        if (fresh) {
          token.role = fresh.role;
          token.isSuperAdmin = fresh.isSuperAdmin;
          token.name = fresh.name;
          token.email = fresh.email ?? token.email;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.isSuperAdmin = !!token.isSuperAdmin;
      }
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!auth?.user;
      const isAuthRoute = pathname === '/login' || pathname.startsWith('/api/auth');
      if (isAuthRoute) return true;
      return isLoggedIn;
    },
  },
});
