"use client";

import { useState } from "react";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

function ThemeShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: "!border-line !bg-panel !text-ink !shadow-card",
            description: "!text-muted",
          },
        }}
      />
    </ThemeProvider>
  );
}

function ConvexShell({
  children,
  url,
}: {
  children: React.ReactNode;
  url: string;
}) {
  const [client] = useState(() => new ConvexReactClient(url));
  return (
    <ConvexProviderWithClerk client={client} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const demo = process.env.NEXT_PUBLIC_KNOCK_DEMO_MODE === "1";
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  if (demo || !clerkKey || !convexUrl)
    return <ThemeShell>{children}</ThemeShell>;

  return (
    <ClerkProvider publishableKey={clerkKey} afterSignOutUrl="/">
      <ConvexShell url={convexUrl}>
        <ThemeShell>{children}</ThemeShell>
      </ConvexShell>
    </ClerkProvider>
  );
}
