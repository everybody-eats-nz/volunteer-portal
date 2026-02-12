import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// During build, allow dummy values if env vars are missing
// This prevents build failures when env vars aren't set
const isBuildTime = process.env.NEXT_PHASE === "phase-production-build";

if (!isBuildTime && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error("Missing Supabase environment variables");
}

// Use dummy values during build if needed
const url = supabaseUrl || "https://dummy-project.supabase.co";
const key = supabaseAnonKey || "dummy-anon-key-for-build";

// Client for browser/public operations
export const supabase = createClient(url, key);

// Admin client for server-side operations (file deletion, etc.)
export const getSupabaseAdmin = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(supabaseUrl, serviceRoleKey);
};
