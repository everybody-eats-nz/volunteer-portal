"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Mail, UserPlus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface InviteUserDialogProps {
  children: React.ReactNode;
}

export function InviteUserDialog({ children }: InviteUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<"VOLUNTEER" | "ADMIN">("VOLUNTEER");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error("Email is required");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to invite user");
      }

      toast.success("User invited successfully!");
      setOpen(false);
      setEmail("");
      setFirstName("");
      setLastName("");
      setRole("VOLUNTEER");

      // Refresh the page to show the new user
      router.refresh();
    } catch (error) {
      console.error("Error inviting user:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to invite user"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogTrigger asChild>{children}</ResponsiveDialogTrigger>
      <ResponsiveDialogContent className="sm:max-w-[480px]" data-testid="invite-user-dialog">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2" data-testid="invite-user-dialog-title">
            <UserPlus className="h-5 w-5" />
            Invite New User
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Send an invitation email to a new volunteer or administrator.
            They&apos;ll receive an email with instructions to set up their
            account.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6" data-testid="invite-user-form">
          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Email Address *
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email address"
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                required
                data-testid="invite-email-input"
              />
            </div>
          </div>

          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-sm font-medium">
                First Name
              </Label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                data-testid="invite-first-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-sm font-medium">
                Last Name
              </Label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                data-testid="invite-last-name-input"
              />
            </div>
          </div>

          {/* Role Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Role *</Label>
            <RadioGroup
              value={role}
              onValueChange={(value: string) =>
                setRole(value as "VOLUNTEER" | "ADMIN")
              }
              className="space-y-3"
              data-testid="invite-role-selection"
            >
              <div className="flex items-center space-x-3 p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="VOLUNTEER" id="volunteer" data-testid="invite-role-volunteer" />
                <div className="flex-1">
                  <Label
                    htmlFor="volunteer"
                    className="font-medium cursor-pointer"
                  >
                    Volunteer
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Can sign up for shifts and manage their own profile
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="ADMIN" id="admin" data-testid="invite-role-admin" />
                <div className="flex-1">
                  <Label htmlFor="admin" className="font-medium cursor-pointer">
                    Administrator
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Full access to manage users, shifts, and system settings
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
              data-testid="invite-cancel-button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="btn-primary gap-2"
              data-testid="invite-submit-button"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending Invitation...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  Send Invitation
                </>
              )}
            </Button>
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
