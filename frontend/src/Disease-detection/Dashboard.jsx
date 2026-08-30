import React from 'react'

const summaryCards = [
  { label: 'People Screened', value: '1,248', note: '86 screenings this week', tone: 'blue', icon: 'people' },
  { label: 'Urgent Cases', value: '24', note: 'Require medical review', tone: 'red', icon: 'alert' },
  { label: 'Flood Exposures', value: '317', note: 'Water, mud, or sewage contact', tone: 'cyan', icon: 'water' },
  { label: 'Image Analyses', value: '486', note: 'Visible skin conditions screened', tone: 'violet', icon: 'scan' },
]

const diseaseStats = [
  { name: 'Possible Dengue', cases: 92, percent: 74, color: 'bg-red-500', detail: 'Fever and dengue-related symptoms' },
  { name: 'Possible Leptospirosis', cases: 64, percent: 52, color: 'bg-amber-500', detail: 'Flood exposure and related symptoms' },
  { name: 'Diarrheal Illness', cases: 47, percent: 38, color: 'bg-cyan-500', detail: 'Unsafe food or water exposure' },
  { name: 'Wound / Skin Infection', cases: 39, percent: 31, color: 'bg-violet-500', detail: 'Rash, redness, swelling, or wounds' },
]

const riskSummary = [
  { label: 'High Risk', value: 24, note: 'Urgent assessment', style: 'border-red-200 bg-red-50 text-red-800' },
  { label: 'Medium Risk', value: 76, note: 'Clinical review advised', style: 'border-amber-200 bg-amber-50 text-amber-800' },
  { label: 'Low Risk', value: 133, note: 'Monitor symptoms', style: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
]

const urgentAlerts = [
  { symptom: 'Difficulty breathing', cases: 7, tone: 'bg-red-500' },
  { symptom: 'Reduced or no urination', cases: 6, tone: 'bg-orange-500' },
  { symptom: 'Bleeding warning signs', cases: 5, tone: 'bg-rose-500' },
  { symptom: 'Confusion or severe drowsiness', cases: 6, tone: 'bg-purple-500' },
]

const recentScreenings = [
  { id: 'SCR-1048', source: 'Symptom form', condition: 'Possible dengue', risk: 'High', time: '8 min ago' },
  { id: 'SCR-1047', source: 'Symptom form', condition: 'Possible leptospirosis', risk: 'High', time: '14 min ago' },
  { id: 'IMG-0486', source: 'Image analysis', condition: 'Skin infection', risk: 'Medium', time: '22 min ago' },
  { id: 'SCR-1046', source: 'Symptom form', condition: 'Diarrheal illness', risk: 'Medium', time: '31 min ago' },
]

function Dashboard() {
  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 sm:p-6">
      <div className="mx-auto w-full max-w-7xl">
        <header className="mb-7 overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Post-flood health intelligence</p>
              <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Flood-Related Disease Dashboard</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                Monitor preliminary disease patterns, exposure history, urgent warning signs, and screening activity for faster medical response.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
              Screening system online
            </div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Screening summary">
          {summaryCards.map((item) => (
            <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className={`grid h-11 w-11 place-items-center rounded-xl ${toneClasses[item.tone]}`}><MetricIcon type={item.icon} /></div>
              <p className="mt-4 text-sm font-semibold text-slate-500">{item.label}</p>
              <p className="mt-1 text-3xl font-bold text-slate-950">{item.value}</p>
              <p className="mt-2 text-xs font-medium text-slate-500">{item.note}</p>
            </article>
          ))}
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <SectionHeading eyebrow="Disease surveillance" title="Current Screening Patterns" subtitle="Preliminary indicators only — laboratory or clinical confirmation is required." />
            <div className="mt-6 space-y-5">
              {diseaseStats.map((item) => (
                <div key={item.name}>
                  <div className="mb-2 flex items-end justify-between gap-4">
                    <div><p className="font-bold text-slate-800">{item.name}</p><p className="mt-0.5 text-xs text-slate-500">{item.detail}</p></div>
                    <p className="shrink-0 text-sm font-bold text-slate-600">{item.cases} reports</p>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.percent}%` }} /></div>
                </div>
              ))}
            </div>
          </section>

          <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <SectionHeading eyebrow="Triage overview" title="Risk Distribution" subtitle="Prioritized from submitted screening data." />
            <div className="mt-6 space-y-3">
              {riskSummary.map((item) => (
                <div key={item.label} className={`flex items-center justify-between rounded-xl border p-4 ${item.style}`}>
                  <div><p className="font-bold">{item.label}</p><p className="mt-1 text-xs opacity-80">{item.note}</p></div>
                  <p className="text-3xl font-black">{item.value}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <section className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm sm:p-6">
            <SectionHeading dark eyebrow="Urgent clinical alerts" title="Warning Signs Reported" subtitle="Cases that should be reviewed without delay." />
            <div className="mt-5 space-y-3">
              {urgentAlerts.map((item) => (
                <div key={item.symptom} className="flex items-center justify-between rounded-xl bg-white/10 p-4">
                  <div className="flex items-center gap-3"><span className={`h-3 w-3 rounded-full ${item.tone}`} /><p className="text-sm font-semibold">{item.symptom}</p></div>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold">{item.cases}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="p-5 sm:p-6"><SectionHeading eyebrow="Live activity" title="Recent Screenings" subtitle="Latest symptom forms and image-analysis records." /></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-6 py-3">Record</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Indicator</th><th className="px-4 py-3">Risk</th><th className="px-6 py-3 text-right">Time</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {recentScreenings.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50"><td className="px-6 py-4 font-bold text-slate-800">{item.id}</td><td className="px-4 py-4 text-slate-600">{item.source}</td><td className="px-4 py-4 font-semibold text-slate-700">{item.condition}</td><td className="px-4 py-4"><RiskBadge risk={item.risk} /></td><td className="px-6 py-4 text-right text-slate-500">{item.time}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <p className="mt-5 text-center text-xs text-slate-500">Dashboard values are preliminary screening indicators and must not be treated as confirmed diagnoses.</p>
      </div>
    </main>
  )
}

const toneClasses = { blue: 'bg-blue-50 text-blue-600', red: 'bg-red-50 text-red-600', cyan: 'bg-cyan-50 text-cyan-700', violet: 'bg-violet-50 text-violet-600' }

function SectionHeading({ eyebrow, title, subtitle, dark = false }) {
  return <div><p className={`text-xs font-bold uppercase tracking-widest ${dark ? 'text-cyan-300' : 'text-blue-700'}`}>{eyebrow}</p><h2 className={`mt-2 text-2xl font-bold ${dark ? 'text-white' : 'text-slate-950'}`}>{title}</h2><p className={`mt-2 text-sm ${dark ? 'text-slate-300' : 'text-slate-500'}`}>{subtitle}</p></div>
}

function RiskBadge({ risk }) {
  const styles = { High: 'bg-red-100 text-red-700', Medium: 'bg-amber-100 text-amber-700', Low: 'bg-emerald-100 text-emerald-700' }
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${styles[risk]}`}>{risk}</span>
}

function MetricIcon({ type }) {
  const paths = {
    people: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5" /></>,
    alert: <><path d="M12 3 2.5 20h19z" /><path d="M12 9v4M12 17h.01" /></>,
    water: <path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13z" />,
    scan: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><circle cx="12" cy="12" r="3" /></>,
  }
  return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[type]}</svg>
}

export default Dashboard
