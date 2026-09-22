import { ButtonHTMLAttributes } from "react";

export default function PrimaryButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`relative w-full rounded-2xl bg-brand-500 px-[10px] py-[13px] text-[18px] font-extrabold text-white shadow-[inset_0px_0px_14px_0px_rgba(255,255,255,0.25),inset_0px_0px_11.8px_0px_rgba(255,255,255,0.6)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${className}`}
    >
      {children}
    </button>
  );
}
