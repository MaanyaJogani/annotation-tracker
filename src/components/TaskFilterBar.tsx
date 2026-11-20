"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Project, Task } from "@/lib/types";
import { emptyTaskFilters, filterCount, filterTasks, type TaskFilters } from "@/lib/task-filters";

const categories = [
  { key: "types", label: "Task Types", icon: "◇" },
  { key: "stages", label: "Stages", icon: "◷" },
  { key: "projects", label: "Projects", icon: "◇" },
  { key: "approvals", label: "Review States", icon: "✓" },
  { key: "comments", label: "Comments", icon: "☷" },
] as const;

type Props = {
  tasks: Task[]; projects: Project[]; search: string;
  onSearch: (value: string) => void; filters: TaskFilters;
  onChange: (value: TaskFilters) => void; resultCount: number;
};

export default function TaskFilterBar({ tasks, projects, search, onSearch, filters, onChange, resultCount }: Props) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<keyof TaskFilters>("stages");
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const count = filterCount(filters);
  const active = count > 0 || search.trim().length > 0;
  const options: Record<keyof TaskFilters, { value: string; label: string }[]> = {
    types: [{ value: "annotation", label: "Annotation" }, { value: "review", label: "Review" }],
    stages: [
      { value: "in_progress", label: "In Progress" },
      { value: "completed", label: "Completed" },
      { value: "paid", label: "Paid & Closed" },
    ],
    projects: projects.map((project) => ({ value: project.id, label: project.name })),
    approvals: [
      { value: "accepted", label: "Approved (Bonus)" },
      { value: "pending", label: "Pending Review" },
      { value: "rejected", label: "Base Only / Rejected" },
    ],
    comments: [{ value: "with", label: "With Comments" }, { value: "without", label: "Without Comments" }],
  };
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  function toggle(key: keyof TaskFilters, value: string) {
    onChange({ ...filters, [key]: filters[key].includes(value) ? filters[key].filter((item) => item !== value) : [...filters[key], value] });
  }
  function clear() { onChange(emptyTaskFilters()); onSearch(""); }
  const labels: Record<keyof TaskFilters, string> = { types: "Task Types", stages: "Stages", projects: "Projects", approvals: "Review States", comments: "Tasks" };
  return (
    <section className="card task-filter-bar p-3 space-y-3" aria-label="Task filters">
      <div className="flex flex-wrap items-center gap-2.5">
        <input aria-label="Search tasks" className="field field-pill flex-1 min-w-40" placeholder="Search ID, stage, notes, project…" value={search} onChange={(event) => onSearch(event.target.value)} />
        <div ref={wrapper} className="relative">
          <button ref={trigger} type="button" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(!open)} className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${count || open ? "border-emerald-300 bg-emerald-50 text-emerald-950" : "border-line bg-surface"}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16M8 4v6M16 9v6M10 14v6" /></svg>
            Filters {count > 0 && <span className="rounded-full bg-emerald-600 text-white px-1.5 text-xs">{count}</span>} <span aria-hidden="true">{open ? "⌃" : "⌄"}</span>
          </button>
          {open && (
            <div id={menuId} role="region" aria-label="Filter by Category" className="absolute right-0 top-full mt-2 z-30 w-[min(420px,calc(100vw-3rem))] rounded-2xl border border-line bg-white shadow-xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 className="text-sm font-bold">Filter by Category</h2>
                <div className="flex gap-3 items-center">
                  {count > 0 && <button className="text-xs font-semibold text-emerald-700" onClick={() => onChange(emptyTaskFilters())}>Clear all filters</button>}
                  <button aria-label="Close filters" className="text-muted px-1" onClick={() => { setOpen(false); trigger.current?.focus(); }}>×</button>
                </div>
              </div>
              <div className="grid grid-cols-[40%_60%] min-h-56">
                <div className="bg-slate-50/70 border-r border-line p-2 space-y-1" aria-label="Filter categories">
                  {categories.map((item) => (
                    <button key={item.key} type="button" aria-pressed={category === item.key} onClick={() => setCategory(item.key)} className={`w-full text-left flex items-center gap-2 rounded-xl px-2.5 py-2.5 text-xs sm:text-sm ${category === item.key ? "bg-white border border-emerald-100 text-emerald-800 font-semibold" : "border border-transparent text-muted hover:bg-white"}`}>
                      <span aria-hidden="true" className="text-emerald-600">{item.icon}</span><span className="flex-1">{item.label}</span>{filters[item.key].length > 0 && <span className="text-xs">{filters[item.key].length}</span>}
                    </button>
                  ))}
                </div>
                <fieldset className="p-3 min-w-0 max-h-72 overflow-y-auto">
                  <legend className="sr-only">{labels[category]} options</legend>
                  <p className="text-[0.65rem] font-bold uppercase tracking-wider text-muted mb-2">{labels[category]} options</p>
                  <label className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-emerald-50 cursor-pointer">
                    <input type="checkbox" className="accent-emerald-700 w-4 h-4" checked={filters[category].length === 0} onChange={() => onChange({ ...filters, [category]: [] })} /> All {labels[category]}
                  </label>
                  {options[category].map((option) => (
                    <label key={option.value} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-emerald-50 cursor-pointer">
                      <input type="checkbox" className="accent-emerald-700 w-4 h-4 shrink-0" checked={filters[category].includes(option.value)} onChange={() => toggle(category, option.value)} />
                      <span className="flex-1 break-words">{option.label}</span>
                      <span className="text-xs text-muted">{filterTasks(tasks, search, { ...filters, [category]: [option.value] }).length}</span>
                    </label>
                  ))}
                  {!options[category].length && <p className="text-xs text-muted p-2">No projects yet.</p>}
                </fieldset>
              </div>
              <p className="border-t border-line px-4 py-2 text-xs text-muted">Select multiple options. No selection includes all.</p>
            </div>
          )}
        </div>
        {active && <button onClick={clear} className="text-xs font-semibold text-rose-700 rounded-full border border-rose-200 bg-rose-50 px-3 py-2">Clear filters</button>}
        <span className="chip bg-slate-100 text-muted border border-line whitespace-nowrap" role="status">{resultCount} of {tasks.length}</span>
      </div>
      {count > 0 && <div className="flex flex-wrap gap-2" aria-label="Applied filters">
        {categories.flatMap((item) => filters[item.key].map((value) => (
          <button key={`${item.key}-${value}`} onClick={() => toggle(item.key, value)} data-category={item.key} aria-label={`Remove ${item.label}: ${options[item.key].find((option) => option.value === value)?.label ?? value}`} className="filter-chip rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1 text-xs text-emerald-900">
            {item.label}: {options[item.key].find((option) => option.value === value)?.label ?? value} <span aria-hidden="true" className="ml-1">×</span>
          </button>
        )))}
      </div>}
    </section>
  );
}
