import { createFileRoute } from "@tanstack/react-router";

const SETUP_TOKEN = "rq-setup-6f2c9a41-provision";

const ACCOUNTS = [
  { email: "owner@reservalq.com", password: "RQ-Owner#2026!Vault", full_name: "Hotel Owner", job_title: "Owner", role: "owner" },
  { email: "manager@reservalq.com", password: "RQ-Manager#2026!Desk", full_name: "Hotel Manager", job_title: "Front Desk Manager", role: "front_desk_manager" },
  { email: "sales@reservalq.com", password: "RQ-Sales#2026!Growth", full_name: "Sales Manager", job_title: "Sales Manager", role: "sales_manager" },
];

export const Route = createFileRoute("/api/public/setup-accounts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (request.headers.get("x-setup-token") !== SETUP_TOKEN) {
          return new Response("Forbidden", { status: 403 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const results: Record<string, string> = {};
        for (const account of ACCOUNTS) {
          const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: account.email,
            password: account.password,
            email_confirm: true,
            user_metadata: { full_name: account.full_name, job_title: account.job_title, role: account.role },
          });
          results[account.email] = error ? error.message : (data.user?.id ?? "created");
        }
        return Response.json(results);
      },
    },
  },
});
