import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CourseTemplate, CourseTombstone, Holiday, ImportResult, Item, MakeupDay, Semester } from '@/types'
import { nowTime, todayISO } from '@/lib/dateUtils'

export const DEFAULT_TAGS = ['阅读', '工作', '生活', '美食', '运动', '心情', '娱乐']
export const DONE_TAG = '完成'

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

interface XiaomanState {
  items: Item[]
  courseTemplates: CourseTemplate[]
  semester: Semester | null
  semesterEnd: string | null
  holidays: Holiday[]
  makeupDays: MakeupDay[]
  savedTags: string[]
  /** 已删除的课程课次（渲染时跳过，可恢复） */
  courseDeleted: CourseTombstone[]

  /** 在指定日期新增一条记录/待办 */
  addItem: (input: { text: string; tags: string[]; kind: 'note' | 'todo'; date: string }) => void
  /** 待办 ↔ 记录 就地切换；课程虚拟条目完成时落库 */
  toggleItem: (item: Item) => void
  deleteItem: (id: string) => void
  updateItemDateTime: (id: string, date: string, time: string) => void
  /** 更新落库条目的标题/时间/备注（手动条目与课程 override 通用） */
  updateItem: (id: string, patch: { text?: string; time?: string; note?: string }) => void
  /**
   * 课程条目编辑落库（override）：以 courseId+date 为去重键；
   * 已存在 override 则更新，不存在则以虚拟条目的状态新建
   */
  upsertCourseItem: (input: {
    courseId: string
    date: string
    time: string
    text: string
    note?: string
    status: 'done' | 'todo'
    periodLabel?: string
    className?: string
    tags?: string[]
  }) => void
  /** 删除课程课次：打墓碑（虚拟与落库条目一并隐藏，可恢复） */
  deleteCourseOccurrence: (item: Item) => void
  /** 恢复已删除的课程课次 */
  restoreCourseOccurrence: (courseId: string, date: string) => void

  addTag: (tag: string) => void
  removeTag: (tag: string) => void

  /** 确认导入：整学期替换旧数据 */
  importSemester: (result: ImportResult) => void
  setMakeupWeekday: (date: string, weekday: number) => void
  removeMakeupDay: (date: string) => void

  // 手动微调
  setSemester: (s: Partial<Semester>) => void
  addHoliday: (h: Holiday) => void
  removeHoliday: (date: string) => void
  addCourseTemplate: (c: Omit<CourseTemplate, 'id'>) => void
  deleteCourseTemplate: (id: string) => void
}

