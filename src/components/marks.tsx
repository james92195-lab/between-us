import { cn } from "@/lib/cn";

export function PersonMark({ name, you }: { name: string; you?: boolean }) {
  const letter = [...name.trim()][0]?.toUpperCase() ?? "?";
  return (
    <span
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full font-display text-lg leading-none",
        you ? "bg-ink text-paper" : "bg-ember/15 text-ember",
      )}
      aria-hidden
    >
      {letter}
    </span>
  );
}

export function JarArt({ ratio, compact = false }: { ratio: number; compact?: boolean }) {
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <div className={compact ? "relative h-28 w-24" : "relative mx-auto h-52 w-36"} aria-hidden>
      <div className="absolute top-0 left-1/2 h-2.5 w-10 -translate-x-1/2 rounded-full bg-ember" />
      <div className="absolute inset-x-1 top-3 bottom-0 overflow-hidden rounded-t-xl rounded-b-3xl border border-line bg-card">
        <div className="absolute inset-x-0 bottom-0 bg-ember/85" style={{ height: `${Math.round(clamped * 100)}%` }} />
        <span className="absolute bottom-8 left-5 size-7 rounded-full border border-ink/15 bg-paper" />
        <span className="absolute right-4 bottom-12 size-5 rounded-full border border-ink/15 bg-card" />
        <span className="absolute bottom-4 left-12 size-4 rounded-full bg-ink/80" />
      </div>
    </div>
  );
}
