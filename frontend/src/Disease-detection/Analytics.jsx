
import { useEffect } from 'react';
import { useState } from 'react';

const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:3002'
).replace(/\/+$/, '');

function Analytics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    let active = true;
    let loading = false;

    const controller = new AbortController();

    async function refresh() {
      if (loading) return;

      loading = true;

      try {
        const response = await fetch(
          `${API_URL}/api/dashboard`,
          {
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(
            'Unable to load analytics.'
          );
        }

        const result = await response.json();

        if (active) {
          setData(result);
          setError('');
          setUpdatedAt(new Date());
        }
      } catch (err) {
        if (active && err.name !== 'AbortError') {
          setError(err.message);
        }
      } finally {
        loading = false;
      }
    }

    // Initial data load
    refresh();

    // Refresh automatically every 10 seconds
    const timer = setInterval(refresh, 10000);

    // Refresh after a screening submission
    window.addEventListener(
      'screening-updated',
      refresh
    );

    // Refresh when browser window gains focus
    window.addEventListener(
      'focus',
      refresh
    );

    return () => {
      active = false;
      controller.abort();
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

  // Loading state
  if (!data) {
    return (
      <main className="p-6">
        <h1 className="text-3xl font-bold">
          Screening Analytics
        </h1>

        <p
          role={error ? 'alert' : 'status'}
          className="mt-4 text-slate-600"
        >
          {error || 'Loading analytics…'}
        </p>
      </main>
    );
  }

  // Risk statistics
  const riskCounts = data.riskCounts || {};

  const formCount = [
    'High',
    'Medium',
    'Low',
  ].reduce(
    (total, level) =>
      total + (riskCounts[level] || 0),
    0
  );

  // Disease statistics
  const diseases = Object.entries(
    data.diseaseCounts || {}
  ).sort(
    (a, b) => b[1] - a[1]
  );

  // Reported symptoms
  const symptoms = Object.entries(
    data.warningCounts || {}
  ).sort(
    (a, b) => b[1] - a[1]
  );

  // Calculate percentage
  const percentage = (count, total) =>
    total
      ? Math.round((count / total) * 100)
      : 0;

  // Summary metrics
  const metrics = [
    [
      'Total Screenings',
      data.totalScreenings,
    ],
    [
      'Symptom Forms',
      formCount,
    ],
    [
      'Image Analyses',
      data.imageCount,
    ],
    [
      'Exposure Reports',
      data.floodExposures,
    ],
  ];

  // Risk level colors
  const riskColors = {
    High: 'bg-red-500',
    Medium: 'bg-amber-500',
    Low: 'bg-emerald-500',
  };

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">

      <div className="mx-auto max-w-7xl space-y-6">

        {/* ANALYTICS HEADER */}
        <header className="rounded-2xl bg-slate-950 p-6 text-white">

          <h1 className="text-3xl font-bold">
            Screening Analytics
          </h1>

          <p className="mt-2 text-slate-300">
            Analytics from saved symptom forms
            and image predictions.
          </p>

          {updatedAt && (
            <p className="mt-3 text-xs text-cyan-300">
              Last updated:{' '}
              {updatedAt.toLocaleString()}
            </p>
          )}

        </header>

        {/* ERROR MESSAGE */}
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-4 text-red-700"
          >
            {error} Showing the last loaded data.
          </p>
        )}

        {/* SUMMARY METRICS */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          {metrics.map(([label, value]) => (
            <article
              key={label}
              className="rounded-2xl border bg-white p-5 shadow-sm"
            >

              <p className="text-sm font-semibold text-slate-500">
                {label}
              </p>

              <p className="mt-2 text-3xl font-bold">
                {Number(value || 0).toLocaleString()}
              </p>

            </article>
          ))}

        </section>

        {/* NO DATA MESSAGE */}
        {data.totalScreenings === 0 && (
          <p className="rounded-xl border bg-white p-4">
            No screening records yet.
            Submit a symptom form or image
            to populate analytics.
          </p>
        )}

        {/* RISK AND IMAGE DISTRIBUTION */}
        <div className="grid gap-6 lg:grid-cols-2">

          {/* SYMPTOM RISK DISTRIBUTION */}
          <section className="rounded-2xl border bg-white p-6">

            <h2 className="text-xl font-bold">
              Symptom Risk Distribution
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Percentages are based on{' '}
              {formCount} symptom forms.
            </p>

            <div className="mt-5 space-y-5">

              {['High', 'Medium', 'Low'].map(
                (level) => (
                  <Bar
                    key={level}
                    label={`${level} Risk`}
                    count={riskCounts[level] || 0}
                    percent={percentage(
                      riskCounts[level] || 0,
                      formCount
                    )}
                    color={riskColors[level]}
                  />
                )
              )}

            </div>
          </section>

          {/* IMAGE PREDICTION DISTRIBUTION */}
          <section className="rounded-2xl border bg-white p-6">

            <h2 className="text-xl font-bold">
              Image Prediction Distribution
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Percentages are based on{' '}
              {data.imageCount} image analyses.
            </p>

            <div className="mt-5 space-y-5">

              {diseases.map(
                ([disease, count]) => (
                  <Bar
                    key={disease}
                    label={`Possible ${disease}`}
                    count={count}
                    percent={percentage(
                      count,
                      data.imageCount
                    )}
                    color="bg-blue-500"
                  />
                )
              )}

              {diseases.length === 0 && (
                <p className="text-sm text-slate-500">
                  No image predictions yet.
                </p>
              )}

            </div>
          </section>

        </div>

        {/* REPORTED SYMPTOMS */}
        <section className="rounded-2xl border bg-white p-6">

          <h2 className="text-xl font-bold">
            Reported Symptoms
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Each form can report multiple symptoms.
          </p>

          <div className="mt-5 grid gap-5 md:grid-cols-2">

            {symptoms.map(
              ([symptom, count]) => (
                <Bar
                  key={symptom}
                  label={symptom}
                  count={count}
                  percent={percentage(
                    count,
                    formCount
                  )}
                  color="bg-cyan-500"
                />
              )
            )}

          </div>

          {symptoms.length === 0 && (
            <p className="mt-4 text-sm text-slate-500">
              No symptoms recorded yet.
            </p>
          )}

        </section>

        {/* LATEST SCREENING RECORDS */}
        <section className="overflow-hidden rounded-2xl border bg-white">

          <h2 className="p-6 text-xl font-bold">
            Latest Screening Records
          </h2>

          <div className="overflow-x-auto">

            <table className="w-full text-left text-sm">

              <thead className="bg-slate-50 text-slate-500">

                <tr>
                  <th className="p-4">
                    Source
                  </th>

                  <th className="p-4">
                    Result
                  </th>

                  <th className="p-4">
                    Risk
                  </th>

                  <th className="p-4">
                    Submitted
                  </th>
                </tr>

              </thead>

              <tbody className="divide-y">

                {(data.recent || []).map(
                  (record) => (
                    <tr key={record.id}>

                      <td className="p-4">
                        {record.source}
                      </td>

                      <td className="p-4">
                        {record.condition}
                      </td>

                      <td className="p-4">
                        {record.risk}
                      </td>

                      <td className="whitespace-nowrap p-4">
                        {record.createdAt
                          ? new Date(
                              record.createdAt
                            ).toLocaleString()
                          : '—'}
                      </td>

                    </tr>
                  )
                )}

                {!data.recent?.length && (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-4 text-slate-500"
                    >
                      No screening records available.
                    </td>
                  </tr>
                )}

              </tbody>
            </table>

          </div>

        </section>

        {/* MEDICAL DISCLAIMER */}
        <p className="text-center text-xs text-slate-500">
          Screening results are preliminary
          indicators, not confirmed diagnoses.
        </p>

      </div>
    </main>
  );
}

// REUSABLE ANALYTICS BAR
function Bar({
  label,
  count,
  percent,
  color,
}) {
  return (
    <div>

      <div className="mb-2 flex justify-between gap-4 text-sm">

        <span className="font-semibold">
          {label}
        </span>

        <span className="shrink-0 text-slate-500">
          {count} ({percent}%)
        </span>

      </div>

      <div
        role="img"
        aria-label={`${label}: ${count} reports, ${percent}%`}
        className="h-3 overflow-hidden rounded-full bg-slate-100"
      >

        <div
          className={`h-full rounded-full ${color}`}
          style={{
            width: `${
              Math.min(
                100,
                Math.max(0, percent)
              )
            }%`,
          }}
        />

      </div>
    </div>
  );
}

// NAMED EXPORT
export { Analytics };
