import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { decideDwollaWebhook, readDwollaEnv } from "@/lib/payments/dwolla";

export const Route = createFileRoute("/api/payments/dwolla/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const decision = await decideDwollaWebhook({
          rawBody,
          signature: request.headers.get("x-request-signature-sha-256"),
          secret: readDwollaEnv(process.env).webhookSecret,
        });
        return Response.json(decision, { status: decision.verified ? 200 : 401 });
      },
    },
  },
});
