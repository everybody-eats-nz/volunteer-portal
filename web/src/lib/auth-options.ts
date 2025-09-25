import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider, {
  FacebookProfile,
} from "next-auth/providers/facebook";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

type AppRole = "ADMIN" | "VOLUNTEER";

// Extend NextAuth types
declare module "next-auth" {
  interface User {
    role?: AppRole;
    phone?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    emailVerified?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: AppRole;
    phone?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    emailVerified?: boolean;
  }
}

type TokenWithProfile = JWT & {
  role?: AppRole;
  phone?: string;
  firstName?: string;
  lastName?: string;
  emailVerified?: boolean;
};

type SessionUserWithProfile = {
  id?: string;
  role?: AppRole;
  phone?: string;
  firstName?: string;
  lastName?: string;
  emailVerified?: boolean;
};

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    // OAuth Providers
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          // Request higher quality image (400x400 instead of default ~96x96)
          image:
            profile.picture?.replace(/=s\d+-c$/, "=s400-c") || profile.picture,
        };
      },
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
      // Request highest quality profile picture (800x800)
      profileUrl:
        "https://graph.facebook.com/me?fields=id,name,email,picture.width(800).height(800)",
      profile(profile: FacebookProfile) {
        return {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          image: profile.picture?.data?.url,
        };
      },
    }),
    // Credentials Provider
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            phone: true,
            firstName: true,
            lastName: true,
            hashedPassword: true,
            emailVerified: true,
          },
        });
        if (!user) return null;
        const valid = await bcrypt.compare(
          credentials.password,
          user.hashedPassword
        );
        if (!valid) return null;
        
        // Allow all authenticated users to sign in, including unverified ones
        // Email verification will be checked at the application level
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
          emailVerified: user.emailVerified,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Handle OAuth sign-in
      if (account?.provider !== "credentials" && user?.email) {
        try {
          // Check if user already exists
          let existingUser = await prisma.user.findUnique({
            where: { email: user.email },
          });

          if (!existingUser) {
            // Create new user for OAuth sign-in
            const nameParts = user.name?.split(" ") || [];
            const firstName = nameParts[0] || "";
            const lastName = nameParts.slice(1).join(" ") || "";

            existingUser = await prisma.user.create({
              data: {
                email: user.email,
                name: user.name || "",
                firstName,
                lastName,
                role: "VOLUNTEER", // Default role for OAuth users
                profilePhotoUrl: user.image || null,
                // OAuth users don't need a password
                hashedPassword: "",
                // Set default agreement acceptance for OAuth users
                volunteerAgreementAccepted: false, // They'll need to complete profile
                healthSafetyPolicyAccepted: false,
              },
            });
          } else {
            // Update existing user's profile photo if from OAuth
            if (user.image && !existingUser.profilePhotoUrl) {
              await prisma.user.update({
                where: { id: existingUser.id },
                data: { profilePhotoUrl: user.image },
              });
            }
          }

          // Update the user object with database info for the session
          user.id = existingUser.id;
          user.role = existingUser.role;
          user.phone = existingUser.phone;
          user.firstName = existingUser.firstName;
          user.lastName = existingUser.lastName;
        } catch (error) {
          console.error("Error handling OAuth sign-in:", error);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = user.role;
        token.phone = user.phone;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.emailVerified = Boolean(user.emailVerified);
      }

      // Handle session updates (like profile changes)
      if (trigger === "update" && session) {
        // Update token with fresh user data from database
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: {
            name: true,
            phone: true,
            role: true,
            firstName: true,
            lastName: true,
            emailVerified: true,
          },
        });
        if (dbUser) {
          token.name = dbUser.name;
          token.phone = dbUser.phone || undefined;
          token.role = dbUser.role;
          token.firstName = dbUser.firstName || undefined;
          token.lastName = dbUser.lastName || undefined;
          token.emailVerified = dbUser.emailVerified || false;
        }
      }

      return token;
    },
    async session({ session, token }) {
      const t = token as TokenWithProfile & { sub?: string };
      const s = session;
      if (s.user) {
        const u = s.user as SessionUserWithProfile;
        u.id = t.sub;
        u.role = t.role;
        u.phone = t.phone;
        u.firstName = t.firstName;
        u.lastName = t.lastName;
        u.emailVerified = t.emailVerified;
      }
      return s;
    },
  },
  pages: {
    signIn: "/login",
  },
};
