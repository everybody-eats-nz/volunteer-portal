"use client";

import Link from "next/link";
import { ResourceType, ResourceCategory } from "@/generated/client";
import {
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  ExternalLink,
  Video,
  Download,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/storage-utils";
import { Sparkle } from "@/components/sparkle";

interface Resource {
  id: string;
  title: string;
  description: string | null;
  type: ResourceType;
  category: ResourceCategory;
  tags: string[];
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  url: string | null;
  createdAt: Date;
  uploader: {
    firstName: string | null;
    lastName: string | null;
  };
}

interface ResourcesGridProps {
  resources: Resource[];
}

const TYPE_ICONS: Record<ResourceType, React.ReactNode> = {
  PDF: <FileText className="h-5 w-5" />,
  IMAGE: <ImageIcon className="h-5 w-5" />,
  DOCUMENT: <FileSpreadsheet className="h-5 w-5" />,
  LINK: <ExternalLink className="h-5 w-5" />,
  VIDEO: <Video className="h-5 w-5" />,
};

/* Type drives the chip accent — external resources (links, videos) get the
   sun accent, files sit on the forest fill. */
const TYPE_CHIP: Record<ResourceType, string> = {
  PDF: "bg-forest-500 text-cream-50 dark:bg-forest-600",
  IMAGE: "bg-forest-500 text-cream-50 dark:bg-forest-600",
  DOCUMENT: "bg-forest-500 text-cream-50 dark:bg-forest-600",
  LINK: "bg-sun-200 text-forest-700 dark:bg-sun-200/90",
  VIDEO: "bg-sun-200 text-forest-700 dark:bg-sun-200/90",
};

const CATEGORY_LABELS: Record<ResourceCategory, string> = {
  TRAINING: "Training",
  POLICIES: "Policies",
  FORMS: "Forms",
  GUIDES: "Guides",
  RECIPES: "Recipes",
  SAFETY: "Safety",
  GENERAL: "General",
};

/** Where a card leads: the external URL for links and videos, else the file. */
function resourceHref(resource: Resource) {
  return resource.type === "LINK" || resource.type === "VIDEO"
    ? resource.url
    : resource.fileUrl;
}

export function ResourcesGrid({ resources }: ResourcesGridProps) {

  if (resources.length === 0) {
    return (
      <div className="grain relative overflow-hidden rounded-[2.5rem] border border-dashed border-forest-500/20 bg-cream-100/70 px-8 py-16 text-center sm:py-20 dark:border-cream-50/15 dark:bg-forest-800/40">
        <div className="relative mx-auto flex max-w-md flex-col items-center">
          <div className="relative mb-6">
            <span className="grain flex h-16 w-16 items-center justify-center rounded-2xl bg-forest-500 text-cream-50 shadow-lg dark:bg-forest-600">
              <FileText className="h-8 w-8" />
            </span>
            <Sparkle className="absolute -right-3 -top-3 h-6 w-6 text-sun-300 drop-shadow" />
          </div>
          <h2 className="display text-3xl tracking-tight text-forest-700 sm:text-4xl dark:text-cream-50">
            No resources <em>found</em>
          </h2>
          <p className="mt-3 text-base leading-relaxed text-forest-700/75 dark:text-cream-50/70">
            Try adjusting your search or filters — or start fresh to browse the
            whole library.
          </p>
          <Link
            href="/resources"
            className="mt-8 inline-flex items-center justify-center rounded-full border border-forest-500/30 px-6 py-3 text-sm font-medium text-forest-700 transition-all duration-200 motion-safe:hover:-translate-y-0.5 hover:border-forest-700 hover:bg-forest-700 hover:text-cream-50 hover:shadow-lg motion-safe:active:translate-y-0 dark:border-cream-50/30 dark:text-cream-50 dark:hover:bg-cream-50 dark:hover:text-forest-700"
          >
            Show everything
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {resources.map((resource) => {
        const href = resourceHref(resource);
        const Card = href ? "a" : "div";
        return (
          <Card
            key={resource.id}
            {...(href
              ? { href, target: "_blank", rel: "noopener noreferrer" }
              : {})}
            className="group grain relative flex flex-col overflow-hidden rounded-3xl border border-forest-500/10 bg-cream-100 p-6 transition-all duration-300 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-7 motion-safe:hover:-translate-y-1 dark:border-cream-50/10 dark:bg-forest-800/60"
            data-testid="resource-card"
          >
            <div className="flex-1">
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl ${TYPE_CHIP[resource.type]}`}
                  aria-hidden
                >
                  {TYPE_ICONS[resource.type]}
                </span>
                <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-forest-500/85 dark:text-cream-50/55">
                  {CATEGORY_LABELS[resource.category]}
                </span>
              </div>

              <h3 className="display display-medium mt-5 line-clamp-2 text-xl leading-snug tracking-tight text-forest-700 sm:text-2xl dark:text-cream-50">
                {resource.title}
              </h3>
              {resource.description && (
                <p className="mt-2.5 line-clamp-3 text-sm leading-relaxed text-forest-700/75 dark:text-cream-50/70">
                  {resource.description}
                </p>
              )}

              {resource.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {resource.tags.slice(0, 3).map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="rounded-full border-0 bg-forest-500/10 px-2.5 py-0.5 text-[0.7rem] font-medium text-forest-600 dark:bg-cream-50/10 dark:text-cream-50/75"
                    >
                      {tag}
                    </Badge>
                  ))}
                  {resource.tags.length > 3 && (
                    <Badge
                      variant="secondary"
                      className="rounded-full border-0 bg-forest-500/10 px-2.5 py-0.5 text-[0.7rem] font-medium text-forest-600 dark:bg-cream-50/10 dark:text-cream-50/75"
                    >
                      +{resource.tags.length - 3}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between gap-3 border-t border-forest-500/10 pt-4 dark:border-cream-50/10">
              <span className="text-xs text-forest-700/70 dark:text-cream-50/55">
                {resource.fileSize
                  ? formatFileSize(resource.fileSize)
                  : resource.type === "LINK"
                  ? "External link"
                  : "Video"}
              </span>
              {/* The whole card is the link; this is its visual affordance. */}
              <span
                aria-hidden
                className={cn(
                  buttonVariants({ size: "sm", variant: "ghost" }),
                  "rounded-full border border-forest-500/25 px-4 text-forest-700 transition-all duration-200 group-hover:border-forest-500 group-hover:bg-forest-500 group-hover:text-cream-50 dark:border-cream-50/25 dark:text-cream-50 dark:group-hover:border-forest-500"
                )}
              >
                {resource.type === "LINK" || resource.type === "VIDEO" ? (
                  <>
                    <ExternalLink className="h-4 w-4" />
                    Open
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    View
                  </>
                )}
              </span>
              {href && <span className="sr-only">(opens in a new tab)</span>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
