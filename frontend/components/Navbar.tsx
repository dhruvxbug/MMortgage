"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { WalletConnectButton } from "@/components/WalletConnectButton";

type NavItem = {
  href: string;
  label: string;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/open", label: "Open" },
];

function LogoMark() {
  return (
    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-zinc-950 bg-[#F7931A] text-zinc-950">
      <span className="text-[26px] font-semibold leading-none">₿</span>
    </span>
  );
}

function isActive(pathname: string, href: string): boolean {
  return pathname.startsWith(href);
}

export default function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 px-4 pt-5 sm:px-6 lg:px-10">
      <div className="mx-auto w-full max-w-[1920px] rounded-[34px] border border-zinc-800 bg-zinc-950/95 px-5 py-4 text-white shadow-[0_10px_30px_rgba(0,0,0,0.24)] backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-4">
            <LogoMark />
            <span className="text-3xl font-bold tracking-tight sm:text-4xl">mezoMortgage</span>
          </Link>

          <nav className="hidden items-center gap-12 lg:flex">
            {navItems.map((item) => {
              const active = isActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-xl font-semibold tracking-tight transition ${
                    active ? "text-[#F7931A]" : "text-zinc-200 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden lg:block">
            <WalletConnectButton className="px-8 text-base" />
          </div>

          <button
            type="button"
            onClick={() => setIsOpen((current) => !current)}
            className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-white lg:hidden"
            aria-label="Toggle navigation menu"
          >
            <div className="space-y-1.5">
              <span className="block h-0.5 w-6 bg-current" />
              <span className="block h-0.5 w-6 bg-current" />
              <span className="block h-0.5 w-6 bg-current" />
            </div>
          </button>
        </div>

        {isOpen ? (
          <div className="mt-4 border-t border-zinc-800 pt-4 lg:hidden">
            <div className="flex flex-col gap-3">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base font-semibold text-zinc-100"
                  onClick={() => setIsOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <WalletConnectButton className="w-full" />
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
