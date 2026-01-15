import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

/**
 * NextAuth.js Configuration
 * - Google OAuth with @appointy.com domain restriction
 * - JWT session strategy for backend API calls
 */
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  
  callbacks: {
    // Domain restriction - only allow @appointy.com
    async signIn({ user }) {
      const allowedDomains = ['appointy.com'];
      const email = user.email || '';
      const domain = email.split('@')[1];
      
      if (!allowedDomains.includes(domain)) {
        console.log(`[Auth] Rejected login from: ${email}`);
        return false;
      }
      
      console.log(`[Auth] Successful login: ${email}`);
      return true;
    },
    
    // Include user info in JWT token
    async jwt({ token, account, user }) {
      if (account && user) {
        token.accessToken = account.access_token;
        token.idToken = account.id_token;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }
      return token;
    },
    
    // Make token info available in session
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.idToken = token.idToken as string;
      session.user = {
        ...session.user,
        email: token.email as string,
        name: token.name as string,
        image: token.picture as string,
      };
      return session;
    },
  },
  
  pages: {
    signIn: '/login',
    error: '/login',
  },
  
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  
  debug: process.env.NODE_ENV === 'development',
};
