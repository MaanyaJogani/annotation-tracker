"use client";

import { useState } from "react";
import { copyText } from "@/lib/clipboard";

const CopyIcon = ({ copied }: { copied: boolean }) =>
  copied ? (
    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path d="M5 13l4 4L19 7" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );

type CopyProps = { label: string; value: string };

export function CopyButton({ label, value }: CopyProps) {
  const [copied, setCopied] = useState(false);
  return (
      <button
        type="button"
        title={copied ? "Copied!" : `Copy ${label.toLowerCase()}`}
        disabled={!value}
        onClick={async (e) => {
          e.stopPropagation();
          if (!value) return;
          const result = await copyText(value);
          if (result === "copied") {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }
        }}
        aria-label={copied ? "Copied!" : `Copy ${label.toLowerCase()}`}
        className="task-icon-button disabled:opacity-30"
      >
        <CopyIcon copied={copied} />
      </button>
  );
}

export default function CopyField({ label, value }: CopyProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
        <p title={value || undefined}
        className="font-mono text-sm text-slate-800 break-all mt-1">
          {value || <span className="text-muted italic">not set</span>}
        </p>
      </div>
      <CopyButton label={label} value={value} />
    </div>
  );
}
