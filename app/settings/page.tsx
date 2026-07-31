"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SettingsForm } from "@/components/settings-form";
import { SetupRequired } from "@/components/setup-required";
import { demoProjects } from "@/lib/demo-data";
import type { Project } from "@/lib/types";

export default function SettingsPage() {
  const demo = process.env.NEXT_PUBLIC_KNOCK_DEMO_MODE === "1";
  const configured = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.NEXT_PUBLIC_CONVEX_URL,
  );
  if (demo) return <DemoSettings />;
  if (!configured) return <SetupRequired />;
  return <LiveSettings />;
}

function DemoSettings() {
  const [project, setProject] = useState(demoProjects[0]);
  return (
    <SettingsForm
      project={project}
      onSave={async (next) => setProject(next)}
      onRefresh={async () => new Promise((resolve) => setTimeout(resolve, 600))}
    />
  );
}

function LiveSettings() {
  const searchParams = useSearchParams();
  const projects = useQuery(api.projects.list, {}) as Project[] | undefined;
  const update = useMutation(api.projects.update);
  const refresh = useMutation(api.projects.refreshKnowledge);
  const requestedProjectId = searchParams.get("projectId");
  const project =
    projects?.find((candidate) => candidate.id === requestedProjectId) ??
    projects?.[0];
  if (!project) return <div className="min-h-dvh bg-canvas" />;
  return (
    <SettingsForm
      project={project}
      onSave={async (next) => {
        await update({
          projectId: next.id,
          name: next.name,
          domain: next.domain,
          founderName: next.founderName,
          agentName: next.agentName,
          inboxId: next.inboxId,
          exclusions: next.exclusions,
        });
      }}
      onRefresh={async () => {
        await refresh({ projectId: project.id });
      }}
    />
  );
}
