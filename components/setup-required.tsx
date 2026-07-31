import { Terminal, ShieldCheck } from "lucide-react";
import { KnockBrand } from "@/components/brand";

export function SetupRequired() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-5 py-16">
      <section className="w-full max-w-xl rounded-2xl border border-line bg-panel p-7 shadow-card sm:p-10">
        <KnockBrand />
        <div className="mt-10 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="size-6" />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-[-0.035em] text-ink">
          Connect the production services
        </h1>
        <p className="mt-3 max-w-lg text-[15px] leading-7 text-muted">
          Knock is installed, but Clerk and Convex Cloud are not configured for
          this environment. Add the public keys to your Vercel project and the
          private integration secrets directly to Convex Cloud.
        </p>
        <div className="mt-6 rounded-xl border border-line bg-canvas p-4 text-sm text-ink">
          <div className="flex items-center gap-2 font-semibold">
            <Terminal className="size-4" /> Local interface preview
          </div>
          <code className="mt-2 block overflow-x-auto text-xs text-muted">
            NEXT_PUBLIC_KNOCK_DEMO_MODE=1 npm run dev
          </code>
        </div>
        <p className="mt-5 text-xs leading-5 text-muted">
          Demo mode is a local UI fixture only. It bypasses external services
          and must remain disabled in production.
        </p>
      </section>
    </main>
  );
}
