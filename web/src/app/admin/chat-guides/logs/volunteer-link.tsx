"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export function VolunteerLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="font-medium hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </Link>
  );
}
