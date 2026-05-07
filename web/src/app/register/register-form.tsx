"use client";

import dynamic from "next/dynamic";

const RegisterClient = dynamic(() => import("./register-client"), {
  ssr: false,
  loading: () => <div>Loading registration form...</div>,
});

interface RegisterFormProps {
  locationOptions: Array<{ value: string; label: string }>;
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
