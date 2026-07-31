"use client";

import { useMemo, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  CalendarDays,
  CircleAlert,
  LoaderCircle,
  Play,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { LaunchCard } from "@/components/launch-card";
import { PlayMode } from "@/components/play-mode";
import { Button } from "@/components/ui/button";
import type { Candidate, DailyRun, Project } from "@/lib/types";

export interface QueueActions {
  send: (candidate: Candidate) => Promise<void>;
  dismiss: (candidate: Candidate) => Promise<void>;
  regenerate: (candidate: Candidate) => Promise<void>;
  retryContact: (candidate: Candidate) => Promise<void>;
  saveDraft: (
    candidate: Candidate,
    subject: string,
    body: string,
  ) => Promise<void>;
  runNow: () => Promise<void>;
}

export function QueueWorkspace({
  projects,
  activeProjectId,
  onProjectChange,
  candidates,
  run,
  actions,
  avatarUrl,
  userName,
  onSignOut,
}: {
  projects: Project[];
  activeProjectId: string;
  onProjectChange: (projectId: string) => void;
  candidates: Candidate[];
  run?: DailyRun;
  actions: QueueActions;
  avatarUrl?: string;
  userName?: string;
  onSignOut: () => void | Promise<void>;
}) {
  const [tab, setTab] = useState("pending");
  const [playSession, setPlaySession] = useState<Candidate[]>();
  const [runningLocal, setRunningLocal] = useState(false);
  const activeProject =
    projects.find((project) => project.id === activeProjectId) ?? projects[0];
  const projectCandidates = candidates.filter(
    (candidate) => candidate.projectId === activeProject.id,
  );
  const pending = projectCandidates.filter((candidate) =>
    ["ready", "send_failed", "no_contact", "send_unknown"].includes(
      candidate.status,
    ),
  );
  const playable = pending.filter(
    (candidate) =>
      candidate.recipientEmail && candidate.status !== "send_unknown",
  );
  const completed = projectCandidates.filter((candidate) =>
    ["sent", "dismissed"].includes(candidate.status),
  );
  const isRunning =
    runningLocal || run?.status === "running" || run?.status === "queued";
  const today = useMemo(
    () =>
      new Intl.DateTimeFormat("en", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(new Date()),
    [],
  );

  async function runNow() {
    setRunningLocal(true);
    try {
      await actions.runNow();
      toast.success("Daily discovery started", {
        description: "You can leave this page while Knock works.",
      });
    } catch (error) {
      toast.error("Couldn’t start the run", {
        description:
          error instanceof Error ? error.message : "Try again shortly.",
      });
    } finally {
      setRunningLocal(false);
    }
  }

  async function notify(action: "send" | "dismiss", candidate: Candidate) {
    try {
      await actions[action](candidate);
      toast.success(
        action === "send"
          ? `Email sent to ${candidate.recipientEmail}`
          : `${candidate.name} dismissed`,
      );
    } catch (error) {
      toast.error(action === "send" ? "Email not sent" : "Couldn’t dismiss", {
        description: error instanceof Error ? error.message : "Try again.",
      });
      throw error;
    }
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <AppHeader
        projects={projects}
        activeProject={activeProject}
        onProjectChange={onProjectChange}
        avatarUrl={avatarUrl}
        userName={userName}
        onSignOut={onSignOut}
      />
      <main className="mx-auto w-full max-w-[1040px] px-4 pb-20 pt-10 sm:px-6 sm:pt-14 lg:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-muted">
              <CalendarDays className="size-4" /> {today}
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.045em] text-ink sm:text-[36px]">
              {pending.length
                ? `${pending.length} ${pending.length === 1 ? "launch" : "launches"} to review`
                : "You’re all caught up"}
            </h1>
            <p className="mt-2 text-[15px] text-muted">
              Prepared from today’s Product Hunt launches. Nothing sends without
              your approval.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => void runNow()}
              disabled={isRunning}
            >
              {isRunning ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              {isRunning ? "Discovering" : "Run now"}
            </Button>
            <Button
              size="md"
              onClick={() =>
                setPlaySession(playable.map((candidate) => ({ ...candidate })))
              }
              disabled={!playable.length}
              className="px-5"
            >
              <Play className="size-4 fill-current" /> Play
            </Button>
          </div>
        </div>

        {isRunning ? (
          <RunProgress run={run} />
        ) : run?.status === "failed" ? (
          <RunFailure run={run} onRetry={runNow} />
        ) : null}

        <Tabs.Root value={tab} onValueChange={setTab} className="mt-10">
          <Tabs.List
            aria-label="Candidate queue"
            className="flex gap-1 border-b border-line"
          >
            <Tab value="pending" count={pending.length}>
              Pending
            </Tab>
            <Tab value="completed" count={completed.length}>
              Completed
            </Tab>
          </Tabs.List>
          <Tabs.Content value="pending" className="mt-5 outline-none">
            {pending.length ? (
              <div className="grid gap-3">
                {pending.map((candidate) => (
                  <LaunchCard
                    key={`${candidate.id}:${candidate.subject}`}
                    candidate={candidate}
                    onSend={(item) => notify("send", item)}
                    onDismiss={(item) => notify("dismiss", item)}
                    onRegenerate={actions.regenerate}
                    onRetryContact={actions.retryContact}
                    onSaveDraft={actions.saveDraft}
                  />
                ))}
              </div>
            ) : (
              <EmptyQueue onRun={runNow} />
            )}
          </Tabs.Content>
          <Tabs.Content value="completed" className="mt-5 outline-none">
            {completed.length ? (
              <div className="grid gap-3">
                {completed.map((candidate) => (
                  <LaunchCard
                    key={`${candidate.id}:${candidate.subject}`}
                    candidate={candidate}
                    completed
                    onSend={(item) => notify("send", item)}
                    onDismiss={(item) => notify("dismiss", item)}
                    onRegenerate={actions.regenerate}
                    onRetryContact={actions.retryContact}
                    onSaveDraft={actions.saveDraft}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-line py-16 text-center text-sm text-muted">
                Sent and dismissed launches will stay here.
              </div>
            )}
          </Tabs.Content>
        </Tabs.Root>
        <footer className="mt-10 border-t border-line pt-5 text-xs leading-5 text-muted">
          Launch data provided by{" "}
          <a
            href="https://www.producthunt.com"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-ink hover:underline"
          >
            Product Hunt
          </a>
          . Knock is not affiliated with Product Hunt.
        </footer>
      </main>

      {playSession ? (
        <PlayMode
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setPlaySession(undefined);
          }}
          candidates={playSession}
          onSend={(item) => notify("send", item)}
          onDismiss={(item) => notify("dismiss", item)}
        />
      ) : null}
    </div>
  );
}

function Tab({
  value,
  count,
  children,
}: {
  value: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Tabs.Trigger
      value={value}
      className="relative flex h-10 items-center gap-2 px-3 text-sm font-semibold text-muted outline-none transition after:absolute after:inset-x-2 after:bottom-[-1px] after:h-0.5 after:rounded-full after:bg-primary after:opacity-0 hover:text-ink focus-visible:ring-2 focus-visible:ring-primary data-[state=active]:text-ink data-[state=active]:after:opacity-100"
    >
      {children}
      <span className="rounded-full bg-ink/[0.06] px-1.5 py-0.5 text-[10px] tabular-nums">
        {count}
      </span>
    </Tabs.Trigger>
  );
}

function RunProgress({ run }: { run?: DailyRun }) {
  const label = run?.currentStep || "Preparing the global Product Hunt run";
  return (
    <div
      role="status"
      className="mt-7 flex items-center gap-4 rounded-xl border border-primary/20 bg-primary/[0.045] p-4"
    >
      <span className="relative flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
        <Sparkles className="size-4" />
        <span className="absolute -right-1 -top-1 size-2.5 animate-pulse rounded-full border-2 border-canvas bg-success" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">
          Knock is discovering launches
        </p>
        <p className="mt-0.5 truncate text-xs text-muted">{label}</p>
      </div>
      {run ? (
        <span className="text-xs font-semibold tabular-nums text-muted">
          {run.counts.drafted} drafts
        </span>
      ) : null}
    </div>
  );
}

function RunFailure({
  run,
  onRetry,
}: {
  run: DailyRun;
  onRetry: () => Promise<void>;
}) {
  return (
    <div
      role="alert"
      className="mt-7 flex items-center gap-4 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950"
    >
      <CircleAlert className="size-5 shrink-0 text-red-600 dark:text-red-300" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-red-800 dark:text-red-200">
          The daily run paused
        </p>
        <p className="mt-0.5 truncate text-xs text-red-700 dark:text-red-300">
          {run.error ?? "Review the run logs, then retry safely."}
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={() => void onRetry()}>
        Retry
      </Button>
    </div>
  );
}

function EmptyQueue({ onRun }: { onRun: () => Promise<void> }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-panel/50 px-5 py-16 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-green-50 text-success dark:bg-green-950">
        <Send className="size-5" />
      </span>
      <h2 className="mt-4 text-lg font-bold text-ink">
        Nothing waiting for review
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
        The next shared run starts daily at 3:15 PM Asia/Karachi, or you can
        start it now.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-5"
        onClick={() => void onRun()}
      >
        <RefreshCw className="size-3.5" /> Run discovery
      </Button>
    </div>
  );
}

export function QueueSkeleton() {
  return (
    <main
      className="mx-auto w-full max-w-[1040px] px-4 py-14 sm:px-6 lg:px-8"
      aria-label="Loading queue"
    >
      <div className="h-4 w-44 animate-pulse rounded bg-ink/10" />
      <div className="mt-4 h-10 w-80 max-w-full animate-pulse rounded-lg bg-ink/10" />
      <div className="mt-12 grid gap-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-44 animate-pulse rounded-2xl border border-line bg-panel"
          />
        ))}
      </div>
    </main>
  );
}
