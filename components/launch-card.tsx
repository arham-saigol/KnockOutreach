"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  ExternalLink,
  Globe2,
  Mail,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import type { Candidate } from "@/lib/types";
import { cn, formatDate, formatTime, initials } from "@/lib/utils";

export function LaunchCard({
  candidate,
  completed,
  onSend,
  onDismiss,
  onRegenerate,
  onRetryContact,
  onSaveDraft,
}: {
  candidate: Candidate;
  completed?: boolean;
  onSend: (candidate: Candidate) => Promise<void>;
  onDismiss: (candidate: Candidate) => Promise<void>;
  onRegenerate: (candidate: Candidate) => Promise<void>;
  onRetryContact: (candidate: Candidate) => Promise<void>;
  onSaveDraft: (
    candidate: Candidate,
    subject: string,
    body: string,
  ) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [subject, setSubject] = useState(candidate.subject);
  const [body, setBody] = useState(candidate.body);
  const [busy, setBusy] = useState<
    "send" | "dismiss" | "regenerate" | "contact" | null
  >(null);

  async function run(
    kind: NonNullable<typeof busy>,
    action: () => Promise<void>,
  ) {
    setBusy(kind);
    try {
      await action();
    } finally {
      setBusy(null);
    }
  }

  const status = candidate.status;
  const isProblem = status === "no_contact";

  return (
    <article
      className={cn(
        "group overflow-hidden rounded-2xl border border-line bg-panel shadow-card transition-colors",
        !completed && "hover:border-ink/20 dark:hover:border-white/20",
      )}
    >
      <button
        type="button"
        className="grid w-full grid-cols-[auto_1fr_auto] gap-3 p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:gap-4 sm:p-5"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls={`candidate-${candidate.id}`}
      >
        <ProductAvatar candidate={candidate} />
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
            <h2 className="text-[15px] font-bold tracking-[-0.015em] text-ink">
              {candidate.name}
            </h2>
            <span className="truncate text-sm text-muted">
              {candidate.tagline}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
            {candidate.companyContext}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            {candidate.recipientEmail ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                <Mail className="size-3.5 text-muted" />{" "}
                {candidate.recipientEmail}
                <span className="font-medium text-success">
                  {Math.round((candidate.emailConfidence ?? 0) * 100)}%
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-semibold text-warning">
                <CircleAlert className="size-3.5" /> Contact needed
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-muted">
              <Sparkles className="size-3.5 text-primary" />{" "}
              {candidate.matchReason}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 self-start">
          <QuickLink
            href={candidate.productHuntUrl}
            label="Open on Product Hunt"
          >
            <span className="text-[11px] font-black">P</span>
          </QuickLink>
          <QuickLink href={candidate.websiteUrl} label="Open website">
            <Globe2 className="size-3.5" />
          </QuickLink>
          <ChevronDown
            className={cn(
              "ml-1 size-4 text-muted transition-transform",
              expanded && "rotate-180",
            )}
          />
        </div>
      </button>

      <div className="border-t border-line bg-canvas/45 px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">
              {candidate.subject}
            </p>
            <p className="mt-1 line-clamp-1 text-xs text-muted">
              {candidate.body.replace(/\s+/g, " ")}
            </p>
          </div>
          {completed ? (
            <CompletedStatus candidate={candidate} />
          ) : (
            <div className="flex shrink-0 gap-2">
              {isProblem ? (
                <Button
                  size="sm"
                  variant="outline"
                  loading={busy === "contact"}
                  onClick={() =>
                    void run("contact", () => onRetryContact(candidate))
                  }
                >
                  <RefreshCw className="size-3.5" /> Retry contact
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                loading={busy === "dismiss"}
                onClick={() => void run("dismiss", () => onDismiss(candidate))}
              >
                <X className="size-3.5" /> Dismiss
              </Button>
              <Button
                size="sm"
                loading={busy === "send"}
                disabled={
                  !candidate.recipientEmail || status === "send_unknown"
                }
                onClick={() =>
                  void run("send", () =>
                    onSend({ ...candidate, subject, body }),
                  )
                }
              >
                <Send className="size-3.5" /> Send
              </Button>
            </div>
          )}
        </div>
      </div>

      {expanded ? (
        <div
          id={`candidate-${candidate.id}`}
          className="border-t border-line p-4 sm:p-5"
        >
          <div className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                Why it matched
              </p>
              <p className="mt-2 text-sm leading-6 text-ink">
                {candidate.matchReason}
              </p>
              {candidate.emailEvidenceUrl ? (
                <a
                  href={candidate.emailEvidenceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  Contact evidence <ExternalLink className="size-3" />
                </a>
              ) : null}
              {candidate.alternativeEmails.length ? (
                <div className="mt-5">
                  <p className="text-xs font-semibold text-muted">
                    Alternatives
                  </p>
                  <p className="mt-1 text-sm text-ink">
                    {candidate.alternativeEmails.join(", ")}
                  </p>
                </div>
              ) : null}
            </div>
            <div className="grid gap-3">
              <label className="grid gap-1.5 text-xs font-semibold text-muted">
                Subject
                <Input
                  value={subject}
                  disabled={completed}
                  onChange={(event) => setSubject(event.target.value)}
                  onBlur={() => void onSaveDraft(candidate, subject, body)}
                  aria-label={`Subject for ${candidate.name}`}
                />
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-muted">
                Email
                <Textarea
                  value={body}
                  disabled={completed}
                  onChange={(event) => setBody(event.target.value)}
                  onBlur={() => void onSaveDraft(candidate, subject, body)}
                  className="min-h-64 bg-panel font-sans leading-6"
                  aria-label={`Email body for ${candidate.name}`}
                />
              </label>
              {!completed ? (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={busy === "regenerate"}
                    onClick={() =>
                      void run("regenerate", () => onRegenerate(candidate))
                    }
                  >
                    <RotateCcw className="size-3.5" /> Regenerate
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function ProductAvatar({ candidate }: { candidate: Candidate }) {
  if (candidate.thumbnailUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={candidate.thumbnailUrl}
        alt=""
        className="size-11 rounded-xl border border-line object-cover sm:size-12"
      />
    );
  }
  const colors = [
    "bg-[#171717]",
    "bg-[#0044ff]",
    "bg-[#e05e24]",
    "bg-[#0e8750]",
  ];
  const color = colors[candidate.name.charCodeAt(0) % colors.length];
  return (
    <span
      className={cn(
        "flex size-11 items-center justify-center rounded-xl text-sm font-bold text-white sm:size-12",
        color,
      )}
    >
      {initials(candidate.name)}
    </span>
  );
}

function QuickLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      onClick={(event) => event.stopPropagation()}
      className="flex size-7 items-center justify-center rounded-md text-muted outline-none hover:bg-ink/[0.06] hover:text-ink focus-visible:ring-2 focus-visible:ring-primary"
    >
      {children}
    </a>
  );
}

function CompletedStatus({ candidate }: { candidate: Candidate }) {
  const sent = candidate.status === "sent";
  const unknown = candidate.status === "send_unknown";
  return (
    <div className="flex items-center gap-2 text-xs font-semibold">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
          sent
            ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
            : unknown
              ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
              : "bg-ink/[0.06] text-muted",
        )}
      >
        {sent ? (
          <CheckCircle2 className="size-3.5" />
        ) : unknown ? (
          <CircleAlert className="size-3.5" />
        ) : (
          <X className="size-3.5" />
        )}
        {sent ? "Sent" : unknown ? "Delivery unknown" : "Dismissed"}
      </span>
      {candidate.completedAt ? (
        <span className="font-medium text-muted">
          {formatDate(candidate.completedAt)} at{" "}
          {formatTime(candidate.completedAt)}
        </span>
      ) : null}
    </div>
  );
}
