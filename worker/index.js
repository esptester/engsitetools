// EngSiteTools Worker.
// Static pages are served by Workers static assets. This script only handles
// POST /api/contact: it checks Cloudflare Turnstile, then emails the message to
// support@engsitetools.com through the CONTACT_EMAIL send_email binding, which
// wrangler.jsonc restricts to that one address.

const TURNSTILE_ACTION = "contact";
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TO = "support@engsitetools.com";
const FROM = { email: "website@forms.engsitetools.com", name: "EngSiteTools website" };
const MAX_BODY_CHARS = 32 * 1024;
const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;

const TOPICS = {
  support: "Support",
  partnership: "Partnership",
  idea: "Tool idea",
  earthworks: "Earthworks visualisation",
  equipment: "3D equipment models",
  other: "General enquiry",
};

const FIELDS = {
  name: { max: 100 },
  email: { max: 254 },
  company: { max: 120 },
  message: { max: 5000, multiline: true },
};

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/contact") {
      if (request.method !== "POST") {
        return json({ ok: false, error: "method_not_allowed" }, 405, { Allow: "POST" });
      }
      return handleContact(request, env);
    }
    if (pathname.startsWith("/api/")) {
      return json({ ok: false, error: "not_found" }, 404);
    }

    // Anything else that didn't match a file: let the assets layer answer (404 page).
    return env.ASSETS.fetch(request);
  },
};

async function handleContact(request, env) {
  const type = (request.headers.get("Content-Type") || "").toLowerCase();
  if (!type.startsWith("application/json")) {
    return json({ ok: false, error: "unsupported_media_type" }, 415);
  }

  let body;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_CHARS) return json({ ok: false, error: "too_large" }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ ok: false, error: "bad_request" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ ok: false, error: "bad_request" }, 400);
  }

  // Bot check first. Fails closed on any error.
  if (!(await passesTurnstile(body.turnstileToken, request, env))) {
    return json({ ok: false, error: "verification_failed" }, 403);
  }

  // Honeypot: people never see this field, so anything in it is a bot. Pretend it worked.
  if (typeof body.extra_info === "string" && body.extra_info.trim() !== "") {
    return json({ ok: true });
  }

  const { values, errors } = validate(body);
  if (errors.length > 0) {
    return json({ ok: false, error: "invalid", fields: errors }, 400);
  }

  const topic = TOPICS[values.topic];
  // No visitor details in the subject (it appears in Cloudflare's delivery logs). The
  // short reference keeps each enquiry in its own thread in the inbox.
  const ref = crypto.randomUUID().slice(0, 6).toUpperCase();
  try {
    await env.CONTACT_EMAIL.send({
      to: TO,
      from: FROM,
      replyTo: { email: values.email, name: values.name },
      subject: `Website enquiry: ${topic} (#${ref})`,
      text: buildText(values, topic),
      html: buildHtml(values, topic),
    });
  } catch (err) {
    // Log the error code only, never the message contents.
    console.error("contact: send failed", (err && err.code) || "unknown");
    return json({ ok: false, error: "send_failed" }, 502);
  }

  return json({ ok: true });
}

async function passesTurnstile(token, request, env) {
  const hostnames = new Set(
    String(env.TURNSTILE_HOSTNAMES || "")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean),
  );
  if (!env.TURNSTILE_SECRET || hostnames.size === 0) return false;
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) return false;

  const form = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) form.set("remoteip", ip);

  let result;
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return false;
    result = await res.json();
  } catch {
    return false;
  }

  if (result.success !== true || !hostnames.has(result.hostname)) {
    console.warn("contact: turnstile rejected", result["error-codes"] || []);
    return false;
  }
  if (result.action === TURNSTILE_ACTION) return true;

  // Cloudflare's published test keys return no action. Accept them only when a
  // local .dev.vars file turns this on; production never sets it.
  return env.TURNSTILE_ALLOW_TEST_KEYS === "true" && result.metadata?.result_with_testing_key === true;
}

function readField(body, key, { max, multiline = false }) {
  const raw = body[key];
  if (raw === undefined || raw === null) return "";
  if (typeof raw !== "string") return null;
  let value = raw.replace(/\r\n?/g, "\n");
  if (multiline) {
    value = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  } else {
    value = value.replace(/[\u0000-\u001F\u007F]+/g, " ").replace(/\s+/g, " ").trim();
  }
  return value.length > max ? null : value;
}

function validate(body) {
  const values = {};
  const errors = [];

  for (const [key, rule] of Object.entries(FIELDS)) {
    const value = readField(body, key, rule);
    if (value === null) errors.push(key);
    else values[key] = value;
  }

  values.topic = typeof body.topic === "string" && Object.hasOwn(TOPICS, body.topic) ? body.topic : "";
  if (!values.topic) errors.push("topic");
  if (!values.name) errors.push("name");
  if (!EMAIL_RE.test(values.email || "")) errors.push("email");

  if (!values.message) errors.push("message");

  return { values, errors: [...new Set(errors)] };
}

function buildText(v, topic) {
  const lines = [
    "New message from the contact form on engsitetools.com.",
    "",
    `Topic: ${topic}`,
    `Name: ${v.name}`,
    `Email: ${v.email}`,
  ];
  if (v.company) lines.push(`Company: ${v.company}`);
  lines.push("", "Message:", v.message);
  lines.push("", `Reply to this email to answer ${v.name} directly.`);
  return lines.join("\n");
}

function buildHtml(v, topic) {
  const cell = "padding:6px 0;vertical-align:top";
  const rows = [
    ["Topic", topic],
    ["Name", v.name],
    ["Email", v.email],
    ["Company", v.company],
  ]
    .filter(([, value]) => value)
    .map(
      ([label, value]) =>
        `<tr><th align="left" style="${cell};padding-right:16px;color:#6b6f78;font-weight:600">${esc(label)}</th><td style="${cell}">${esc(value)}</td></tr>`,
    )
    .join("");
  const message = `<p style="margin:20px 0 6px;color:#6b6f78;font-weight:600">Message</p><div style="white-space:pre-wrap">${esc(v.message)}</div>`;
  return (
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#16171a">` +
    `<p style="margin:0 0 16px">New message from the contact form on engsitetools.com.</p>` +
    `<table cellpadding="0" cellspacing="0" border="0">${rows}</table>${message}` +
    `<p style="margin:24px 0 0;color:#6b6f78">Reply to this email to answer ${esc(v.name)} directly.</p></div>`
  );
}

function esc(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}
