import crypto from "node:crypto";
import nodemailer from "nodemailer";
import twilio from "twilio";

function createAlerts(env = process.env, adapters = {}) {
  const history = [];
  const last = new Map();
  const pending = new Set();

  const enabled = (key) => env[key] === "true";

  function configured(channel) {
    return channel === "email"
      ? [
          "SMTP_HOST",
          "SMTP_USER",
          "SMTP_PASS",
          "ALERT_EMAIL_FROM",
          "ALERT_EMAIL_TO",
        ].every((k) => !!env[k])
      : [
          "TWILIO_ACCOUNT_SID",
          "TWILIO_AUTH_TOKEN",
          "TWILIO_FROM",
          "ALERT_SMS_TO",
        ].every((k) => !!env[k]);
  }

  function status() {
    return {
      emailConfigured: configured("email"),
      smsConfigured: configured("sms"),
      automaticEmail: enabled("AUTO_EMAIL_ALERTS"),
      automaticSms: enabled("AUTO_SMS_ALERTS"),
      recipientConfirmed: enabled("ALERT_RECIPIENT_OPT_IN"),
      history: [...history],
    };
  }

  async function deliver(channel, source) {
    if (!["email", "sms"].includes(channel)) {
      throw new Error("Invalid channel");
    }

    if (!enabled("ALERT_RECIPIENT_OPT_IN")) {
      return {
        channel,
        status: "disabled",
        message: "Confirm recipient consent in backend configuration.",
      };
    }

    if (!configured(channel)) {
      return {
        channel,
        status: "not_configured",
        message: "Complete provider settings in backend .env.",
      };
    }

    if (
      pending.has(channel) ||
      Date.now() - (last.get(channel) || 0) < 60000
    ) {
      return {
        channel,
        status: "throttled",
        message: "Wait 60 seconds before another alert on this channel.",
      };
    }

    pending.add(channel);
    last.set(channel, Date.now());

    const entry = {
      id: crypto.randomUUID(),
      channel,
      source,
      createdAt: new Date().toISOString(),
      status: "failed",
    };

    const text =
      source === "automatic"
        ? "Flood-risk demo: a screening received a High model label. Review the application. Synthetic-data model output; not a medical diagnosis."
        : "Flood-risk demo: an administrator requested a manual alert. Review the application.";

    try {
      if (channel === "email") {
        const send =
          adapters.email ||
          (async (message) => {
            const transporter = nodemailer.createTransport({
              host: env.SMTP_HOST,
              port: Number(env.SMTP_PORT || 587),
              secure: env.SMTP_PORT === "465",
              requireTLS: env.SMTP_PORT !== "465",
              auth: {
                user: env.SMTP_USER,
                pass: env.SMTP_PASS,
              },
              connectionTimeout: 8000,
              greetingTimeout: 8000,
              socketTimeout: 10000,
            });

            try {
              return await transporter.sendMail(message);
            } finally {
              transporter.close();
            }
          });

        const result = await send({
          from: env.ALERT_EMAIL_FROM,
          to: env.ALERT_EMAIL_TO,
          subject: "Flood-risk application alert",
          text,
        });

        if (!result.accepted?.length) {
          throw new Error("Rejected");
        }

        entry.status = "accepted";
      } else {
        const send =
          adapters.sms ||
          (async (message) =>
            twilio(
              env.TWILIO_ACCOUNT_SID,
              env.TWILIO_AUTH_TOKEN,
              {
                timeout: 10000,
                autoRetry: false,
              }
            ).messages.create(message));

        const result = await send({
          from: env.TWILIO_FROM,
          to: env.ALERT_SMS_TO,
          body: text,
        });

        entry.status = ["failed", "undelivered"].includes(result.status)
          ? "failed"
          : "queued";
      }
    } catch {
      entry.status = "failed";
      entry.message =
        "Provider request failed. Check provider credentials, sender and recipient configuration.";
    } finally {
      pending.delete(channel);
    }

    history.unshift(entry);
    history.splice(50);

    return entry;
  }

  async function automatic(riskLevel) {
    if (riskLevel !== "High") return [];

    return Promise.all(
      ["email", "sms"]
        .filter((channel) =>
          enabled(
            channel === "email"
              ? "AUTO_EMAIL_ALERTS"
              : "AUTO_SMS_ALERTS"
          )
        )
        .map((channel) => deliver(channel, "automatic"))
    );
  }

  return {
    status,
    deliver,
    automatic,
  };
}

const alerts = createAlerts();

export const { status, deliver, automatic } = alerts;
export { createAlerts };