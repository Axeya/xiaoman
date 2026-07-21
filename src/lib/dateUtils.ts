export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function nowTime(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

export function todayISO(): string {
  return toISODate(new Date())
}

const CN_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
const CN_MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
const CN_WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

/** 1-31 转中文数字 */
export function toCnDay(n: number): string {
  if (n <= 10) return CN_DIGITS[n]
  if (n < 20) return `十${CN_DIGITS[n % 10]}`
  const tens = Math.floor(n / 10)
  const ones = n % 10
  return `${CN_DIGITS[tens]}十${ones > 0 ? CN_DIGITS[ones] : ''}`
}

/** "七月二十日" */
export function formatCnDate(iso: string): string {
  const d = parseISODate(iso)
  return `${CN_MONTHS[d.getMonth()]}${toCnDay(d.getDate())}日`
}

/** 1=周一 … 7=周日 */
export function weekdayOf(iso: string): number {
  const js = parseISODate(iso).getDay() // 0=周日
  return js === 0 ? 7 : js
}

export function weekdayCn(iso: string): string {
  return CN_WEEKDAYS[weekdayOf(iso) - 1]
}

export function monthCn(year: number, month0: number): string {
  return `${CN_MONTHS[month0]} ${year}`
}

/** 由学期开始日期推算某天是第几教学周；未设置或超出范围返回 null */
export function getTeachingWeek(iso: string, semesterStart: string | null, totalWeeks: number): number | null {
  if (!semesterStart) return null
  const start = parseISODate(semesterStart).getTime()
  const cur = parseISODate(iso).getTime()
  const diffDays = Math.floor((cur - start) / 86400000)
  if (diffDays < 0) return null
  const week = Math.floor(diffDays / 7) + 1
  if (totalWeeks > 0 && week > totalWeeks) return null
  return week
}

/** 返回包含 iso 这一天的一周（周一开始）7 天日期 */
export function weekDatesOf(iso: string): string[] {
  const wd = weekdayOf(iso)
  const monday = addDays(iso, -(wd - 1))
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

/** 某年某月（month0 从 0 起）的日历格子：以周一开头，含前后补位，长度 35 或 42 */
export function monthGrid(year: number, month0: number): (string | null)[] {
  const first = new Date(year, month0, 1)
  const daysInMonth = new Date(year, month0 + 1, 0).getDate()
  let lead = first.getDay() - 1 // 周一开头
  if (lead < 0) lead = 6
  const cells: (string | null)[] = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(toISODate(new Date(year, month0, d)))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

/** "07-20" → "7月20日" 简短格式 */
export function shortCnDate(iso: string): string {
  const d = parseISODate(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export function formatTs(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
