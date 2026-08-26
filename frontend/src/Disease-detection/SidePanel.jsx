import React, { useState } from 'react'

import Dashboard from './Dashboard'
import Form from './Form'
import Image_Upload from './Image_Upload'
import Alerts from './Alerts'
import Analytics from './Analytics'
import Setting from './Setting'

const menuItems = [
  { label: 'Dashboard', icon: DashboardIcon, badge: 'Live' },
  { label: 'Facial Image', icon: ScanIcon },
  { label: 'Symptoms Form', icon: ReportIcon },
  { label: 'Alerts & Notifications', icon: BellIcon, badge: '9', danger: true },
  { label: 'Analytics', icon: ChartIcon },
  { label: 'Settings', icon: SettingsIcon },
]

function SidePanel() {
  const [activePage, setActivePage] = useState('Dashboard')

  const pages = {
    Dashboard: <Dashboard />,
    'Facial Image': <Image_Upload />,
    'Symptoms Form': <Form />,
    'Alerts & Notifications': <Alerts />,
    Analytics: <Analytics />,
    Settings: <Setting />,
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-emerald-50">
      {/* SIDEBAR */}
      <aside className="fixed inset-y-0 left-0 z-30 flex w-72 flex-col gap-6 overflow-y-auto bg-slate-950 px-5 py-6 text-white shadow-2xl shadow-slate-900/20">
        <div className="flex items-center gap-3 border-b border-white/10 pb-5">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-teal-400 text-2xl font-black text-slate-950">
            +
          </div>

          <div>
            <h1 className="text-xl font-bold leading-none">
              MedDetect
            </h1>

            <p className="mt-2 text-xs font-bold uppercase tracking-widest text-sky-200">
              Clinical Console
            </p>
          </div>
        </div>

        <nav aria-label="Main navigation">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = activePage === item.label

              return (
                <li key={item.label}>
                  <button
                    type="button"
                    onClick={() => setActivePage(item.label)}
                    className={`grid min-h-12 w-full grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                      isActive
                        ? 'bg-teal-400/15 text-white shadow-[inset_4px_0_0_rgb(45,212,191)]'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon />

                    <span className="truncate">
                      {item.label}
                    </span>

                    {item.badge && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-black ${
                          item.danger
                            ? 'bg-red-400 text-white'
                            : 'bg-teal-400 text-slate-950'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

       
      </aside>

      {/* PAGE CONTENT */}
      <main className="ml-72 min-h-screen p-4">
        {pages[activePage]}
      </main>
    </div>
  )
}

function BaseIcon({ children }) {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

function DashboardIcon() {
  return (
    <BaseIcon>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </BaseIcon>
  )
}

function ScanIcon() {
  return (
    <BaseIcon>
      <path d="M4 7V5a1 1 0 0 1 1-1h2" />
      <path d="M17 4h2a1 1 0 0 1 1 1v2" />
      <path d="M20 17v2a1 1 0 0 1-1 1h-2" />
      <path d="M7 20H5a1 1 0 0 1-1-1v-2" />
      <path d="M8 12h8" />
      <path d="M12 8v8" />
    </BaseIcon>
  )
}

function ReportIcon() {
  return (
    <BaseIcon>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v5h5" />
      <path d="M10 13h7" />
      <path d="M10 17h5" />
    </BaseIcon>
  )
}

function BellIcon() {
  return (
    <BaseIcon>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 6-3 9h18c0-3-3-2-3-9" />
      <path d="M10 21h4" />
    </BaseIcon>
  )
}

function ChartIcon() {
  return (
    <BaseIcon>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 15l3-4 3 2 4-7" />
    </BaseIcon>
  )
}

function SettingsIcon() {
  return (
    <BaseIcon>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a8 8 0 0 0 .1-2l2-1.5-2-3.5-2.4 1a8 8 0 0 0-1.7-1L15 5.5h-4L10.6 8a8 8 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a8 8 0 0 0 .1 2l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 1.7 1l.4 2.5h4l.4-2.5a8 8 0 0 0 1.7-1l2.4 1 2-3.5z" />
    </BaseIcon>
  )
}

export default SidePanel