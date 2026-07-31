"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  ExternalLink,
  Globe2,
  Keyboard,
  Mail,
  Send,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import type { Candidate } from "@/lib/types";
import { initials } from "@/lib/utils";

export function PlayMode({
  open,
  onOpenChange,
  candidates,
  onSend,
  onDismiss,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: Candidate[];
  onSend: (candidate: Candidate) => Promise<void>;
  onDismiss: (candidate: Candidate) => Promise<void>;
}) {
  const [index, setIndex] = useState(0);
  const [edits, setEdits] = useState<
    Record<string, { subject: string; body: string }>
  >({});
  const [busy, setBusy] = useState<"send" | "dismiss" | null>(null);
  const [error, setError] = useState<string>();
  const [finished, setFinished] = useState(candidates.length === 0);
  const closeRef = useRef<HTMLButtonElement>(null);

  const current = candidates[index];
  const next = candidates[index + 1];
  const subject = current
    ? (edits[current.id]?.subject ?? current.subject)
    : "";
  const body = current ? (edits[current.id]?.body ?? current.body) : "";

  useEffect(() => {
    if (!next?.thumbnailUrl) return;
    const image = new Image();
    image.src = next.thumbnailUrl;
  }, [next?.id, next?.thumbnailUrl]);

  const act = useCallback(
    async (kind: "send" | "dismiss") => {
      if (!current || busy) return;
      setBusy(kind);
      setError(undefined);
      try {
        const updated = { ...current, subject, body };
        if (kind === "send") await onSend(updated);
        else await onDismiss(updated);
        if (index + 1 >= candidates.length) setFinished(true);
        else setIndex((value) => value + 1);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "The action could not be completed. Try again.",
        );
      } finally {
        setBusy(null);
      }
    },
    [body, busy, candidates.length, current, index, onDismiss, onSend, subject],
  );

  useEffect(() => {
    if (!open || finished) return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.matches("input, textarea, [contenteditable='true']")
      )
        return;
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        void act("send");
      }
      if (event.key.toLowerCase() === "d") {
        event.preventDefault();
        void act("dismiss");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [act, finished, open]);

  const progress = useMemo(
    () =>
      candidates.length
        ? Math.min(100, (index / candidates.length) * 100)
        : 100,
    [candidates.length, index],
  );

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-canvas" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex min-h-0 flex-col bg-canvas outline-none"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            closeRef.current?.focus();
          }}
        >
          <Dialog.Title className="sr-only">
            Play through pending outreach
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            Review one draft at a time, then send or dismiss it.
          </Dialog.Description>
          <div className="h-1 bg-line">
            <div
              className="h-full bg-primary transition-[width] duration-300"
              style={{ width: `${finished ? 100 : progress}%` }}
            />
          </div>
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4 sm:px-6">
            <Dialog.Close asChild>
              <Button ref={closeRef} variant="ghost" size="sm">
                <ArrowLeft className="size-4" /> Exit
              </Button>
            </Dialog.Close>
            <div className="text-center">
              <p className="text-sm font-bold text-ink">Play queue</p>
              <p className="text-xs text-muted">
                {finished
                  ? `${candidates.length} reviewed`
                  : `${index + 1} of ${candidates.length}`}
              </p>
            </div>
            <div className="hidden items-center gap-1.5 text-xs text-muted sm:flex">
              <Keyboard className="size-3.5" /> S to send · D to dismiss
            </div>
            <div className="w-16 sm:hidden" aria-hidden />
          </header>

          {finished || !current ? (
            <CompletionState
              count={candidates.length}
              onClose={() => onOpenChange(false)}
            />
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <main className="mx-auto grid min-h-full w-full max-w-6xl gap-8 px-5 py-8 lg:grid-cols-[0.78fr_1.22fr] lg:px-8 lg:py-12">
                <section className="self-start lg:sticky lg:top-8">
                  <div className="flex items-center gap-3">
                    <span className="flex size-14 items-center justify-center rounded-2xl bg-ink text-base font-bold text-panel">
                      {initials(current.name)}
                    </span>
                    <div>
                      <h2 className="text-xl font-bold tracking-[-0.03em] text-ink">
                        {current.name}
                      </h2>
                      <p className="mt-0.5 text-sm text-muted">
                        {current.tagline}
                      </p>
                    </div>
                  </div>
                  <p className="mt-6 text-[15px] leading-7 text-ink">
                    {current.companyContext}
                  </p>
                  <div className="mt-6 rounded-xl border border-line bg-panel p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                      Why this fits
                    </p>
                    <p className="mt-2 text-sm leading-6 text-ink">
                      {current.matchReason}
                    </p>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <a
                      href={current.productHuntUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-panel px-3 text-xs font-semibold text-ink hover:bg-ink/[0.04]"
                    >
                      <span className="font-black">P</span> Product Hunt{" "}
                      <ExternalLink className="size-3" />
                    </a>
                    <a
                      href={current.websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-panel px-3 text-xs font-semibold text-ink hover:bg-ink/[0.04]"
                    >
                      <Globe2 className="size-3.5" /> Website{" "}
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                </section>

                <section className="self-center rounded-2xl border border-line bg-panel p-5 shadow-card sm:p-7">
                  <div className="flex items-center gap-2 border-b border-line pb-4 text-sm">
                    <Mail className="size-4 text-muted" />
                    <span className="text-muted">To</span>
                    <span className="font-semibold text-ink">
                      {current.recipientEmail ?? "No verified contact"}
                    </span>
                    {current.emailConfidence ? (
                      <span className="ml-auto text-xs font-semibold text-success">
                        {Math.round(current.emailConfidence * 100)}% confidence
                      </span>
                    ) : null}
                  </div>
                  <label className="mt-5 grid gap-2 text-xs font-bold uppercase tracking-[0.1em] text-muted">
                    Subject
                    <Input
                      value={subject}
                      onChange={(event) =>
                        setEdits((value) => ({
                          ...value,
                          [current.id]: { subject: event.target.value, body },
                        }))
                      }
                      className="h-12 text-[15px] font-semibold normal-case tracking-normal"
                    />
                  </label>
                  <label className="mt-4 grid gap-2 text-xs font-bold uppercase tracking-[0.1em] text-muted">
                    Message
                    <Textarea
                      value={body}
                      onChange={(event) =>
                        setEdits((value) => ({
                          ...value,
                          [current.id]: { subject, body: event.target.value },
                        }))
                      }
                      className="min-h-72 resize-none text-[15px] normal-case leading-7 tracking-normal sm:min-h-80"
                    />
                  </label>
                  {error ? (
                    <div
                      role="alert"
                      className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
                    >
                      <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
                    </div>
                  ) : null}
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      size="lg"
                      loading={busy === "dismiss"}
                      disabled={Boolean(busy)}
                      onClick={() => void act("dismiss")}
                    >
                      <X className="size-4" /> Dismiss{" "}
                      <kbd className="ml-1 hidden rounded border border-line px-1 text-[10px] text-muted sm:inline">
                        D
                      </kbd>
                    </Button>
                    <Button
                      size="lg"
                      loading={busy === "send"}
                      disabled={Boolean(busy) || !current.recipientEmail}
                      onClick={() => void act("send")}
                    >
                      <Send className="size-4" /> Send{" "}
                      <kbd className="ml-1 hidden rounded border border-white/30 px-1 text-[10px] text-white/80 sm:inline">
                        S
                      </kbd>
                    </Button>
                  </div>
                </section>
              </main>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CompletionState({
  count,
  onClose,
}: {
  count: number;
  onClose: () => void;
}) {
  return (
    <main className="grid flex-1 place-items-center px-5 py-12 text-center">
      <div>
        <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-green-50 text-success dark:bg-green-950">
          <Check className="size-8" />
        </span>
        <h2 className="mt-6 text-3xl font-bold tracking-[-0.045em] text-ink">
          Queue cleared
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-7 text-muted">
          {count
            ? `You reviewed ${count} ${count === 1 ? "launch" : "launches"}.`
            : "There was nothing waiting for review."}{" "}
          New candidates will appear after the next run.
        </p>
        <Button className="mt-7" onClick={onClose}>
          Back to Knock
        </Button>
      </div>
    </main>
  );
}
