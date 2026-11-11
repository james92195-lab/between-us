import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/shell";
import { Alert, Field, PrimaryButton, fieldClass } from "@/components/ui";
import { authClient } from "@/lib/auth/client";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-up");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    const result =
      mode === "sign-up"
        ? await authClient.signUp.email({ email, password, name: name.trim() || email })
        : await authClient.signIn.email({ email, password });
    if (result.error) {
      setError(result.error.message ?? "Sign-in failed.");
      return;
    }
    await navigate({ to: "/" });
  }

  return (
    <Shell mode="account">
      <p className="text-xs font-medium tracking-widest text-ember uppercase">Account</p>
      <h1 className="mt-2 font-display text-4xl">{mode === "sign-up" ? "Create an account" : "Sign in"}</h1>
      <p className="mt-2 max-w-md text-sm text-muted">
        Password is stored by Better Auth as a hash. This does not create a Dwolla account, and it does not send email.
      </p>
      <form
        className="mt-5 flex max-w-md flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {mode === "sign-up" ? (
          <Field label="Name">
            <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ada" />
          </Field>
        ) : null}
        <Field label="Email">
          <input type="email" autoComplete="email" className={fieldClass} value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field label="Password">
          <input
            type="password"
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
            className={fieldClass}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        {error ? <Alert>{error}</Alert> : null}
        <PrimaryButton type="submit">{mode === "sign-up" ? "Create account" : "Sign in"}</PrimaryButton>
      </form>
      <button
        type="button"
        className="mt-4 text-sm text-ember"
        onClick={() => setMode(mode === "sign-up" ? "sign-in" : "sign-up")}
      >
        {mode === "sign-up" ? "I already have an account" : "Create an account"}
      </button>
    </Shell>
  );
}
