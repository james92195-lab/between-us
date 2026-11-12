import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { handleBooks } from "@/lib/books/http.server";

async function handle({ request }: { request: Request }) {
  return handleBooks(request);
}

export const Route = createFileRoute("/api/books/$")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
    },
  },
});
