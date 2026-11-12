import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

export const Route = createFileRoute("/healthz")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          const sql = await getSql();
          await sql`select 1 as ok`;
        } catch {
          return new Response("database unavailable", {
            status: 503,
            headers: { "content-type": "text/plain" },
          });
        }
        const headers = new Headers({ "content-type": "text/plain" });
        if (request.headers.get("x-trust-probe") === "1") {
          headers.set("x-request-url", new URL(request.url).origin);
        }
        return new Response("ok", { status: 200, headers });
      },
    },
  },
});
