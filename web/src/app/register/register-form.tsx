"use client";

import dynamic from "next/dynamic";
import type { LocationOption } from "@/lib/location-utils";
import { RegisterSkeleton } from "./register-skeleton";

const RegisterClient = dynamic(() => import("./register-client"), {
  ssr: false,
  loading: () => <RegisterSkeleton />,
});

interface RegisterFormProps {
  locationOptions: LocationOption[];
  shiftTypes: Array<{ id: string; name: string }>;
  newsletterLists: Array<{
    id: string;
    name: string;
    campaignMonitorId: string;
    description: string | null;
  }>;
}

export function RegisterForm({
  locationOptions,
  shiftTypes,
  newsletterLists,
}: RegisterFormProps) {
  return (
    <RegisterClient
      locationOptions={locationOptions}
      shiftTypes={shiftTypes}
      newsletterLists={newsletterLists}
    />
  );
}
