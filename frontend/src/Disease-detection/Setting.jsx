import React, { useState } from 'react'

function Setting() {
  const [theme, setTheme] = useState('Light')
  const [language, setLanguage] = useState('English')
  const [emailAlerts, setEmailAlerts] = useState(true)
  const [smsAlerts, setSmsAlerts] = useState(false)
  const [criticalOnly, setCriticalOnly] = useState(true)

  return (
    <div className={`p-4 sm:p-6 ${theme === 'Dark' ? 'bg-slate-950 text-white' : 'text-slate-900'}`}>
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
            Preferences
          </p>
          <h1 className={`mt-2 text-3xl font-bold ${theme === 'Dark' ? 'text-white' : 'text-slate-950'}`}>
            Settings
          </h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <section className="space-y-6">
            <SettingCard
              title="Theme Mode"
              description="Choose the dashboard appearance."
              dark={theme === 'Dark'}
            >
              <div className="grid gap-3 sm:grid-cols-3">
                {['Light', 'Dark', 'System'].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTheme(mode)}
                    className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                      theme === mode
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : theme === 'Dark'
                          ? 'border-slate-700 bg-slate-900 text-slate-200 hover:border-blue-400'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </SettingCard>

            <SettingCard
              title="Notification Settings"
              description="Control how alert messages are delivered."
              dark={theme === 'Dark'}
            >
              <div className="space-y-3">
                <ToggleRow
                  label="Email alerts"
                  description="Receive patient and system alerts by email."
                  enabled={emailAlerts}
                  onChange={setEmailAlerts}
                  dark={theme === 'Dark'}
                />
                <ToggleRow
                  label="SMS alerts"
                  description="Send urgent alert messages to your phone."
                  enabled={smsAlerts}
                  onChange={setSmsAlerts}
                  dark={theme === 'Dark'}
                />
                <ToggleRow
                  label="Critical alerts only"
                  description="Limit notifications to high-risk patient cases."
                  enabled={criticalOnly}
                  onChange={setCriticalOnly}
                  dark={theme === 'Dark'}
                />
              </div>
            </SettingCard>
          </section>

          <aside className="space-y-6">
            <SettingCard
              title="Language"
              description="Select the display language."
              dark={theme === 'Dark'}
            >
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className={`w-full rounded-xl border p-3 font-medium transition focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100 ${
                  theme === 'Dark'
                    ? 'border-slate-700 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <option>English</option>
                <option>Sinhala</option>
                <option>Tamil</option>
              </select>
            </SettingCard>

            <SettingCard
              title="Current Settings"
              description="Selected preferences preview."
              dark={theme === 'Dark'}
            >
              <div className="space-y-4">
                <AccountItem label="Theme" value={theme} dark={theme === 'Dark'} />
                <AccountItem label="Language" value={language} dark={theme === 'Dark'} />
                <AccountItem
                  label="Email Alerts"
                  value={emailAlerts ? 'Enabled' : 'Disabled'}
                  dark={theme === 'Dark'}
                />
                <AccountItem
                  label="SMS Alerts"
                  value={smsAlerts ? 'Enabled' : 'Disabled'}
                  dark={theme === 'Dark'}
                />
              </div>
            </SettingCard>
          </aside>
        </div>
      </div>
    </div>
  )
}

function SettingCard({ title, description, dark, children }) {
  return (
    <section
      className={`rounded-2xl border p-5 shadow-xl sm:p-6 ${
        dark
          ? 'border-slate-800 bg-slate-900 shadow-slate-950/40'
          : 'border-white/80 bg-white/90 shadow-slate-200/70'
      }`}
    >
      <div className="mb-5">
        <h2 className={`text-xl font-bold ${dark ? 'text-white' : 'text-slate-950'}`}>
          {title}
        </h2>
        <p className={`mt-1 text-sm leading-6 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
          {description}
        </p>
      </div>
      {children}
    </section>
  )
}

function ToggleRow({ label, description, enabled, onChange, dark }) {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-xl border p-4 ${
        dark ? 'border-slate-700 bg-slate-950' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <div>
        <p className={`font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>
          {label}
        </p>
        <p className={`mt-1 text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
          {description}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={`flex h-7 w-12 items-center rounded-full p-1 transition ${
          enabled ? 'justify-end bg-blue-600' : 'justify-start bg-slate-300'
        }`}
      >
        <span className="h-5 w-5 rounded-full bg-white shadow" />
      </button>
    </div>
  )
}

function AccountItem({ label, value, dark }) {
  return (
    <div className={`rounded-xl p-4 ${dark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className={`mt-1 font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>
        {value}
      </p>
    </div>
  )
}

export default Setting
