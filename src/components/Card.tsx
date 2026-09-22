import { ReactNode } from "react";

export default function Card({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full flex-col items-start justify-between gap-6 rounded-[32px] bg-white p-5">
      {children}
    </div>
  );
}
