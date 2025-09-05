import { PostHog } from "posthog-node";

let posthogClient: PostHog | undefined;

function getPostHogClient(): PostHog {
  if (!posthogClient && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: "https://us.posthog.com",
    });
  }
  
  if (!posthogClient) {
    throw new Error("PostHog client not initialized - missing NEXT_PUBLIC_POSTHOG_KEY");
  }
  
  return posthogClient;
}

export async function isFeatureEnabled(
  flag: string, 
  distinctId: string = "anonymous"
): Promise<boolean> {
  try {
    const client = getPostHogClient();
    return await client.isFeatureEnabled(flag, distinctId);
  } catch (error) {
    console.error("Error checking feature flag:", error);
    // Return false by default if there's an error
    return false;
  }
}

export async function shutdownPostHog() {
  if (posthogClient) {
    await posthogClient.shutdown();
  }
}