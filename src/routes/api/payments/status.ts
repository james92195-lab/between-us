import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { paymentStatusBody } from "@/lib/payments/assess";

export const Route = createFileRoute("/api/payments/status")({
  server: {
    handlers: {
      GET: async () => Response.json(paymentStatusBody()),
    },
  },
});
