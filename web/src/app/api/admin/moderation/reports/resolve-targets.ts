import { prisma } from "@/lib/prisma";
import { formatInNZT } from "@/lib/timezone";
import { volunteerProfileHref } from "@/lib/admin-navigation";

/**
 * What a content report points at, resolved for the moderation queue.
 *
 * A report stores only `targetType` + `targetId`. For a `post`, the id is the
 * mobile feed item id (see `api/mobile/feed`), whose prefix says where the
 * item came from: `announcement-<id>`, `achievement-<userAchievementId>`,
 * `friend-signup-<signupId>`, `daily-menu-<id>`, or a CMS item. A `comment`
 * is a `FeedComment` id and a `user` a `User` id.
 */
export interface ReportTarget {
  /** Short human label for the kind of thing reported, e.g. "Announcement". */
  kind: string;
  /** What the reported item says, trimmed for the table. Null if gone or textless. */
  snippet: string | null;
  /** Who wrote or owns it. Null for system or CMS content. */
  author: { id: string; name: string; email: string } | null;
  /** Where an admin can see the item or its author. */
  href: string | null;
  /** False when the item has since been deleted. */
  exists: boolean;
  /** Why there's no snippet, for items whose text isn't stored here. */
  note?: string;
}

interface ReportRef {
  targetType: string;
  targetId: string;
}

const SNIPPET_LENGTH = 280;
const FROM_WEBSITE =
  "Published from the website, so its text isn't stored in the portal.";
const GENERATED = "Written by the app from shift data; no one authored it.";
const MODERATION_PATH = "/admin/moderation";

function snippet(text: string | null | undefined): string | null {
  if (!text) return null;
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > SNIPPET_LENGTH
    ? `${flat.slice(0, SNIPPET_LENGTH - 1)}…`
    : flat;
}

type UserRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  email: string;
};

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  name: true,
  email: true,
} as const;

function toAuthor(user: UserRow) {
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return {
    id: user.id,
    name: full || user.name || user.email,
    email: user.email,
  };
}

function profileHref(userId: string) {
  return volunteerProfileHref(userId, MODERATION_PATH);
}

const missing = (kind: string): ReportTarget => ({
  kind,
  snippet: null,
  author: null,
  href: null,
  exists: false,
});

/** Feed-item prefixes in the order they must be tested (longest first). */
const POST_PREFIXES = [
  "friend-signup-",
  "announcement-",
  "achievement-",
  "journal-post-",
  "shift-recap-",
  "daily-menu-",
  "cms-event-",
  "new-shift-",
] as const;

type PostPrefix = (typeof POST_PREFIXES)[number];

function splitPostId(targetId: string): [PostPrefix | null, string] {
  const prefix = POST_PREFIXES.find((p) => targetId.startsWith(p)) ?? null;
  return [prefix, prefix ? targetId.slice(prefix.length) : targetId];
}

/**
 * Resolves every report's target in a handful of batched queries (one per
 * target kind), keyed by `${targetType}:${targetId}`.
 */
