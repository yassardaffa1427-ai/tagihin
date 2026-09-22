import { CheckCircleIcon } from "@/components/icons";

const STEPS = ["Proses", "Pembayaran", "invoice"] as const;

export default function ProgressSteps({ doneCount }: { doneCount: 0 | 1 | 3 }) {
  return (
    <div className="bg-white rounded-3xl p-[14px] w-full">
      <div className="flex items-center justify-center w-full">
        {STEPS.map((label, index) => {
          const isDone = index < doneCount;
          return (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-[9px] shrink-0">
                {isDone ? (
                  <CheckCircleIcon className="size-5 text-brand-500 shrink-0" />
                ) : (
                  <span className="size-5 rounded-full border border-neutral-300 shrink-0" />
                )}
                <span
                  className={`text-[11px] font-medium whitespace-nowrap ${
                    isDone ? "text-brand-500" : "text-neutral-500"
                  }`}
                >
                  {label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div className="flex-1 h-0 border-t border-dashed border-neutral-300 mx-[7px]" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
