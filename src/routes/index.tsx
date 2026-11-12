import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { Alert, Field, PrimaryButton, fieldClass } from "@/components/ui";
import { OfflineHome } from "@/components/offline-home";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { signOut } from "@/lib/auth/client";
import { staticHost } from "@/lib/static-host";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  if (staticHost) return <OfflineHome />;
  return <AccountHome />;
}

function AccountHome() {
  const { user, isPending } = useCurrentUserState();
  const [circles, setCircles] = useState<{ id: string; name: string }[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    void fetch("/api/books/circles", { credentials: "include" })
      .then((response) => response.json())
      .then((body: { ok: boolean; circles?: { id: string; name: string }[]; error?: string }) => {
        if (!body.ok) setError(body.error ?? "Could not load circles.");
        else setCircles(body.circles ?? []);
      })
      .catch(() => setError("The book server is not reachable."));
  }, [user]);

  if (isPending) {
    return (
      <Shell mode="account">
        <p className="text-muted">Checking your session…</p>
      </Shell>
    );
  }
  if (!user) return <Navigate to="/login" />;

  async function createCircle() {
    const response = await fetch("/api/books/circles", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const body = (await response.json()) as { ok: boolean; id?: string; error?: string };
    if (!body.ok || !body.id) {
      setError(body.error ?? "Could not create the circle.");
      return;
    }
    setName("");
    setCircles((current) => [...current, { id: body.id as string, name: name.trim() }]);
  }

  return (
    <Shell mode="account">
      <header className="mb-6">
        <p className="text-xs font-medium tracking-widest text-ember uppercase">Signed in</p>
        <h1 className="mt-2 font-display text-4xl">Your circles</h1>
        <p className="mt-2 text-sm text-muted">
          {user.primaryEmail}. Votes are your account, not a name picked on the page. Money still does not move.
        </p>
      </header>
      {error ? <Alert>{error}</Alert> : null}
      <ul className="mb-4 flex flex-col gap-2">
        {circles.length === 0 ? <li className="text-sm text-muted">No circles yet.</li> : null}
        {circles.map((circle) => (
          <li key={circle.id}>
            <Link to="/circles/$circleId" params={{ circleId: circle.id }} className="block rounded-2xl border border-line bg-card px-4 py-3 font-medium">
              {circle.name}
            </Link>
          </li>
        ))}
      </ul>
      <form
        className="mb-4 flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void createCircle();
        }}
      >
        <Field label="New circle">
          <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="House" />
        </Field>
        <PrimaryButton type="submit" className="sm:mt-6">
          Create
        </PrimaryButton>
      </form>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link to="/offline" className="text-ember">
          Offline notebook
        </Link>
        <button type="button" className="text-muted" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </Shell>
  );
}

