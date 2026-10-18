
import { useEffect } from 'react';
import { useState } from 'react';

const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:3002'
).replace(/\/+$/, '');

function Alerts() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  // Fetch latest alert configuration and history
  async function refresh() {
    const response = await fetch(
      `${API_URL}/api/alerts`
    );

    if (!response.ok) {
      throw new Error(
        'Unable to load alert settings.'
      );
    }

    const result = await response.json();
    setData(result);
  }

  // Automatically refresh alert information
  useEffect(() => {
    let active = true;

    async function update() {
      try {
        const response = await fetch(
          `${API_URL}/api/alerts`
        );

        if (!response.ok) {
          throw new Error(
            'Unable to load alert settings.'
          );
        }

        const result = await response.json();

        if (active) {
          setData(result);
          setMessage('');
        }
      } catch (error) {
        if (active) {
          setMessage(error.message);
        }
      }
    }

    // Initial load
    update();

    // Refresh every 10 seconds
    const timer = setInterval(update, 10000);

    // Refresh after new screening
    window.addEventListener(
      'screening-updated',
      update
    );

    return () => {
      active = false;
      clearInterval(timer);

      window.removeEventListener(
        'screening-updated',
        update
      );
    };
  }, []);

  // Send a manual email or SMS alert
  async function send(channel) {
    setBusy(channel);
    setMessage('');

    try {
      const response = await fetch(
        `${API_URL}/api/alerts/send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channel,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
          'Alert request failed.'
        );
      }

      setMessage(
        result.message ||
        `${
          channel === 'email'
            ? 'Email'
            : 'SMS'
        }: ${result.status}. Provider acceptance does not confirm delivery.`
      );

      // Reload alert history
      await refresh();

    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6 text-slate-900">

      {/* PAGE HEADER */}
      <header>
        <h1 className="text-3xl font-bold">
          Email and SMS Alerts
        </h1>

        <p className="mt-2 text-slate-600">
          Notify the administrator contact
          configured in the backend. Messages
          contain no patient details.
        </p>
      </header>

      {/* STATUS MESSAGE */}
      {message && (
        <p
          role="status"
          className="rounded-lg border bg-slate-50 p-4"
        >
          {message}
        </p>
      )}

      {/* EMAIL AND SMS ALERT CARDS */}
      <div className="grid gap-4 md:grid-cols-2">

        {['email', 'sms'].map((channel) => {
          const ready =
            data?.[`${channel}Configured`];

          const automatic =
            data?.[
              channel === 'email'
                ? 'automaticEmail'
                : 'automaticSms'
            ];

          const isAutomaticEnabled = Boolean(
            automatic &&
            ready &&
            data?.recipientConfirmed
          );

          const canSend = Boolean(
            ready &&
            data?.recipientConfirmed
          );

          return (
            <section
              key={channel}
              className="space-y-4 rounded-xl border bg-white p-5"
            >

              {/* CARD TITLE */}
              <h2 className="text-xl font-semibold">
                {channel === 'email'
                  ? 'Email Alerts'
                  : 'SMS Alerts'}
              </h2>

              {/* PROVIDER CONFIGURATION */}
              <p className="text-sm text-slate-600">
                {data
                  ? ready
                    ? 'Provider configured'
                    : 'Provider setup required'
                  : 'Loading configuration…'}
              </p>

              {/* AUTOMATIC ALERT STATUS */}
              <div className="rounded-lg bg-slate-50 p-3">

                <p className="text-sm font-medium">
                  Automatic screening alerts:
                </p>

                <p
                  className={`mt-1 text-sm font-semibold ${
                    isAutomaticEnabled
                      ? 'text-emerald-700'
                      : 'text-amber-700'
                  }`}
                >
                  {isAutomaticEnabled
                    ? 'Enabled'
                    : 'Disabled or setup incomplete'}
                </p>

              </div>

              {/* SEND ALERT BUTTON */}
              <button
                type="button"
                disabled={
                  Boolean(busy) || !canSend
                }
                onClick={() => send(channel)}
                className="rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {busy === channel
                  ? 'Sending…'
                  : `Send ${
                      channel === 'email'
                        ? 'email'
                        : 'SMS'
                    } alert`}
              </button>

            </section>
          );
        })}

      </div>

      {/* ALERT INFORMATION */}
      <p className="text-sm leading-6 text-slate-600">
        Automatic alerts trigger for possible
        dengue or leptospirosis image results
        and High or Medium symptom risk.
        This synthetic-data output is not a
        clinical emergency assessment.
        Provider settings and recipient consent
        are configured in the backend .env file.
      </p>

      {/* RECENT ALERT ATTEMPTS */}
      <section className="rounded-xl border bg-white p-5">

        <div className="flex items-center justify-between gap-4">

          <h2 className="text-xl font-semibold">
            Recent Alert Attempts
          </h2>

          <button
            type="button"
            onClick={() =>
              refresh().catch((error) =>
                setMessage(error.message)
              )
            }
            className="font-semibold text-blue-700 hover:text-blue-900"
          >
            Refresh
          </button>

        </div>

        <p className="mt-2 text-sm text-slate-500">
          History covers this server session
          only. Accepted or queued does not
          mean delivered.
        </p>

        {/* ALERT HISTORY */}
        <ul className="mt-4 space-y-3">

          {data?.history?.map((item) => (
            <li
              key={item.id}
              className="border-t pt-3 text-sm text-slate-700"
            >

              <span className="font-semibold capitalize">
                {item.channel}
              </span>

              {' · '}

              {item.source}

              {' · '}

              {item.disease ||
                (
                  item.riskLevel
                    ? `${item.riskLevel} risk`
                    : 'Manual alert'
                )}

              {' · '}

              <span className="font-semibold">
                {item.status}
              </span>

              {item.message
                ? ` — ${item.message}`
                : ''}

              {' · '}

              {item.createdAt
                ? new Date(
                    item.createdAt
                  ).toLocaleString()
                : 'Unknown time'}

            </li>
          ))}

        </ul>

        {/* EMPTY HISTORY MESSAGE */}
        {!data?.history?.length && (
          <p className="mt-4 text-sm text-slate-500">
            No alert attempts this session.
          </p>
        )}

      </section>

    </main>
  );
}

// NAMED EXPORT
export { Alerts };
