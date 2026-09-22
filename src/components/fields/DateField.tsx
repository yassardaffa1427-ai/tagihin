"use client";

import { useRef } from "react";
import { CalendarSearchIcon } from "@/components/icons";

export default function DateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasValue = Boolean(value);

  const handleClick = () => {
    try {
      inputRef.current?.showPicker?.();
    } catch {
      inputRef.current?.focus();
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`relative flex items-center w-full h-[39px] rounded-[10px] border bg-white cursor-pointer ${
        hasValue ? "border-neutral-400" : "border-neutral-200"
      }`}
    >
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full h-full rounded-[10px] bg-transparent px-[10px] text-[13px] text-neutral-950 outline-none appearance-none cursor-pointer ${
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

