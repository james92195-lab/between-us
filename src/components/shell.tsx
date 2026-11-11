import { Link } from "@tanstack/react-router";
import { HandCoins, House, NotebookPen, PiggyBank, UsersRound, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { useBook } from "@/lib/book-store";
import { useBookHydrated } from "@/components/use-book-hydrated";

const NAV = [
  { to: "/", label: "Home", icon: House, exact: true },
  { to: "/loans", label: "Loans", icon: HandCoins, exact: false },
  { to: "/jars", label: "Jar", icon: PiggyBank, exact: false },
  { to: "/people", label: "Circle", icon: UsersRound, exact: false },
  { to: "/payments", label: "Pay", icon: Wallet, exact: false },
] as const;

const ACCOUNT_NAV = [
  { to: "/", label: "Home", icon: House, exact: true },
  { to: "/offline", label: "Offline", icon: NotebookPen, exact: false },
] as const;

export function Shell({ children, mode = "offline" }: { children: ReactNode; mode?: "offline" | "account" }) {
  const nav = mode === "account" ? ACCOUNT_NAV : NAV;
  const ready = useBookHydrated();
  const warning = useBook((state) => state.storageWarning);
  return (
    <div className="min-h-screen bg-paper text-ink">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-line bg-card px-4 py-6 md:flex">
        <p className="px-3 font-display text-3xl leading-none">Between us</p>
        <p className="mt-2 px-3 text-sm text-muted">Friends. No interest.</p>
        <nav className="mt-8 flex flex-col gap-1">
          {nav.map((item) => (
            <SideLink key={item.to} item={item} />
          ))}
        </nav>
        <p className="mt-auto px-3 text-xs leading-relaxed text-muted">
          {mode === "account"
            ? "Signed-in votes are stored for the circle. Three yeses still do not send a bank transfer."
            : "Offline notebook only. These names are not accounts."}
        </p>
      </aside>
      <div className="mx-auto w-full max-w-2xl px-4 pt-5 pb-28 md:pt-8 md:pr-8 md:pb-16 md:pl-64">
        <p className="mb-5 font-display text-2xl md:hidden">Between us</p>
        {mode === "offline" ? (
          <p className="mb-4 rounded-2xl border border-ember/30 bg-card px-3 py-2 text-sm">
            Offline notebook. These names are not accounts, and a yes here is not an approval. A shared jar with signed-in friends needs the server. This public Pages copy cannot do that.
          </p>
        ) : null}
        {warning ? (
          <p role="alert" className="mb-4 rounded-2xl border border-ember/40 bg-ember/10 px-3 py-2 text-sm">
            {warning}
          </p>
        ) : null}
        {mode === "account" || ready ? children : <p className="text-muted">Opening the book…</p>}
      </div>
      <nav
        className={`fixed inset-x-0 bottom-0 z-20 grid border-t border-line bg-card md:hidden ${mode === "account" ? "grid-cols-2" : "grid-cols-5"}`}
      >
        {nav.map((item) => (
          <BottomLink key={item.to} item={item} />
        ))}
      </nav>
    </div>
  );
}

function SideLink({ item }: { item: (typeof NAV)[number] | (typeof ACCOUNT_NAV)[number] }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      activeOptions={{ exact: item.exact }}
      inactiveProps={{ className: "flex h-11 items-center gap-3 rounded-2xl px-3 text-sm text-muted" }}
      activeProps={{ className: "flex h-11 items-center gap-3 rounded-2xl bg-ink px-3 text-sm text-paper" }}
    >
      <Icon className="size-4" strokeWidth={1.75} aria-hidden />
      {item.label}
    </Link>
  );
}

function BottomLink({ item }: { item: (typeof NAV)[number] | (typeof ACCOUNT_NAV)[number] }) {
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
