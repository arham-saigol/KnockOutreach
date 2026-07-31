import { cn } from "@/lib/utils";

export function KnockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="Knock"
      className={cn("size-7", className)}
      fill="none"
    >
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <path
        d="M9.5 8.5v15M10 17l6-6.2M12.8 14.2l7.7 9.3M19.3 8.5v6.2M22.7 8.5v6.2"
        stroke="white"
        strokeWidth="2.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KnockWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "text-[17px] font-bold tracking-[-0.035em] text-ink",
        className,
      )}
    >
      Knock
    </span>
  );
}

export function KnockBrand({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <KnockIcon className="text-primary" />
      <KnockWordmark />
    </span>
  );
}
