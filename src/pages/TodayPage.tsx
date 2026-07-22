import { useMemo, useState } from 'react'
import type { Item } from '@/types'
import { useStore } from '@/store/useStore'
import { mergedItemsForDate, teachingWeekOf, tombstoneKeys, weekStats } from '@/lib/schedule'
import { addDays, formatCnDate, todayISO, weekdayCn, weekDatesOf } from '@/lib/dateUtils'
import { Composer } from '@/components/Composer'
import { DayList } from '@/components/DayList'
import { BackfillDialog } from '@/components/BackfillDialog'
import { EditItemDialog } from '@/components/EditItemDialog'
import { BackupDialog } from '@/components/BackupDialog'

export default function TodayPage() {
  const items = useStore((s) => s.items)
  const templates = useStore((s) => s.courseTemplates)
  const semester = useStore((s) => s.semester)
  const holidays = useStore((s) => s.holidays)
  const makeupDays = useStore((s) => s.makeupDays)
  const courseDeleted = useStore((s) => s.courseDeleted)
  const toggleItem = useStore((s) => s.toggleItem)
  const deleteItem = useStore((s) => s.deleteItem)
  const deleteCourseOccurrence = useStore((s) => s.deleteCourseOccurrence)

  const [date, setDate] = useState(todayISO())
  const [backfilling, setBackfilling] = useState<Item | null>(null)
  const [editing, setEditing] = useState<Item | null>(null)
  const [backupOpen, setBackupOpen] = useState(false)

  const deleted = useMemo(() => tombstoneKeys(courseDeleted), [courseDeleted])
  const isToday = date === todayISO()
  const teachingWeek = teachingWeekOf(date, semester)
  const dayItems = useMemo(
    () => mergedItemsForDate(date, items, templates, semester, holidays, makeupDays, deleted),
    [date, items, templates, semester, holidays, makeupDays, deleted],
  )
  const stats = useMemo(
    () => weekStats(weekDatesOf(date), items, templates, semester, holidays, makeupDays, deleted),
    [date, items, templates, semester, holidays, makeupDays, deleted],
  )

  const handleDelete = (e: Item) => {
    if (e.source === 'course') {
      if (window.confirm(`删除这次课「${e.text}」？之后可在课表页恢复。`)) {
        deleteCourseOccurrence(e)
      }
    } else {
      deleteItem(e.id)
    }
  }

  return (
    <div className="px-5 pb-6 pt-8">
      {/* 日期头部 */}
      <header>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setDate(addDays(date, -1))} aria-label="前一天" className="px-1 text-[18px] text-softgray">
            ‹
          </button>
          <h1 className="text-[26px] font-semibold leading-tight text-ink">{formatCnDate(date)}</h1>
          <button type="button" onClick={() => setDate(addDays(date, 1))} aria-label="后一天" className="px-1 text-[18px] text-softgray">
            ›
          </button>
        </div>
        <p className="mt-1 text-[13px] text-softgray">
          {weekdayCn(date)}
          {teachingWeek !== null ? ` · 第${teachingWeek}教学周` : ''}
          {!isToday && (
            <button type="button" onClick={() => setDate(todayISO())} className="ml-3 text-blue">
              回到今天
            </button>
          )}
        </p>
      </header>

      {/* 记一笔（写到当前查看的这一天） */}
      <section className="mt-6">
        <Composer date={date} />
      </section>

      {/* 本周小结 */}
      <section className="mt-8">
        <p className="text-[12px] tracking-wide text-softgray">本周小结</p>
        <p className="mt-2 text-[15px] leading-relaxed text-ink">
          本周共记 <span className="font-medium text-blue">{stats.total}</span> 笔 · 阅读{' '}
          <span className="font-medium text-blue">{stats.reading}</span> 次 · 完成待办{' '}
          <span className="font-medium text-blue">{stats.todoDone}</span> 件 · 上课{' '}
          <span className="font-medium text-blue">{stats.courseCount}</span> 节
        </p>
      </section>

      <hr className="mt-6 border-mist" />

      {/* 融合列表 */}
      <section className="mt-2">
        <DayList
          items={dayItems}
          onToggle={toggleItem}
          onEdit={(e) => setEditing(e)}
          onBackfill={(e) => setBackfilling(e)}
          onDelete={handleDelete}
          emptyText={isToday ? '今天还空着，三秒记一笔吧' : '这一天安安静静的'}
        />
      </section>

      {/* 备份入口：低调放在页尾 */}
      <hr className="mt-8 border-mist" />
      <div className="mt-4 flex justify-center">
        <button type="button" onClick={() => setBackupOpen(true)} className="text-[13px] text-softgray">
          备份与恢复
        </button>
      </div>

      <BackfillDialog item={backfilling} onClose={() => setBackfilling(null)} />
      <EditItemDialog item={editing} onClose={() => setEditing(null)} />
      <BackupDialog open={backupOpen} onClose={() => setBackupOpen(false)} />
    </div>
  )
}
