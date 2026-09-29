"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Task Board", icon: "▦" },
  { href: "/focus", label: "Active Focus", icon: "◎" },
  { href: "/sheet", label: "Detailed Sheet", icon: "▤" },
  { href: "/payouts", label: "Payout Ledger", icon: "₹" },
  { href: "/projects", label: "Projects", icon: "◧" },
];

export default function NavTabs() {
  const pathname = usePathname();
  return (
    <nav className="bg-surface border-b border-line">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 overflow-x-auto">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`px-3.5 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                active
                  ? "border-primary text-primary-ink"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              <span className="mr-1.5 opacity-70">{t.icon}</span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
