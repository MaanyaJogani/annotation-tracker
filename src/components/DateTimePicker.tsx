"use client";

import { useRef, useState } from "react";
import { formatDateTime, toDateInputValue } from "@/lib/format";

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const months = Array.from({ length: 12 }, (_, month) =>
  new Date(2024, month, 1).toLocaleString("en", { month: "long" })
);

export default function DateTimePicker({ id, label, value, onChange }: Props) {
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date());
  const selected = value ? new Date(value) : null;
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, index) =>
    new Date(first.getFullYear(), first.getMonth(), index - offset + 1)
  );
  const dayKey = (date: Date) => toDateInputValue(date.toISOString()).slice(0, 10);
  const selectedDay = value.slice(0, 10);
  const today = dayKey(new Date());

  function close() {
    panel.current?.hidePopover();
    trigger.current?.focus();
  }

  function toggle() {
    if (open) { close(); return; }
    setMonth(selected && !Number.isNaN(selected.getTime()) ? selected : new Date());
    const box = trigger.current!.getBoundingClientRect();
    const popup = panel.current!;
    popup.style.left = `${Math.max(12, Math.min(box.left, window.innerWidth - 352))}px`;
    popup.showPopover();
    const height = popup.getBoundingClientRect().height;
    const below = box.bottom + 8;
    const above = box.top - height - 8;
    popup.style.top = `${below + height <= window.innerHeight - 12
      ? below
      : Math.max(12, above >= 12 ? above : window.innerHeight - height - 12)}px`;
    popup.querySelector<HTMLButtonElement>(".date-time-day[data-selected='true'], .date-time-day[data-today='true']")?.focus({ preventScroll: true });
  }

  function chooseDay(date: Date) {
    const time = value.slice(11, 16) || toDateInputValue(new Date().toISOString()).slice(11, 16);
    onChange(`${dayKey(date)}T${time}`);
    setMonth(date);
  }

  return (
    <>
      <button id={id} ref={trigger} type="button" onClick={toggle}
        aria-label={`${label}: ${value ? formatDateTime(value) : "Choose date and time"}`}
        aria-haspopup="dialog" aria-expanded={open} aria-controls={`${id}-calendar`}
        className="field date-time-trigger">
        <span className={value ? "" : "text-slate-400"}>{value ? formatDateTime(value) : "Choose date & time"}</span>
        <svg aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4m8-4v4M3 11h18" />
        </svg>
      </button>
      <div id={`${id}-calendar`} ref={panel} popover="auto" role="dialog" aria-label={label}
        className="date-time-popover" onToggle={(event) => setOpen(event.newState === "open")}
        onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); close(); } }}>
        <div className="date-time-heading">
          <div><p className="font-semibold text-emerald-950">{label}</p><p className="text-xs text-slate-500 mt-1">Choose a date and time</p></div>
          <button type="button" className="date-time-icon" aria-label="Close calendar" onClick={close}>×</button>
        </div>
        <div className="date-time-month">
          <button type="button" className="date-time-icon" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
          <select aria-label="Month" value={month.getMonth()} onChange={(event) => setMonth(new Date(month.getFullYear(), Number(event.target.value), 1))}>
            {months.map((name, index) => <option key={name} value={index}>{name}</option>)}
          </select>
          <input aria-label="Year" type="number" min="1" max="9999" value={month.getFullYear()}
            onChange={(event) => { const year = Number(event.target.value); if (year >= 100 && year <= 9999) setMonth(new Date(year, month.getMonth(), 1)); }} />
          <button type="button" className="date-time-icon" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
        </div>
        <div className="date-time-grid">
          {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => <span key={day} className="date-time-weekday">{day}</span>)}
          {days.map((date) => {
            const key = dayKey(date);
            return <button key={key} type="button" className="date-time-day"
              data-selected={key === selectedDay} data-outside={date.getMonth() !== month.getMonth()} data-today={key === today}
              aria-label={date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              aria-pressed={key === selectedDay} aria-current={key === today ? "date" : undefined}
              onClick={() => chooseDay(date)}>{date.getDate()}</button>;
          })}
        </div>
        <div className="date-time-clock">
          <label htmlFor={`${id}-time`} className="font-medium text-sm text-slate-600">Time</label>
          <input id={`${id}-time`} aria-label="Time" type="time" className="field" value={value.slice(11, 16)}
            onInput={(event) => { if (event.currentTarget.value) onChange(`${selectedDay || today}T${event.currentTarget.value}`); }} />
        </div>
        <div className="date-time-actions">
          <button type="button" onClick={() => { onChange(""); close(); }} className="text-slate-500 hover:text-slate-800">Clear</button>
          <button type="button" onClick={() => { const now = new Date(); onChange(toDateInputValue(now.toISOString())); setMonth(now); }} className="ml-auto font-semibold text-emerald-700">Now</button>
          <button type="button" onClick={close} className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800">Done</button>
        </div>
      </div>
    </>
  );
}
