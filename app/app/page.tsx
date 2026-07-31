"use client";

import { useEffect, useMemo, useState } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useAction,
  useMutation,
  useQuery,
} from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  QueueSkeleton,
  QueueWorkspace,
  type QueueActions,
} from "@/components/queue-workspace";
import { SetupRequired } from "@/components/setup-required";
import { demoCandidates, demoProjects, demoRun } from "@/lib/demo-data";
import type { Candidate, DailyRun, Project } from "@/lib/types";

export default function AppPage() {
  const demo = process.env.NEXT_PUBLIC_KNOCK_DEMO_MODE === "1";
  const configured = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.NEXT_PUBLIC_CONVEX_URL,
  );
  if (demo) return <DemoQueue />;
  if (!configured) return <SetupRequired />;
  return (
    <>
      <Authenticated>
        <LiveQueue />
      </Authenticated>
      <AuthLoading>
        <QueueSkeleton />
      </AuthLoading>
      <Unauthenticated>
        <SetupRequired />
      </Unauthenticated>
    </>
  );
}

function DemoQueue() {
  const [projects] = useState(demoProjects);
  const [activeProjectId, setActiveProjectId] = useState(projects[0].id);
  const [candidates, setCandidates] = useState(demoCandidates);
  const [run, setRun] = useState<DailyRun>(demoRun);

  const wait = () => new Promise((resolve) => setTimeout(resolve, 420));
  const actions: QueueActions = {
    send: async (candidate) => {
      await wait();
      setCandidates((items) =>
        items.map((item) =>
          item.id === candidate.id
            ? { ...item, ...candidate, status: "sent", completedAt: Date.now() }
            : item,
        ),
      );
    },
    dismiss: async (candidate) => {
      await wait();
      setCandidates((items) =>
        items.map((item) =>
          item.id === candidate.id
            ? { ...item, status: "dismissed", completedAt: Date.now() }
            : item,
        ),
      );
    },
    regenerate: async (candidate) => {
      await wait();
      setCandidates((items) =>
        items.map((item) =>
          item.id === candidate.id
            ? {
                ...item,
                subject: `${item.name} and the decision before the update`,
              }
            : item,
        ),
      );
    },
    retryContact: async () => {
      await wait();
    },
    saveDraft: async (candidate, subject, body) => {
      setCandidates((items) =>
        items.map((item) =>
          item.id === candidate.id ? { ...item, subject, body } : item,
        ),
      );
    },
    runNow: async () => {
      setRun({
        ...demoRun,
        status: "running",
        currentStep: "Fetching Product Hunt launches",
        completedAt: undefined,
      });
      setTimeout(() => setRun(demoRun), 4500);
    },
  };
  return (
    <QueueWorkspace
      projects={projects}
      activeProjectId={activeProjectId}
      onProjectChange={setActiveProjectId}
      candidates={candidates}
      run={run}
      actions={actions}
      userName="Arham Khan"
      onSignOut={() => window.location.assign("/")}
    />
  );
}

function LiveQueue() {
  const router = useRouter();
  const { user } = useUser();
  const { signOut } = useClerk();
  const rawProjects = useQuery(api.projects.list, {}) as Project[] | undefined;
  const [selectedProjectId, setSelectedProjectId] = useState<string>();
  const projects = rawProjects ?? [];
  const activeProjectId = selectedProjectId ?? projects[0]?.id;
  const rawCandidates = useQuery(
    api.candidates.list,
    activeProjectId ? { projectId: activeProjectId } : "skip",
  ) as Candidate[] | undefined;
  const run = useQuery(api.pipeline.latestRun, {}) as DailyRun | undefined;
  const dismissMutation = useMutation(api.candidates.dismiss);
  const saveDraftMutation = useMutation(api.drafts.update);
  const sendAction = useAction(api.sending.sendApproved);
  const regenerateAction = useAction(api.drafts.regenerate);
  const retryContactAction = useAction(api.candidates.retryContact);
  const runMutation = useMutation(api.pipeline.runNow);

  const actions = useMemo<QueueActions>(
    () => ({
      send: async (candidate) => {
        await sendAction({
          candidateId: candidate.id,
          subject: candidate.subject,
          body: candidate.body,
        });
      },
      dismiss: async (candidate) => {
        await dismissMutation({ candidateId: candidate.id });
      },
      regenerate: async (candidate) => {
        await regenerateAction({ candidateId: candidate.id });
      },
      retryContact: async (candidate) => {
        await retryContactAction({ candidateId: candidate.id });
      },
      saveDraft: async (candidate, subject, body) => {
        await saveDraftMutation({ candidateId: candidate.id, subject, body });
      },
      runNow: async () => {
        await runMutation({});
      },
    }),
    [
      dismissMutation,
      regenerateAction,
      retryContactAction,
      runMutation,
      saveDraftMutation,
      sendAction,
    ],
  );

  useEffect(() => {
    if (rawProjects && rawProjects.length === 0) router.replace("/onboarding");
  }, [rawProjects, router]);

  if (!rawProjects || !projects.length || !rawCandidates || !activeProjectId)
    return <QueueSkeleton />;
  return (
    <QueueWorkspace
      projects={projects}
      activeProjectId={activeProjectId}
      onProjectChange={setSelectedProjectId}
      candidates={rawCandidates}
      run={run}
      actions={actions}
      avatarUrl={user?.imageUrl}
      userName={
        user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "Account"
      }
      onSignOut={() => signOut({ redirectUrl: "/" })}
    />
  );
}
