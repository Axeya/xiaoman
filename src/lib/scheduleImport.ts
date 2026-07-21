import type { CourseTemplate, Holiday, ImportResult, MakeupDay, Semester } from '@/types'

/**
 * 校历 + 课表 Excel 解析（三 sheet 格式）：
 * - 教学日历：月份/周次/一~日，合并单元格向下填充；同一教学周跨月时拆成两行
 * - 任课表：矩阵，首列「节次\n时间」，列头星期一~星期五
 * - 节假日速查：节日/调休 | 日期 | 所在周次；「调休上课」进待确认列表
 */

const CN_MONTHS: Record<string, number> = {
  一月: 1, 二月: 2, 三月: 3, 四月: 4, 五月: 5, 六月: 6,
  七月: 7, 八月: 8, 九月: 9, 十月: 10, 十一月: 11, 十二月: 12,
}
const CN_WEEKDAY_CHARS: Record<string, number> = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7,
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate()
}

let seq = 0
function uid(prefix: string): string {
  seq += 1
  return `${prefix}-${Date.now()}-${seq}-${Math.random().toString(36).slice(2, 6)}`
}

interface TermInfo {
  /** 学年起始年（第一学期所在秋） */
  fallYear: number
  /** 第二学期（春）所在年 */
  springYear: number
  term: 1 | 2
  name: string
}

/** "2025-2026 学年第二学期教学日历" → 学年信息 */
export function parseTermTitle(title: string): TermInfo | null {
  const m = title.match(/(\d{4})\s*[-–—]\s*(\d{4})\s*学年\s*第([一二])学期/)
  if (!m) return null
  const y1 = Number(m[1])
  const y2 = Number(m[2])
  const term = m[3] === '一' ? 1 : 2
  return {
    fallYear: y1,
    springYear: term === 2 ? y2 : y1 + 1,
    term,
    name: `${y1}-${y2} 学年第${m[3]}学期`,
  }
}

/** 月份 → 年份（跨年推断：第二学期 2~7 月属春季年；第一学期 9~12 属秋季年，1~2 属次年） */
export function resolveYear(month: number, termInfo: TermInfo): number {
  if (termInfo.term === 2) return termInfo.springYear
  if (month >= 9) return termInfo.fallYear
  if (month <= 2) return termInfo.fallYear + 1
  return termInfo.fallYear
}

interface CalendarParse {
  semester: Semester
  endDate: string
}

/** 解析「教学日历」sheet */
export function parseCalendarSheet(rows: string[][]): CalendarParse | null {
  if (rows.length < 3) return null
  const termInfo = parseTermTitle(rows[0]?.[0] ?? '')
  if (!termInfo) return null

  // 表头行：包含「周次」
  const headerIdx = rows.findIndex((r) => r.some((c) => c.includes('周次')))
  if (headerIdx < 0) return null
  const header = rows[headerIdx]
  const weekCol = header.findIndex((c) => c.includes('周次'))
  const monthCol = 0
  const dayCols = [2, 3, 4, 5, 6, 7, 8] // 一~日

  // 按教学周分组（同一周跨月拆成两行，按列取首个非空）
  const weekRows = new Map<number, string[][]>()
  let curMonth = ''
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (row[monthCol]) curMonth = row[monthCol]
    const wm = (row[weekCol] ?? '').match(/第\s*(\d+)\s*周/)
    if (!wm) continue
    const week = Number(wm[1])
    const list = weekRows.get(week) ?? []
    // 携带该行的月份（填充后）
    list.push([curMonth, ...row])
    weekRows.set(week, list)
  }
  if (weekRows.size === 0) return null

  // 每周一~日的真实日期
  const weekDates = new Map<number, string[]>() // week -> 7 个 ISO 日期
  for (const [week, group] of weekRows) {
    // 按列合并（group 行里跳过行首携带的月份标记）
    const merged: string[] = []
    for (const c of dayCols) {
      let v = ''
      for (const g of group) {
        const cell = g[c + 1] ?? '' // +1 因为行首塞了月份
        if (cell !== '') {
          v = cell
          break
        }
      }
      merged.push(v)
    }
    // 该周起始月份：group 第一行的月份
    let month = CN_MONTHS[group[0][0]] ?? 3
    let lastDay = 0
    const dates: string[] = []
    for (const cell of merged) {
      const num = Number(cell)
      const isNum = cell !== '' && Number.isInteger(num)
      if (isNum) {
        if (lastDay > 0 && num <= lastDay) month = (month % 12) + 1
        lastDay = num
      } else if (cell !== '') {
        // 节日文字：日期 = 前一天 + 1
        let d = lastDay + 1
        if (d > daysInMonth(resolveYear(month, termInfo), month)) {
          month = (month % 12) + 1
          d = 1
        }
        lastDay = d
      } else {
        dates.push('')
        continue
      }
      dates.push(iso(resolveYear(month, termInfo), month, lastDay))
    }
    weekDates.set(week, dates)
  }

  const week1 = weekDates.get(1)
  const startDate = week1?.[0]
  if (!startDate) return null
  const totalWeeks = Math.max(...weekRows.keys())
  const start = new Date(startDate)
  const end = new Date(start)
  end.setDate(end.getDate() + (totalWeeks - 1) * 7 + 6)

  return {
    semester: { name: termInfo.name, startDate, totalWeeks },
    endDate: iso(end.getFullYear(), end.getMonth() + 1, end.getDate()),
  }
}

