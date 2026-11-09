"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  Search,
} from "lucide-react";

import {
  EMAIL_CATALOG,
  EMAIL_GROUPS,
  emailsInGroup,
  type EmailCatalogEntry,
  type EmailGroupId,
} from "@/lib/email-catalog";
import type { EmailTemplateStatus } from "@/lib/email-catalog.server";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/admin/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CopyButton } from "./copy-button";
import { TemplatePreviewDialog } from "./template-preview-dialog";

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * One grid for every row and the column headings, so the columns line up
 * down the whole page: email, who it goes to, status, link to the template.
 */
const ROW_GRID =
  "grid items-center gap-x-4 gap-y-1 grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_11rem_11rem]";

const linkClass =
  "inline-flex min-h-9 items-center gap-1.5 font-medium text-primary-text underline-offset-4 hover:underline";

type GroupFilter = EmailGroupId | "all";

/** Does this email mention the search text anywhere an admin would look? */
function matchesQuery(email: EmailCatalogEntry, query: string) {
  const haystack = [
    email.name,
    email.trigger,
    email.recipient,
    ...email.variables.map((variable) => variable.name),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export function EmailCatalogList({
  statuses,
}: {
  statuses: EmailTemplateStatus[];
}) {
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");

  const statusByKey = new Map<string, EmailTemplateStatus>(
    statuses.map((status) => [status.key, status])
  );
  const needle = query.trim().toLowerCase();
  const visibleGroups = EMAIL_GROUPS.filter(
    (group) => groupFilter === "all" || group.id === groupFilter
  )
    .map((group) => ({
      group,
      emails: emailsInGroup(group.id).filter(
        (email) => !needle || matchesQuery(email, needle)
      ),
    }))
    .filter(({ emails }) => emails.length > 0);

  const filters: { id: GroupFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: EMAIL_CATALOG.length },
    ...EMAIL_GROUPS.map((group) => ({
      id: group.id,
      label: group.title,
      count: emailsInGroup(group.id).length,
    })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search emails or variables"
            aria-label="Search emails or variables"
            className="pl-9"
            data-testid="emails-search-input"
          />
        </div>
        <div className="scrollbar-hide -mx-1 overflow-x-auto px-1">
          <div
            role="group"
            aria-label="Show emails about"
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1"
          >
            {filters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setGroupFilter(filter.id)}
                aria-pressed={groupFilter === filter.id}
                className={cn(
                  "cursor-pointer rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  groupFilter === filter.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                data-testid={`emails-filter-${filter.id}`}
              >
                {filter.label}{" "}
                <span className="tabular-nums opacity-70">{filter.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {visibleGroups.length === 0 ? (
        <div
          className="rounded-xl border border-dashed bg-card/50"
          data-testid="emails-empty"
        >
          <EmptyState
            icon={Search}
            title={`No emails match "${query.trim()}"`}
            action={
              <Button
                variant="link"
                onClick={() => {
                  setQuery("");
                  setGroupFilter("all");
                }}
              >
                Clear search
              </Button>
            }
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div
            aria-hidden
            className={`${ROW_GRID} hidden border-b bg-muted/40 py-2 pr-4 pl-10 text-xs font-medium text-muted-foreground md:grid`}
          >
            <span>Email and when it is sent</span>
            <span>Goes to</span>
            <span className="justify-self-end">Template</span>
          </div>

          {visibleGroups.map(({ group, emails }) => (
            <section
              key={group.id}
              aria-labelledby={`emails-group-${group.id}`}
              data-testid={`emails-group-${group.id}`}
              className="border-t first:border-t-0 md:first:border-t"
            >
              <div className="flex flex-wrap items-baseline gap-x-2.5 border-b bg-muted/20 px-4 py-2">
                <h2
                  id={`emails-group-${group.id}`}
                  className="text-sm font-semibold text-foreground"
                >
                  {group.title}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {group.description}
                </p>
              </div>
              <ul className="divide-y">
                {emails.map((email) => (
                  <EmailRow
                    key={email.key}
                    email={email}
                    status={statusByKey.get(email.key)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        The wording and design of each email live in Campaign Monitor. The
        portal decides when to send it and fills in the variables.
      </p>
    </div>
  );
}

/** Only speaks up when a template needs attention; a healthy one shows nothing. */
function TemplateProblem({
  status,
}: {
  status: EmailTemplateStatus | undefined;
}) {
  if (!status?.configured) {
    return (
      <Badge variant="warning" data-testid="email-not-set-up">
        <AlertTriangle aria-hidden />
        Not set up
      </Badge>
    );
  }
  if (status.lookupProblem === "not-found") {
    return (
      <Badge variant="warning" data-testid="email-problem">
        <AlertTriangle aria-hidden />
        Template not found
      </Badge>
    );
  }
  if (status.template?.status && status.template.status !== "Active") {
    return (
      <Badge variant="warning" data-testid="email-problem">
        <AlertTriangle aria-hidden />
        {status.template.status}
      </Badge>
    );
  }
  return null;
}

function EmailRow({
  email,
  status,
}: {
  email: EmailCatalogEntry;
  status: EmailTemplateStatus | undefined;
}) {
  return (
    <Collapsible asChild>
      <li
        id={email.key}
        data-testid={`email-row-${email.key}`}
        data-configured={status?.configured ? "true" : "false"}
        className="scroll-mt-24 data-[state=open]:bg-muted/20"
      >
        <div className={`${ROW_GRID} pr-4`}>
          <CollapsibleTrigger
            className="group flex min-h-14 cursor-pointer items-start gap-2 py-2.5 pl-4 text-left outline-none hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset md:rounded-none"
            data-testid="email-toggle"
          >
            <ChevronRight
              className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90 motion-reduce:transition-none"
              aria-hidden
            />
            <span className="min-w-0">
              <span
                className="block text-sm font-semibold text-foreground"
                data-testid="email-name"
              >
                {email.name}
              </span>
              <span
                className="block text-sm text-muted-foreground"
                data-testid="email-trigger"
              >
                {email.trigger}
              </span>
            </span>
          </CollapsibleTrigger>

          <p
            className="hidden text-sm text-foreground/80 md:block"
            data-testid="email-recipient"
          >
            {email.recipient}
          </p>

          <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
            <TemplateProblem status={status} />
            {status?.template?.previewUrl && (
              <TemplatePreviewDialog
                emailName={email.name}
                templateName={status.template.name}
                subject={status.template.subject}
                previewUrl={status.template.previewUrl}
              />
            )}
            {status?.campaignMonitorUrl && (
              <a
                href={status.campaignMonitorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${linkClass} text-sm`}
                data-testid="email-template-open"
                aria-label={`Open ${email.name} in Campaign Monitor (opens in a new tab)`}
              >
                Open
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            )}
          </span>
        </div>

        <CollapsibleContent>
          <EmailDetails email={email} status={status} />
        </CollapsibleContent>
      </li>
    </Collapsible>
  );
}

/** What opens under a row: the template behind it and the variables it gets. */
function EmailDetails({
  email,
  status,
}: {
  email: EmailCatalogEntry;
  status: EmailTemplateStatus | undefined;
}) {
  const fallback = email.fallbackKey
    ? EMAIL_CATALOG.find((other) => other.key === email.fallbackKey)
    : undefined;
  const template = status?.template;

  return (
    <div
      className="grid gap-x-8 gap-y-4 pt-1 pr-4 pb-4 pl-10 text-sm lg:grid-cols-[minmax(0,1fr)_22rem]"
      data-testid="email-details"
    >
      <div className="min-w-0 space-y-2">
        <p className="md:hidden">
          <span className="text-muted-foreground">Goes to:</span>{" "}
          {email.recipient}
        </p>
        {email.note && <p className="text-muted-foreground">{email.note}</p>}
        <div>
          <p className="font-medium text-foreground">
            {plural(email.variables.length, "variable", "variables")} the
            template can use
          </p>
          <dl
            className="mt-1 grid gap-x-6 sm:grid-cols-2"
            data-testid="email-variables"
          >
            {email.variables.map((variable) => (
              <div
                key={variable.name}
                className="flex min-w-0 items-start gap-0.5 py-0.5"
              >
                <CopyButton
                  value={variable.name}
                  label={`the variable ${variable.name}`}
                />
                <div className="min-w-0 pt-1">
                  <dt className="font-mono text-[13px] font-medium break-all text-foreground">
                    {variable.name}
                  </dt>
                  <dd className="text-muted-foreground">
                    {variable.description}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div
        className="min-w-0 space-y-2 lg:border-l lg:pl-6"
        data-testid="email-template"
      >
        {!status?.configured || !status.templateId ? (
          <>
            <p className="font-medium text-foreground">No template linked</p>
            <p
              className="text-muted-foreground"
              data-testid="email-if-not-set-up"
            >
              {email.ifNotSetUp}
            </p>
            {fallback && (
              <p className="text-muted-foreground">
                See{" "}
                <a
                  href={`#${fallback.key}`}
                  className="font-medium text-primary-text underline-offset-4 hover:underline"
                >
                  {fallback.name}
                </a>
                .
              </p>
            )}
          </>
        ) : (
          <>
            {template ? (
              <div className="space-y-0.5">
                <p className="text-muted-foreground">
                  Template in Campaign Monitor
                </p>
                <p
                  className="font-medium break-words text-foreground"
                  data-testid="email-template-name"
                >
                  {template.name}
                </p>
                {template.subject && (
                  <p className="break-words text-muted-foreground">
                    Subject: {template.subject}
                  </p>
                )}
                {template.status && template.status !== "Active" && (
                  <p className="text-muted-foreground">
                    Marked {template.status} in Campaign Monitor.
                  </p>
                )}
              </div>
            ) : status.lookupProblem === "not-found" ? (
              <p className="text-muted-foreground">
                Campaign Monitor has no template with this ID. Check the ID
                below against the template there.
              </p>
            ) : status.lookupProblem === "unavailable" ? (
              <p className="text-muted-foreground">
                Campaign Monitor could not be reached just now, so the
                template&apos;s name and preview are missing. Try again
                shortly.
              </p>
            ) : null}

            <div>
              <p className="text-muted-foreground">Template ID</p>
              <div className="flex items-center gap-1">
                <code
                  className="min-w-0 font-mono text-[13px] break-all text-foreground"
                  data-testid="email-template-id"
                >
                  {status.templateId}
                </code>
                <CopyButton
                  value={status.templateId}
                  label={`the template ID for ${email.name}`}
                  testId="email-template-id-copy"
                />
              </div>
            </div>

          </>
        )}
      </div>
    </div>
  );
}
