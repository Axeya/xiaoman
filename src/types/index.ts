/** 统一条目模型：
 * - kind 'note'：记录；kind 'todo'：待办
 * - status 'done' 的任何条目都是时间线里的一条记录；'todo' 是待办
 * - source 'course' 的课程条目平时虚拟生成，完成课程待办时落库（去重键 courseId + date）
 */
export interface Item {
  id: string
  /** YYYY-MM-DD */
  date: string
  /** HH:MM */
  time: string
  text: string
  tags: string[]
  kind: 'note' | 'todo'
  status: 'done' | 'todo'
  source: 'manual' | 'course'
  /** 课程模板 id（虚拟课程条目也有，以 vc- 前缀区分未落库） */
  courseId?: string
  createdAt: number
  completedAt?: number
  /** 课程附加信息（虚拟条目携带） */
  periodLabel?: string
  className?: string
  /** 备注/反思（课程条目与手动记录均可补充） */
  note?: string
}

/** 课程删除墓碑：渲染时跳过该 courseId+date，可恢复 */
export interface CourseTombstone {
  courseId: string
  date: string
  /** 删除时的展示文案快照（模板被删后也能显示） */
  label: string
}

export interface CourseTemplate {
  id: string
  /** 如 语文 / 教研 / 192早读 */
  name: string
  /** 如 初192班，可空 */
  className: string
  /** 1=周一 … 7=周日 */
  weekday: number
  /** 开始时间 HH:MM */
  time: string
  /** 如 早读 / 第一节 */
  periodLabel: string
  weekStart: number
  weekEnd: number
}

export interface Semester {
  /** 如 "2025-2026 学年第二学期" */
  name: string
  /** YYYY-MM-DD，第 1 周周一 */
  startDate: string
  totalWeeks: number
}

export interface Holiday {
  /** YYYY-MM-DD */
  date: string
  name: string
  /** true=落在工作日，不排课；false=落在周末，仅展示 */
  off: boolean
}

/** 调休上课日：followWeekday 为 null 时待在"待确认"列表 */
export interface MakeupDay {
  date: string
  name: string
  /** 按周几的课表上课，1-7；null=待确认 */
  followWeekday: number | null
}

export type TabKey = 'today' | 'calendar' | 'schedule'

/** 导入解析结果（预览用） */
export interface ImportResult {
  semester: Semester
  endDate: string
  courseTemplates: CourseTemplate[]
  holidays: Holiday[]
  makeupDays: MakeupDay[]
  skippedCells: number
}
