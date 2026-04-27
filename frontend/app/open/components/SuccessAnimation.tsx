export default function SuccessAnimation() {
  return (
    <div className="relative flex items-center justify-center">
      <div className="absolute h-28 w-28 animate-ping rounded-full border border-[#F7931A]/40 bg-[#F7931A]/10" />
      <div className="absolute h-40 w-40 rounded-full border border-zinc-800" />
      <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-2 border-[#F7931A] bg-[#F7931A] text-zinc-950 shadow-frame">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-12 w-12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12.5 9.2 17 19 7.5" />
        </svg>
      </div>
    </div>
  );
}
