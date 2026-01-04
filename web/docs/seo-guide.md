# SEO Guide - Everybody Eats Volunteer Portal

This guide covers the SEO implementation, best practices, and maintenance procedures for the Everybody Eats Volunteer Portal.

## Table of Contents

1. [Overview](#overview)
2. [Implementation Guide](#implementation-guide)
3. [Metadata Best Practices](#metadata-best-practices)
4. [Sitemap & Robots](#sitemap--robots)
5. [Structured Data](#structured-data)
6. [Google Search Console Setup](#google-search-console-setup)
7. [Testing & Validation](#testing--validation)
8. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Overview

### SEO Strategy

The volunteer portal implements a comprehensive SEO strategy to improve discoverability and drive volunteer recruitment through organic search.

**Key Goals:**

- Rank for volunteer-related searches in New Zealand
- Drive qualified volunteer registrations
- Build authority for Everybody Eats brand
- Ensure all public pages are properly indexed

**Target Keywords:**

- "volunteer New Zealand"
- "Everybody Eats volunteer"
- "food rescue volunteer [city]"
- "charitable restaurant volunteer"
- "volunteer opportunities [location]"

### Indexing Policy

**Public Pages (Indexable):**

- `/` - Homepage
- `/login` - Sign in
- `/register` - Registration
- `/shifts` - Shift browsing (all locations)

**Private Pages (Non-Indexable):**

- `/dashboard`, `/profile`, `/achievements`, `/friends`, `/resources` - Authenticated pages
- `/admin/*` - All admin pages
- `/api/*` - All API routes

---

## Implementation Guide

### Using SEO Utilities

All SEO functionality is centralized in `/web/src/lib/seo.ts`. Use these utilities when adding metadata to new pages.

#### Adding Metadata to a New Public Page

```typescript
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Page Title", // Unique, descriptive title (50-60 chars)
  description:
    "Page description that appears in search results. Should be compelling and include target keywords.", // 150-160 chars
  path: "/page-path", // Path from root
});
```

#### Adding Dynamic Metadata

For pages with dynamic content (e.g., location filtering):

```typescript
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}): Promise<Metadata> {
  const { slug } = await params;
  const query = await searchParams;

  // Fetch data or determine content
  const title = `Dynamic Title - ${slug}`;
  const description = `Dynamic description based on ${query.filter}`;

  return buildPageMetadata({
    title,
    description,
    path: `/page/${slug}`,
  });
}
```

#### Adding Structured Data (Schema.org)

**Organization Schema** (for homepage or about pages):

```typescript
import { buildOrganizationSchema } from "@/lib/seo";

export default function Page() {
  const schema = buildOrganizationSchema();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      {/* Page content */}
    </>
  );
}
```

**Event Schema** (for shifts or events):

```typescript
import { buildShiftEventSchema } from "@/lib/seo";

export default function Page() {
  const shifts = await fetchShifts();

  const schemas = shifts.slice(0, 20).map((shift) =>
    buildShiftEventSchema({
      id: shift.id,
      name: shift.name,
      description: shift.description,
      startDate: shift.start,
      endDate: shift.end,
      location: shift.location,
      capacity: shift.capacity,
      spotsAvailable: shift.spotsAvailable,
    })
  );

  return (
    <>
      {schemas.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      {/* Page content */}
    </>
  );
}
```

#### Marking Pages as Non-Indexable

For authenticated or private pages:

```typescript
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page Title",
  robots: {
    index: false,
    follow: false,
  },
};
```

---

## Metadata Best Practices

### Page Titles

**Format:** `Specific Page Title | Everybody Eats`

The template is configured in the root layout, so you only need to provide the unique part.

**Best Practices:**

- 50-60 characters optimal
- Include primary keyword
- Make it compelling and descriptive
- Front-load important keywords
- Avoid keyword stuffing

**Examples:**

- ✅ "Join as Volunteer | Everybody Eats"
- ✅ "Volunteer Shifts in Auckland | Everybody Eats"
- ❌ "Volunteer Volunteer Volunteer Auckland Wellington" (keyword stuffing)
- ❌ "Page 1 - Everybody Eats" (not descriptive)

### Meta Descriptions

**Best Practices:**

- 150-160 characters optimal
- Include target keywords naturally
- Write compelling copy that encourages clicks
- Include a call-to-action when appropriate
- Avoid duplicate descriptions across pages

**Examples:**

- ✅ "Register to become an Everybody Eats volunteer. Choose shifts that fit your schedule and help fight food waste while building community connections."
- ❌ "This is the register page for volunteers." (too short, not compelling)

### Open Graph Images

**Specifications:**

- Dimensions: 1200x630px (1.91:1 ratio)
- Format: JPG or PNG
- File size: < 100KB ideal
- Location: `/web/public/og-image.jpg`

**Content Guidelines:**

- Include Everybody Eats branding/logo
- Use high-contrast, readable text
- Avoid small text (won't be readable in previews)
- Test across platforms (Facebook, Twitter, LinkedIn)

---

## Sitemap & Robots

### Sitemap Generation

**File:** `/web/src/app/sitemap.ts`

The sitemap is automatically generated and served at `/sitemap.xml`. It includes:

- Static public pages (home, login, register, shifts)
- Dynamic location pages (pulled from database)

**How It Works:**

1. Next.js calls the `sitemap()` function at build time and on-demand
2. Function queries database for active locations
3. Returns array of URLs with metadata (priority, change frequency)
4. Next.js serves as XML at `/sitemap.xml`

**Adding New Static Pages:**

```typescript
// In /web/src/app/sitemap.ts
const staticPages: MetadataRoute.Sitemap = [
  // ... existing pages
  {
    url: `${baseUrl}/new-page`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  },
];
```

**Priority Guidelines:**

- 1.0 - Homepage only
- 0.9 - High priority pages (register, shifts)
- 0.8 - Important pages (login, location pages)
- 0.5 - Standard pages
- < 0.5 - Low priority or archived content

**Change Frequency Guidelines:**

- `always` - Live content (not recommended)
- `daily` - Shifts, events, dynamic content
- `weekly` - Homepage, regularly updated pages
- `monthly` - Static pages, login, register
- `yearly` - Legal pages, rarely updated content

### Robots.txt Configuration

**File:** `/web/src/app/robots.ts`

The robots.txt is automatically generated and served at `/robots.txt`.

**Current Configuration:**

- **Allow:** `/`, `/login`, `/register`, `/shifts`
- **Disallow:** All authenticated pages, admin pages, API routes

**Modifying Robots Rules:**

```typescript
// In /web/src/app/robots.ts
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          // Add new public paths here
        ],
        disallow: [
          // Add new private paths here
        ],
      },
    ],
    sitemap: `${getBaseUrl()}/sitemap.xml`,
  };
}
```

---

## Structured Data

### Organization Schema

**Location:** Homepage (`/web/src/app/page.tsx`)

**Purpose:** Helps Google understand Everybody Eats as an organization.

**Fields:**

- Name, URL, logo
- Description
- Social media profiles (Facebook, Instagram)
- Contact information

**Updating Social Media Links:**

```typescript
// In /web/src/lib/seo.ts
export function buildOrganizationSchema() {
  return {
    // ... other fields
    sameAs: [
      "https://www.facebook.com/EverybodyEatsNZ",
      "https://www.instagram.com/everybodyeatsnz",
    ],
  };
}
```

### Event Schema

**Location:** Shifts page (`/web/src/app/shifts/page.tsx`)

**Purpose:** Helps shifts appear in Google Events search and rich results.

**Fields:**

- Event name, description
- Start/end dates
- Location address
- Capacity and availability
- Organizer (Everybody Eats)

**When It Appears:**

- Only when shifts are displayed (not on location selection screen)
- Limited to first 20 shifts for performance

**Benefits:**

- Shifts may appear in Google Events
- Rich results with date/time/location
- Increased visibility in event searches

### Adding New Schema Types

**BreadcrumbList Example:**

```typescript
// In /web/src/lib/seo.ts
export function buildBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
```

---

## Google Search Console Setup

### Initial Setup

1. **Visit Google Search Console**

   - Go to: https://search.google.com/search-console

2. **Add Property**

   - Click "Add Property"
   - Select "URL prefix" method
   - Enter: `https://volunteers.everybodyeats.nz`

3. **Verify Ownership**

   - Choose "HTML tag" verification method
   - Copy the verification code
   - Add to `/web/src/app/layout.tsx`:
     ```typescript
     export const metadata: Metadata = {
       // ... other metadata
       verification: {
         google: "YOUR_VERIFICATION_CODE_HERE",
       },
     };
     ```
   - Deploy to production
   - Click "Verify" in Search Console

4. **Submit Sitemap**
   - Navigate to "Sitemaps" in left sidebar
   - Enter: `sitemap.xml`
   - Click "Submit"
   - Wait for Google to process (can take 24-48 hours)

### Key Metrics to Monitor

**Coverage Report:**

- Tracks indexed vs. non-indexed pages
- Identifies crawl errors
- Shows indexing status over time

**Performance Report:**

- Total clicks, impressions, CTR, average position
- Top queries driving traffic
- Top pages receiving clicks
- Country/device breakdowns

**Core Web Vitals:**

- Largest Contentful Paint (LCP): < 2.5s
- First Input Delay (FID): < 100ms
- Cumulative Layout Shift (CLS): < 0.1

**Mobile Usability:**

- Identifies mobile-specific issues
- Ensures responsive design compliance

### Common Issues & Solutions

**Issue: Pages not indexed**

- Check robots.txt isn't blocking
- Verify page is in sitemap
- Ensure page is linked internally
- Request indexing via URL Inspection tool

**Issue: Soft 404 errors**

- Ensure pages return correct HTTP status codes
- Verify content is substantial (not thin content)

**Issue: Structured data errors**

- Use Rich Results Test to debug
- Verify all required fields are present
- Check for type mismatches

---

## Testing & Validation

### Pre-Deployment Testing

**1. Local Development Testing:**

```bash
cd web
npm run dev

# Visit these URLs:
# http://localhost:3000/sitemap.xml
# http://localhost:3000/robots.txt
```

**2. Metadata Validation:**

- Visit each public page
- Right-click → "View Page Source"
- Search for `<head>` section
- Verify:
  - `<title>` tag present and unique
  - `<meta name="description">` present
  - `<meta property="og:*">` tags present
  - `<link rel="canonical">` points to correct URL

**3. Structured Data Validation:**

Use Google Rich Results Test:

- URL: https://search.google.com/test/rich-results
- Enter page URL or paste HTML
- Verify no errors in schema markup

Use Schema.org Validator:

- URL: https://validator.schema.org/
- Paste JSON-LD code
- Check for validation errors

### Post-Deployment Testing

**1. Production Verification:**

Visit production URLs:

- https://volunteers.everybodyeats.nz/sitemap.xml
- https://volunteers.everybodyeats.nz/robots.txt

Check metadata on live pages:

- View source and inspect `<head>` tags
- Verify canonical URLs use production domain

**2. Social Media Preview Testing:**

**Facebook Debugger:**

- URL: https://developers.facebook.com/tools/debug/
- Enter page URL
- Click "Scrape Again" to refresh
- Verify Open Graph image and description

**Twitter Card Validator:**

- URL: https://cards-dev.twitter.com/validator
- Enter page URL
- Verify card preview displays correctly

**LinkedIn Post Inspector:**

- URL: https://www.linkedin.com/post-inspector/
- Enter page URL
- Verify preview looks correct

**3. Search Console Submission:**

Within 24 hours of deployment:

- Submit sitemap in Google Search Console
- Request indexing for key pages via URL Inspection
- Monitor for crawl errors

### Validation Tools

**Metadata & SEO:**

- [Google Rich Results Test](https://search.google.com/test/rich-results)
- [Schema Markup Validator](https://validator.schema.org/)
- [Meta Tags Preview](https://metatags.io/)
- [SEO Checker](https://www.seobility.net/en/seocheck/)

**Social Sharing:**

- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)

**Performance:**

- [PageSpeed Insights](https://pagespeed.web.dev/)
- [GTmetrix](https://gtmetrix.com/)
- [WebPageTest](https://www.webpagetest.org/)

**Mobile:**

- [Google Mobile-Friendly Test](https://search.google.com/test/mobile-friendly)
- [Responsive Design Checker](https://responsivedesignchecker.com/)

---

## Monitoring & Maintenance

### Daily Tasks

No daily SEO tasks required. Automated systems handle:

- Sitemap updates (via Next.js)
- Metadata generation
- Structured data

### Weekly Tasks

**First Month After Launch:**

- Check Google Search Console for new errors
- Monitor indexing progress
- Review any manual actions or warnings
- Check for unexpected 404s

**After Stable:**

- Review Search Console once weekly
- Quick check for critical errors only

### Monthly Tasks

**Search Console Review:**

- Coverage report: Any new errors?
- Performance: Traffic trends (up/down)
- Core Web Vitals: Any degradation?
- Top queries: New opportunities?

**Content Audit:**

- Are meta descriptions still relevant?
- Do page titles reflect current content?
- Are there new pages that need indexing?

**Competitor Analysis:**

- What volunteer keywords are competitors ranking for?
- Any new content opportunities?

### Quarterly Tasks

**Comprehensive SEO Audit:**

- Review all public page metadata
- Check for broken internal links
- Verify structured data is valid
- Test mobile usability
- Review Core Web Vitals
- Analyze keyword rankings
- Identify new content opportunities

**Performance Review:**

- Compare traffic quarter-over-quarter
- Analyze conversion rates (registrations from organic)
- Review top landing pages
- Identify high-performing keywords
- Adjust strategy based on data

### Annual Tasks

**Strategic Review:**

- Full SEO strategy assessment
- Competitive landscape analysis
- Keyword research refresh
- Technical SEO audit
- Backlink profile review
- Content strategy planning

### Updating Content

**When to Update Metadata:**

- Major page content changes
- Shift in target keywords
- Low CTR on well-ranked pages
- Seasonal campaigns or events

**When to Update Structured Data:**

- New locations added
- Organization information changes
- New event types introduced

**When to Update Sitemap:**

- Already automated - no manual updates needed
- Sitemap regenerates on deployment
- New locations automatically included

---

## Troubleshooting

### Common Issues

**Q: Page isn't showing in Google search**
A:

1. Check it's in sitemap: `/sitemap.xml`
2. Verify not blocked in robots.txt
3. Request indexing via Search Console
4. Ensure page has substantive content
5. Wait 24-48 hours for indexing

**Q: Wrong page title showing in search results**
A:

1. Verify metadata is correct in source
2. Clear cache with `?` parameter in URL
3. Request re-indexing in Search Console
4. Google may rewrite titles - optimize for relevance

**Q: Open Graph image not displaying**
A:

1. Verify image is accessible: `/og-image.jpg`
2. Check image dimensions (1200x630px)
3. Clear social media cache:
   - Facebook: Use Debugger tool
   - Twitter: Use Card Validator
4. Wait 24 hours for cache refresh

**Q: Structured data errors in Search Console**
A:

1. Use Rich Results Test to identify issues
2. Check all required fields are present
3. Verify data types match schema.org spec
4. Test with Schema.org Validator

**Q: Core Web Vitals failing**
A:

1. Use PageSpeed Insights for detailed report
2. Check Vercel Speed Insights dashboard
3. Optimize images (already using next/image)
4. Review third-party scripts
5. Consider lazy loading below-fold content

---

## Additional Resources

**Documentation:**

- [Next.js Metadata API](https://nextjs.org/docs/app/building-your-application/optimizing/metadata)
- [Schema.org Documentation](https://schema.org/)
- [Google Search Central](https://developers.google.com/search)

**Tools:**

- [Google Search Console](https://search.google.com/search-console)
- [Vercel Speed Insights](https://vercel.com/analytics)
- [PostHog Analytics](https://posthog.com/) (already integrated)

**Learning:**

- [Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Moz Beginner's Guide to SEO](https://moz.com/beginners-guide-to-seo)

---

## Quick Reference

### File Locations

- **SEO Utilities:** `/web/src/lib/seo.ts`
- **Sitemap:** `/web/src/app/sitemap.ts`
- **Robots:** `/web/src/app/robots.ts`
- **Root Layout Metadata:** `/web/src/app/layout.tsx`
- **This Guide:** `/web/docs/seo-guide.md`

### Key Functions

```typescript
// Build page metadata
buildPageMetadata({ title, description, path });

// Build Organization schema
buildOrganizationSchema();

// Build Event schema for shifts
buildShiftEventSchema({
  id,
  name,
  description,
  startDate,
  endDate,
  location,
  capacity,
  spotsAvailable,
});

// Get canonical URL
buildCanonicalUrl("/path");
```

### Checklist for New Public Pages

- [ ] Add metadata export with `buildPageMetadata()`
- [ ] Ensure unique title and description
- [ ] Add to sitemap (if static page)
- [ ] Add to robots.txt `allow` list (if needed)
- [ ] Add structured data (if applicable)
- [ ] Test with Rich Results Test
- [ ] Verify Open Graph preview
- [ ] Request indexing in Search Console
- [ ] Monitor for indexing confirmation

---

**Last Updated:** December 2024
**Maintained By:** Development Team
