import { useId } from "react";
import type { Status } from "@/lib/types";

interface Props {
  statuses: Status[];
  value: string;
  onChange: (value: string) => void;
}

export default function StageStatusSelect({ statuses, value, onChange }: Props) {
  const id = useId();
  const selected = statuses.find((status) => status.id === value);

  return (
    <>
      <label htmlFor={id} className="label block mb-1.5">Stage Status</label>
      <select
        id={id}
        className="field font-semibold transition-colors"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={selected ? {
          backgroundColor: `color-mix(in srgb, ${selected.color} 15%, white)`,
          borderColor: `color-mix(in srgb, ${selected.color} 55%, white)`,
          color: "#1e293b",
        } : undefined}
      >
        {!selected && (
          <option value={value} disabled>
            {value ? "Current status unavailable" : "Select stage…"}
          </option>
        )}
        {statuses.map((status) => (
          <option key={status.id} value={status.id} style={{ backgroundColor: "white", color: "#1e293b" }}>
            {status.name}
          </option>
        ))}
      </select>
    </>
  );
}
