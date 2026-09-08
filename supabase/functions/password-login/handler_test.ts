import { deepEqual, equal, ok } from "node:assert/strict";
import { createPasswordLoginHandler } from "./handler.ts";

const config = {
  supabaseUrl: "https://test.supabase.co",
  serviceRoleKey: "test-server-credential",
};
const session = { access_token: "user-access", refresh_token: "user-refresh" };

function request(
  body: unknown = { email: "parent@example.test", password: "password" },
) {
  return new Request("http://localhost/password-login", {
    method: "POST",
    headers: {
      origin: "https://www.bufib-kinder.de",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

const unexpectedFetch: typeof fetch = () => {
  throw new Error("Supabase must not be called for this request");
};

Deno.test("logs in without captcha, forwards only credentials and returns only user tokens", async () => {
  let called = false;
  const handler = createPasswordLoginHandler(config, (url, options) => {
    called = true;
    equal(url, "https://test.supabase.co/auth/v1/token?grant_type=password");
    equal(options?.method, "POST");
    const headers = new Headers(options?.headers);
    equal(headers.get("authorization"), `Bearer ${config.serviceRoleKey}`);
    equal(headers.get("apikey"), config.serviceRoleKey);
    deepEqual(JSON.parse(String(options?.body)), {
      email: "parent@example.test",
      password: " password ",
    });
    ok(options?.signal instanceof AbortSignal);
    return Promise.resolve(
      Response.json({ ...session, user: { email: "private" } }),
    );
  });
  const response = await handler(request({
    email: " PARENT@example.test ",
    password: " password ",
    grant_type: "refresh_token",
    refresh_token: "injected",
    role: "service_role",
    redirectTo: "https://untrusted.test",
    captchaToken: "unused",
  }));
  equal(response.status, 200);
  deepEqual(await response.json(), { session });
  equal(response.headers.get("Cache-Control"), "no-store");
  equal(
    response.headers.get("Access-Control-Allow-Origin"),
    "https://www.bufib-kinder.de",
  );
  ok(called);
});

Deno.test("rejects invalid credentials and preserves confirmation and rate-limit errors", async () => {
  for (
    const [status, result, expectedStatus, message] of [
      [
        400,
        { error_code: "invalid_credentials" },
        400,
        "E-Mail-Adresse oder Passwort ist falsch.",
      ],
      [
        400,
        { error_code: "email_not_confirmed" },
        400,
        "Bitte bestätige zuerst deine E-Mail-Adresse.",
      ],
      [
        403,
        { error_code: "user_banned" },
        400,
        "E-Mail-Adresse oder Passwort ist falsch.",
      ],
      [
        429,
        {},
        429,
        "Zu viele Anmeldeversuche. Bitte versuche es später erneut.",
      ],
      [500, {}, 503, "Die Anmeldung ist zurzeit nicht verfügbar."],
    ] as const
  ) {
    const handler = createPasswordLoginHandler(
      config,
      () => Promise.resolve(Response.json(result, { status })),
    );
    const response = await handler(request());
    equal(response.status, expectedStatus);
    deepEqual(await response.json(), { error: message });
  }
});

Deno.test("rejects missing and malformed input before calling Auth", async () => {
  const handler = createPasswordLoginHandler(config, unexpectedFetch);
  for (
    const body of [
      null,
      [],
      {},
      { email: "a", password: "" },
      { email: " ", password: "b" },
      { email: true, password: "b" },
      { email: "a", password: {} },
      { email: "a", password: "b".repeat(4097) },
    ]
  ) {
    equal((await handler(request(body))).status, 400);
  }
  equal(
    (await handler(
      new Request("http://localhost", { method: "POST", body: "{" }),
    )).status,
    400,
  );
});

Deno.test("handles browser preflight, blocks unapproved origins and permits native login", async () => {
  const handler = createPasswordLoginHandler(config, unexpectedFetch);
  const options = await handler(
    new Request("http://localhost", {
      method: "OPTIONS",
      headers: { origin: "https://www.bufib-kinder.de" },
    }),
  );
  equal(options.status, 204);
  equal(options.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
  equal((await handler(new Request("http://localhost"))).status, 405);
  const blocked = await handler(
    new Request("http://localhost", {
      method: "POST",
      headers: { origin: "https://untrusted.test" },
    }),
  );
  equal(blocked.status, 403);
  equal(blocked.headers.get("Access-Control-Allow-Origin"), null);
  const nativeRequest = request();
  nativeRequest.headers.delete("origin");
  const nativeHandler = createPasswordLoginHandler(
    config,
    () => Promise.resolve(Response.json(session)),
  );
  equal((await nativeHandler(nativeRequest)).status, 200);
});

Deno.test("never returns a session on network errors, malformed responses or missing configuration", async () => {
  for (
    const fetcher of [
      () => Promise.reject(new Error("network")),
      () => Promise.resolve(new Response("invalid JSON")),
      () => Promise.resolve(Response.json({ access_token: "partial" })),
    ]
  ) {
    const response = await createPasswordLoginHandler(config, fetcher)(
      request(),
    );
    ok(response.status >= 500);
    equal((await response.json()).session, undefined);
  }
  for (const key of ["supabaseUrl", "serviceRoleKey"] as const) {
    equal(
      (await createPasswordLoginHandler(
        { ...config, [key]: "" },
        unexpectedFetch,
      )(request())).status,
      503,
    );
  }
});
