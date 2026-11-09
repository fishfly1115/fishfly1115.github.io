// 日期格式：系統統一用 2026/11/09 14:05；文件列印日期用民國紀年。

export const pad2 = (n) => String(n).padStart(2, "0");
export const fmt = (t) => { if (!t) return ""; const d = new Date(t); return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
export const rocToday = () => { const d = new Date(); return `中華民國 ${d.getFullYear() - 1911} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`; };
// Word paragraph indents come in as data-i (half-em units); one rule per step.
