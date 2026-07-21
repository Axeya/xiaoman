import { useState } from 'react'
import type { TabKey } from '@/types'
import TodayPage from '@/pages/TodayPage'
import CalendarPage from '@/pages/CalendarPage'
import SchedulePage from '@/pages/SchedulePage'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'today', label: '今天' },
  { key: 'calendar', label: '日历' },
  { key: 'schedule', label: '课表' },
]

export default function App() {
  const [tab, setTab] = useState<TabKey>('today')

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-white">
      <main className="flex-1 pb-20">
        {tab === 'today' && <TodayPage />}
        {tab === 'calendar' && <CalendarPage />}
        {tab === 'schedule' && <SchedulePage />}
      </main>

      {/* 底部 Tab 栏：纯文字 */}
      <nav className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 border-t border-mist bg-white/95 backdrop-blur-sm">
        <div className="flex">
          {TABS.map((t) => {
            const active = tab === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className="flex flex-1 flex-col items-center gap-1 py-3"
              >
                <span className={`text-[14px] ${active ? 'font-semibold text-blue' : 'text-softgray'}`}>{t.label}</span>
                <span className={`h-[3px] w-4 rounded-full ${active ? 'bg-blue' : 'bg-transparent'}`} />
              </button>
            )
          })}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </div>
  )
}
