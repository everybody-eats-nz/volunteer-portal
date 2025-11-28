# Year in Review Feature

## Overview

The Year in Review feature generates personalized video summaries of volunteers' annual impact using Remotion (React-based video generation). Videos are rendered server-side, cached permanently in Supabase Storage, and available seasonally (December-January in NZ timezone).

## Architecture

### Core Components

1. **Stats Calculation** (`src/lib/year-in-review/stats-calculator.ts`)
   - Queries database for 12 key metrics (shifts, hours, friends, achievements, etc.)
   - Returns `YearStats` object or null if no activity

2. **Season Checker** (`src/lib/year-in-review/season-checker.ts`)
   - Controls access to December-January only (NZ timezone)
   - Functions: `isSeasonallyAvailable()`, `getAvailableYears()`, `hasShiftsInYear()`

3. **Render Cache** (`src/lib/year-in-review/render-cache.ts`)
   - Manages Supabase Storage bucket for videos
   - Functions: `getCachedVideo()`, `uploadVideo()`, `deleteCachedVideo()`, `cleanupOldVideos()`
   - Storage path: `{userId}/{year}/year-in-review.mp4`
   - Cache expiry: 365 days

4. **Job Tracker** (`src/lib/year-in-review/job-tracker.ts`)
   - In-memory job tracking for async rendering
   - Status: `pending` | `processing` | `completed` | `failed`
   - Progress: 0-100%
   - Auto-cleanup after 5 minutes

### API Endpoints

#### POST /api/year-in-review/stats
Get year statistics for authenticated user.

**Request:**
```json
{
  "year": 2024  // optional, defaults to previous year
}
```

**Response:**
```json
{
  "userName": "Alex",
  "year": 2024,
  "totalShifts": 42,
  "totalHours": 168,
  "mealsServed": 1260,
  // ... 9 more metrics
}
```

**Status Codes:**
- 200: Success
- 401: Unauthorized
- 403: Not seasonally available
- 404: No shifts found for year

#### POST /api/year-in-review/render
Initiate video rendering (async).

**Request:**
```json
{
  "year": 2024  // optional
}
```

**Response (cached):**
```json
{
  "status": "cached",
  "url": "https://...",
  "createdAt": "2024-12-01T10:00:00Z"
}
```

**Response (new job):**
```json
{
  "status": "pending",
  "jobId": "user123-2024-1234567890"
}
```

**Response (job in progress):**
```json
{
  "status": "processing",
  "jobId": "user123-2024-1234567890",
  "progress": 45
}
```

#### GET /api/year-in-review/job/[jobId]
Poll job status.

**Response:**
```json
{
  "id": "user123-2024-1234567890",
  "status": "processing",
  "progress": 67,
  "videoUrl": null,
  "error": null,
  "createdAt": "2024-12-01T10:00:00Z",
  "updatedAt": "2024-12-01T10:00:45Z"
}
```

**When completed:**
```json
{
  "id": "user123-2024-1234567890",
  "status": "completed",
  "progress": 100,
  "videoUrl": "https://...",
  "createdAt": "2024-12-01T10:00:00Z",
  "updatedAt": "2024-12-01T10:01:30Z"
}
```

### UI Components

#### YearInReviewButton
Trigger button for the feature.

```tsx
import { YearInReviewButton } from "@/components/year-in-review";

<YearInReviewButton
  year={2024}  // optional
  variant="default"  // or "outline" | "ghost" | "secondary"
  size="default"  // or "sm" | "lg"
/>
```

#### YearInReviewDialog
Modal with video generation progress and player.

```tsx
import { YearInReviewDialog } from "@/components/year-in-review";

<YearInReviewDialog
  open={isOpen}
  onOpenChange={setIsOpen}
  defaultYear={2024}  // optional
/>
```

#### useYearInReviewRender Hook
React hook for managing render state.

```tsx
import { useYearInReviewRender } from "@/hooks/useYearInReviewRender";

const {
  status,      // 'idle' | 'checking' | 'rendering' | 'completed' | 'failed'
  progress,    // 0-100
  videoUrl,    // string | null
  error,       // string | null
  startRender, // (year?) => Promise<void>
  reset,       // () => void
  isLoading    // boolean
} = useYearInReviewRender();
```

### Remotion Compositions

#### File Structure
```
src/remotion/
├── Root.tsx                     # Composition registration
├── YearInReview/
│   ├── index.tsx               # Main composition (8 sequences)
│   ├── types.ts                # Types, colors, fonts, timing
│   └── slides/
│       ├── IntroSlide.tsx      # Welcome (90 frames)
│       ├── StatsSlide.tsx      # Key metrics (120 frames)
│       ├── ImpactSlide.tsx     # Food waste, locations (120 frames)
│       ├── AchievementsSlide.tsx  # Badges, grade (150 frames)
│       ├── StreakSlide.tsx     # Consecutive months (90 frames)
│       ├── FriendsSlide.tsx    # Community connections (90 frames)
│       ├── HighlightsSlide.tsx # First/last/longest shifts (150 frames)
│       └── OutroSlide.tsx      # Thank you (90 frames)
```

#### Video Specifications
- **Format:** 9:16 portrait (1080x1920px)
- **Duration:** 30 seconds (900 frames @ 30fps)
- **Codec:** H.264
- **Size:** ~5-10MB per video

