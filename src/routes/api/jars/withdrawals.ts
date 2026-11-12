import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { assessWithdrawalPayload } from "@/lib/payments/assess";

export const Route = createFileRoute("/api/jars/withdrawals")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: unknown = null;
        try {
          payload = await request.json();
        } catch {
          payload = null;
        }
        const result = assessWithdrawalPayload(payload);
        return Response.json(result.body, { status: result.status });
      },
    },
  },
});