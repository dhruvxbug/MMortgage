import Link from "next/link";

function LinkedInIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 11v5" />
      <path d="M8 8h.01" />
      <path d="M12 16v-3a2 2 0 0 1 4 0v3" />
      <path d="M4 4h16v16H4z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16v12H4z" />
      <path d="m4 8 8 6 8-6" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="mx-auto mt-10 w-full max-w-[1920px] overflow-hidden rounded-[24px] border border-zinc-800">
      <div className="bg-[radial-gradient(circle_at_top,rgba(247,147,26,0.48),transparent_38%),radial-gradient(circle_at_78%_18%,rgba(251,191,36,0.22),transparent_42%),radial-gradient(circle_at_50%_100%,rgba(247,147,26,0.16),transparent_58%),linear-gradient(180deg,#18181b_0%,#09090b_100%)] px-5 py-8 sm:px-10 sm:py-10">
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm font-medium text-zinc-300 sm:text-base">
            Press
            <span className="mx-2 inline-flex items-center gap-2 rounded-full border border-[#F7931A]/50 bg-zinc-900 px-4 py-2 font-semibold text-zinc-100 shadow-sm">
              this
              <span className="rounded-md border border-zinc-600 px-1.5 py-0.5 text-xs text-[#F7931A]">↵</span>
            </span>
            to visit Contact Us page.
          </p>

          <div className="flex items-center gap-2">
            <Link
              href="https://www.linkedin.com"
              target="_blank"
              rel="noreferrer"
              aria-label="LinkedIn"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-200 transition hover:border-[#F7931A] hover:text-[#F7931A]"
            >
              <LinkedInIcon />
            </Link>
            <Link
              href="mailto:contact@mezomortgage.io"
              aria-label="Email"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-200 transition hover:border-[#F7931A] hover:text-[#F7931A]"
            >
              <MailIcon />
            </Link>
          </div>
        </div>

        <div className="mt-10">
          <h2 className="text-[clamp(2rem,13vw,9rem)] font-bold leading-[0.9] tracking-tight text-white bg-gradient-to-b from-white-100 via-[#F7931A] to-[#8a4700] bg-clip-text [mask-image:linear-gradient(to_bottom,rgba(0,0,0,1)_0%,rgba(0,0,0,0.8)_68%,rgba(0,0,0,0.2)_100%)]">
            mezoMortgage
          </h2>
        </div>
      </div>
    </footer>
  );
}
