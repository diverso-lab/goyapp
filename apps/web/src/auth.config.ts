import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ request, auth }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!auth;
      const isProtected = pathname.startsWith("/dashboard") || pathname.startsWith("/editor") || pathname.startsWith("/templates");
      if (isProtected && !isLoggedIn) return false;
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        const u = user as { role?: string };
        if (u.role) token.role = u.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token?.id) session.user.id = token.id as string;
        const r = (token as { role?: string }).role;
        session.user.role = (r === "ADMIN" ? "ADMIN" : "USER");
      }
      return session;
    },
  },
};
