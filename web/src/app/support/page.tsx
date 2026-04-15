import type { Metadata } from "next";
import Link from "next/link";
import {
  Mail,
  MessageCircle,
  Flag,
  Shield,
  HelpCircle,
  ExternalLink,
  Clock,
  AlertTriangle,
} from "lucide-react";

import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Support",
  description:
    "Get help with your Everybody Eats volunteer account. Find answers to common questions, report issues, or contact our support team.",
  path: "/support",
});

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1"
          >
            ← Back to portal
          </Link>
          <h1 className="text-3xl font-bold font-[Fraunces] mt-2">
            Support & Help
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            We&apos;re here to help. Find answers below or reach out to our team.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        {/* Contact */}
        <section>
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Contact Us
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <h3 className="font-medium">Email Support</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                For account help, shift questions, and general enquiries.
              </p>
              <a
                href="mailto:hello@everybodyeats.nz"
                className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
              >
                hello@everybodyeats.nz
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <h3 className="font-medium">Response Times</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                We aim to respond to all support enquiries within 24 hours
                during business days (Monday–Friday, NZ time).
              </p>
            </div>
          </div>
        </section>

        {/* Report Harmful Content */}
        <section>
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-500" />
            Reporting & Safety
          </h2>
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              The Everybody Eats Volunteer Portal is a community space. We take
              reports of harmful, offensive, or inappropriate content seriously.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-md bg-muted/50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Flag className="h-4 w-4 text-orange-500" />
                  <h3 className="text-sm font-medium">Report in the App</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use the &ldquo;⋯&rdquo; menu on any post or comment, or the Report button
                  on a user&apos;s profile, to flag harmful content directly from the
                  mobile app.
                </p>
              </div>

              <div className="rounded-md bg-muted/50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="h-4 w-4 text-orange-500" />
                  <h3 className="text-sm font-medium">Report by Email</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  If you can&apos;t report through the app, email us at{" "}
                  <a
                    href="mailto:hello@everybodyeats.nz"
                    className="text-primary hover:underline"
                  >
                    hello@everybodyeats.nz
                  </a>{" "}
                  with details of the issue.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-md border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800 p-4">
              <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
              <p className="text-xs text-orange-800 dark:text-orange-200">
                <strong>24-hour commitment:</strong> We review all content
                reports and take action within 24 hours in accordance with Apple
                App Store Guideline 1.2.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section>
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            Common Questions
          </h2>
          <div className="space-y-4">
            {[
              {
                q: "How do I sign up for a shift?",
                a: "Log in to the volunteer portal, go to Shifts, and select the date and shift type you'd like. Click Sign Up and you'll be added to the roster.",
              },
              {
                q: "I can't log in to my account.",
                a: "Try resetting your password via the Forgot Password link on the sign-in page. If you still can't access your account, email us and we'll help you recover it.",
              },
              {
                q: "How do I cancel a shift I signed up for?",
                a: "Open the shift in the portal or mobile app and select Cancel Sign-Up. Please cancel as early as possible so we can find a replacement volunteer.",
              },
              {
                q: "How do I block another user?",
                a: "On the mobile app, visit the user's profile and scroll to the bottom. Tap Block User. Blocked users cannot see your activity and you won't see theirs.",
              },
              {
                q: "I received a notification I didn't expect.",
                a: "Shift shortage notifications are sent when a shift is under-staffed. You can manage notification preferences in your Profile settings.",
              },
              {
                q: "How do I delete my account?",
                a: "Email hello@everybodyeats.nz with a request to delete your account. We'll process your request within 5 business days.",
              },
            ].map(({ q, a }) => (
              <details
                key={q}
                className="group rounded-lg border bg-card px-5 py-4 cursor-pointer"
              >
                <summary className="flex items-center justify-between gap-4 text-sm font-medium list-none">
                  {q}
                  <span className="text-muted-foreground group-open:rotate-180 transition-transform shrink-0">
                    ▾
                  </span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Feedback */}
        <section className="rounded-lg border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <MessageCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold mb-1">Give Us Feedback</h2>
              <p className="text-sm text-muted-foreground mb-3">
                Have a suggestion or noticed a bug? We&apos;d love to hear from you.
                Your feedback helps us improve the portal for all volunteers.
              </p>
              <a
                href="mailto:hello@everybodyeats.nz?subject=Volunteer Portal Feedback"
                className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
              >
                Send feedback
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </section>

        <p className="text-xs text-muted-foreground text-center pb-6">
          Everybody Eats · Auckland, New Zealand ·{" "}
          <a
            href="https://everybodyeats.nz"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            everybodyeats.nz
          </a>
        </p>
      </div>
    </div>
  );
}
