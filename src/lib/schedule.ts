import type { CourseTemplate, Holiday, Item, MakeupDay, Semester } from '@/types'
import { getTeachingWeek, todayISO, weekdayOf } from './dateUtils'

/** 某天的教学周数（不在学期内返回 null） */
export function teachingWeekOf(iso: string, semester: Semester | null): number | null {
  if (!semester) return null
  return getTeachingWeek(iso, semester.startDate, semester.totalWeeks)
}

/** 某天是否是放假日（节假日落在工作日） */
export function isHolidayOff(iso: string, holidays: Holiday[]): boolean {
  return holidays.some((h) => h.date === iso && h.off)
}

/** 某天按周几的课表上课（调休决定；无调休则为当天星期） */
export function effectiveWeekday(iso: string, makeupDays: MakeupDay[]): number | null {
  const mk = makeupDays.find((m) => m.date === iso)
  if (mk) return mk.followWeekday // null = 待确认，先不上课
  return weekdayOf(iso)
}

/**
 * 课程铺底规则（用户明确要求）：
 * - 日期 < 今天：课程是该天的记录（status done）
 * - 日期 >= 今天：课程是待办（status todo，可点完成变记录）
 * 虚拟条目不落库；完成课程待办时落库 course 来源条目（去重键 courseId+date）
 */
/** 课程课次的去重键（override / 墓碑共用） */
export function courseKey(courseId: string, date: string): string {
  return `${courseId}|${date}`
}

/** 墓碑键集合 */
export function tombstoneKeys(deleted: { courseId: string; date: string }[]): Set<string> {
  return new Set(deleted.map((t) => courseKey(t.courseId, t.date)))
}

export function virtualCourseItems(
  iso: string,
  templates: CourseTemplate[],
  semester: Semester | null,
  holidays: Holiday[],
  makeupDays: MakeupDay[],
  deleted?: Set<string>,
): Item[] {
  if (!semester) return []
  if (isHolidayOff(iso, holidays)) return []
  const week = teachingWeekOf(iso, semester)
  if (week === null) return []
  const wd = effectiveWeekday(iso, makeupDays)
  if (wd === null) return []
  const today = todayISO()
  const status: Item['status'] = iso < today ? 'done' : 'todo'
  return templates
    .filter((c) => c.weekday === wd && week >= c.weekStart && week <= c.weekEnd)
    .filter((c) => !deleted?.has(courseKey(c.id, iso)))
    .map((c) => ({
      id: `vc-${c.id}-${iso}`,
      date: iso,
      time: c.time,
      text: c.className ? `${c.name} · ${c.className}` : c.name,
      tags: [],
      kind: 'todo' as const,
      status,
      source: 'course' as const,
      courseId: c.id,
      periodLabel: c.periodLabel,
      className: c.className,
      createdAt: 0,
    }))
}

/** 合并某天的落库条目 + 虚拟课程条目（override 优先于虚拟；墓碑跳过） */
export function mergedItemsForDate(
  iso: string,
  items: Item[],
  templates: CourseTemplate[],
  semester: Semester | null,
  holidays: Holiday[],
  makeupDays: MakeupDay[],
  deleted?: Set<string>,
): Item[] {
  const stored = items
    .filter((e) => e.date === iso)
    .filter((e) => !(e.source === 'course' && e.courseId && deleted?.has(courseKey(e.courseId, iso))))
  const storedCourseKeys = new Set(stored.filter((e) => e.source === 'course' && e.courseId).map((e) => `${e.courseId}`))
  const virtual = virtualCourseItems(iso, templates, semester, holidays, makeupDays, deleted).filter(
    (v) => !storedCourseKeys.has(v.courseId ?? ''),
  )
  return [...stored, ...virtual].sort((a, b) =>
    a.time === b.time ? a.createdAt - b.createdAt : a.time.localeCompare(b.time),
  )
}

/** 某天是否有内容（日历点亮，有即满） */
export function dayHasContent(
  iso: string,
  items: Item[],
  templates: CourseTemplate[],
  semester: Semester | null,
  holidays: Holiday[],
  makeupDays: MakeupDay[],
  deleted?: Set<string>,
): boolean {
  const visible = items.some(
    (e) =>
      e.date === iso &&
      !(e.source === 'course' && e.courseId && deleted?.has(courseKey(e.courseId, iso))),
  )
  if (visible) return true
  return virtualCourseItems(iso, templates, semester, holidays, makeupDays, deleted).length > 0
}

export interface WeekStats {
  total: number
  reading: number
  todoDone: number
  courseCount: number
}

/** 本周小结：共记 N 笔 · 阅读 X 次 · 完成待办 X 件 · 上课 X 节 */
export function weekStats(
  dates: string[],
  items: Item[],
  templates: CourseTemplate[],
  semester: Semester | null,
  holidays: Holiday[],
  makeupDays: MakeupDay[],
  deleted?: Set<string>,
): WeekStats {
  const set = new Set(dates)
  const weekItems = items
    .filter((e) => set.has(e.date))
    .filter((e) => !(e.source === 'course' && e.courseId && deleted?.has(courseKey(e.courseId, e.date))))
  let courseCount = 0
  for (const iso of dates) {
    courseCount += virtualCourseItems(iso, templates, semester, holidays, makeupDays, deleted).length
  }
  return {
    total: weekItems.filter((e) => e.status === 'done').length,
    reading: weekItems.filter((e) => e.tags.includes('阅读')).length,
    todoDone: weekItems.filter((e) => e.kind === 'todo' && e.status === 'done').length,
    courseCount,
  }
}