export async function resolveReportTargets(
  reports: ReportRef[]
): Promise<Map<string, ReportTarget>> {
  const ids = {
    user: new Set<string>(),
    comment: new Set<string>(),
    announcement: new Set<string>(),
    achievement: new Set<string>(),
    signup: new Set<string>(),
    menu: new Set<string>(),
  };

  for (const { targetType, targetId } of reports) {
    if (targetType === "user") ids.user.add(targetId);
    else if (targetType === "comment") ids.comment.add(targetId);
    else if (targetType === "post") {
      const [prefix, id] = splitPostId(targetId);
      if (prefix === "announcement-") ids.announcement.add(id);
      else if (prefix === "achievement-") ids.achievement.add(id);
      else if (prefix === "friend-signup-") ids.signup.add(id);
      else if (prefix === "daily-menu-") ids.menu.add(id);
    }
  }

  const [users, comments, announcements, achievements, signups, menus] =
    await Promise.all([
      ids.user.size
        ? prisma.user.findMany({
            where: { id: { in: [...ids.user] } },
            select: userSelect,
          })
        : [],
      ids.comment.size
        ? prisma.feedComment.findMany({
            where: { id: { in: [...ids.comment] } },
            select: { id: true, text: true, user: { select: userSelect } },
          })
        : [],
      ids.announcement.size
        ? prisma.announcement.findMany({
            where: { id: { in: [...ids.announcement] } },
            select: {
              id: true,
              title: true,
              body: true,
              author: { select: userSelect },
            },
          })
        : [],
      ids.achievement.size
        ? prisma.userAchievement.findMany({
            where: { id: { in: [...ids.achievement] } },
            select: {
              id: true,
              achievement: { select: { name: true } },
              user: { select: userSelect },
            },
          })
        : [],
      ids.signup.size
        ? prisma.signup.findMany({
            where: { id: { in: [...ids.signup] } },
            select: {
              id: true,
              user: { select: userSelect },
              shift: {
                select: {
                  start: true,
                  location: true,
                  shiftType: { select: { name: true } },
                },
              },
            },
          })
        : [],
      ids.menu.size
        ? prisma.dailyMenu.findMany({
            where: { id: { in: [...ids.menu] } },
            select: {
              id: true,
              date: true,
              location: true,
              announcement: true,
            },
          })
        : [],
    ]);

  const byId = <T extends { id: string }>(rows: T[]) =>
    new Map(rows.map((r) => [r.id, r]));
  const usersById = byId(users);
  const commentsById = byId(comments);
  const announcementsById = byId(announcements);
  const achievementsById = byId(achievements);
  const signupsById = byId(signups);
  const menusById = byId(menus);

  const resolve = ({ targetType, targetId }: ReportRef): ReportTarget => {
    if (targetType === "user") {
      const user = usersById.get(targetId);
      if (!user) return missing("Volunteer");
      return {
        kind: "Volunteer",
        snippet: null,
        author: toAuthor(user),
        href: profileHref(user.id),
        exists: true,
      };
    }

    if (targetType === "comment") {
      const comment = commentsById.get(targetId);
      if (!comment) return missing("Comment");
      return {
        kind: "Comment",
        snippet: snippet(comment.text),
        author: toAuthor(comment.user),
        href: profileHref(comment.user.id),
        exists: true,
      };
    }

    if (targetType !== "post") return missing(targetType);

    const [prefix, id] = splitPostId(targetId);
    switch (prefix) {
      case "announcement-": {
        const ann = announcementsById.get(id);
        if (!ann) return missing("Announcement");
        return {
          kind: "Announcement",
          snippet: snippet(`${ann.title}: ${ann.body}`),
          author: toAuthor(ann.author),
          href: "/admin/announcements",
          exists: true,
        };
      }
      case "achievement-": {
        const ua = achievementsById.get(id);
        if (!ua) return missing("Achievement post");
        return {
          kind: "Achievement post",
          snippet: `Unlocked “${ua.achievement.name}”`,
          author: toAuthor(ua.user),
          href: profileHref(ua.user.id),
          exists: true,
        };
      }
      case "friend-signup-": {
        const signup = signupsById.get(id);
        if (!signup) return missing("Shift signup post");
        const { shift } = signup;
        const where = shift.location ? ` at ${shift.location}` : "";
        return {
          kind: "Shift signup post",
          snippet: `Signed up for ${shift.shiftType.name}${where}, ${formatInNZT(shift.start, "EEE d MMM")}`,
          author: toAuthor(signup.user),
          href: profileHref(signup.user.id),
          exists: true,
        };
      }
      case "daily-menu-": {
        const menu = menusById.get(id);
        if (!menu) return missing("Daily menu");
        return {
          kind: "Daily menu",
          snippet:
            snippet(menu.announcement) ??
            `${menu.location} menu, ${formatInNZT(menu.date, "EEE d MMM")}`,
          author: null,
          href: "/admin/menus",
          exists: true,
        };
      }
      case "journal-post-":
        return { ...missing("Journal post"), exists: true, note: FROM_WEBSITE };
      case "cms-event-":
        return {
          ...missing("Community event"),
          exists: true,
          note: FROM_WEBSITE,
        };
      case "new-shift-":
        return { ...missing("New shifts post"), exists: true, note: GENERATED };
      case "shift-recap-":
        return {
          ...missing("Shift recap post"),
          exists: true,
          note: GENERATED,
        };
      case null:
        return missing("Post");
      default: {
        // Adding a prefix to POST_PREFIXES without a case above fails here.
        const unhandled: never = prefix;
        return missing(unhandled);
      }
    }
  };

  return new Map(
    reports.map((r) => [`${r.targetType}:${r.targetId}`, resolve(r)])
  );
}
