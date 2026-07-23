import type { Metadata } from "next";
import { getBaseUrl } from "@/lib/utils";

// SEO Configuration
export const SEO_CONFIG = {
  siteName: "Everybody Eats Volunteer Portal",
  defaultTitle: "Volunteer Portal - Everybody Eats",
  defaultDescription:
    "Join Everybody Eats as a volunteer and help transform rescued food into quality meals on a pay-what-you-can basis. Make a difference in fighting food waste and food insecurity across New Zealand.",
  locale: "en_NZ",
  ogImage: "/og-image.png",
} as const;

// Metadata Builder Options
interface MetadataOptions {
  title: string;
  description: string;
  path: string;
  ogImage?: string;
  noIndex?: boolean;
  /**
   * When true, omit `openGraph.images` so Next.js's file-based
   * `opengraph-image.tsx` convention takes over for this route.
   */
  useFileBasedOgImage?: boolean;
}

// Build complete page metadata
export function buildPageMetadata(options: MetadataOptions): Metadata {
  const {
    title,
    description,
    path,
    ogImage,
    noIndex = false,
    useFileBasedOgImage = false,
  } = options;
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${path}`;
  const image = ogImage || SEO_CONFIG.ogImage;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: SEO_CONFIG.siteName,
      locale: SEO_CONFIG.locale,
      type: "website",
      ...(useFileBasedOgImage
        ? {}
        : {
            images: [
              {
                url: image,
                width: 1200,
                height: 630,
                alt: title,
              },
            ],
          }),
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
        }
      : {
          index: true,
          follow: true,
        },
  };
}

// Generate canonical URL
export function buildCanonicalUrl(path: string): string {
  const baseUrl = getBaseUrl();
  return `${baseUrl}${path}`;
}

// Organization Schema (schema.org)
export function buildOrganizationSchema() {
  const baseUrl = getBaseUrl();

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Everybody Eats",
    url: "https://everybodyeats.nz",
    logo: `${baseUrl}/logo.svg`,
    description:
      "Everybody Eats is an innovative charitable restaurant transforming rescued food into quality 3-course meals on a pay-what-you-can basis.",
    sameAs: [
      "https://www.facebook.com/EverybodyEatsNZ",
      "https://www.instagram.com/everybodyeatsnz",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "Volunteer Coordination",
      url: `${baseUrl}/register`,
    },
  };
}

// LocalBusiness + Breadcrumb + FAQ schema for a per-city volunteer page.
// Helps Google understand we're a real org with physical restaurants in this
// city, and powers FAQ rich results for "volunteering <city>" queries.
interface VolunteerLocationSchemaData {
  city: string;
  slug: string;
  intro: string;
  venues: { name: string; address: string }[];
  faqs: { question: string; answer: string }[];
}

export function buildVolunteerLocationSchema(data: VolunteerLocationSchemaData) {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/volunteer/${data.slug}`;

  const organizations = data.venues.map((venue) => ({
    "@context": "https://schema.org",
    "@type": ["NGO", "FoodEstablishment"],
    name: `Everybody Eats ${venue.name}`,
    description: data.intro,
    url,
    parentOrganization: {
      "@type": "NGO",
      name: "Everybody Eats",
      url: "https://everybodyeats.nz",
    },
    address: {
      "@type": "PostalAddress",
      streetAddress: venue.address,
      addressRegion: data.city,
      addressCountry: "NZ",
    },
    potentialAction: {
      "@type": "JoinAction",
      name: `Volunteer in ${data.city}`,
      target: `${baseUrl}/register`,
    },
  }));

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Volunteer", item: `${baseUrl}/volunteer` },
      { "@type": "ListItem", position: 2, name: data.city, item: url },
    ],
  };

  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: data.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  return [...organizations, breadcrumb, faqPage];
}

// Shift Event Schema Data
interface ShiftEventData {
  id: string;
  name: string;
  description: string | null;
  startDate: Date;
  endDate: Date;
  location: string | null;
  // Street address for `location`, resolved fresh by the caller (via
  // `getLocationAddresses()`) so newly created locations resolve immediately.
  locationAddress?: string;
  capacity: number;
  spotsAvailable: number;
}

// Event Schema for Shift (schema.org)
export function buildShiftEventSchema(shift: ShiftEventData) {
  const baseUrl = getBaseUrl();

  const locationAddress = shift.location ? shift.locationAddress : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: `${shift.name}${shift.location ? ` - ${shift.location}` : ""}`,
    description:
      shift.description ||
      `Volunteer opportunity for ${shift.name} at Everybody Eats`,
    startDate: shift.startDate.toISOString(),
    endDate: shift.endDate.toISOString(),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    ...(locationAddress && {
      location: {
        "@type": "Place",
        name: `Everybody Eats ${shift.location}`,
        address: {
          "@type": "PostalAddress",
          addressCountry: "NZ",
          streetAddress: locationAddress,
        },
      },
    }),
    organizer: {
      "@type": "Organization",
      name: "Everybody Eats",
      url: "https://everybodyeats.nz",
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "NZD",
      availability:
        shift.spotsAvailable > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/SoldOut",
      url: `${baseUrl}/shifts`,
      validFrom: new Date().toISOString(),
    },
    maximumAttendeeCapacity: shift.capacity,
    remainingAttendeeCapacity: shift.spotsAvailable,
  };
}
