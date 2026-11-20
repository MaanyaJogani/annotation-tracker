"use client";

import { useEffect, useId, useRef, useState } from "react";

/** Measure rendered lines so wrapping, manual line breaks, and resizing all count. */
export default function ExpandableText({ text, label, className = "" }: {
  text: string;
  label: string;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const paragraph = useRef<HTMLParagraphElement>(null);
  const id = useId();

  useEffect(() => {
    const element = paragraph.current;
    if (!element) return;
    function measure() {
      if (!element || element.clientWidth === 0) return;
      const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
      setOverflows(element.scrollHeight > lineHeight * 3 + 1);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [text, className]);

  return <>
    <p ref={paragraph} id={id} className={`whitespace-pre-wrap break-words leading-5 ${className} ${expanded && overflows ? "" : "line-clamp-3"}`}>{text}</p>
    {overflows && <button type="button" aria-expanded={expanded} aria-controls={id}
      onClick={event => { event.stopPropagation(); setExpanded(!expanded); }}
      className="mt-1 text-xs font-semibold text-indigo-700 hover:underline">
      {expanded ? "Show less" : `Show full ${label}`}
    </button>}
  </>;
}
