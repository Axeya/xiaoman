import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import type { ImportResult } from '@/types'
import { useStore } from '@/store/useStore'
import { parseWorkbookRows } from '@/lib/scheduleImport'
import { shortCnDate } from '@/lib/dateUtils'

const WD = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']
const labelCls = 'block text-[12px] text-softgray'
const inputCls = 'mt-1 w-full rounded-lg bg-mist px-2.5 py-2 text-[14px] text-ink outline-none'

type Stage =
  | { step: 'idle' }
  | { step: 'preview'; result: ImportResult }
  | { step: 'error'; message: string }

export default function SchedulePage() {
  const templates = useStore((s) => s.courseTemplates)
  const semester = useStore((s) => s.semester)
  const semesterEnd = useStore((s) => s.semesterEnd)
  const holidays = useStore((s) => s.holidays)
  const makeupDays = useStore((s) => s.makeupDays)
  const importSemester = useStore((s) => s.importSemester)
  const setMakeupWeekday = useStore((s) => s.setMakeupWeekday)
  const removeMakeupDay = useStore((s) => s.removeMakeupDay)
  const deleteCourseTemplate = useStore((s) => s.deleteCourseTemplate)
  const addCourseTemplate = useStore((s) => s.addCourseTemplate)
  const setSemester = useStore((s) => s.setSemester)
  const addHoliday = useStore((s) => s.addHoliday)
  const removeHoliday = useStore((s) => s.removeHoliday)
  const courseDeleted = useStore((s) => s.courseDeleted)
  const restoreCourseOccurrence = useStore((s) => s.restoreCourseOccurrence)

  const fileRef = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<Stage>({ step: 'idle' })
  const [showTweak, setShowTweak] = useState(false)
  const [showCourses, setShowCourses] = useState(false)
  const [msg, setMsg] = useState('')

  // 手动微调表单
  const [mName, setMName] = useState('')
  const [mWeekday, setMWeekday] = useState(1)
  const [mTime, setMTime] = useState('08:00')
  const [mLabel, setMLabel] = useState('')
  const [mClass, setMClass] = useState('')
  const [hDate, setHDate] = useState('')
  const [hName, setHName] = useState('')

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheets: Record<string, string[][]> = {}
      for (const name of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: '' })
        sheets[name] = rows
          .map((r) => (Array.isArray(r) ? r.map((c) => String(c).trim()) : []))
          .filter((r) => r.some((c) => c !== ''))
      }
      const result = parseWorkbookRows(sheets)
      if ('error' in result) {
        setStage({ step: 'error', message: result.error })
      } else {
        setStage({ step: 'preview', result })
      }
    } catch {
      setStage({ step: 'error', message: '文件解析失败，请确认是 .xlsx 或 .csv' })
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const confirmImport = (result: ImportResult) => {
    if (semester && !window.confirm(`已存在学期「${semester.name}」，导入将替换旧学期数据（课程模板、校历、节假日），确认继续？`)) {
      return
    }
    importSemester(result)
    setStage({ step: 'idle' })
    setMsg(`已导入「${result.semester.name}」：${result.courseTemplates.length} 门课程模板、${result.holidays.length} 条节假日、${result.makeupDays.length} 条调休待确认`)
  }

  const pendingMakeup = makeupDays.filter((m) => m.followWeekday === null)
  const confirmedMakeup = makeupDays.filter((m) => m.followWeekday !== null)

  return (
    <div className="px-5 pb-6 pt-8">
      <header>
        <h1 className="text-[22px] font-semibold text-ink">课表</h1>
        <p className="mt-1 text-[13px] text-softgray">
          {semester
            ? `${semester.name} · ${semester.startDate} ~ ${semesterEnd ?? ''} · 共${semester.totalWeeks}周`
            : '上传校历与课表 Excel，每个教学日自动有课程铺底'}
        </p>
      </header>

      {/* 一键导入 */}
      <section className="mt-6">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => void handleFile(e.target.files?.[0])}
          className="block w-full text-[13px] text-softgray file:mr-3 file:rounded-full file:border-0 file:bg-blue file:px-4 file:py-2 file:text-[13px] file:font-medium file:text-white"
        />
        {msg && <p className="mt-2 text-[13px] text-blue">{msg}</p>}
        {stage.step === 'error' && <p className="mt-2 text-[13px] text-red-500">{stage.message}</p>}
      </section>

      {/* 导入预览 */}
      {stage.step === 'preview' && (
        <section className="mt-4 rounded-2xl bg-mist/60 p-4">
          <h2 className="text-[15px] font-medium text-ink">导入预览</h2>
          <dl className="mt-2 space-y-1 text-[13px] text-ink/80">
            <div>学期：{stage.result.semester.name}</div>
            <div>
              起止：{stage.result.semester.startDate} ~ {stage.result.endDate}（共 {stage.result.semester.totalWeeks} 周）
            </div>
            <div>课程模板：{stage.result.courseTemplates.length} 门</div>
            <div>节假日：{stage.result.holidays.length} 条</div>
            <div>调休待确认：{stage.result.makeupDays.length} 条</div>
          </dl>

          <details className="mt-3">
            <summary className="cursor-pointer text-[13px] text-blue">抽查课程列表</summary>
            <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-[12px] text-ink/70">
              {[...stage.result.courseTemplates]
                .sort((a, b) => (a.weekday === b.weekday ? a.time.localeCompare(b.time) : a.weekday - b.weekday))
                .map((c) => (
                  <li key={c.id}>
                    {WD[c.weekday]} {c.time} {c.periodLabel} · {c.name}
                    {c.className ? ` ${c.className}` : ''}
                  </li>
                ))}
            </ul>
          </details>

          {stage.result.makeupDays.length > 0 && (
            <p className="mt-2 text-[12px] text-softgray">调休上课日导入后可在下方选择「按周几上课」。</p>
          )}

          <div className="mt-4 flex justify-end gap-4">
            <button type="button" onClick={() => setStage({ step: 'idle' })} className="text-[13px] text-softgray">
              取消
            </button>
            <button
              type="button"
              onClick={() => confirmImport(stage.result)}
              className="rounded-full bg-blue px-4 py-1.5 text-[13px] font-medium text-white"
            >
              确认导入
            </button>
          </div>
        </section>
      )}

      {/* 调休待确认 */}
      {pendingMakeup.length > 0 && (
        <section className="mt-6">
          <h2 className="text-[15px] font-medium text-ink">调休上课 · 待确认</h2>
          <ul className="mt-2 space-y-2">
            {pendingMakeup.map((m) => (
              <li key={m.date} className="flex items-center gap-2 rounded-xl bg-mist/60 px-3 py-2.5">
                <span className="min-w-0 flex-1 text-[13px] text-ink">
                  {shortCnDate(m.date)} {m.name}
                </span>
                <select
                  value=""
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    if (v >= 1 && v <= 7) setMakeupWeekday(m.date, v)
                  }}
                  className="rounded-lg bg-white px-2 py-1.5 text-[12px] text-ink outline-none"
                >
                  <option value="" disabled>
                    按周几上课
                  </option>
                  {[1, 2, 3, 4, 5, 6, 7].map((w) => (
                    <option key={w} value={w}>
                      {WD[w]}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => removeMakeupDay(m.date)} aria-label="忽略" className="text-softgray">
                  ×
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 当前课表概览 */}
      {templates.length > 0 && (
        <section className="mt-6">
          <button
            type="button"
            onClick={() => setShowCourses((v) => !v)}
            className="flex w-full items-center justify-between text-[15px] font-medium text-ink"
          >
            <span>当前课表 · {templates.length} 门</span>
            <span className="text-[12px] font-normal text-softgray">{showCourses ? '收起' : '展开'}</span>
          </button>
          {showCourses && (
            <ul className="mt-2">
              {[...templates]
                .sort((a, b) => (a.weekday === b.weekday ? a.time.localeCompare(b.time) : a.weekday - b.weekday))
                .map((c) => (
                  <li key={c.id} className="flex items-baseline gap-2 border-b border-mist py-2.5">
                    <span className="min-w-0 flex-1 text-[14px] text-ink">
                      {c.name}
                      {c.className ? ` ${c.className}` : ''}
                      <span className="ml-2 text-[12px] text-softgray">
                        {WD[c.weekday]} {c.time} {c.periodLabel}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteCourseTemplate(c.id)}
                      className="shrink-0 text-[11px] text-softgray underline decoration-mist underline-offset-2"
                    >
                      删除
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </section>
      )}

      {/* 节假日与调休概览 */}
      {(holidays.length > 0 || confirmedMakeup.length > 0) && (
        <section className="mt-6">
          <h2 className="text-[15px] font-medium text-ink">节假日</h2>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {holidays.map((h) => (
              <li
                key={h.date}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] ${h.off ? 'bg-mist text-ink/70' : 'bg-mist/50 text-softgray'}`}
              >
                {shortCnDate(h.date)} {h.name}
                {!h.off && <span className="text-[10px]">（周末）</span>}
                <button type="button" onClick={() => removeHoliday(h.date)} aria-label="删除" className="text-softgray">
                  ×
                </button>
              </li>
            ))}
            {confirmedMakeup.map((m) => (
              <li key={m.date} className="flex items-center gap-1.5 rounded-full bg-blue/10 px-2.5 py-1 text-[12px] text-blue">
                {shortCnDate(m.date)} 按{WD[m.followWeekday ?? 1]}上课
                <button type="button" onClick={() => removeMakeupDay(m.date)} aria-label="删除" className="text-blue/60">
                  ×
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 已删除的课程：可恢复 */}
      {courseDeleted.length > 0 && (
        <section className="mt-6">
          <h2 className="text-[15px] font-medium text-ink">已删除的课程 · {courseDeleted.length}</h2>
          <ul className="mt-2">
            {[...courseDeleted]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((t) => (
                <li
                  key={`${t.courseId}|${t.date}`}
                  className="flex items-baseline gap-2 border-b border-mist py-2.5"
                >
                  <span className="min-w-0 flex-1 text-[14px] text-softgray line-through decoration-mist">
                    {t.label}
                    <span className="ml-2 text-[12px] no-underline">{shortCnDate(t.date)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => restoreCourseOccurrence(t.courseId, t.date)}
                    className="shrink-0 text-[12px] font-medium text-blue"
                  >
                    恢复
                  </button>
                </li>
              ))}
          </ul>
          <p className="mt-1 text-[12px] text-softgray">恢复后课程会重新出现在当天时间线</p>
        </section>
      )}

      {/* 手动微调 */}
      <section className="mt-8">
        <button
          type="button"
          onClick={() => setShowTweak((v) => !v)}
          className="flex w-full items-center justify-between text-[13px] text-softgray"
        >
          <span>手动微调</span>
          <span>{showTweak ? '收起' : '展开'}</span>
        </button>

        {showTweak && (
          <div className="mt-4 space-y-6">
            {/* 校历 */}
            <div>
              <h3 className="text-[13px] font-medium text-ink">校历</h3>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <label className="col-span-2">
                  <span className={labelCls}>学期名称</span>
                  <input
                    value={semester?.name ?? ''}
                    onChange={(e) => setSemester({ name: e.target.value })}
                    placeholder="如 2026 春季"
                    className={inputCls}
                  />
                </label>
                <label>
                  <span className={labelCls}>学期开始日期</span>
                  <input
                    type="date"
                    value={semester?.startDate ?? ''}
                    onChange={(e) => e.target.value && setSemester({ startDate: e.target.value })}
                    className={inputCls}
                  />
                </label>
                <label>
                  <span className={labelCls}>教学周总数</span>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={semester?.totalWeeks ?? 16}
                    onChange={(e) => setSemester({ totalWeeks: Math.max(1, Number(e.target.value) || 1) })}
                    className={inputCls}
                  />
                </label>
              </div>
            </div>

            {/* 手动加节假日 */}
            <div>
              <h3 className="text-[13px] font-medium text-ink">添加节假日（工作日不排课）</h3>
              <div className="mt-2 flex items-center gap-2">
                <input type="date" value={hDate} onChange={(e) => setHDate(e.target.value)} className={`${inputCls} mt-0 flex-1`} />
                <input
                  value={hName}
                  onChange={(e) => setHName(e.target.value)}
                  placeholder="名称"
                  className={`${inputCls} mt-0 w-24`}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (hDate) {
                      const wd = new Date(hDate).getDay()
                      addHoliday({ date: hDate, name: hName.trim() || '假日', off: wd >= 1 && wd <= 5 })
                      setHName('')
                    }
                  }}
                  className="shrink-0 text-[13px] font-medium text-blue"
                >
                  添加
                </button>
              </div>
            </div>

            {/* 手动加课程 */}
            <div>
              <h3 className="text-[13px] font-medium text-ink">添加课程</h3>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <label className="col-span-2">
                  <span className={labelCls}>课程名</span>
                  <input value={mName} onChange={(e) => setMName(e.target.value)} placeholder="如 语文" className={inputCls} />
                </label>
                <label>
                  <span className={labelCls}>星期</span>
                  <select value={mWeekday} onChange={(e) => setMWeekday(Number(e.target.value))} className={inputCls}>
                    {[1, 2, 3, 4, 5, 6, 7].map((w) => (
                      <option key={w} value={w}>
                        {WD[w]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={labelCls}>开始时间</span>
                  <input type="time" value={mTime} onChange={(e) => setMTime(e.target.value)} className={inputCls} />
                </label>
                <label>
                  <span className={labelCls}>节次名（选填）</span>
                  <input value={mLabel} onChange={(e) => setMLabel(e.target.value)} placeholder="如 第一节" className={inputCls} />
                </label>
                <label>
                  <span className={labelCls}>班级/地点（选填）</span>
                  <input value={mClass} onChange={(e) => setMClass(e.target.value)} placeholder="如 初192班" className={inputCls} />
                </label>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!mName.trim()) return
                  const total = semester?.totalWeeks ?? 16
                  addCourseTemplate({
                    name: mName.trim(),
                    className: mClass.trim(),
                    weekday: mWeekday,
                    time: mTime,
                    periodLabel: mLabel.trim(),
                    weekStart: 1,
                    weekEnd: total,
                  })
                  setMName('')
                  setMLabel('')
                  setMClass('')
                }}
                disabled={!mName.trim()}
                className="mt-3 text-[13px] font-medium text-blue disabled:text-softgray"
              >
                添加课程
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
