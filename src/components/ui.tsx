import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export const fieldClass =
  "h-12 w-full rounded-2xl border border-line bg-card px-3 text-base outline-none";

export function PrimaryButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-12 items-center justify-center rounded-full bg-ink px-5 text-sm font-medium text-paper disabled:opacity-50",
        className,
      )}
    />
  );
}

export function QuietButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-12 items-center justify-center rounded-full border border-line bg-card px-4 text-sm disabled:opacity-50",
        className,
      )}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-muted">{label}</span>
      {children}
    </label>
  );
}

export function Alert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-2xl bg-ember/10 px-3 py-2 text-sm text-ember">
      {children}
    </p>
  );
}
