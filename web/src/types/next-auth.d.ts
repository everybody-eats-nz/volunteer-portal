import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "VOLUNTEER";
      firstName?: string;
      lastName?: string;
    } & DefaultSession["user"];
  }
}
