"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Calendar, Mail } from "lucide-react";
import { format } from "date-fns";
import { AdminEditableField } from "@/components/admin-editable-field";

interface AdminContactInfoSectionProps {
  volunteerId: string;
  email: string;
  phone: string | null;
  dateOfBirth: Date | null;
}

export function AdminContactInfoSection({
  volunteerId,
  email: initialEmail,
  phone,
  dateOfBirth: initialDateOfBirth,
}: AdminContactInfoSectionProps) {
  const [email, setEmail] = useState(initialEmail);
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(
    initialDateOfBirth
  );

  return (
    <Card data-testid="contact-information-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary dark:text-primary" />
          Contact Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Email Address
            </label>
            <AdminEditableField
              userId={volunteerId}
              fieldName="email"
              currentValue={email}
              displayValue={email}
              onUpdate={setEmail}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Click the edit button to update the email address
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              Phone
            </label>
            <div className="flex items-center gap-3 p-3 bg-muted/50 dark:bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground">
                {phone || "Not provided"}
              </p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Date of Birth
            </label>
            <AdminEditableField
              userId={volunteerId}
              fieldName="dateOfBirth"
              currentValue={
                dateOfBirth ? format(dateOfBirth, "yyyy-MM-dd") : null
              }
              displayValue={
                dateOfBirth ? format(dateOfBirth, "dd MMM yyyy") : "Not provided"
              }
              onUpdate={(newValue) => setDateOfBirth(new Date(newValue))}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Click the edit button to update the date of birth
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