/** 解析「任课表」矩阵 sheet → 课程模板 */
export function parseCoursesSheet(rows: string[][], totalWeeks: number): { templates: CourseTemplate[]; skippedCells: number } {
  const headerIdx = rows.findIndex((r) => r.some((c) => c.includes('星期一')))
  if (headerIdx < 0) return { templates: [], skippedCells: 0 }
  const header = rows[headerIdx]
  const weekdayCols: { col: number; weekday: number }[] = []
  header.forEach((c, i) => {
    const m = c.match(/星期([一二三四五六日天])/)
    if (m) weekdayCols.push({ col: i, weekday: CN_WEEKDAY_CHARS[m[1]] })
  })

  const templates: CourseTemplate[] = []
  let skippedCells = 0
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    const first = (row[0] ?? '').trim()
    if (!first) continue
    if (/^(课间|分隔|午休)/.test(first)) continue
    const label = first.split('\n')[0].trim()
    const tm = first.match(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/)
    if (!tm) continue // 没有时间信息的行不视为课节
    const [sh, sm] = tm[1].split(':').map(Number)
    const time = `${pad(sh)}:${pad(sm)}`
    for (const { col, weekday } of weekdayCols) {
      const cell = (row[col] ?? '').trim()
      if (!cell) continue
      const lines = cell.split('\n').map((s) => s.trim()).filter(Boolean)
      if (lines.length === 0) {
        skippedCells += 1
        continue
      }
      templates.push({
        id: uid('ct'),
        name: lines[0],
        className: lines[1] ?? '',
        weekday,
        time,
        periodLabel: label,
        weekStart: 1,
        weekEnd: totalWeeks,
      })
    }
  }
  return { templates, skippedCells }
}

/** 解析「节假日速查」sheet */
export function parseHolidaysSheet(
  rows: string[][],
  termInfo: TermInfo,
): { holidays: Holiday[]; makeupDays: MakeupDay[] } {
  const headerIdx = rows.findIndex((r) => r.some((c) => c.includes('日期')))
  if (headerIdx < 0) return { holidays: [], makeupDays: [] }
  const holidays: Holiday[] = []
  const makeupDays: MakeupDay[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    const name = (row[0] ?? '').trim()
    const dateStr = (row[1] ?? '').trim()
    if (!name || !dateStr) continue
    const dm = dateStr.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*[（(]?([一二三四五六日天])?/)
    if (!dm) continue
    const month = Number(dm[1])
    const day = Number(dm[2])
    const year = resolveYear(month, termInfo)
    const date = iso(year, month, day)
    const weekday = dm[3] ? CN_WEEKDAY_CHARS[dm[3]] : ((new Date(date).getDay() + 6) % 7) + 1
    if (name.includes('调休') && name.includes('上课')) {
      makeupDays.push({ date, name, followWeekday: null })
    } else {
      holidays.push({ date, name, off: weekday >= 1 && weekday <= 5 })
    }
  }
  return { holidays, makeupDays }
}

function pickSheet(sheets: Record<string, string[][]>, keywords: string[]): string[][] | null {
  for (const [name, rows] of Object.entries(sheets)) {
    if (keywords.some((k) => name.includes(k))) return rows
  }
  return null
}

/** 解析整个工作簿（sheet 名 → 二维字符串数组） */
export function parseWorkbookRows(sheets: Record<string, string[][]>): ImportResult | { error: string } {
  const calendarRows = pickSheet(sheets, ['教学日历', '日历'])
  const coursesRows = pickSheet(sheets, ['任课', '课表'])
  const holidaysRows = pickSheet(sheets, ['节假日', '调休', '速查'])
  if (!calendarRows) return { error: '没有找到「教学日历」sheet' }

  const cal = parseCalendarSheet(calendarRows)
  if (!cal) return { error: '教学日历解析失败：未识别学年标题或第1周起始日' }

  const termInfo = parseTermTitle(calendarRows[0]?.[0] ?? '')!
  const { templates, skippedCells } = coursesRows
    ? parseCoursesSheet(coursesRows, cal.semester.totalWeeks)
    : { templates: [], skippedCells: 0 }
  const { holidays, makeupDays } = holidaysRows
    ? parseHolidaysSheet(holidaysRows, termInfo)
    : { holidays: [], makeupDays: [] }

  return {
    semester: cal.semester,
    endDate: cal.endDate,
    courseTemplates: templates,
    holidays,
    makeupDays,
    skippedCells,
  }
}
