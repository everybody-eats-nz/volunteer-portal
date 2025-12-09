import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";
import { LogoutClient } from "./logout-client";

export default async function LogoutPage() {
  const session = await getServerSession(authOptions);

  // If already logged out, redirect to login
  if (!session) {
    redirect("/login");
  }

  // Render client component to perform logout
  return <LogoutClient />;
}
