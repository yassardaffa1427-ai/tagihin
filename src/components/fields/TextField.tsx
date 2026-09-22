"use client";

import { InputHTMLAttributes } from "react";

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
  hasValue: boolean;
};

export default function TextField({ hasValue, ...props }: TextFieldProps) {
  return (
    <input
      {...props}
      className={`w-full h-[39px] rounded-[10px] border bg-white px-[10px] py-[10px] text-[13px] outline-none transition-colors focus:border-neutral-400 ${
        hasValue
          ? "border-neutral-400 text-neutral-950"
          : "border-neutral-200 text-neutral-950 placeholder:text-neutral-400"
      }`}
    />
  );
}
