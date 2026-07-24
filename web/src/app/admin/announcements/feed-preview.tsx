"use client";

import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface FeedPreviewProps {
  title: string;
  body: string;
  imageUrl: string | null;
  authorName: string;
  className?: string;
}

/**
 * Live replica of the announcement card volunteers see in the mobile feed,
 * framed in a phone silhouette. Mirrors the real rendering in
 * mobile/app/(tabs)/index.tsx: yellow icon tile with the 📢 emoji (the app's
 * actual glyph, not admin chrome), title, markdown body, author + timestamp.
 */
export function FeedPreview({
  title,
  body,
  imageUrl,
  authorName,
  className,
}: FeedPreviewProps) {
  const empty = !title.trim() && !body.trim() && !imageUrl;

  return (
    <div className={cn("select-none", className)} aria-hidden="true">
      {/* Phone silhouette */}
      <div className="relative mx-auto w-full max-w-[300px] rounded-[2.25rem] border border-forest-500/20 dark:border-white/10 bg-[#101410] p-[7px] shadow-[0_24px_48px_-24px_rgb(29_83_55/0.45)]">
        {/* Screen */}
        <div className="overflow-hidden rounded-[1.85rem] bg-cream-50 dark:bg-[#0f1114]">
          {/* Status bar */}
          <div className="flex items-center justify-between px-6 pt-2.5 pb-1 text-[10px] font-semibold text-[#14181c] dark:text-cream-50">
            <span>9:41</span>
            <span className="h-[18px] w-[72px] rounded-full bg-[#101410] dark:bg-black" />
            <span className="flex items-center gap-1">
              <svg viewBox="0 0 16 12" className="h-2.5 w-3.5 fill-current">
                <rect x="0" y="7" width="3" height="5" rx="0.75" />
                <rect x="4.5" y="4.5" width="3" height="7.5" rx="0.75" />
                <rect x="9" y="2" width="3" height="10" rx="0.75" />
                <rect x="13" y="0" width="3" height="12" rx="0.75" opacity="0.35" />
              </svg>
              <svg viewBox="0 0 25 12" className="h-3 w-6">
                <rect x="0.5" y="0.5" width="21" height="11" rx="3" className="fill-none stroke-current" strokeOpacity="0.4" />
                <rect x="2" y="2" width="14" height="8" rx="1.5" className="fill-current" />
                <path d="M23 4v4c1.1-.3 1.1-3.7 0-4z" className="fill-current" fillOpacity="0.4" />
              </svg>
            </span>
          </div>

          {/* Feed screen header, as in the app's home tab */}
          <div className="px-4 pt-2 pb-2.5">
            <p className="font-accent text-[15px] font-semibold leading-tight text-forest-500 dark:text-[#86d99b]">
              Kia ora 👋
            </p>
            <p className="text-[10px] text-[#14181c]/50 dark:text-cream-50/50">
              What&apos;s happening at Everybody Eats
            </p>
          </div>

          {/* The announcement card */}
          <div className="mx-3 overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-[#16181d]">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt=""
                className="h-[110px] w-full object-cover"
              />
            ) : null}
            <div className="flex gap-2.5 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fef9c3] text-[15px] dark:bg-[#fef9c3]/15">
                📢
              </div>
              <div className="min-w-0 flex-1">
                {empty ? (
                  <>
                    <div className="mb-1.5 h-3 w-3/4 rounded bg-[#14181c]/10 dark:bg-white/10" />
                    <div className="mb-1 h-2 w-full rounded bg-[#14181c]/[0.06] dark:bg-white/[0.06]" />
                    <div className="h-2 w-2/3 rounded bg-[#14181c]/[0.06] dark:bg-white/[0.06]" />
                  </>
                ) : (
                  <>
                    <p className="break-words text-[13px] font-bold leading-snug text-[#14181c] dark:text-cream-50">
                      {title.trim() || "Untitled announcement"}
                    </p>
                    {body.trim() ? (
                      <div className="preview-markdown mt-0.5 break-words text-[11.5px] leading-[1.45] text-[#14181c]/65 dark:text-cream-50/65">
                        <ReactMarkdown>{body}</ReactMarkdown>
                      </div>
                    ) : null}
                  </>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-[10px] text-[#14181c]/45 dark:text-cream-50/45">
                      {authorName}
                    </p>
                    <p className="text-[10px] text-[#14181c]/45 dark:text-cream-50/45">
                      just now
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Ghost of the next feed card, for context */}
          <div className="mx-3 mt-2.5 flex gap-2.5 rounded-t-2xl bg-white/60 p-3 pb-4 dark:bg-white/[0.04]">
            <div className="h-9 w-9 shrink-0 rounded-xl bg-[#fce7f3] opacity-60 dark:bg-[#fce7f3]/10" />
            <div className="flex-1 pt-1 opacity-60">
              <div className="mb-1.5 h-2.5 w-1/2 rounded bg-[#14181c]/10 dark:bg-white/10" />
              <div className="h-2 w-5/6 rounded bg-[#14181c]/[0.06] dark:bg-white/[0.06]" />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
