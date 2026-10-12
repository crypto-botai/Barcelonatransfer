import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { linkGuestBookings, offerToClaimBookings } from "@/lib/claim-bookings";

// Loaded when needed: the email module is large and nothing at sign-in time should pay for it unless a booking is waiting to be claimed.
const mailClaim = async (o: { to: string; name: string | null; count: number; claimUrl: string }) => (await import("@/lib/resend")).sendClaimBookingsEmail(o);

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

        // A customer with bookings made without an account is offered them by email (at most twice a day).
        if (user.role === "CUSTOMER") await offerToClaimBookings({ id: user.id, email: user.email, name: user.name, role: user.role }, mailClaim);

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
      // The profile photo can be kept with the account as a picture; it must never travel inside the sign-in cookie.
      delete token.picture;
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
        // Google has verified the email: bookings made as a guest with it are this person's.
        if (user?.email && dbUser?.role === "CUSTOMER") await linkGuestBookings(token.id as string, user.email).catch(() => 0);
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
