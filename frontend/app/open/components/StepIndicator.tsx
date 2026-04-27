type StepIndicatorProps = {
  step: number;
  totalSteps: number;
  labels: string[];
};

export default function StepIndicator({
  step,
  totalSteps,
  labels,
}: StepIndicatorProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">
            Step {step} of {totalSteps}
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {labels[step - 1]}
          </h1>
        </div>
        <div className="rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300">
          {Math.round((step / totalSteps) * 100)}% complete
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {labels.map((label, index) => {
          const currentStep = index + 1;
          const state =
            currentStep < step
              ? "done"
              : currentStep === step
                ? "current"
                : "upcoming";

          return (
            <div
              key={label}
              className={`rounded-2xl border px-4 py-4 ${
                state === "done"
                  ? "border-[#F7931A] bg-[#F7931A] text-zinc-950"
                  : state === "current"
                    ? "border-zinc-600 bg-zinc-900 text-white"
                    : "border-zinc-800 bg-zinc-950 text-zinc-500"
              }`}
            >
              <div className="text-xs uppercase tracking-[0.18em]">Step {currentStep}</div>
              <div className="mt-2 text-sm font-semibold">{label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
