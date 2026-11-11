// 契約頁的狀態與衍生資料（誰、哪一方、待審閱、條文排序）。所有畫面與動作都讀寫這裡的 S。
import { plainToHtml, sanitize } from "../../core/sanitize.js";
import { S, ctx } from "./context.js";

export const SIDE = { A: "甲方", B: "乙方" };
export { ROLES } from "../../lib/roles.js";
export const pById = (id) => S.participants.find((x) => x.id === id);
export const mySide = () => S.me?.side || "A";
export const sideOfId = (id) => (pById(id) || (id === S.uid ? S.me : null))?.side || null;
export const sameSide = (id) => sideOfId(id) === mySide();
export const who = (id) => {
  if (!id) return "某人";
  if (id === S.uid) return "您";
  const p = pById(id);
  return p ? (p.name || p.label || SIDE[p.side] || "他方") : "已停用的成員";
};
// name with side and role, for the revision log
export const whoFull = (id) => {
  const p = pById(id); if (!p) return who(id);
  const tag = [SIDE[p.side], p.title].filter(Boolean).join("・");
  return `${id === S.uid ? "您" : (p.name || p.label || "")}${tag ? `（${tag}）` : ""}`;
};
export const roundNo = () => S.handoff?.round || 1;
export const status = () => S.handoff?.status || "editing";
export const docTitle = () => S.contract?.title || "採購契約書";
export const caseNo = () => S.contract?.caseNo || "";
export const otherLabel = () => mySide() === "B" ? "機關（甲方）" : "廠商（乙方）";
export const myLink = () => ctx.KEY ? `${location.origin}/c/${ctx.CID}#k=${ctx.KEY}` : "";
export const clauseHtmlOf = (c) => sanitize(c.html ?? plainToHtml(c.body));
export const revHtml = (r, side) => sanitize(r.fmt === "html" ? r[side] : plainToHtml(r[side]));
export const sorted = () => [...S.clauses].sort((x, y) => (x.order ?? 0) - (y.order ?? 0));
export const pendingOf = (cid) => S.revs.filter((r) => r.clauseId === cid && r.status === "pending").sort((x, y) => x.at - y.at);
export const visible = () => sorted().filter((c) => !c.removed || pendingOf(c.id).some((r) => r.kind === "delete"));
export const live = () => sorted().filter((c) => !c.removed);
export const pendingForMe = () => S.revs.filter((r) => r.status === "pending" && !sameSide(r.by));
export const isNew = (r) => S.lastSeen != null && r.by !== S.uid && r.at > S.lastSeen;
export const decidedNew = (r) => S.lastSeen != null && sameSide(r.by) && r.reviewedAt && r.reviewedAt > S.lastSeen && !sameSide(r.reviewedBy);
export const revTitle = (r) => r.titleAfter || r.titleBefore || r.clauseTitle || "條文";
export const KIND = { edit: "修訂", add: "新增條文", delete: "刪除條文", move: "調整位置" };
export const canEditDoc = () => S.canWrite && !!S.uid;
export const FIELD_LABELS = { checked: "已勾選，點選取消", unchecked: "未勾選，點選勾選", date: "選擇日期", blank: "填寫內容", cell: "填寫" };
export const otherSide = () => mySide() === "A" ? "B" : "A";
// 有他方待審閱修訂的條文（依條文順序）
export const theirsClauses = () => visible().filter((c) => pendingOf(c.id).some((r) => !sameSide(r.by)));
