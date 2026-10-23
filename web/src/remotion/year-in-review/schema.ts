import { z } from "zod";

/**
 * Everything the "Year in mahi" video shows, for one volunteer and one
 * calendar year. Built server-side by `getVolunteerYearInReview()` and passed
 * to the composition as input props, so it must stay JSON-serialisable (dates
 * are ISO strings).
 *
 * Optional stories are carried as empty arrays / nulls and the timeline skips
 * their scene, so a volunteer with no friends or no new badges still gets a
 * video that flows.
 */

const rankedSchema = z.object({
  name: z.string(),
  count: z.number().int().nonnegative(),
});

export const yearInReviewSchema = z.object({
  year: z.number().int(),
  firstName: z.string(),
  /**
   * Their profile photo as stored: a base64 `data:` URI (older uploads), a
   * Supabase Storage URL, or the photo from a Google sign-in.
   */
  photoUrl: z.string().nullable(),
  shifts: z.object({
    completed: z.number().int().positive(),
    /** Whole hours, rounded down like everywhere else in the portal. */
    hours: z.number().int().nonnegative(),
    /** Distinct service nights (day + location) they volunteered on. */
    nights: z.number().int().nonnegative(),
    first: z.object({
      date: z.string(),
      location: z.string().nullable(),
      role: z.string(),
    }),
  }),
  impact: z.object({
    /** People served on the nights they volunteered. */
    mealsServed: z.number().int().nonnegative(),
    foodSavedKg: z.number().int().nonnegative(),
  }),
  rhythm: z.object({
    /** Completed shifts per month, January first. */
    months: z.array(z.number().int().nonnegative()).length(12),
    busiestMonth: z.number().int().min(0).max(11),
    /** 0 = Sunday ... 6 = Saturday (NZ time). */
    favouriteWeekday: z.number().int().min(0).max(6),
    favouriteWeekdayCount: z.number().int().nonnegative(),
  }),
  /** Most-worked shift types, busiest first. */
  roles: z.array(rankedSchema),
  /** Restaurants they volunteered at, busiest first. */
  locations: z.array(rankedSchema),
  crew: z.object({
    /** Other volunteers on the same nights at the same restaurant. */
    alongside: z.number().int().nonnegative(),
    /** Friends they shared the most nights with (visible friends only). */
    friends: z.array(
      z.object({
        name: z.string(),
        nights: z.number().int().positive(),
        photoUrl: z.string().nullable(),
      })
    ),
  }),
  achievements: z.array(
    z.object({
      name: z.string(),
      icon: z.string(),
      description: z.string(),
    })
  ),
  /** "Top X%" of volunteers by shifts this year, or null when not notable. */
  topPercent: z.number().int().min(1).max(100).nullable(),
  organisation: z.object({
    mealsServed: z.number().int().nonnegative(),
    serviceNights: z.number().int().nonnegative(),
    volunteers: z.number().int().nonnegative(),
    volunteerHours: z.number().int().nonnegative(),
    events: z.array(
      z.object({
        name: z.string(),
        date: z.string(),
        location: z.string(),
      })
    ),
  }),
});

export type YearInReviewProps = z.infer<typeof yearInReviewSchema>;
