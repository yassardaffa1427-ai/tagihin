"use client";

import { CalendarSearchIcon } from "@/components/icons";

export default function DateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const hasValue = Boolean(value);

  return (
    <div
      className={`relative w-full h-[39px] rounded-[10px] border bg-white ${
        hasValue ? "border-neutral-400" : "border-neutral-200"
      }`}
    >
      {/* Native input drives the real, OS-native date picker (iOS wheel /
          Android calendar) — this is what makes the field device-native. */}
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`absolute inset-0 w-full h-full rounded-[10px] bg-transparent px-[10px] py-[10px] text-[13px] text-neutral-950 outline-none ${
          hasValue ? "has-value" : ""
        }`}
      />
      {!hasValue && (
        <span className="pointer-events-none absolute left-[10px] top-1/2 -translate-y-1/2 text-[13px] text-neutral-400">
          tanggal hari ini
        </span>
      )}
      <CalendarSearchIcon className="pointer-events-none absolute right-[10px] top-1/2 size-[18px] -translate-y-1/2 text-neutral-500" />
    </div>
  );
}
