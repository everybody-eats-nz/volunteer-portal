"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * An odometer photo. The only reason to keep one is so the office can hold the
 * recorded number against the picture, so this always renders *something*
 * rather than a broken image: a missing photo is a fact the exceptions list
 * reports, not a rendering accident.
 *
 * Demo data stores the sentinel `seed:odo` instead of uploading a file. When it
 * sees that, this draws a dial showing the reading actually recorded against
 * the trip — so the "compare the number to the picture" workflow is
 * demonstrable without inventing photographs.
 */
export const SEED_PHOTO = "seed:odo";

export function OdoPhoto({
  url,
  reading,
  className,
  alt = "Odometer",
}: {
  url: string | null;
  reading: number | null;
  className?: string;
  alt?: string;
}) {
  if (url === SEED_PHOTO || (url === null && reading !== null)) {
    return (
      <DrawnDial reading={reading} className={className} label={alt} muted={!url} />
    );
  }

  if (!url) {
    return (
      <div
        className={cn(
          "grid place-items-center bg-muted text-[11px] font-medium text-muted-foreground",
          className
        )}
      >
        No photo
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <Image src={url} alt={alt} fill sizes="480px" className="object-cover" />
    </div>
  );
}

/** A dashboard drawn from the reading, for demo rows with no real photograph. */
function DrawnDial({
  reading,
  className,
  label,
  muted,
}: {
  reading: number | null;
  className?: string;
  label: string;
  muted?: boolean;
}) {
  const digits = String(Math.round(reading ?? 0)).padStart(6, "0").slice(-6);
  return (
    <svg
      viewBox="0 0 240 180"
      role="img"
      aria-label={`${label}: ${digits} kilometres`}
      className={cn("block", muted && "opacity-60", className)}
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="240" height="180" fill="#14181c" />
      <circle
        cx="120"
        cy="86"
        r="66"
        fill="none"
        stroke="#3a4148"
        strokeWidth="3"
      />
      <circle cx="120" cy="86" r="58" fill="#1b2126" />
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
        return (
          <line
            key={i}
            x1={120 + Math.cos(angle) * 48}
            y1={86 + Math.sin(angle) * 48}
            x2={120 + Math.cos(angle) * 55}
            y2={86 + Math.sin(angle) * 55}
            stroke="#57616a"
            strokeWidth="2"
          />
        );
      })}
      <rect x="70" y="98" width="100" height="26" rx="3" fill="#0c1013" />
      {digits.split("").map((digit, i) => (
        <g key={i}>
          <rect
            x={73 + i * 16}
            y={101}
            width="14"
            height="20"
            rx="1.5"
            fill={i < 5 ? "#e8eef2" : "#f8fb69"}
          />
          <text
            x={80 + i * 16}
            y={116}
            textAnchor="middle"
            fontSize="14"
            fontWeight="700"
            fontFamily="ui-monospace, SFMono-Regular, monospace"
            fill="#14181c"
          >
            {digit}
          </text>
        </g>
      ))}
      <text
        x="120"
        y="140"
        textAnchor="middle"
        fontSize="9"
        letterSpacing="1.5"
        fill="#8b959c"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        km
      </text>
    </svg>
  );
}
