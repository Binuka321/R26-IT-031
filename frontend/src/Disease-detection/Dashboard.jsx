
import { useEffect } from 'react';
import { useState } from 'react';

const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:3002'
).replace(/\/+$/, '');

const toneClasses = {
  blue: 'bg-blue-50 text-blue-600',
  red: 'bg-red-50 text-red-600',
  cyan: 'bg-cyan-50 text-cyan-700',
  violet: 'bg-violet-50 text-violet-600',
};

function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function refresh() {
      try {
        const response = await fetch(
          `${API_URL}/api/dashboard`
        );

        if (!response.ok) {
          throw new Error(
            'Unable to load dashboard data.'
          );
        }

        const result = await response.json();

        if (active) {
          setData(result);
          setError('');
        }
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      }
    }

    // Initial dashboard load
    refresh();

    // Automatically refresh every 10 seconds
    const timer = setInterval(refresh, 10000);

    // Refresh after a new screening is submitted
    window.addEventListener(
      'screening-updated',
      refresh
    );

    // Refresh when the browser tab becomes active
    window.addEventListener(
      'focus',
      refresh
    );

    return () => {
      active = false;

      clearInterval(timer);

      window.removeEventListener(
        'screening-updated',
        refresh
      );

      window.removeEventListener(
        'focus',
        refresh
      );
    };
  }, []);

  // Dashboard summary cards
  const summaryCards = [
    {
      label: 'Screenings Submitted',
      value: data?.totalScreenings ?? '—',
      note: 'Saved symptom forms and images',
      tone: 'blue',
      icon: 'people',
    },
    {
      label: 'High Risk Forms',
      value: data?.riskCounts?.High ?? '—',
      note: 'Require medical review',
      tone: 'red',
      icon: 'alert',
    },
    {
      label: 'Exposure Reports',
      value: data?.floodExposures ?? '—',
      note: 'Forms reporting exposure',
      tone: 'cyan',
      icon: 'water',
    },
    {
      label: 'Image Analyses',
      value: data?.imageCount ?? '—',
      note: 'Saved image screening results',
      tone: 'violet',
      icon: 'scan',
    },
  ];

  // Disease screening pattern statistics
  const diseaseStats = Object.entries(
    data?.diseaseCounts || {}
  ).map(([name, cases]) => ({
    name: `Possible ${name}`,
    cases,
    percent: data?.imageCount
      ? (cases / data.imageCount) * 100
      : 0,
    color: 'bg-blue-500',
    detail: 'Image screening indicator',
  }));

  // Risk level distribution
  const riskSummary = [
    'High',
    'Medium',
    'Low',
  ].map((level) => ({
    label: `${level} Risk`,
    value: data?.riskCounts?.[level] ?? '—',
    note: 'Symptom form assessments',
    style:
      level === 'High'
        ? 'border-red-200 bg-red-50 text-red-800'
        : level === 'Medium'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-emerald-200 bg-emerald-50 text-emerald-800',
  }));

  // Urgent warning signs
  const urgentAlerts = [
    'Breathing difficulty',
    'Reduced urination',
    'Confusion',
    'Chest pain',
  ].map((symptom) => ({
    symptom,
    cases:
      data?.warningCounts?.[symptom] ?? '—',
    tone: 'bg-red-500',
  }));

  // Most recent screening records
  const recentScreenings = (
    data?.recent || []
  ).map((item) => ({
    ...item,
    time: item.createdAt
      ? new Date(
          item.createdAt
        ).toLocaleString()
      : '—',
  }));

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 sm:p-6">

      <div className="mx-auto w-full max-w-7xl">

        {/* DASHBOARD HEADER */}
        <header className="mb-7 overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-8">

          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">
                Post-flood health intelligence
              </p>

              <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
                Flood-Related Disease Dashboard
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                Monitor preliminary disease patterns,
                exposure history, urgent warning signs,
                and screening activity for faster
                medical response.
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200">

              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />

              Screening dashboard active

            </div>

          </div>
        </header>

        {/* ERROR MESSAGE */}
        {error && (
          <p
            role="alert"
            className="mb-4 rounded-xl bg-red-50 p-4 text-red-700"
          >
            {error}
          </p>
        )}

        {/* LOADING MESSAGE */}
        {!data && !error && (
          <p role="status">
            Loading dashboard…
          </p>
        )}

        {/* EMPTY DASHBOARD MESSAGE */}
        {data?.totalScreenings === 0 && (
          <p className="mb-4">
            No screenings submitted yet.
          </p>
        )}

        {/* SUMMARY CARDS */}
        <section
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Screening summary"
        >

          {summaryCards.map((item) => (
            <article
              key={item.label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >

              <div
                className={`grid h-11 w-11 place-items-center rounded-xl ${
                  toneClasses[item.tone]
                }`}
              >
                <MetricIcon type={item.icon} />
              </div>

              <p className="mt-4 text-sm font-semibold text-slate-500">
                {item.label}
              </p>

              <p className="mt-1 text-3xl font-bold text-slate-950">
                {item.value}
              </p>

              <p className="mt-2 text-xs font-medium text-slate-500">
                {item.note}
              </p>

            </article>
          ))}

        </section>

        {/* SCREENING PATTERNS AND RISK DISTRIBUTION */}
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">

          {/* DISEASE SCREENING PATTERNS */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">

            <SectionHeading
              eyebrow="Disease surveillance"
              title="Current Screening Patterns"
              subtitle="Preliminary indicators only — laboratory or clinical confirmation is required."
            />

            <div className="mt-6 space-y-5">

              {diseaseStats.length === 0 && (
                <p className="text-sm text-slate-500">
                  No image screening data available yet.
                </p>
              )}

              {diseaseStats.map((item) => (
                <div key={item.name}>

                  <div className="mb-2 flex items-end justify-between gap-4">

                    <div>
                      <p className="font-bold text-slate-800">
                        {item.name}
                      </p>

                      <p className="mt-0.5 text-xs text-slate-500">
                        {item.detail}
                      </p>
                    </div>

                    <p className="shrink-0 text-sm font-bold text-slate-600">
                      {item.cases} reports
                    </p>

                  </div>

                  {/* SCREENING PROGRESS BAR */}
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">

                    <div
                      className={`h-full rounded-full ${item.color}`}
                      style={{
                        width: `${item.percent}%`,
                      }}
                    />

                  </div>
                </div>
              ))}

            </div>
          </section>

          {/* RISK DISTRIBUTION */}
          <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">

            <SectionHeading
              eyebrow="Triage overview"
              title="Risk Distribution"
              subtitle="Prioritized from submitted screening data."
            />

            <div className="mt-6 space-y-3">

              {riskSummary.map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center justify-between rounded-xl border p-4 ${item.style}`}
                >

                  <div>
                    <p className="font-bold">
                      {item.label}
                    </p>

                    <p className="mt-1 text-xs opacity-80">
                      {item.note}
                    </p>
                  </div>

                  <p className="text-3xl font-black">
                    {item.value}
                  </p>

                </div>
              ))}

            </div>
          </aside>

        </div>

        {/* URGENT ALERTS AND RECENT SCREENINGS */}
        <div className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">

          {/* URGENT WARNING SIGNS */}
          <section className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm sm:p-6">

            <SectionHeading
              dark
              eyebrow="Urgent clinical alerts"
              title="Warning Signs Reported"
              subtitle="Reported symptoms requiring prompt medical attention."
            />

            <div className="mt-5 space-y-3">

              {urgentAlerts.map((item) => (
                <div
                  key={item.symptom}
                  className="flex items-center justify-between rounded-xl bg-white/10 p-4"
                >

                  <div className="flex items-center gap-3">

                    <span
                      className={`h-3 w-3 rounded-full ${item.tone}`}
                    />

                    <p className="text-sm font-semibold">
                      {item.symptom}
                    </p>

                  </div>

                  <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold">
                    {item.cases}
                  </span>

                </div>
              ))}

            </div>

          </section>

          {/* RECENT SCREENINGS */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

            <div className="p-5 sm:p-6">

              <SectionHeading
                eyebrow="Live activity"
                title="Recent Screenings"
                subtitle="Latest symptom forms and image-analysis records."
              />

            </div>

            <div className="overflow-x-auto">

              <table className="w-full min-w-[650px] text-left text-sm">

                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>

                    <th className="px-6 py-3">
                      Record
                    </th>

                    <th className="px-4 py-3">
                      Source
                    </th>

                    <th className="px-4 py-3">
                      Indicator
                    </th>

                    <th className="px-4 py-3">
                      Risk
                    </th>

                    <th className="px-6 py-3 text-right">
                      Time
                    </th>

                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">

                  {recentScreenings.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-6 text-center text-slate-500"
                      >
                        No recent screening records.
                      </td>
                    </tr>
                  )}

                  {recentScreenings.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50"
                    >

                      <td className="px-6 py-4 font-bold text-slate-800">
                        {item.id}
                      </td>

                      <td className="px-4 py-4 text-slate-600">
                        {item.source}
                      </td>

                      <td className="px-4 py-4 font-semibold text-slate-700">
                        {item.condition}
                      </td>

                      <td className="px-4 py-4">
                        <RiskBadge risk={item.risk} />
                      </td>

                      <td className="px-6 py-4 text-right text-slate-500">
                        {item.time}
                      </td>

                    </tr>
                  ))}

                </tbody>
              </table>

            </div>

          </section>

        </div>

        {/* DASHBOARD DISCLAIMER */}
        <p className="mt-5 text-center text-xs text-slate-500">
          Dashboard values are preliminary screening
          indicators and must not be treated as
          confirmed diagnoses.
        </p>

      </div>
    </main>
  );
}

// SECTION HEADING COMPONENT
function SectionHeading({
  eyebrow,
  title,
  subtitle,
  dark = false,
}) {
  return (
    <div>

      <p
        className={`text-xs font-bold uppercase tracking-widest ${
          dark ? 'text-cyan-300' : 'text-blue-700'
        }`}
      >
        {eyebrow}
      </p>

      <h2
        className={`mt-2 text-2xl font-bold ${
          dark ? 'text-white' : 'text-slate-950'
        }`}
      >
        {title}
      </h2>

      <p
        className={`mt-2 text-sm ${
          dark ? 'text-slate-300' : 'text-slate-500'
        }`}
      >
        {subtitle}
      </p>

    </div>
  );
}

// RISK BADGE COMPONENT
function RiskBadge({ risk }) {
  const styles = {
    High: 'bg-red-100 text-red-700',
    Medium: 'bg-amber-100 text-amber-700',
    Low: 'bg-emerald-100 text-emerald-700',
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${
        styles[risk] ||
        'bg-slate-100 text-slate-600'
      }`}
    >
      {risk || '—'}
    </span>
  );
}

// METRIC ICON COMPONENT
function MetricIcon({ type }) {
  const paths = {
    people: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5" />
      </>
    ),

    alert: (
      <>
        <path d="M12 3 2.5 20h19z" />
        <path d="M12 9v4M12 17h.01" />
      </>
    ),

    water: (
      <path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13z" />
    ),

    scan: (
      <>
        <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
  };

  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[type]}
    </svg>
  );
}

// NAMED EXPORT
export { Dashboard };
