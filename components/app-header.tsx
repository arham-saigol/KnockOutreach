"use client";

import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Check,
  ChevronDown,
  Laptop,
  LogOut,
  Moon,
  Plus,
  Settings,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { KnockBrand } from "@/components/brand";
import type { Project } from "@/lib/types";
import { cn, initials } from "@/lib/utils";

const menuContent =
  "z-50 min-w-56 rounded-xl border border-line bg-panel p-1.5 text-ink shadow-[0_16px_50px_rgb(0_0_0/0.14)] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out";
const menuItem =
  "flex h-9 cursor-default select-none items-center gap-2 rounded-lg px-2.5 text-sm outline-none transition data-[highlighted]:bg-ink/[0.06] data-[disabled]:opacity-50";

export function AppHeader({
  projects,
  activeProject,
  onProjectChange,
  avatarUrl,
  userName = "Account",
  onSignOut,
}: {
  projects: Project[];
  activeProject: Project;
  onProjectChange: (projectId: string) => void;
  avatarUrl?: string;
  userName?: string;
  onSignOut: () => void | Promise<void>;
}) {
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-line bg-canvas/95 backdrop-blur supports-[backdrop-filter]:bg-canvas/90">
      <div className="mx-auto flex h-full max-w-[1180px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            href="/app"
            aria-label="Knock queue"
            className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <KnockBrand className="[&>span]:hidden sm:[&>span]:inline" />
          </Link>
          <span className="select-none text-line" aria-hidden>
            /
          </span>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-ink outline-none hover:bg-ink/[0.05] focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Switch project"
              >
                <span className="truncate">{activeProject.name}</span>
                <ChevronDown className="size-3.5 shrink-0 text-muted" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className={menuContent}
                sideOffset={8}
                align="start"
              >
                <DropdownMenu.Label className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                  Projects
                </DropdownMenu.Label>
                {projects.map((project) => (
                  <DropdownMenu.Item
                    key={project.id}
                    className={menuItem}
                    onSelect={() => onProjectChange(project.id)}
                  >
                    <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">
                      {initials(project.name)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {project.name}
                    </span>
                    {project.id === activeProject.id ? (
                      <Check className="size-4 text-primary" />
                    ) : null}
                  </DropdownMenu.Item>
                ))}
                <DropdownMenu.Separator className="my-1 h-px bg-line" />
                <DropdownMenu.Item className={menuItem} asChild>
                  <Link href="/onboarding">
                    <Plus className="size-4" /> Create new project
                  </Link>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label="Open account menu"
              className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink text-xs font-bold text-panel outline-none ring-offset-2 ring-offset-canvas hover:ring-2 hover:ring-line focus-visible:ring-2 focus-visible:ring-primary"
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                initials(userName)
              )}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className={menuContent}
              sideOffset={8}
              align="end"
            >
              <DropdownMenu.Label className="px-2.5 py-2">
                <span className="block text-sm font-semibold">{userName}</span>
                <span className="mt-0.5 block text-xs font-normal text-muted">
                  Workspace preferences
                </span>
              </DropdownMenu.Label>
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <DropdownMenu.Label className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
                Theme
              </DropdownMenu.Label>
              <DropdownMenu.RadioGroup value={theme} onValueChange={setTheme}>
                {[
                  ["light", Sun, "Light"],
                  ["dark", Moon, "Dark"],
                  ["system", Laptop, "System"],
                ].map(([value, Icon, label]) => (
                  <DropdownMenu.RadioItem
                    key={value as string}
                    value={value as string}
                    className={menuItem}
                  >
                    <Icon className="size-4 text-muted" />
                    <span className="flex-1">{label as string}</span>
                    <DropdownMenu.ItemIndicator>
                      <Check className="size-4 text-primary" />
                    </DropdownMenu.ItemIndicator>
                  </DropdownMenu.RadioItem>
                ))}
              </DropdownMenu.RadioGroup>
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <DropdownMenu.Item className={menuItem} asChild>
                <Link href="/settings">
                  <Settings className="size-4 text-muted" /> Settings
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className={cn(menuItem, "text-red-600")}
                onSelect={() => void onSignOut()}
              >
                <LogOut className="size-4" /> Sign out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
