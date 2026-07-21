/* 冒烟测试：课程虚拟条目 → 编辑 override → 删除 tombstone → 恢复 */
import { useStore } from '../src/store/useStore'
import { mergedItemsForDate, tombstoneKeys, virtualCourseItems } from '../src/lib/schedule'
import type { CourseTemplate } from '../src/types'

const semester = { name: '测试学期', startDate: '2026-03-02', totalWeeks: 22 }
const tpl: CourseTemplate = {
  id: 'ct1', name: '语文', className: '初192班', weekday: 1,
  time: '08:00', periodLabel: '第一节', weekStart: 1, weekEnd: 22,
}
const DATE = '2026-07-27' // 未来周一 → 虚拟待办

function merged() {
  const s = useStore.getState()
  return mergedItemsForDate(DATE, s.items, [tpl], semester, [], [], tombstoneKeys(s.courseDeleted))
}
function assert(cond: boolean, msg: string) {
  if (!cond) { console.error('FAIL:', msg); process.exit(1) }
  console.log('ok:', msg)
}

// 0. 清空
useStore.setState({ items: [], courseDeleted: [], courseTemplates: [tpl], semester })

// 1. 虚拟条目渲染
const virtual = virtualCourseItems(DATE, [tpl], semester, [], [])
assert(virtual.length === 1 && virtual[0].status === 'todo' && virtual[0].id.startsWith('vc-'), '虚拟课程条目为待办')

// 2. 编辑虚拟条目 → override 落库
useStore.getState().upsertCourseItem({
  courseId: 'ct1', date: DATE, time: '08:10', text: '语文 · 初192班（调课）',
  note: '今天讲了《背影》，学生反应不错。', status: 'todo', periodLabel: '第一节', className: '初192班',
})
let list = merged()
assert(list.length === 1 && !list[0].id.startsWith('vc-'), 'override 替代虚拟条目')
assert(list[0].text.includes('调课') && list[0].time === '08:10' && list[0].note?.includes('背影') === true, 'override 标题/时间/备注生效')

// 3. 再次编辑同 courseId+date → 更新而非新增
useStore.getState().upsertCourseItem({
  courseId: 'ct1', date: DATE, time: '08:10', text: '语文 · 初192班（再改）', note: '补充：明天听写。',
  status: 'todo', periodLabel: '第一节', className: '初192班',
})
list = merged()
assert(list.length === 1 && list[0].text.includes('再改') && list[0].note?.includes('听写') === true, '再次编辑为更新（不重复）')

// 4. 完成（toggle 落库条目）
useStore.getState().toggleItem(list[0])
list = merged()
assert(list.length === 1 && list[0].status === 'done' && list[0].note?.includes('听写') === true, '完成课程待办后备注保留')

// 5. 删除 → tombstone
useStore.getState().deleteCourseOccurrence(list[0])
list = merged()
assert(list.length === 0, '删除后当天不再显示该课')
assert(useStore.getState().courseDeleted.length === 1, 'tombstone 已记录')

// 6. 恢复 → override 重新出现（完成状态与备注未丢）
useStore.getState().restoreCourseOccurrence('ct1', DATE)
list = merged()
assert(list.length === 1 && list[0].status === 'done' && list[0].note?.includes('听写') === true, '恢复后 override 完整重现')

console.log('\n全部通过 ✅')
