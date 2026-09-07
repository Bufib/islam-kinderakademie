const ALLOWED_ORIGINS = new Set([
  "https://bufib.github.io",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
]);

type Config = { supabaseUrl?: string; serviceRoleKey?: string };

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function createPasswordLoginHandler(
  config: Config,
  fetcher: (url: string, options: RequestInit) => Promise<Response> = fetch,
) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("origin");
    const headers: Record<string, string> = {
      "Cache-Control": "no-store",
      Vary: "Origin",
    };
    if (origin && ALLOWED_ORIGINS.has(origin)) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Access-Control-Allow-Headers"] =
        "authorization, apikey, content-type, x-client-info";
      headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    }
    const fail = (status: number, error: string) =>
      Response.json({ error }, { status, headers });

    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return fail(403, "Diese Anfrage ist nicht erlaubt.");
    }
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== "POST") {
      return fail(405, "Methode nicht erlaubt.");
    }
    if (!config.supabaseUrl || !config.serviceRoleKey) {
      return fail(503, "Die Anmeldung ist zurzeit nicht verfügbar.");
    }

    let credentials: Record<string, unknown>;
    try {
      credentials = record(await request.json());
    } catch {
      return fail(400, "Ungültige Anfrage.");
    }
    const { email, password } = credentials;
    if (
      typeof email !== "string" || !email.trim() || email.length > 320 ||
      typeof password !== "string" || !password || password.length > 4096
    ) {
      return fail(400, "Bitte gib E-Mail-Adresse und Passwort ein.");
    }

    try {
      // Only the password grant is exposed. Supabase still checks credentials,
      // account confirmation/bans and Auth rate limits. The server credential
      // exempts this request from CAPTCHA; it never reaches the client.
      const response = await fetcher(
        `${
          config.supabaseUrl.replace(/\/$/, "")
        }/auth/v1/token?grant_type=password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: config.serviceRoleKey,
            Authorization: `Bearer ${config.serviceRoleKey}`,
          },
          body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!response.ok) {
        if (response.status === 429) {
          return fail(
            429,
            "Zu viele Anmeldeversuche. Bitte versuche es später erneut.",
          );
        }
        if (response.status >= 500) {
          return fail(503, "Die Anmeldung ist zurzeit nicht verfügbar.");
        }
        const result = record(await response.json());
        return fail(
          400,
          result.error_code === "email_not_confirmed"
            ? "Bitte bestätige zuerst deine E-Mail-Adresse."
            : "E-Mail-Adresse oder Passwort ist falsch.",
        );
      }

      const result = record(await response.json());
      if (
        typeof result.access_token !== "string" || !result.access_token ||
        typeof result.refresh_token !== "string" || !result.refresh_token
      ) {
        return fail(502, "Die Anmeldung konnte nicht abgeschlossen werden.");
      }
      return Response.json({
        session: {
          access_token: result.access_token,
          refresh_token: result.refresh_token,
        },
      }, { headers });
    } catch {
      return fail(503, "Die Anmeldung ist zurzeit nicht verfügbar.");
    }
  };
}
