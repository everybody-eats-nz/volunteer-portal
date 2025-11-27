import React from "react";
import { Composition } from "remotion";
import { YearInReview } from "./YearInReview";
import type { YearStats } from "./YearInReview/types";

// Default props for Remotion preview
const defaultStats: YearStats = {
  year: 2024,
  userId: "demo-user",
  userName: "Alex Thompson",

  // Primary stats
  totalShifts: 24,
  totalHours: 96,
  mealsServed: 1440,
  volunteerDays: 24,

  // Impact metrics
  locationsVisited: ["Wellington", "Glen Innes"],
  favoriteShiftType: { name: "Kitchen Prep", count: 12 },
  busiestMonth: { month: "June", count: 5 },
  foodWasteKg: 576,

  // Community metrics
  achievementsUnlocked: 8,
  volunteerGrade: "GREEN",
  friendsMade: 3,
  currentStreak: 6,

  // Highlights
  firstShift: { date: "January 15", type: "Kitchen Prep", location: "Wellington" },
  lastShift: { date: "December 20", type: "Serving", location: "Glen Innes" },
  longestShift: { duration: 6, date: "July 4", type: "Kitchen Prep" },

  // Profile
  profilePhotoUrl: null,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="YearInReview"
        component={YearInReview}
        durationInFrames={900} // 30 seconds at 30fps
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultStats}
      />
    </>
  );
};

// This is the default export that Remotion expects
export default RemotionRoot;
