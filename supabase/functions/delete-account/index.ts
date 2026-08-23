import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const ALLOWED_ORIGINS = new Set([
  "https://bufib.github.io",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
]);

const RECENT_SIGN_IN_WINDOW_MS = 10 * 60 * 1000;

type ResponseBody = {
  success?: boolean;
  error?: string;
};

function requestOrigin(request: Request) {
  return request.headers.get("origin");
}

function isAllowedOrigin(origin: string | null) {
  return origin === null || ALLOWED_ORIGINS.has(origin);
}

function responseHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
  };

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] =
      "authorization, apikey, content-type, x-client-info";
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  }

  return headers;
}

function jsonResponse(
  origin: string | null,
  status: number,
  body: ResponseBody,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(origin),
  });
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);

  return match?.[1]?.trim() || null;
}

Deno.serve(async (request) => {
  const origin = requestOrigin(request);

  if (!isAllowedOrigin(origin)) {
    return jsonResponse(origin, 403, {
      error: "Diese Anfrage ist nicht erlaubt.",
    });
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: responseHeaders(origin),
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(origin, 405, { error: "Methode nicht erlaubt." });
  }

  const accessToken = bearerToken(request);

  if (!accessToken) {
    return jsonResponse(origin, 401, { error: "Anmeldung erforderlich." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("delete-account: required Supabase environment is missing");
    return jsonResponse(origin, 500, {
      error: "Der Account konnte nicht gelöscht werden.",
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  /*
   * getUser(accessToken) validiert die Signatur und Gültigkeit des Tokens am
   * Supabase-Auth-Server. Eine vom Client übermittelte User-ID wird bewusst
   * nicht akzeptiert.
   */
  const {
    data: { user },
    error: userError,
  } = await adminClient.auth.getUser(accessToken);

  if (userError || !user) {
    return jsonResponse(origin, 401, {
      error: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.",
    });
  }

  const lastSignInAt = Date.parse(user.last_sign_in_at ?? "");

  if (
    !Number.isFinite(lastSignInAt) ||
    Date.now() - lastSignInAt > RECENT_SIGN_IN_WINDOW_MS
  ) {
    return jsonResponse(origin, 403, {
      error: "Bitte bestätige dein Passwort erneut.",
    });
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(
    user.id,
  );

  if (deleteError) {
    console.error(
      "delete-account: Auth user deletion failed",
      deleteError.message,
    );

    const isLastAdmin = deleteError.message
      .toLowerCase()
      .includes("last admin");

    return jsonResponse(origin, isLastAdmin ? 409 : 500, {
      error: isLastAdmin
        ? "Das letzte Admin-Konto kann nicht gelöscht werden."
        : "Der Account konnte nicht gelöscht werden.",
    });
  }

  return jsonResponse(origin, 200, { success: true });
});
