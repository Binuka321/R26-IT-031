
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import twilio from 'twilio';

function createAlerts(env = process.env, adapters = {}) {
  const history = [];
  const last = new Map();
  const pending = new Set();

  const enabled = key => env[key] === 'true';

  function configured(channel) {
    return channel === 'email'
      ? [
          'SMTP_HOST',
          'SMTP_USER',
          'SMTP_PASS',
          'ALERT_EMAIL_FROM',
          'ALERT_EMAIL_TO'
        ].every(k => !!env[k])
      : [
          'TWILIO_ACCOUNT_SID',
          'TWILIO_AUTH_TOKEN',
          'TWILIO_FROM',
          'ALERT_SMS_TO'
        ].every(k => !!env[k]);
  }

  function status() {
    return {
      emailConfigured: configured('email'),
      smsConfigured: configured('sms'),
      automaticEmail: env.AUTO_EMAIL_ALERTS !== 'false',
      automaticSms: env.AUTO_SMS_ALERTS !== 'false',
      recipientConfirmed: enabled('ALERT_RECIPIENT_OPT_IN'),
      history: [...history]
    };
  }

  async function deliver(channel, source, context = {}) {
    if (!['email', 'sms'].includes(channel)) {
      throw new Error('Invalid channel');
    }

    const entry = {
      id: crypto.randomUUID(),
      channel,
      source,
      ...context,
      createdAt: new Date().toISOString(),
      status: 'failed'
    };

    function skip(status, message) {
      Object.assign(entry, {
        status,
        message
      });

      history.unshift(entry);
      history.splice(50);

      return entry;
    }

    // Check recipient consent
    if (!enabled('ALERT_RECIPIENT_OPT_IN')) {
      return skip(
        'disabled',
        'Confirm recipient consent in backend configuration.'
      );
    }

    // Check provider configuration
    if (!configured(channel)) {
      return skip(
        'not_configured',
        'Complete provider settings in backend .env.'
      );
    }

    // Prevent duplicate alert requests
    const key = `${channel}:${context.recordId || 'manual'}`;

    if (
      pending.has(key) ||
      Date.now() - (last.get(key) || 0) < 60000
    ) {
      return skip(
        'throttled',
        'An alert for this record was already requested.'
      );
    }

    pending.add(key);

    // Generate notification content
    const text = source === 'automatic'
      ? (
          context.type === 'image'
            ? `Image screening identified possible ${context.disease}. Review the application for medical follow-up. Screening output is not a confirmed diagnosis.`
            : `Symptom screening identified ${context.riskLevel} risk. Review the application and follow the screening recommendation. Screening output is not a confirmed diagnosis.`
        )
      : 'Flood-risk demo: an administrator requested a manual alert. Review the application.';

    try {
      // EMAIL NOTIFICATION
      if (channel === 'email') {
        const send = adapters.email || (async message => {
          const transporter = nodemailer.createTransport({
            host: env.SMTP_HOST,
            port: Number(env.SMTP_PORT || 587),
            secure: env.SMTP_PORT === '465',
            requireTLS: env.SMTP_PORT !== '465',
            auth: {
              user: env.SMTP_USER,
              pass: env.SMTP_PASS
            },
            connectionTimeout: 8000,
            greetingTimeout: 8000,
            socketTimeout: 10000
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
          subject: 'Flood-risk application alert',
          text
        });

        if (!result.accepted?.length) {
          throw new Error('Rejected');
        }

        entry.status = 'accepted';

      } else {
        // SMS NOTIFICATION
        const send = adapters.sms || (
          async message =>
            twilio(
              env.TWILIO_ACCOUNT_SID,
              env.TWILIO_AUTH_TOKEN,
              {
                timeout: 10000,
                autoRetry: false
              }
            ).messages.create(message)
        );

        const result = await send({
          from: env.TWILIO_FROM,
          to: env.ALERT_SMS_TO,
          body: text
        });

        entry.status = [
          'failed',
          'undelivered'
        ].includes(result.status)
          ? 'failed'
          : 'queued';
      }

    } catch {
      entry.status = 'failed';

      entry.message =
        'Provider request failed. Check provider credentials, sender and recipient configuration.';

    } finally {
      pending.delete(key);
    }

    // Record successful provider requests
    if (
      ['accepted', 'queued'].includes(entry.status)
    ) {
      last.set(key, Date.now());

      const timer = setTimeout(
        () => last.delete(key),
        60000
      );

      timer.unref?.();
    }

    // Save alert history
    history.unshift(entry);
    history.splice(50);

    return entry;
  }

  // AUTOMATIC ALERT HANDLING
  async function automatic(context) {
    if (typeof context === 'string') {
      context = {
        type: 'symptom',
        riskLevel: context
      };
    }

    const disease = String(
      context.disease || ''
    ).trim().toLowerCase();

    const eligible = context.type === 'image'
      ? [
          'dengue',
          'leptospirosis'
        ].includes(disease)
      : [
          'High',
          'Medium'
        ].includes(context.riskLevel);

    if (!eligible) {
      return [];
    }

    return Promise.all(
      ['email', 'sms']
        .filter(
          c =>
            env[
              c === 'email'
                ? 'AUTO_EMAIL_ALERTS'
                : 'AUTO_SMS_ALERTS'
            ] !== 'false'
        )
        .map(
          c =>
            deliver(c, 'automatic', {
              ...context,
              disease:
                context.type === 'image'
                  ? disease
                  : undefined
            })
        )
    );
  }

  return {
    status,
    deliver,
    automatic
  };
}

// CREATE ALERT SERVICE INSTANCE
const alerts = createAlerts();

// NAMED EXPORT
export { createAlerts };

// DEFAULT EXPORT
export default alerts;
