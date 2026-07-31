"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  CircleAlert,
  Globe2,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { KnockBrand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import type { ProjectStatus } from "@/lib/types";

export interface ProjectInput {
  name: string;
  domain: string;
  founderName: string;
  agentName: string;
  inboxId: string;
}

export function OnboardingForm({
  onCreate,
}: {
  onCreate: (input: ProjectInput) => Promise<void>;
}) {
  const [form, setForm] = useState<ProjectInput>({
    name: "",
    domain: "",
    founderName: "",
    agentName: "",
    inboxId: "",
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof ProjectInput, string>>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  function set<K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function validate() {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = "Enter a project name.";
    try {
      new URL(
        /^https?:\/\//.test(form.domain)
          ? form.domain
          : `https://${form.domain}`,
      );
    } catch {
      next.domain = "Enter a valid website domain.";
    }
    if (!form.founderName.trim())
      next.founderName = "Enter the founder’s name.";
    if (!form.agentName.trim())
      next.agentName = "Name the agent who will introduce itself.";
    if (!form.inboxId.trim())
      next.inboxId = "Enter the AgentMail inbox ID or address.";
    setErrors(next);
    return !Object.keys(next).length;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError(undefined);
    try {
      await onCreate(form);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "The project could not be created.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-dvh bg-canvas">
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 sm:px-8">
        <KnockBrand />
        <Link
          href="/app"
          className="text-sm font-semibold text-muted hover:text-ink"
        >
          Back to queue
        </Link>
      </header>
      <div className="mx-auto grid max-w-5xl gap-12 px-5 pb-20 pt-12 md:grid-cols-[0.72fr_1.28fr] md:px-8 md:pt-20">
        <section>
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="size-5" />
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-[-0.05em] text-ink">
            Tell Knock where to look.
          </h1>
          <p className="mt-4 text-[15px] leading-7 text-muted">
            Five details are enough. Knock reads your website to learn the
            product, audience, positioning, proof, and writing voice.
          </p>
          <div className="mt-7 flex items-start gap-3 rounded-xl border border-line bg-panel p-4 text-sm leading-6 text-muted">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
            Your AgentMail API key stays in Convex Cloud. It is never collected
            here or stored with the project.
          </div>
        </section>
        <form
          onSubmit={submit}
          className="rounded-2xl border border-line bg-panel p-5 shadow-card sm:p-7"
          noValidate
        >
          <div className="grid gap-5">
            <Field label="Project name" error={errors.name}>
              <Input
                autoFocus
                autoComplete="organization"
                placeholder="Northstar"
                value={form.name}
                onChange={(event) => set("name", event.target.value)}
              />
            </Field>
            <Field
              label="Domain"
              hint="Knock will follow useful pages on this domain only."
              error={errors.domain}
            >
              <div className="relative">
                <Globe2 className="absolute left-3.5 top-3.5 size-4 text-muted" />
                <Input
                  className="pl-10"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="northstar.so"
                  value={form.domain}
                  onChange={(event) => set("domain", event.target.value)}
                />
              </div>
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Founder name" error={errors.founderName}>
                <Input
                  autoComplete="name"
                  placeholder="Maya Chen"
                  value={form.founderName}
                  onChange={(event) => set("founderName", event.target.value)}
                />
              </Field>
              <Field label="Agent name" error={errors.agentName}>
                <Input
                  placeholder="Kit"
                  value={form.agentName}
                  onChange={(event) => set("agentName", event.target.value)}
                />
              </Field>
            </div>
            <Field
              label="AgentMail inbox"
              hint="Use the inbox ID or full sending address shown in AgentMail."
              error={errors.inboxId}
            >
              <Input
                autoComplete="email"
                placeholder="kit@northstar.so"
                value={form.inboxId}
                onChange={(event) => set("inboxId", event.target.value)}
              />
            </Field>
          </div>
          {submitError ? (
            <div
              role="alert"
              className="mt-5 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
            >
              <CircleAlert className="size-4 shrink-0" />
              {submitError}
            </div>
          ) : null}
          <Button
            type="submit"
            size="lg"
            loading={submitting}
            className="mt-7 w-full"
          >
            Create project <ArrowRight className="size-4" />
          </Button>
        </form>
      </div>
    </main>
  );
}

const stages = [
  {
    key: "crawling",
    label: "Reading your website",
    detail: "Fetching the homepage and useful same-domain pages",
  },
  {
    key: "synthesizing",
    label: "Building project knowledge",
    detail: "Extracting the product, audience, proof, and writing voice",
  },
  {
    key: "ready",
    label: "Preparing your workspace",
    detail: "Versioning the knowledge base and opening the queue",
  },
] as const;

export function OnboardingProgress({
  status,
  error,
  onRetry,
}: {
  status: ProjectStatus;
  error?: string;
  onRetry: () => Promise<void>;
}) {
  const currentIndex =
    status === "failed"
      ? 0
      : Math.max(
          0,
          stages.findIndex((stage) => stage.key === status),
        );
  useEffect(() => {
    if (status !== "ready") return;
    const timeout = setTimeout(() => window.location.assign("/app"), 900);
    return () => clearTimeout(timeout);
  }, [status]);
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-5 py-12">
      <section className="w-full max-w-lg rounded-2xl border border-line bg-panel p-6 shadow-card sm:p-8">
        <KnockBrand />
        <h1 className="mt-10 text-2xl font-bold tracking-[-0.04em] text-ink">
          Learning your project
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          You can safely leave this page. Convex will continue the workflow and
          preserve each completed step.
        </p>
        <div className="mt-8 grid gap-3">
          {stages.map((stage, index) => {
            const complete = status === "ready" || index < currentIndex;
            const active =
              index === currentIndex &&
              status !== "failed" &&
              status !== "ready";
            return (
              <div
                key={stage.key}
                className="flex items-start gap-3 rounded-xl border border-line p-4"
              >
                <span
                  className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${complete ? "bg-success text-white" : active ? "bg-primary text-white" : "bg-ink/[0.06] text-muted"}`}
                >
                  {complete ? (
                    <Check className="size-3.5" />
                  ) : active ? (
                    <LoaderCircle className="size-3.5 animate-spin" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-current" />
                  )}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {stage.label}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    {stage.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        {status === "failed" ? (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
            <div className="flex gap-2 text-sm font-semibold text-red-700 dark:text-red-300">
              <CircleAlert className="size-4 shrink-0" />
              Knowledge build paused
            </div>
            <p className="mt-2 text-xs leading-5 text-red-700 dark:text-red-300">
              {error ??
                "The site could not be processed. Check the domain and service configuration, then retry."}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void onRetry()}
            >
              <RefreshCw className="size-3.5" /> Retry safely
            </Button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
