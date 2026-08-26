import React from 'react'

const stats = [
  {
    label: 'Total Affected Patients',
    value: '1,248',
    note: '+86 this week',
    tone: 'blue',
  },
  {
    label: 'Active Alerts',
    value: '24',
    note: '9 critical cases',
    tone: 'red',
  },
  {
    label: 'Disease Statistics',
    value: '6',
    note: 'Tracked disease groups',
    tone: 'emerald',
  },
  {
    label: 'AI Prediction Summary',
    value: '91%',
    note: 'Average confidence',
    tone: 'violet',
  },
]

const diseaseStats = [
  { name: 'Dengue', patients: 420, percent: 78, color: 'bg-red-500' },
  { name: 'Influenza', patients: 315, percent: 62, color: 'bg-blue-500' },
  { name: 'COVID-like Symptoms', patients: 218, percent: 44, color: 'bg-amber-500' },
  { name: 'Skin Infection', patients: 156, percent: 31, color: 'bg-emerald-500' },
]

const predictions = [
  { label: 'High Risk', value: '18 patients', color: 'text-red-600' },
  { label: 'Medium Risk', value: '46 patients', color: 'text-amber-600' },
  { label: 'Low Risk', value: '133 patients', color: 'text-emerald-600' },
]

function Dashboard() {
  return (
    <div className="p-4 text-slate-900 sm:p-6">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
              Overview
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">
              Disease Detection Dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Monitor affected patients, active alerts, disease spread, and AI
              prediction results from one place.
            </p>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            System Online
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((item) => (
            <article
              key={item.label}
              className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-xl shadow-slate-200/70"
            >
              <div
                className={`mb-4 grid h-11 w-11 place-items-center rounded-xl ${getIconBg(
                  item.tone,
                )}`}
              >
                <DashboardIcon tone={item.tone} />
              </div>
              <p className="text-sm font-semibold text-slate-500">{item.label}</p>
              <p className="mt-3 text-3xl font-bold text-slate-950">{item.value}</p>
              <p className="mt-2 text-sm font-medium text-slate-500">{item.note}</p>
            </article>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-xl shadow-slate-200/70 sm:p-6">
            <div className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                Disease Statistics
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                Current Case Distribution
              </h2>
            </div>

            <div className="space-y-5">
              {diseaseStats.map((item) => (
                <div key={item.name}>
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <p className="font-semibold text-slate-800">{item.name}</p>
                    <p className="text-sm font-semibold text-slate-500">
                      {item.patients} patients
                    </p>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${item.color}`}
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="rounded-2xl border border-white/80 bg-slate-950 p-5 text-white shadow-xl shadow-slate-200/70 sm:p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-sky-300">
              AI Prediction Summary
            </p>
            <h2 className="mt-2 text-2xl font-bold">Risk Forecast</h2>

            <div className="mt-6 space-y-4">
              {predictions.map((item) => (
                <div key={item.label} className="rounded-xl bg-white/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {item.label}
                  </p>
                  <p className={`mt-1 text-xl font-bold ${item.color}`}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-xl bg-blue-500/15 p-4">
              <p className="text-sm text-sky-100">
                AI model predicts a moderate increase in respiratory cases over
                the next 7 days.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

function getIconBg(tone) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
  }

  return colors[tone] || colors.blue
}

function DashboardIcon() {
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
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </svg>
  )
}

export default Dashboard