export const useStore = create<XiaomanState>()(
  persist(
    (set, get) => ({
      items: [],
      courseTemplates: [],
      semester: null,
      semesterEnd: null,
      holidays: [],
      makeupDays: [],
      savedTags: [...DEFAULT_TAGS],
      courseDeleted: [],

      addItem: ({ text, tags, kind, date }) => {
        const trimmed = text.trim()
        if (!trimmed) return
        const item: Item = {
          id: uid('i'),
          date,
          time: nowTime(),
          text: trimmed,
          tags,
          kind,
          status: kind === 'note' ? 'done' : 'todo',
          source: 'manual',
          createdAt: Date.now(),
        }
        set((s) => ({ items: [...s.items, item] }))
      },

      toggleItem: (item) => {
        // 虚拟课程条目：完成 → 落库一条 course 记录（去重键 courseId+date）
        if (item.id.startsWith('vc-')) {
          if (item.status !== 'todo') return
          const exists = get().items.some(
            (e) => e.source === 'course' && e.courseId === item.courseId && e.date === item.date,
          )
          if (exists) return
          const now = Date.now()
          const record: Item = {
            ...item,
            id: uid('i'),
            status: 'done',
            tags: item.tags.includes(DONE_TAG) ? item.tags : [...item.tags, DONE_TAG],
            createdAt: now,
            completedAt: now,
          }
          set((s) => ({ items: [...s.items, record] }))
          return
        }
        // 落库条目：todo ↔ done 就地切换
        set((s) => ({
          items: s.items.map((e) => {
            if (e.id !== item.id || e.kind !== 'todo') return e
            if (e.status === 'todo') {
              const now = Date.now()
              return {
                ...e,
                status: 'done' as const,
                completedAt: now,
                tags: e.tags.includes(DONE_TAG) ? e.tags : [...e.tags, DONE_TAG],
              }
            }
            return {
              ...e,
              status: 'todo' as const,
              completedAt: undefined,
              tags: e.tags.filter((t) => t !== DONE_TAG),
            }
          }),
        }))
      },

      deleteItem: (id) => {
        set((s) => ({ items: s.items.filter((e) => e.id !== id) }))
      },

      updateItemDateTime: (id, date, time) => {
        set((s) => ({ items: s.items.map((e) => (e.id === id ? { ...e, date, time } : e)) }))
      },

      updateItem: (id, patch) => {
        set((s) => ({
          items: s.items.map((e) =>
            e.id === id
              ? {
                  ...e,
                  ...(patch.text !== undefined ? { text: patch.text.trim() || e.text } : {}),
                  ...(patch.time !== undefined ? { time: patch.time } : {}),
                  ...(patch.note !== undefined ? { note: patch.note.trim() || undefined } : {}),
                }
              : e,
          ),
        }))
      },

      upsertCourseItem: ({ courseId, date, time, text, note, status, periodLabel, className, tags }) => {
        const trimmed = text.trim()
        if (!trimmed) return
        const existing = get().items.find(
          (e) => e.source === 'course' && e.courseId === courseId && e.date === date,
        )
        if (existing) {
          set((s) => ({
            items: s.items.map((e) =>
              e.id === existing.id
                ? { ...e, time, text: trimmed, note: note?.trim() || undefined }
                : e,
            ),
          }))
          return
        }
        const now = Date.now()
        const item: Item = {
          id: uid('i'),
          date,
          time,
          text: trimmed,
          tags: tags ?? [],
          kind: 'todo',
          status,
          source: 'course',
          courseId,
          periodLabel,
          className,
          note: note?.trim() || undefined,
          createdAt: now,
          completedAt: status === 'done' ? now : undefined,
        }
        set((s) => ({ items: [...s.items, item] }))
      },

      deleteCourseOccurrence: (item) => {
        if (item.source !== 'course' || !item.courseId) return
        const key = `${item.courseId}|${item.date}`
        set((s) =>
          s.courseDeleted.some((t) => `${t.courseId}|${t.date}` === key)
            ? s
            : {
                courseDeleted: [
                  ...s.courseDeleted,
                  { courseId: item.courseId as string, date: item.date, label: item.text },
                ],
              },
        )
      },

      restoreCourseOccurrence: (courseId, date) => {
        set((s) => ({
          courseDeleted: s.courseDeleted.filter((t) => !(t.courseId === courseId && t.date === date)),
        }))
      },

      addTag: (tag) => {
        const trimmed = tag.trim()
        if (!trimmed) return
        set((s) => (s.savedTags.includes(trimmed) ? s : { savedTags: [...s.savedTags, trimmed] }))
      },

      removeTag: (tag) => {
        // 只从快捷列表移除，历史记录上的标签文字保留
        set((s) => ({ savedTags: s.savedTags.filter((t) => t !== tag) }))
      },

      importSemester: (result) => {
        set({
          semester: result.semester,
          semesterEnd: result.endDate,
          courseTemplates: result.courseTemplates,
          holidays: result.holidays,
          makeupDays: result.makeupDays,
        })
      },

      setMakeupWeekday: (date, weekday) => {
        set((s) => ({
          makeupDays: s.makeupDays.map((m) => (m.date === date ? { ...m, followWeekday: weekday } : m)),
        }))
      },

      removeMakeupDay: (date) => {
        set((s) => ({ makeupDays: s.makeupDays.filter((m) => m.date !== date) }))
      },

      setSemester: (partial) => {
        set((s) => ({
          semester: s.semester
            ? { ...s.semester, ...partial }
            : { name: '', startDate: todayISO(), totalWeeks: 16, ...partial },
        }))
      },

      addHoliday: (h) => {
        set((s) => (s.holidays.some((x) => x.date === h.date) ? s : { holidays: [...s.holidays, h] }))
      },

      removeHoliday: (date) => {
        set((s) => ({ holidays: s.holidays.filter((h) => h.date !== date) }))
      },

      addCourseTemplate: (c) => {
        set((s) => ({ courseTemplates: [...s.courseTemplates, { ...c, id: uid('ct') }] }))
      },

      deleteCourseTemplate: (id) => {
        set((s) => ({ courseTemplates: s.courseTemplates.filter((c) => c.id !== id) }))
      },
    }),
    {
      name: 'xiaoman-store',
      version: 2,
      migrate: (persisted: unknown, version: number) => {
        // v1 → v2：entries/todos 合并进统一 items；courses/calendarConfig 转成学期模型
        if (version >= 2) return persisted as XiaomanState
        const old = (persisted ?? {}) as Record<string, unknown>
        const items: Item[] = []
        const seenEntryIds = new Set<string>()

        interface OldEntry {
          id: string
          date: string
          time: string
          text: string
          tags: string[]
          source: 'manual' | 'todo'
          createdAt: number
        }
        interface OldTodo {
          id: string
          text: string
          createdAt: number
          completedAt: number | null
          entryId?: string
        }
        interface OldCourse {
          id: string
          name: string
          weekday: number
          period: number
          location: string
          weekStart: number
          weekEnd: number
        }

        const oldEntries = Array.isArray(old.entries) ? (old.entries as OldEntry[]) : []
        for (const e of oldEntries) {
          seenEntryIds.add(e.id)
          items.push({
            id: e.id,
            date: e.date,
            time: e.time,
            text: e.text,
            tags: Array.isArray(e.tags) ? e.tags : [],
            kind: e.source === 'todo' ? 'todo' : 'note',
            status: 'done',
            source: 'manual',
            createdAt: e.createdAt ?? Date.now(),
            completedAt: e.source === 'todo' ? e.createdAt : undefined,
          })
        }

        const oldTodos = Array.isArray(old.todos) ? (old.todos as OldTodo[]) : []
        for (const t of oldTodos) {
          // 已完成待办在 entries 里已有对应记录，跳过避免重复
          if (t.completedAt !== null && t.entryId && seenEntryIds.has(t.entryId)) continue
          const created = t.createdAt ?? Date.now()
          const d = new Date(created)
          const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          items.push({
            id: t.id,
            date: iso,
            time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
            text: t.text,
            tags: t.completedAt !== null ? [DONE_TAG] : [],
            kind: 'todo',
            status: t.completedAt !== null ? 'done' : 'todo',
            source: 'manual',
            createdAt: created,
            completedAt: t.completedAt ?? undefined,
          })
        }

        const oldCfg = (old.calendarConfig ?? {}) as Record<string, unknown>
        const periodTimeMap = (old.periodTimeMap ?? {}) as Record<string, string>
        const oldCourses = Array.isArray(old.courses) ? (old.courses as OldCourse[]) : []
        const courseTemplates: CourseTemplate[] = oldCourses.map((c) => ({
          id: c.id,
          name: c.name,
          className: c.location ?? '',
          weekday: c.weekday,
          time: periodTimeMap[String(c.period)] ?? '08:00',
          periodLabel: `第${c.period}节`,
          weekStart: c.weekStart ?? 1,
          weekEnd: c.weekEnd ?? 16,
        }))

        const customTags = Array.isArray(old.customTags) ? (old.customTags as string[]) : []
        const savedTags = [...DEFAULT_TAGS]
        for (const t of customTags) if (!savedTags.includes(t)) savedTags.push(t)

        const holidays: Holiday[] = Array.isArray(oldCfg.holidays)
          ? (oldCfg.holidays as string[]).map((d) => ({ date: d, name: '假日', off: true }))
          : []

        return {
          items,
          courseTemplates,
          semester: oldCfg.semesterStart
            ? {
                name: String(oldCfg.semesterName ?? ''),
                startDate: String(oldCfg.semesterStart),
                totalWeeks: Number(oldCfg.totalWeeks ?? 16),
              }
            : null,
          semesterEnd: null,
          holidays,
          makeupDays: [],
          courseDeleted: [],
          savedTags,
        } as unknown as XiaomanState
      },
    },
  ),
)
