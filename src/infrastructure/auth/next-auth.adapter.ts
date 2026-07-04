import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { config } from '@/infrastructure/config';

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: config.auth.googleClientId,
      clientSecret: config.auth.googleClientSecret,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (credentials?.email === 'admin@nova.io' && credentials?.password === 'admin123') {
          return { id: '1', name: 'Admin', email: 'admin@nova.io' };
        }
        return null;
      },
    }),
  ],
  pages: {
    signIn: '/',
  },
  session: {
    strategy: 'jwt' as const,
  },
  secret: config.auth.nextAuthSecret,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
