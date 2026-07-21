/* 用真实样本测试解析器：node /tmp/test-import.cjs */
const XLSX = require('xlsx')
const { parseWorkbookRows } = require('./.scheduleImport.bundle.cjs')

const FILE = '/Users/ucirlcui/Kaia/2025-2026学年第二学期_校历与课表.xlsx'
const wb = XLSX.readFile(FILE)
const sheets = {}
for (const name of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' })
  sheets[name] = rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c).trim()) : []))
}

const result = parseWorkbookRows(sheets)
if (result.error) {
  console.error('解析失败:', result.error)
  process.exit(1)
}

console.log('=== 学期 ===')
console.log('名称:', result.semester.name)
console.log('开始:', result.semester.startDate)
console.log('结束:', result.endDate)
console.log('总周数:', result.semester.totalWeeks)

console.log('\n=== 课程模板 (' + result.courseTemplates.length + ') ===')
const WD = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']
const sorted = [...result.courseTemplates].sort((a, b) =>
  a.weekday === b.weekday ? a.time.localeCompare(b.time) : a.weekday - b.weekday,
)
for (const c of sorted) {
  console.log(`${WD[c.weekday]} ${c.time} ${c.periodLabel} | ${c.name}${c.className ? ' ' + c.className : ''} | ${c.weekStart}-${c.weekEnd}周`)
}

console.log('\n=== 节假日 (' + result.holidays.length + ') ===')
for (const h of result.holidays) {
  console.log(`${h.date} ${h.name} ${h.off ? '[工作日-不排课]' : '[周末-仅展示]'}`)
}

console.log('\n=== 调休上课待确认 (' + result.makeupDays.length + ') ===')
for (const m of result.makeupDays) {
  console.log(`${m.date} ${m.name} → 待选择按周几上课`)
}
console.log('\n跳过的单元格:', result.skippedCells)
