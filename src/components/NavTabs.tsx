"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Task } from "@/lib/types";

const tabs = [
  { href: "/", label: "Task Board", icon: "▦" },
  { href: "/focus", label: "Active Focus", icon: "◎" },
  { href: "/sheet", label: "Detailed Sheet", icon: "▤" },
  { href: "/payouts", label: "Payout Ledger", icon: "₹" },
  { href: "/projects", label: "Projects", icon: "◧" },
];

export default function NavTabs() {
  const pathname = usePathname();
  const [running, setRunning] = useState<Task | null>(null);

  useEffect(() => {
    let alive = true;
    async function check() {
      try {
        const tasks: Task[] = await fetch("/api/tasks").then((r) => r.json());
        if (alive) setRunning(tasks.find((t) => t.timerStartedAt) ?? null);
      } catch {
        /* ignore */
      }
    }
    check();
    const t = setInterval(check, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [pathname]);

  const runningMin = running
    ? Math.floor(
        (Date.now() - new Date(running.timerStartedAt!).getTime()) / 60000
      ) + running.timeSpentMinutes
    : null;

  return (
    <nav className="bg-surface border-b border-line">
      <div className="max-w-[2200px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-14 flex items-center gap-1 overflow-x-auto">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`px-3.5 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                active
                  ? "border-primary text-primary-ink"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              <span className="opacity-70">{t.icon}</span>
              {t.label}
              {t.href === "/focus" && runningMin !== null && (
                <span className="chip bg-amber-100 text-amber-700 border border-amber-200">
                  {runningMin}m
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
