import { LeaderboardCard } from "@/components/leaderboard-card";
import { prisma } from "@/lib/prisma";
import {
  getUserAchievements,
  getAvailableAchievements,
  checkAndUnlockAchievements,
} from "@/lib/achievements";

interface AchievementsStatsProps {
  userId: string;
  skipUnlockCheck?: boolean;
}

/** Four-point sparkle — the marketing site's signature accent mark. */
function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 0c.6 6.5 5.5 11.4 12 12-6.5.6-11.4 5.5-12 12-.6-6.5-5.5-11.4-12-12C6.5 11.4 11.4 6.5 12 0z" />
    </svg>
  );
}

async function getAchievementsData(userId: string, skipUnlockCheck = false) {
  // Calculate achievements based on current history (skip if already done at page level)
  if (!skipUnlockCheck) {
    await checkAndUnlockAchievements(userId);
  }

  // Get user's current achievements and available ones
  const [userAchievements, availableAchievements] = await Promise.all([
    getUserAchievements(userId),
    getAvailableAchievements(userId),
  ]);

  // Calculate total points
  const totalPoints = userAchievements.reduce(
    (sum: number, ua) => sum + ua.achievement.points,
    0
  );

  // Get all active users with their achievement points for ranking (all locations)
  const allUsersWithPoints = await prisma.user.findMany({
    where: {
      role: "VOLUNTEER",
      archivedAt: null,
    },
    select: {
      id: true,
      achievements: {
        include: {
          achievement: {
            select: {
              points: true,
            },
          },
        },
      },
    },
  });

  // Calculate points for each user and sort
  const userRankings = allUsersWithPoints
    .map((u) => ({
      id: u.id,
      points: u.achievements.reduce(
        (sum, ua) => sum + ua.achievement.points,
        0
      ),
    }))
    .sort((a, b) => b.points - a.points);

  // Find user's rank
  const userRank = userRankings.findIndex((u) => u.id === userId) + 1;
  const totalUsers = userRankings.length;
  const percentile =
    totalUsers > 1
      ? Math.round(((totalUsers - userRank + 1) / totalUsers) * 100)
      : 100;

  return {
    userAchievements,
    availableAchievements,
    totalPoints,
    ranking: {
      userRank,
      totalUsers,
      percentile,
    },
  };
}

export async function AchievementsStats({ userId, skipUnlockCheck }: AchievementsStatsProps) {
  const data = await getAchievementsData(userId, skipUnlockCheck);
  const { userAchievements, availableAchievements, totalPoints, ranking } =
    data;

  const totalAchievements =
    userAchievements.length + availableAchievements.length;
  const completionRate =
    totalAchievements > 0
      ? Math.round((userAchievements.length / totalAchievements) * 100)
      : 0;

  return (
    <>
      {/* ============ Trophy cabinet — dark forest panel with sun glow ============
          The page's signature moment (new.everybodyeats.nz dark-panel treatment):
          the volunteer's points as a giant Fraunces figure, a hairline-divided
          stat strip, and a sun completion bar. */}
      <section
        className="grain relative overflow-hidden rounded-[2.5rem] bg-forest-700 px-6 py-10 text-cream-50 sm:px-12 sm:py-14"
        data-testid="achievements-trophy-cabinet"
      >
        {/* Warm sun glow — radial gradient rather than a blur filter, which
            escapes the rounded-corner clip on composited layers in Chromium */}
        <div
          className="absolute -bottom-32 -right-32 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(closest-side,rgb(248_251_105/0.18),transparent)]"
          aria-hidden
        />

        <div className="relative">
          <p className="eyebrow mb-8 flex items-center gap-3 text-sun-200/90">
            <span className="inline-block h-px w-8 bg-sun-200/50" />
            Tō pātaka tohu · Your trophy cabinet
          </p>

          <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
            {/* Total points — the hero figure */}
            <div data-testid="achievements-stat-points">
              <div className="display flex items-baseline gap-3 text-7xl leading-none tracking-tight tabular-nums sm:text-8xl">
                {totalPoints}
                <Sparkle className="h-7 w-7 shrink-0 self-center text-sun-200 sm:h-8 sm:w-8" />
              </div>
              <div className="mt-3 text-sm uppercase tracking-[0.15em] text-cream-50/60">
                Total Points
              </div>
              <div className="mt-1 text-sm text-cream-50/70">
                From {userAchievements.length} achievements
              </div>
            </div>

            {/* Stat strip — hairline-divided trio */}
            <dl className="grid flex-1 grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-cream-50/10 lg:max-w-2xl">
              <div
                className="sm:px-8 sm:first:pl-0 sm:last:pr-0"
                data-testid="achievements-stat-unlocked"
              >
                <dd className="display text-3xl tracking-tight tabular-nums sm:text-4xl">
                  {userAchievements.length}
                  <span className="text-xl text-cream-50/50 sm:text-2xl">
                    /{totalAchievements}
                  </span>
                </dd>
                <dt className="mt-2 text-xs uppercase tracking-[0.15em] text-cream-50/60">
                  Unlocked
                </dt>
                <p className="mt-1 text-xs text-cream-50/55">
                  {completionRate}% completion rate
                </p>
              </div>

              {ranking && (
                <div
                  className="sm:px-8 sm:first:pl-0 sm:last:pr-0"
                  data-testid="achievements-stat-rank"
                >
                  <dd className="display text-3xl tracking-tight tabular-nums sm:text-4xl">
                    #{ranking.userRank}
                    <span className="text-xl text-cream-50/50 sm:text-2xl">
                      /{ranking.totalUsers}
                    </span>
                  </dd>
                  <dt className="mt-2 text-xs uppercase tracking-[0.15em] text-cream-50/60">
                    Your Rank
                  </dt>
                  <p className="mt-1 text-xs text-cream-50/55">
                    Top{" "}
                    {Math.ceil((ranking.userRank / ranking.totalUsers) * 100)}%
                    of volunteers
                  </p>
                </div>
              )}

              {ranking && (
                <div
                  className="sm:px-8 sm:first:pl-0 sm:last:pr-0"
                  data-testid="achievements-stat-percentile"
                >
                  <dd className="display text-3xl tracking-tight tabular-nums sm:text-4xl">
                    {ranking.percentile}
                    <span className="text-xl text-cream-50/50 sm:text-2xl">
                      th
                    </span>
                  </dd>
                  <dt className="mt-2 text-xs uppercase tracking-[0.15em] text-cream-50/60">
                    Percentile
                  </dt>
                  <p className="mt-1 text-xs text-cream-50/55">
                    Better than {ranking.percentile}% of volunteers
                  </p>
                </div>
              )}
            </dl>
          </div>

          {/* Completion bar — the journey so far, in sun */}
          <div className="mt-12">
            <div className="mb-2.5 flex items-center justify-between text-xs">
              <span className="text-cream-50/70">
                {userAchievements.length} of {totalAchievements} achievements
                unlocked
              </span>
              <span className="font-semibold text-sun-200">
                {completionRate}%
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-cream-50/15"
              role="progressbar"
              aria-valuenow={completionRate}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Achievement completion"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-sun-300 to-sun-200 transition-all"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Leaderboard Card with location filtering */}
      <LeaderboardCard />
    </>
  );
}
