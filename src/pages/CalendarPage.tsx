import { useMemo, useState } from 'react'
import type { Item } from '@/types'
import { useStore } from '@/store/useStore'
import { mergedItemsForDate, tombstoneKeys } from '@/lib/schedule'
import { formatCnDate, monthGrid, todayISO, weekdayCn } from '@/lib/dateUtils'
import { Composer } from '@/components/Composer'
import { DayList } from '@/components/DayList'
import { BackfillDialog } from '@/components/BackfillDialog'
import { EditItemDialog } from '@/components/EditItemDialog'

const WEEKDAY_HEADS = ['一', '二', '三', '四', '五', '六', '日']

/** 热力档位：记录越多颜色越深（1-2 浅蓝 / 3-4 中蓝 / 5+ 深蓝） */
function heatClass(done: number): string {
  if (done >= 5) return 'bg-blue font-medium text-white'
  if (done >= 3) return 'bg-[#7E9BF6] font-medium text-white'
  if (done >= 1) return 'bg-[#C9D6FC] text-ink'
  return 'bg-mist text-softgray'
}

export default function CalendarPage() {
  const items = useStore((s) => s.items)
  const templates = useStore((s) => s.courseTemplates)
  const semester = useStore((s) => s.semester)
  const holidays = useStore((s) => s.holidays)
  const makeupDays = useStore((s) => s.makeupDays)
  const courseDeleted = useStore((s) => s.courseDeleted)
  const toggleItem = useStore((s) => s.toggleItem)
  const deleteItem = useStore((s) => s.deleteItem)
  const deleteCourseOccurrence = useStore((s) => s.deleteCourseOccurrence)

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month0, setMonth0] = useState(now.getMonth())
  const [selected, setSelected] = useState(todayISO())
  const [backfilling, setBackfilling] = useState<Item | null>(null)
  const [editing, setEditing] = useState<Item | null>(null)

  const deleted = useMemo(() => tombstoneKeys(courseDeleted), [courseDeleted])
  const cells = useMemo(() => monthGrid(year, month0), [year, month0])
  // 热力：done 数决定深浅；未来有待办 → 右上角小点，不点亮
  const dayStats = useMemo(() => {
    const map = new Map<string, { done: number; futureTodo: boolean }>()
    const today = todayISO()
    for (const iso of cells) {
      if (!iso) continue
      const dayItems = mergedItemsForDate(iso, items, templates, semester, holidays, makeupDays, deleted)
      map.set(iso, {
        done: dayItems.filter((e) => e.status === 'done').length,
        futureTodo: iso > today && dayItems.some((e) => e.status === 'todo'),
      })
    }
    return map
  }, [cells, items, templates, semester, holidays, makeupDays, deleted])
  const touchedDays = useMemo(() => {
    let n = 0
    dayStats.forEach((s) => {
      if (s.done > 0) n += 1
    })
    return n
  }, [dayStats])

  const selectedItems = useMemo(
    () => mergedItemsForDate(selected, items, templates, semester, holidays, makeupDays, deleted),
    [selected, items, templates, semester, holidays, makeupDays, deleted],
  )

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month0 + delta, 1)
    setYear(d.getFullYear())
    setMonth0(d.getMonth())
  }

  const handleDelete = (e: Item) => {
    if (e.source === 'course') {
      if (window.confirm(`删除这次课「${e.text}」？之后可在课表页恢复。`)) {
        deleteCourseOccurrence(e)
      }
    } else {
      deleteItem(e.id)
    }
  }

  const today = todayISO()

  return (
    <div className="px-5 pb-6 pt-8">
      <header className="flex items-baseline justify-between">
        <h1 className="text-[22px] font-semibold text-ink">
          {year}年{month0 + 1}月
        </h1>
        <div className="flex items-center gap-3 text-[16px] text-softgray">
          <button type="button" onClick={() => shiftMonth(-1)} aria-label="上个月" className="px-1">
            ‹
          </button>
          <button type="button" onClick={() => shiftMonth(1)} aria-label="下个月" className="px-1">
            ›
          </button>
        </div>
      </header>
      <p className="mt-1 text-[13px] text-softgray">
        {touchedDays > 0 ? `这个月你留下了 ${touchedDays} 天的痕迹` : '这一页还等着你的第一笔'}
      </p>

      {/* 月视图热力图：颜色越深记录越多；未来有待办只画小点 */}
      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {WEEKDAY_HEADS.map((w) => (
          <div key={w} className="pb-1 text-center text-[11px] text-softgray">
            {w}
          </div>
        ))}
        {cells.map((iso, i) => {
          if (!iso) return <div key={`blank-${i}`} className="aspect-square" />
          const dayNum = Number(iso.slice(8, 10))
          const stat = dayStats.get(iso) ?? { done: 0, futureTodo: false }
          const has = stat.done > 0
          const isToday = iso === today
          const isSelected = iso === selected
          return (
            <button key={iso} type="button" onClick={() => setSelected(iso)} className="aspect-square">
              <span
                className={`relative flex h-full w-full items-center justify-center rounded-md text-[13px] transition-colors ${
                  isToday && !has ? 'bg-white text-blue ring-[1.5px] ring-inset ring-blue' : heatClass(stat.done)
                } ${isToday && has ? 'ring-[1.5px] ring-inset ring-blue' : ''} ${
                  isSelected && !isToday && !has ? 'ring-[1.5px] ring-inset ring-softgray/50' : ''
                }`}
              >
                {dayNum}
                {stat.futureTodo && (
                  <span className="absolute right-1 top-1 h-[5px] w-[5px] rounded-full bg-blue" />
                )}
              </span>
            </button>
          )
        })}
      </div>

      <hr className="mt-5 border-mist" />

      {/* 选中的一天：可记可补 */}
      <section className="mt-4">
        <h2 className="text-[13px] text-softgray">
          {formatCnDate(selected)} {weekdayCn(selected)}
          {selected === today && <span className="ml-2 font-medium text-blue">今天</span>}
        </h2>
        <div className="mt-3">
          <Composer date={selected} />
        </div>
        <div className="mt-2">
          <DayList
            items={selectedItems}
            onToggle={toggleItem}
            onEdit={(e) => setEditing(e)}
            onBackfill={(e) => setBackfilling(e)}
            onDelete={handleDelete}
          />
        </div>
      </section>

      <BackfillDialog item={backfilling} onClose={() => setBackfilling(null)} />
      <EditItemDialog item={editing} onClose={() => setEditing(null)} />
    </div>
  )
}
