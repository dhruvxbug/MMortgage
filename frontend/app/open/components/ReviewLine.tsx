type ReviewLineProps = {
  label: string;
  value: string;
  emphasis?: boolean;
};

export default function ReviewLine({
  label,
  value,
  emphasis = false,
}: ReviewLineProps) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-800 py-4 last:border-b-0">
      <div className="text-sm text-zinc-400">{label}</div>
      <div
        className={`max-w-[60%] text-right text-sm ${
          emphasis ? "font-semibold text-white" : "text-zinc-200"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
