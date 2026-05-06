import { CampaignMonitorService } from "@/lib/services/campaign-monitor";

interface SyncOptions {
  email: string;
  name: string;
  oldLists: string[];
  newLists: string[];
  emailNewsletterSubscription?: boolean;
}

/**
 * Reconcile a user's Campaign Monitor subscriptions with the desired state.
 *
 * - When `emailNewsletterSubscription` is explicitly false, every list in
 *   `oldLists` is unsubscribed and `newLists` is ignored.
 * - Otherwise, lists added since `oldLists` are subscribed and lists removed
 *   are unsubscribed.
 *
 * Errors are swallowed (Campaign Monitor outages should not block registration
 * or profile updates), but the sync is still attempted for every list.
 */
export async function syncNewsletterSubscriptions({
  email,
  name,
  oldLists,
  newLists,
  emailNewsletterSubscription,
}: SyncOptions): Promise<void> {
  try {
    const campaignMonitor = new CampaignMonitorService();
    const displayName = name.trim() || email;

    if (emailNewsletterSubscription === false) {
      for (const listId of oldLists) {
        await campaignMonitor.unsubscribeFromList(listId, email);
      }
      return;
    }

    const listsToAdd = newLists.filter((id) => !oldLists.includes(id));
    for (const listId of listsToAdd) {
      await campaignMonitor.subscribeToList(listId, email, displayName, {});
    }

    const listsToRemove = oldLists.filter((id) => !newLists.includes(id));
    for (const listId of listsToRemove) {
      await campaignMonitor.unsubscribeFromList(listId, email);
    }
  } catch (error) {
    console.error("Campaign Monitor sync error:", error);
  }
}
