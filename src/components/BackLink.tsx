"use client";

import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "@/components/icons";

export default function BackLink({
  label,
  onClick,
}: {
  label: string;
  onClick?: () => void;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={onClick ?? (() => router.back())}
      className="flex items-center gap-[9px] px-[7px] py-1 text-neutral-50 cursor-pointer"
    >
      <ArrowLeftIcon className="size-6" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
