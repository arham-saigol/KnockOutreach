import Link from "next/link";
import { ArrowRight, Check, MousePointer2, Sparkles } from "lucide-react";
import { KnockBrand } from "@/components/brand";
import { SetupRequired } from "@/components/setup-required";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const demo = process.env.NEXT_PUBLIC_KNOCK_DEMO_MODE === "1";
  const configured = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.NEXT_PUBLIC_CONVEX_URL,
  );
  if (!demo && !configured) return <SetupRequired />;

  return (
    <main className="min-h-dvh overflow-hidden bg-canvas">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 lg:px-8">
        <KnockBrand />
        <Link
          href={demo ? "/app" : "/sign-in"}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Sign in <ArrowRight className="size-3.5" />
        </Link>
      </header>
      <section className="mx-auto grid max-w-6xl gap-14 px-5 pb-20 pt-16 lg:grid-cols-[1fr_0.9fr] lg:px-8 lg:pb-28 lg:pt-24">
        <div className="self-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 text-xs font-semibold text-muted">
            <Sparkles className="size-3.5 text-primary" /> Human-approved
            outreach
          </div>
          <h1 className="mt-7 max-w-2xl text-balance text-5xl font-bold leading-[1.02] tracking-[-0.06em] text-ink sm:text-6xl">
            A thoughtful knock on the right doors.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted">
            Knock finds relevant launches, learns what your company does, and
            prepares short emails you can send or dismiss in seconds.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href={demo ? "/app" : "/sign-up"}
              className={cn(buttonVariants({ size: "lg" }))}
            >
              Open Knock <ArrowRight className="size-4" />
            </Link>
            <span className="inline-flex items-center gap-2 px-2 text-sm text-muted">
              <Check className="size-4 text-success" /> Nothing sends without
              you
            </span>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-lg">
          <div className="absolute -left-20 top-12 size-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative rotate-[-1deg] rounded-2xl border border-line bg-panel p-5 shadow-card">
            <div className="flex items-center gap-3 border-b border-line pb-4">
              <div className="flex size-11 items-center justify-center rounded-xl bg-[#131313] text-sm font-bold text-white">
                M
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-ink">Mori</div>
                <div className="truncate text-sm text-muted">
                  Customer research that stays current
                </div>
              </div>
              <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 dark:bg-green-950 dark:text-green-300">
                94% contact
              </span>
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Draft ready
            </p>
            <p className="mt-2 font-semibold text-ink">
              A small idea for Mori’s research loop
            </p>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted">
              Hi Mori team,{"\n\n"}I’m Kit, Maya’s AI agent at Northstar. I
              noticed Mori keeps evidence connected to the decisions it
              informs...
            </p>
            <div className="mt-5 flex gap-2">
              <div className="flex h-10 flex-1 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white">
                Send
              </div>
              <div className="flex h-10 flex-1 items-center justify-center rounded-lg border border-line text-sm font-semibold text-ink">
                Dismiss
              </div>
            </div>
            <MousePointer2 className="absolute -bottom-5 right-14 size-8 fill-ink text-panel" />
          </div>
        </div>
      </section>
    </main>
  );
}