#### Brand Styling
```typescript
BRAND_COLORS = {
  background: "#0e3a23",      // Dark green
  primary: "#256628",         // Lighter green
  accent: "#f8fb69",          // Yellow
  text: "#fffdf7"             // Warm off-white
}

BRAND_FONTS = {
  sans: "Libre Franklin",     // Body text
  accent: "Fraunces"          // Headings
}
```

## Setup Instructions

### 1. Install Dependencies
Already installed in package.json:
- `remotion`
- `@remotion/renderer`
- `@remotion/cli`
- `@remotion/bundler`
- `@supabase/supabase-js`

### 2. Configure Environment Variables
Add to `.env.local`:
```bash
# Supabase (for video storage)
NEXT_PUBLIC_SUPABASE_URL="your-project-url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Timezone (already configured)
TZ="Pacific/Auckland"
```

### 3. Set Up Supabase Storage Bucket
Run the setup script:
```bash
npx tsx scripts/setup-supabase-storage.ts
```

This creates a public bucket named `year-in-review-videos` with:
- Public read access
- 50MB file size limit
- MP4 mime type restriction

### 4. Preview Remotion Compositions
```bash
npm run remotion
```
Opens preview at `http://localhost:3001`

### 5. Integration
Add the button to your dashboard:
```tsx
import { YearInReviewButton } from "@/components/year-in-review";

export default function Dashboard() {
  return (
    <div>
      {/* Seasonal feature - only visible in Dec/Jan */}
      <YearInReviewButton />
    </div>
  );
}
```

## Rendering Process

### Flow Diagram
```
User clicks button
  → POST /api/year-in-review/render
  → Check cache
     → If cached: return URL immediately
     → If not cached:
        → Create job
        → Start async rendering
        → Return jobId
        → Client polls GET /api/year-in-review/job/[jobId]
           → Updates progress bar
           → On completion: shows video player
```

### Rendering Steps
1. **Calculate stats** (10% progress)
2. **Bundle Remotion** (30% progress)
3. **Select composition** (40% progress)
4. **Render frames** (40-90% progress)
5. **Upload to Supabase** (95% progress)
6. **Cleanup & complete** (100% progress)

### Performance
- First render: ~45-60 seconds
- Cached: <1 second
- Bundle size: ~2-3MB (temporary)
- Video size: ~5-10MB (permanent)

## Security

### Access Control
- **Authentication:** All endpoints require valid session
- **Authorization:** Users can only access their own videos
- **Seasonal:** Only available Dec 1 - Jan 31 (NZ time)
- **Rate Limiting:** One active job per user/year

### Data Privacy
- Videos stored in user-specific folders: `{userId}/{year}/`
- Public URLs but unguessable (Supabase generates unique paths)
- Auto-cleanup of old years
- No PII in video content (only stats)

## Troubleshooting

### Common Issues

**"Year-in-review videos are only available in December and January"**
- Check server timezone: `TZ=Pacific/Auckland`
- Verify season checker logic
- For testing, temporarily modify `isSeasonallyAvailable()`

**"Failed to render video"**
- Check Remotion bundler output in server logs
- Verify `src/remotion/Root.tsx` has default export
- Ensure all slide components import correctly
- Check server has sufficient memory (rendering requires ~500MB)

**"Failed to upload video"**
- Verify Supabase credentials in `.env.local`
- Check bucket exists: Run setup script again
- Verify service role key has storage permissions

**Job stuck at progress**
- Check server logs for errors
- Jobs auto-expire after 5 minutes
- User can retry with "Try Again" button

### Debugging

Enable verbose logging:
```bash
# Server logs
npm run dev

# Remotion preview logs
npm run remotion

# Check job state (in browser console)
fetch('/api/year-in-review/job/YOUR_JOB_ID')
  .then(r => r.json())
  .then(console.log)
```

## Future Enhancements

### Potential Improvements
1. **Persistent Job Storage:** Use Redis/database instead of in-memory
2. **Email Notifications:** Send email when video is ready
3. **Customization:** Allow users to choose themes/music
4. **Social Sharing:** Direct sharing to Instagram/Facebook Stories
5. **Analytics:** Track video views and shares
6. **Batch Rendering:** Generate videos for all users in background
7. **Video Templates:** Multiple styles (minimalist, animated, etc.)
8. **Subtitles:** Add captions for accessibility

### Scaling Considerations
- **Queue System:** Bull/BullMQ for job processing
- **Worker Separation:** Dedicated render workers
- **CDN:** CloudFlare for video delivery
- **Cost Optimization:** Compress videos further, limit renders per user

## Testing

### Manual Testing Checklist
- [ ] Stats API returns correct data
- [ ] Seasonal restriction works (Dec/Jan only)
- [ ] Video generation completes successfully
- [ ] Progress updates correctly during render
- [ ] Cached video returned on subsequent requests
- [ ] Download button works
- [ ] Share button works (native share or clipboard)
- [ ] Error states display correctly
- [ ] Dialog can be closed/reopened
- [ ] Multiple years can be selected

### E2E Test Ideas
```typescript
// tests/e2e/year-in-review.spec.ts
test("should generate year in review video", async ({ page }) => {
  // Mock seasonal availability
  // Login as test user
  // Click year in review button
  // Wait for video to render
  // Verify video player appears
  // Test download button
  // Test share button
});
```

## Resources

- [Remotion Documentation](https://remotion.dev)
- [Supabase Storage Guide](https://supabase.com/docs/guides/storage)
- [Motion.dev (animations)](https://motion.dev)
- [Brand Assets](../public/logo.svg)
