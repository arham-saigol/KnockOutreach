"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { KnockBrand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import type { Project } from "@/lib/types";

export function SettingsForm({
  project,
  onSave,
  onRefresh,
}: {
  project: Project;
  onSave: (project: Project) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(project);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  function update(field: keyof Project, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setSaved(false);
  }
  function updateExclusion(
    field: keyof Project["exclusions"],
    value: string | number | string[],
  ) {
    setDraft((current) => ({
      ...current,
      exclusions: { ...current.exclusions, [field]: value },
    }));
    setSaved(false);
  }
  function list(value: string) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave(draft);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }
  async function refresh() {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <main className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-20 h-14 border-b border-line bg-canvas/95">
        <div className="mx-auto flex h-full max-w-4xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/app"
              aria-label="Back to queue"
              className="rounded-md p-1 text-muted hover:bg-ink/[0.05] hover:text-ink"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <KnockBrand />
          </div>
          <span className="text-sm font-semibold text-muted">Settings</span>
        </div>
      </header>
      <form
        onSubmit={save}
        className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-[-0.045em] text-ink">
            {project.name}
          </h1>
          <p className="mt-2 text-sm text-muted">
            Edit project identity, sending inbox, and coarse exclusions.
          </p>
        </div>
        <section className="mt-9 rounded-2xl border border-line bg-panel p-5 shadow-card sm:p-7">
          <h2 className="text-base font-bold text-ink">Project details</h2>
          <p className="mt-1 text-sm text-muted">
            These are the same five fields used during onboarding.
          </p>
          <div className="mt-6 grid gap-5">
            <Field label="Project name">
              <Input
                required
                value={draft.name}
                onChange={(event) => update("name", event.target.value)}
              />
            </Field>
            <Field label="Domain">
              <Input
                required
                inputMode="url"
                value={draft.domain}
                onChange={(event) => update("domain", event.target.value)}
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Founder name">
                <Input
                  required
                  value={draft.founderName}
                  onChange={(event) =>
                    update("founderName", event.target.value)
                  }
                />
              </Field>
              <Field label="Agent name">
                <Input
                  required
                  value={draft.agentName}
                  onChange={(event) => update("agentName", event.target.value)}
                />
              </Field>
            </div>
            <Field
              label="AgentMail inbox ID or address"
              hint="The API key remains a Convex Cloud secret and is never shown here."
            >
              <Input
                required
                value={draft.inboxId}
                onChange={(event) => update("inboxId", event.target.value)}
              />
            </Field>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-line bg-panel p-5 shadow-card sm:p-7">
          <h2 className="text-base font-bold text-ink">Exclusion rules</h2>
          <p className="mt-1 text-sm text-muted">
            Applied before expensive enrichment, then considered again during
            final matching.
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field label="Keywords" hint="Comma-separated">
              <Input
                value={draft.exclusions.keywords.join(", ")}
                onChange={(event) =>
                  updateExclusion("keywords", list(event.target.value))
                }
              />
            </Field>
            <Field label="Domains" hint="Comma-separated">
              <Input
                value={draft.exclusions.domains.join(", ")}
                onChange={(event) =>
                  updateExclusion("domains", list(event.target.value))
                }
              />
            </Field>
            <Field
              label="Categories"
              hint="Comma-separated Product Hunt topics"
            >
              <Input
                value={draft.exclusions.categories.join(", ")}
                onChange={(event) =>
                  updateExclusion("categories", list(event.target.value))
                }
              />
            </Field>
            <Field label="Contact cooldown (days)">
              <Input
                type="number"
                min={1}
                max={730}
                value={draft.exclusions.cooldownDays}
                onChange={(event) =>
                  updateExclusion("cooldownDays", Number(event.target.value))
                }
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Additional exclusion guidance">
                <Textarea
                  value={draft.exclusions.notes}
                  onChange={(event) =>
                    updateExclusion("notes", event.target.value)
                  }
                />
              </Field>
            </div>
          </div>
        </section>

        <section className="mt-4 flex flex-col gap-4 rounded-2xl border border-line bg-panel p-5 sm:flex-row sm:items-center sm:p-7">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BookOpen className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-ink">
              Knowledge base · version {project.knowledgeVersion}
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              Knock checks source hashes weekly and creates a version only when
              DeepSeek confirms a meaningful change.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            loading={refreshing}
            onClick={() => void refresh()}
          >
            <RefreshCw className="size-3.5" /> Refresh now
          </Button>
        </section>

        <div className="sticky bottom-4 mt-6 flex items-center justify-between rounded-xl border border-line bg-panel/95 p-3 shadow-[0_12px_40px_rgb(0_0_0/0.1)] backdrop-blur">
          <div className="flex items-center gap-2 text-xs text-muted">
            {saved ? (
              <>
                <Check className="size-4 text-success" />
                Saved
              </>
            ) : (
              <>
                <ShieldCheck className="size-4" />
                Changes stay scoped to this project
              </>
            )}
          </div>
          <Button type="submit" loading={saving}>
            Save changes
          </Button>
        </div>
      </form>
    </main>
  );
}
