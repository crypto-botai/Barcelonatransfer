import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [GoogleProvider({
          clientId:     process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          authorization: { params: { prompt: "select_account" } },
          // allowDangerousEmailAccountLinking removed — prevents OAuth account takeover
        })]
      : []),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.passwordHash) return null;

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;

        return {
          id:                user.id,
          email:             user.email,
          name:              user.name,
          role:              user.role,
          image:             user.image,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, trigger }) {
      if (user) {
        token.id                = user.id;
        token.role              = (user as { role?: string }).role;
        token.mustChangePassword = (user as { mustChangePassword?: boolean }).mustChangePassword;
      }
      // For OAuth sign-ins (Google), always re-fetch role from DB so role
      // changes (e.g. promote to ADMIN) are reflected immediately.
      if (account?.provider === "google" && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, mustChangePassword: true },
        });
        if (dbUser) {
          token.role               = dbUser.role;
          token.mustChangePassword = dbUser.mustChangePassword;
        }
      }
      // The role can change under a live session: the office converts a
      // customer account into a fleet company, or a customer deletes their
      // account and registers again as something else. The token used to keep
      // the role it was stamped with at sign-in until the person signed out,
      // so the account looked unchanged. Re-read it from the database at most
      // once a minute; the middleware and every panel read the token.
      const checkedAt = (token.roleCheckedAt as number | undefined) ?? 0;
      if (token.id && Date.now() - checkedAt > 60_000) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, mustChangePassword: true },
        });
        if (dbUser) {
          token.role               = dbUser.role;
          token.mustChangePassword = dbUser.mustChangePassword;
        } else {
          // The account is gone (deleted from its settings): make the token
          // useless so the next request is treated as signed out.
          token.role = undefined;
          token.id = undefined;
        }
        token.roleCheckedAt = Date.now();
      }
      // Re-fetch when session is updated (e.g. after password change)
      if (trigger === "update" && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, mustChangePassword: true },
        });
        if (dbUser) {
          token.role               = dbUser.role;
          token.mustChangePassword = dbUser.mustChangePassword;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id                = token.id as string;
        (session.user as { role?: string }).role            = token.role as string;
        (session.user as { mustChangePassword?: boolean }).mustChangePassword = token.mustChangePassword as boolean | undefined;
      }
      return session;
    },
  },
};
