"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  OnboardingForm,
  OnboardingProgress,
  type ProjectInput,
} from "@/components/onboarding-flow";
import { SetupRequired } from "@/components/setup-required";
import type { Project, ProjectStatus } from "@/lib/types";

export default function OnboardingPage() {
  const demo = process.env.NEXT_PUBLIC_KNOCK_DEMO_MODE === "1";
  const configured = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.NEXT_PUBLIC_CONVEX_URL,
  );
  if (demo) return <DemoOnboarding />;
  if (!configured) return <SetupRequired />;
  return <LiveOnboarding />;
}

function DemoOnboarding() {
  const [created, setCreated] = useState(false);
  const [status, setStatus] = useState<ProjectStatus>("crawling");
  async function create() {
    setCreated(true);
    setStatus("crawling");
    setTimeout(() => setStatus("synthesizing"), 1600);
    setTimeout(() => setStatus("ready"), 3400);
  }
  return created ? (
    <OnboardingProgress status={status} onRetry={create} />
  ) : (
    <OnboardingForm onCreate={create} />
  );
}

function LiveOnboarding() {
  const [projectId, setProjectId] = useState<string>();
  const createProject = useMutation(api.projects.create);
  async function create(input: ProjectInput) {
    const id = (await createProject(input)) as string;
    setProjectId(id);
  }
  return projectId ? (
    <LiveProgress projectId={projectId} />
  ) : (
    <OnboardingForm onCreate={create} />
  );
}

function LiveProgress({ projectId }: { projectId: string }) {
  const project = useQuery(api.projects.get, { projectId }) as
    (Project & { onboardingError?: string }) | null | undefined;
  const retry = useMutation(api.projects.retryOnboarding);
  return (
    <OnboardingProgress
      status={project?.status ?? "crawling"}
      error={project?.onboardingError}
      onRetry={async () => {
        await retry({ projectId });
      }}
    />
  );
}
