var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/lib/scheduleImport.ts
var scheduleImport_exports = {};
__export(scheduleImport_exports, {
  parseCalendarSheet: () => parseCalendarSheet,
  parseCoursesSheet: () => parseCoursesSheet,
  parseHolidaysSheet: () => parseHolidaysSheet,
  parseTermTitle: () => parseTermTitle,
  parseWorkbookRows: () => parseWorkbookRows,
  resolveYear: () => resolveYear
});
module.exports = __toCommonJS(scheduleImport_exports);
var CN_MONTHS = {
  \u4E00\u6708: 1,
  \u4E8C\u6708: 2,
  \u4E09\u6708: 3,
  \u56DB\u6708: 4,
  \u4E94\u6708: 5,
  \u516D\u6708: 6,
  \u4E03\u6708: 7,
  \u516B\u6708: 8,
  \u4E5D\u6708: 9,
  \u5341\u6708: 10,
  \u5341\u4E00\u6708: 11,
  \u5341\u4E8C\u6708: 12
};
var CN_WEEKDAY_CHARS = {
  \u4E00: 1,
  \u4E8C: 2,
  \u4E09: 3,
  \u56DB: 4,
  \u4E94: 5,
  \u516D: 6,
  \u65E5: 7,
  \u5929: 7
};
function pad(n) {
  return String(n).padStart(2, "0");
}
function iso(y, m, d) {
  return `${y}-${pad(m)}-${pad(d)}`;
}
function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}
var seq = 0;
function uid(prefix) {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}-${Math.random().toString(36).slice(2, 6)}`;
}
function parseTermTitle(title) {
  const m = title.match(/(\d{4})\s*[-–—]\s*(\d{4})\s*学年\s*第([一二])学期/);
  if (!m) return null;
  const y1 = Number(m[1]);
  const y2 = Number(m[2]);
  const term = m[3] === "\u4E00" ? 1 : 2;
  return {
    fallYear: y1,
    springYear: term === 2 ? y2 : y1 + 1,
    term,
    name: `${y1}-${y2} \u5B66\u5E74\u7B2C${m[3]}\u5B66\u671F`
  };
}
function resolveYear(month, termInfo) {
  if (termInfo.term === 2) return termInfo.springYear;
  if (month >= 9) return termInfo.fallYear;
  if (month <= 2) return termInfo.fallYear + 1;
  return termInfo.fallYear;
}
function parseCalendarSheet(rows) {
  if (rows.length < 3) return null;
  const termInfo = parseTermTitle(rows[0]?.[0] ?? "");
  if (!termInfo) return null;
  const headerIdx = rows.findIndex((r) => r.some((c) => c.includes("\u5468\u6B21")));
  if (headerIdx < 0) return null;
  const header = rows[headerIdx];
  const weekCol = header.findIndex((c) => c.includes("\u5468\u6B21"));
  const monthCol = 0;
  const dayCols = [2, 3, 4, 5, 6, 7, 8];
  const weekRows = /* @__PURE__ */ new Map();
  let curMonth = "";
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (row[monthCol]) curMonth = row[monthCol];
    const wm = (row[weekCol] ?? "").match(/第\s*(\d+)\s*周/);
    if (!wm) continue;
    const week = Number(wm[1]);
    const list = weekRows.get(week) ?? [];
    list.push([curMonth, ...row]);
    weekRows.set(week, list);
  }
  if (weekRows.size === 0) return null;
  const weekDates = /* @__PURE__ */ new Map();
  for (const [week, group] of weekRows) {
    const merged = [];
    for (const c of dayCols) {
      let v = "";
      for (const g of group) {
        const cell = g[c + 1] ?? "";
        if (cell !== "") {
          v = cell;
          break;
        }
      }
      merged.push(v);
    }
    let month = CN_MONTHS[group[0][0]] ?? 3;
    let lastDay = 0;
    const dates = [];
    for (const cell of merged) {
      const num = Number(cell);
      const isNum = cell !== "" && Number.isInteger(num);
      if (isNum) {
        if (lastDay > 0 && num <= lastDay) month = month % 12 + 1;
        lastDay = num;
      } else if (cell !== "") {
        let d = lastDay + 1;
        if (d > daysInMonth(resolveYear(month, termInfo), month)) {
          month = month % 12 + 1;
          d = 1;
        }
        lastDay = d;
      } else {
        dates.push("");
        continue;
      }
      dates.push(iso(resolveYear(month, termInfo), month, lastDay));
    }
    weekDates.set(week, dates);
  }
  const week1 = weekDates.get(1);
  const startDate = week1?.[0];
  if (!startDate) return null;
  const totalWeeks = Math.max(...weekRows.keys());
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + (totalWeeks - 1) * 7 + 6);
  return {
    semester: { name: termInfo.name, startDate, totalWeeks },
    endDate: iso(end.getFullYear(), end.getMonth() + 1, end.getDate())
  };
}
function parseCoursesSheet(rows, totalWeeks) {
  const headerIdx = rows.findIndex((r) => r.some((c) => c.includes("\u661F\u671F\u4E00")));
  if (headerIdx < 0) return { templates: [], skippedCells: 0 };
  const header = rows[headerIdx];
  const weekdayCols = [];
  header.forEach((c, i) => {
    const m = c.match(/星期([一二三四五六日天])/);
    if (m) weekdayCols.push({ col: i, weekday: CN_WEEKDAY_CHARS[m[1]] });
  });
  const templates = [];
  let skippedCells = 0;
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const first = (row[0] ?? "").trim();
    if (!first) continue;
    if (/^(课间|分隔|午休)/.test(first)) continue;
    const label = first.split("\n")[0].trim();
    const tm = first.match(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/);
    if (!tm) continue;
    const [sh, sm] = tm[1].split(":").map(Number);
    const time = `${pad(sh)}:${pad(sm)}`;
    for (const { col, weekday } of weekdayCols) {
      const cell = (row[col] ?? "").trim();
      if (!cell) continue;
      const lines = cell.split("\n").map((s) => s.trim()).filter(Boolean);
      if (lines.length === 0) {
        skippedCells += 1;
        continue;
      }
      templates.push({
        id: uid("ct"),
        name: lines[0],
        className: lines[1] ?? "",
        weekday,
        time,
        periodLabel: label,
        weekStart: 1,
        weekEnd: totalWeeks
      });
    }
  }
  return { templates, skippedCells };
}
function parseHolidaysSheet(rows, termInfo) {
  const headerIdx = rows.findIndex((r) => r.some((c) => c.includes("\u65E5\u671F")));
  if (headerIdx < 0) return { holidays: [], makeupDays: [] };
  const holidays = [];
  const makeupDays = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const name = (row[0] ?? "").trim();
    const dateStr = (row[1] ?? "").trim();
    if (!name || !dateStr) continue;
    const dm = dateStr.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*[（(]?([一二三四五六日天])?/);
    if (!dm) continue;
    const month = Number(dm[1]);
    const day = Number(dm[2]);
    const year = resolveYear(month, termInfo);
    const date = iso(year, month, day);
    const weekday = dm[3] ? CN_WEEKDAY_CHARS[dm[3]] : (new Date(date).getDay() + 6) % 7 + 1;
    if (name.includes("\u8C03\u4F11") && name.includes("\u4E0A\u8BFE")) {
      makeupDays.push({ date, name, followWeekday: null });
    } else {
      holidays.push({ date, name, off: weekday >= 1 && weekday <= 5 });
    }
  }
  return { holidays, makeupDays };
}
function pickSheet(sheets, keywords) {
  for (const [name, rows] of Object.entries(sheets)) {
    if (keywords.some((k) => name.includes(k))) return rows;
  }
  return null;
}
function parseWorkbookRows(sheets) {
  const calendarRows = pickSheet(sheets, ["\u6559\u5B66\u65E5\u5386", "\u65E5\u5386"]);
  const coursesRows = pickSheet(sheets, ["\u4EFB\u8BFE", "\u8BFE\u8868"]);
  const holidaysRows = pickSheet(sheets, ["\u8282\u5047\u65E5", "\u8C03\u4F11", "\u901F\u67E5"]);
  if (!calendarRows) return { error: "\u6CA1\u6709\u627E\u5230\u300C\u6559\u5B66\u65E5\u5386\u300Dsheet" };
  const cal = parseCalendarSheet(calendarRows);
  if (!cal) return { error: "\u6559\u5B66\u65E5\u5386\u89E3\u6790\u5931\u8D25\uFF1A\u672A\u8BC6\u522B\u5B66\u5E74\u6807\u9898\u6216\u7B2C1\u5468\u8D77\u59CB\u65E5" };
  const termInfo = parseTermTitle(calendarRows[0]?.[0] ?? "");
  const { templates, skippedCells } = coursesRows ? parseCoursesSheet(coursesRows, cal.semester.totalWeeks) : { templates: [], skippedCells: 0 };
  const { holidays, makeupDays } = holidaysRows ? parseHolidaysSheet(holidaysRows, termInfo) : { holidays: [], makeupDays: [] };
  return {
    semester: cal.semester,
    endDate: cal.endDate,
    courseTemplates: templates,
    holidays,
    makeupDays,
    skippedCells
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  parseCalendarSheet,
  parseCoursesSheet,
  parseHolidaysSheet,
  parseTermTitle,
  parseWorkbookRows,
  resolveYear
});
