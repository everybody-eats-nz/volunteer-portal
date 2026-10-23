import { Composition, type CalculateMetadataFunction } from "remotion";
import { YearInReview } from "./year-in-review/YearInReview";
import {
  yearInReviewSchema,
  type YearInReviewProps,
} from "./year-in-review/schema";
import { FPS, getDurationInFrames } from "./year-in-review/timeline";

// Scenes come and go with the volunteer's data, so the length does too.
const calculateMetadata: CalculateMetadataFunction<YearInReviewProps> = ({
  props,
}) => ({
  durationInFrames: getDurationInFrames(props),
  defaultOutName: `year-in-mahi-${props.year}-${props.firstName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}`,
});

/**
 * Remotion Studio entry. The default props are a sample volunteer; load a
 * real one with `npm run video:props` and pass `--props` to Studio or render.
 */
export const RemotionRoot = () => (
  <Composition
    id="YearInReview"
    component={YearInReview}
    schema={yearInReviewSchema}
    calculateMetadata={calculateMetadata}
    durationInFrames={1500}
    fps={FPS}
    width={1080}
    height={1920}
    defaultProps={{
      year: 2026,
      firstName: "Aroha",
      photoUrl: null,
      shifts: {
        completed: 38,
        hours: 121,
        nights: 34,
        first: {
          date: "2026-01-15T04:30:00.000Z",
          location: "Wellington",
          role: "Kitchen Prep",
        },
      },
      impact: { mealsServed: 2140, foodSavedKg: 1070 },
      rhythm: {
        months: [2, 3, 4, 3, 5, 4, 6, 3, 2, 3, 2, 1],
        busiestMonth: 6,
        favouriteWeekday: 4,
        favouriteWeekdayCount: 17,
      },
      roles: [
        { name: "Kitchen Prep", count: 14 },
        { name: "Front of House", count: 11 },
        { name: "Dishwasher", count: 8 },
        { name: "FOH Set-Up & Service", count: 5 },
      ],
      locations: [
        { name: "Wellington", count: 30 },
        { name: "Onehunga", count: 8 },
      ],
      crew: {
        alongside: 142,
        friends: [
          { name: "Mere", nights: 9, photoUrl: null },
          { name: "Sam", nights: 6, photoUrl: null },
          { name: "Tama", nights: 4, photoUrl: null },
        ],
      },
      achievements: [
        {
          name: "First Steps",
          icon: "🌟",
          description: "Complete your first volunteer shift",
        },
        {
          name: "Getting Started",
          icon: "⭐",
          description: "Complete 5 volunteer shifts",
        },
        {
          name: "Making a Difference",
          icon: "🎯",
          description: "Complete 10 volunteer shifts",
        },
        {
          name: "Veteran Volunteer",
          icon: "🏆",
          description: "Complete 25 volunteer shifts",
        },
        {
          name: "Century Club",
          icon: "💯",
          description: "Volunteer for 100 hours",
        },
      ],
      topPercent: 8,
      organisation: {
        mealsServed: 31480,
        serviceNights: 412,
        volunteers: 640,
        volunteerHours: 9870,
        events: [
          {
            name: "Matariki Hākari",
            date: "2026-07-10",
            location: "Wellington",
          },
          {
            name: "Winter Warmer Fundraiser",
            date: "2026-08-14",
            location: "Glen Innes",
          },
          {
            name: "Pay It Forward Gala",
            date: "2026-09-25",
            location: "Onehunga",
          },
          {
            name: "Christmas Kai",
            date: "2026-12-18",
            location: "Wellington",
          },
        ],
      },
    }}
  />
);
