import { Link } from "@tanstack/react-router";
import { BadgeDollarSign, House, NotebookPen, PiggyBank, UsersRound } from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Home", icon: House, exact: true },
  { to: "/log", label: "Log", icon: NotebookPen, exact: false },
  { to: "/jar", label: "Jar", icon: PiggyBank, exact: false },
  { to: "/circle", label: "Circle", icon: UsersRound, exact: false },
  { to: "/sell", label: "Sell", icon: BadgeDollarSign, exact: false },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-line bg-card px-4 py-6 md:flex">
        <p className="px-3 font-display text-3xl leading-none">Between us</p>
        <p className="mt-2 px-3 text-sm text-muted">Friends. No interest.</p>
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map((item) => (
            <SideLink key={item.to} item={item} />
          ))}
        </nav>
        <p className="mt-auto px-3 text-xs leading-relaxed text-muted">
          The spare change from every bill can sit in the jar until you give it away.
        </p>
      </aside>
      <div className="mx-auto w-full max-w-2xl px-4 pt-5 pb-28 md:pt-8 md:pr-8 md:pb-16 md:pl-64">
        <p className="mb-5 font-display text-2xl md:hidden">Between us</p>
        {children}
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-card md:hidden">
        {NAV.map((item) => (
          <BottomLink key={item.to} item={item} />
        ))}
      </nav>
    </div>
  );
}

function SideLink({ item }: { item: (typeof NAV)[number] }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      activeOptions={{ exact: item.exact }}
      inactiveProps={{
        className: "flex h-11 items-center gap-3 rounded-2xl px-3 text-sm text-muted",
      }}
      activeProps={{
        className: "flex h-11 items-center gap-3 rounded-2xl px-3 text-sm bg-ink text-paper",
      }}
    >
      <Icon className="size-4" strokeWidth={1.75} aria-hidden />
      {item.label}
    </Link>
  );
}

function BottomLink({ item }: { item: (typeof NAV)[number] }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      activeOptions={{ exact: item.exact }}
      inactiveProps={{
        className: "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs text-muted",
      }}
      activeProps={{
        className: "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs text-ink",
      }}
    >
      <Icon className="size-5" strokeWidth={1.75} aria-hidden />
      {item.label}
    </Link>
  );
}
