// Contact form: topic fields, Cloudflare Turnstile, and sending to /api/contact.
(() => {
  const form = document.getElementById("contact-form");
  if (!form) return;

  const EMAIL = "support@engsitetools.com";
  // Cloudflare's always-pass test sitekey, used only when the site runs on this computer.
  const TEST_SITEKEY = "1x00000000000000000000AA";
  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);

  const formBody = document.querySelector("[data-form-body]");
  const success = document.querySelector("[data-form-success]");
  const successTitle = success.querySelector("[data-success-title]");
  const successText = success.querySelector("[data-success-text]");
  const title = document.getElementById("message-title");
  const status = form.querySelector("[data-form-status]");
  const submit = form.querySelector('button[type="submit"]');
  const submitLabel = submit.textContent;
  const topic = form.elements.topic;
  const slot = form.querySelector("[data-turnstile]");

  let widgetId;
  let turnstileFailed = false;
  let sending = false;

  const setTopic = (value) => {
    if ([...topic.options].some((option) => option.value === value && !option.disabled)) {
      topic.value = value;
      return true;
    }
    return false;
  };

  const showForm = () => {
    document.getElementById("message").scrollIntoView();
    title.focus({ preventScroll: true });
  };

  // Links pick a topic with /contact#earthworks (one address for search engines).
  // Older ?topic= links still work.
  title.setAttribute("tabindex", "-1");
  const fromHash = setTopic(decodeURIComponent(window.location.hash.slice(1)));
  const fromQuery = setTopic(new URLSearchParams(window.location.search).get("topic"));
  if (fromHash) requestAnimationFrame(showForm);

  // Topic links ("Send a support request" and so on) pick the topic and jump to the form.
  document.querySelectorAll("a[data-topic]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      setTopic(link.dataset.topic);
      history.replaceState(null, "", `${location.pathname}#${encodeURIComponent(link.dataset.topic)}`);
      showForm();
    });
  });
  if (fromQuery) history.replaceState(null, "", `${location.pathname}#${encodeURIComponent(topic.value)}`);
  window.addEventListener("hashchange", () => {
    if (setTopic(decodeURIComponent(window.location.hash.slice(1)))) showForm();
  });

  const setStatus = (text, { error = false, emailFallback = false } = {}) => {
    status.classList.toggle("is-error", error);
    status.replaceChildren(text);
    if (emailFallback) {
      const link = document.createElement("a");
      link.href = `mailto:${EMAIL}`;
      link.textContent = EMAIL;
      status.append(" ", link, ".");
    }
  };

  const clearInvalid = () => {
    form.querySelectorAll('[aria-invalid="true"]').forEach((el) => el.removeAttribute("aria-invalid"));
  };

  const markInvalid = (names) => {
    let first;
    names.forEach((name) => {
      const field = form.elements[name];
      if (field && !field.disabled && field.setAttribute) {
        field.setAttribute("aria-invalid", "true");
        first = first || field;
      }
    });
    if (first) first.focus();
  };

  form.addEventListener("input", (event) => {
    if (event.target.removeAttribute) event.target.removeAttribute("aria-invalid");
  });

  // Cloudflare Turnstile: checks the sender is a person. It stays hidden unless it needs a click.
  window.onContactTurnstileLoad = () => {
    widgetId = window.turnstile.render(slot, {
      sitekey: isLocal ? TEST_SITEKEY : slot.dataset.sitekey,
      action: "contact",
      theme: "light",
      size: "flexible",
      appearance: "interaction-only",
      "response-field": false,
      "error-callback": () => {
        turnstileFailed = true;
        return true;
      },
      callback: () => {
        turnstileFailed = false;
      },
    });
  };

  const script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onContactTurnstileLoad&render=explicit";
  script.async = true;
  script.addEventListener("error", () => {
    turnstileFailed = true;
  });
  document.head.append(script);

  submit.disabled = false;

  const showSuccess = ({ name, email }) => {
    const first = String(name || "").trim().split(/\s+/)[0];
    successTitle.textContent = first ? `Thanks, ${first}. Your message is on its way.` : "Thanks. Your message is on its way.";
    successText.textContent = `We'll reply to ${email}.`;
    formBody.hidden = true;
    success.hidden = false;
    successTitle.focus();
  };

  success.querySelector("[data-form-again]").addEventListener("click", () => {
    form.reset();
    setStatus("");
    success.hidden = true;
    formBody.hidden = false;
    form.elements.name.focus();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending) return;
    clearInvalid();

    const token = widgetId === undefined ? "" : window.turnstile.getResponse(widgetId) || "";
    if (!token) {
      if (turnstileFailed) {
        setStatus("The security check couldn't load, so the form can't send. Please email us at", {
          error: true,
          emailFallback: true,
        });
      } else {
        setStatus("The security check is still running. Please wait a moment, then send again.", { error: true });
      }
      return;
    }

    const payload = Object.fromEntries(new FormData(form));
    payload.turnstileToken = token;

    sending = true;
    submit.disabled = true;
    submit.textContent = "Sending…";
    setStatus("Sending your message…");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(() => ({}));

      if (res.ok && result.ok === true) {
        setStatus("");
        showSuccess(payload);
      } else if (res.status === 400 && Array.isArray(result.fields)) {
        setStatus("Please check the highlighted fields.", { error: true });
        markInvalid(result.fields);
      } else if (res.status === 403) {
        setStatus("We couldn't confirm you're a person. Please try sending again.", { error: true });
      } else {
        setStatus("Sorry, your message didn't send. Please try again, or email us at", {
          error: true,
          emailFallback: true,
        });
      }
    } catch {
      setStatus("Sorry, your message didn't send. Please check your connection and try again, or email us at", {
        error: true,
        emailFallback: true,
      });
    } finally {
      sending = false;
      submit.disabled = false;
      submit.textContent = submitLabel;
      // Turnstile tokens work once, so get a fresh one for any retry.
      if (widgetId !== undefined) window.turnstile.reset(widgetId);
    }
  });
})();
