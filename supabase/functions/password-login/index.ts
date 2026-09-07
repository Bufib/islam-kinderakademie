import { createPasswordLoginHandler } from "./handler.ts";

Deno.serve(createPasswordLoginHandler({
  supabaseUrl: Deno.env.get("SUPABASE_URL"),
  serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
}));
