import assert from "node:assert/strict";
import { test } from "node:test";
import { addMonths, maskDateText, maskTimeText, monthGrid, normalizeDateText, normalizeTimeText, parseThaiDate, parseTime, thaiDateLabel } from "../../src/lib/date-input";

test("date typing is shaped to วว/ดด/ปปปป without trapping Backspace", () => {
  assert.equal(maskDateText("0"), "0");
  assert.equal(maskDateText("06"), "06", "no slash right after the second digit");
  assert.equal(maskDateText("061"), "06/1");
  assert.equal(maskDateText("06102569"), "06/10/2569");
  assert.equal(maskDateText("061025691"), "06/10/2569", "extra digits are ignored");
  assert.equal(maskDateText("๐๖๑๐๒๕๖๙"), "06/10/2569", "Thai digits");
  assert.equal(maskDateText("6/"), "06/", "a typed separator pads the day");
  assert.equal(maskDateText("6/3/2"), "06/03/2");
  assert.equal(maskDateText("6.3.2569"), "06/03/2569");
  assert.equal(maskDateText("01/03/2571"), "01/03/2571", "already formatted text is unchanged");
  assert.equal(maskDateText("ab12"), "12");
  // Typing one digit at a time onto an already shaped value (regression found by the browser test).
  assert.equal(maskDateText("02/032"), "02/03/2", "a full month spills into the year");
  assert.equal(maskDateText("02/03/25712"), "02/03/2571", "the year stops at four digits");
  assert.equal(maskDateText("02/03/"), "02/03/", "Backspace on the year keeps the separator until it is deleted too");
  assert.equal(maskDateText("02//"), "02/", "repeated separators are ignored");
});

test("dates are read in the Buddhist era and impossible dates are refused", () => {
  assert.equal(parseThaiDate("06/10/2569"), "2026-10-06");
  assert.equal(parseThaiDate("6/10/2569"), "2026-10-06");
  assert.equal(parseThaiDate("06102569"), "2026-10-06");
  assert.equal(parseThaiDate("06/10/69"), "2026-10-06", "two-digit year means 25YY พ.ศ.");
  assert.equal(parseThaiDate("2026-10-06"), "2026-10-06", "pasted ISO date");
  assert.equal(parseThaiDate("29/02/2567"), "2024-02-29", "leap year");
  for (const bad of ["29/02/2569", "31/04/2569", "00/01/2569", "01/13/2569", "06/10/2026", "06/10", ""]) assert.equal(parseThaiDate(bad), null, bad);
  assert.equal(normalizeDateText("6/3/71"), "06/03/2571");
  assert.equal(normalizeDateText("31/02/2569"), "31/02/2569", "invalid text is kept for correction");
  assert.equal(thaiDateLabel("2026-10-06"), "วันอังคารที่ 6 ตุลาคม พ.ศ. 2569");
});

test("time typing is shaped to ชช:นน and read as 24-hour time", () => {
  assert.equal(maskTimeText("0"), "0");
  assert.equal(maskTimeText("08"), "08");
  assert.equal(maskTimeText("083"), "08:3");
  assert.equal(maskTimeText("0830"), "08:30");
  assert.equal(maskTimeText("8.30"), "8:30");
  assert.equal(maskTimeText("๑๓๔๕"), "13:45");
  assert.equal(parseTime("8:30"), "08:30");
  assert.equal(parseTime("830"), "08:30");
  assert.equal(parseTime("8"), "08:00");
  assert.equal(parseTime("23:59 น."), "23:59");
  for (const bad of ["24:00", "12:60", "1:5", "abc", ""]) assert.equal(parseTime(bad), null, bad);
  assert.equal(normalizeTimeText("7.5"), "7.5", "invalid text is kept for correction");
});

test("calendar grid starts on Sunday and month steps clamp to the last day", () => {
  const grid = monthGrid(2026, 10);
  assert.equal(grid.length, 6); assert.equal(grid[0][0], "2026-09-27"); assert.equal(grid[0][4], "2026-10-01");
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2024-01-31", 1), "2024-02-29");
  assert.equal(addMonths("2026-12-15", 1), "2027-01-15");
});
