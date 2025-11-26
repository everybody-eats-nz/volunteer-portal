import { authOptions } from "@/lib/auth-options";

export interface Provider {
  id: string;
  name: string;
  type: string;
}

/**
 * Extracts OAuth provider information from NextAuth configuration
 * This runs server-side to avoid client-side fetching and layout shifts
 */
export function getOAuthProviders(): Provider[] {
  const providers: Provider[] = [];

  for (const provider of authOptions.providers) {
    // Skip credentials and email providers - only include OAuth providers
    if (provider.type !== "credentials" && provider.type !== "email") {
      providers.push({
        id: provider.id,
        name: provider.name,
        type: provider.type,
      });
    }
  }

  return providers;
}
