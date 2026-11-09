// 修訂比對：以 HTML 標籤為單位、文字逐字比對，產生刪除線／底線標示。
import { esc } from "./dom.js";

export const tokenize = (h) => h.match(/<[^>]+>|&[a-zA-Z0-9#]+;|[\s\S]/g) || [];
const isTag = (t) => t[0] === "<";
const isImg = (t) => /^<img/i.test(t);
export function diffTokens(A0, B0) {
  let p = 0; while (p < A0.length && p < B0.length && A0[p] === B0[p]) p++;
  let s = 0; while (s < A0.length - p && s < B0.length - p && A0[A0.length - 1 - s] === B0[B0.length - 1 - s]) s++;
  const A = A0.slice(p, A0.length - s), B = B0.slice(p, B0.length - s);
  let mid = [];
  const push = (arr, t, tok) => { const l = arr[arr.length - 1]; if (l && l[0] === t) l[1].push(tok); else arr.push([t, [tok]]); };
  if (!A.length && B.length) mid = [["+", B]];
  else if (A.length && !B.length) mid = [["-", A]];
  else if (A.length * B.length > 4e6) mid = [["-", A], ["+", B]];
  else if (A.length) {
    const n = A.length, m = B.length, W = m + 1, L = new Uint16Array((n + 1) * W);
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
      L[i * W + j] = A[i] === B[j] ? L[(i + 1) * W + j + 1] + 1 : Math.max(L[(i + 1) * W + j], L[i * W + j + 1]);
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) { push(mid, "=", A[i]); i++; j++; }
      else if (L[(i + 1) * W + j] >= L[i * W + j + 1]) push(mid, "-", A[i++]);
      else push(mid, "+", B[j++]);
    }
    while (i < n) push(mid, "-", A[i++]);
    while (j < m) push(mid, "+", B[j++]);
    for (let k = 1; k < mid.length - 1; k++) {
      const seg = mid[k];
      if (seg[0] === "=" && seg[1].length <= 2 && !seg[1].some(isTag) && mid[k - 1][0] !== "=" && mid[k + 1][0] !== "=")
        mid.splice(k, 1, ["-", seg[1].slice()], ["+", seg[1].slice()]);
    }
    const merged = [];
    for (const seg of mid) {
      const grp = merged[merged.length - 1];
      if (seg[0] !== "=" && grp && grp.t === "x") grp[seg[0]].push(...seg[1]);
      else if (seg[0] === "=") merged.push({ t: "=", toks: seg[1] });
      else merged.push({ t: "x", "-": seg[0] === "-" ? [...seg[1]] : [], "+": seg[0] === "+" ? [...seg[1]] : [] });
    }
    mid = [];
    for (const g of merged) {
      if (g.t === "=") mid.push(["=", g.toks]);
      else { if (g["-"].length) mid.push(["-", g["-"]]); if (g["+"].length) mid.push(["+", g["+"]]); }
    }
  }
  const out = [];
  if (p) out.push(["=", A0.slice(0, p)]);
  out.push(...mid);
  if (s) out.push(["=", A0.slice(A0.length - s)]);
  return out;
}
export function renderDiff(segs) {
  let html = "";
  for (const [t, toks] of segs) {
    if (t === "=") { html += toks.join(""); continue; }
    const tagName = t === "-" ? "del" : "ins", title = t === "-" ? "原文（已刪除）" : "新增";
    let run = "";
    const flush = () => { if (run) html += `<${tagName} class="d" title="${title}">${run}</${tagName}>`; run = ""; };
    for (const tok of toks) {
      if (isImg(tok)) { flush(); html += `<${tagName} class="d" title="${title}">${tok}</${tagName}>`; }
      else if (isTag(tok)) { flush(); if (t === "+") html += tok; }
      else run += tok;
    }
    flush();
  }
  return html;
}
const diffCache = new Map();
export function diffHtml(a, b) {
  const key = a + "\u0000" + b;
  if (diffCache.has(key)) return diffCache.get(key);
  const out = renderDiff(diffTokens(tokenize(a), tokenize(b)));
  if (diffCache.size > 300) diffCache.clear();
  diffCache.set(key, out); return out;
}
export const diffText = (a, b) => renderDiff(diffTokens([...(a || "")].map(esc), [...(b || "")].map(esc)));

// 修訂摘要：把兩段純文字的差異整理成「前文 · 原文 → 新文」清單（審閱卡片用）。
// 改動落在數字或日期中間時，向前後延伸到完整的數字／日期（例如 1,000,000 → 1,200,000）。
const JOIN = /[0-9A-Za-z,.年月日＿_]/;
export function changeList(a, b, max = 4) {
  const segs = diffTokens([...(a || "")], [...(b || "")]).map(([t, toks]) => [t, [...toks]]);
  const out = [];
  for (let i = 0; i < segs.length; i++) {
    if (segs[i][0] === "=") continue;
    let from = "", to = "";
    const start = i;
    while (i < segs.length && segs[i][0] !== "=") { if (segs[i][0] === "-") from += segs[i][1].join(""); else to += segs[i][1].join(""); i++; }
    const prev = start > 0 ? segs[start - 1][1] : [], next = i < segs.length ? segs[i][1] : [];
    let head = "", tail = "";
    while (prev.length && head.length < 8 && JOIN.test(prev[prev.length - 1])) head = prev.pop() + head;
    while (next.length && tail.length < 8 && JOIN.test(next[0])) tail += next.shift();
    i--;
    const ctx = prev.join("").replace(/\s+/g, " ").trim().split(/[，。；：、（）()「」\s]/).filter(Boolean).pop() || "";
    out.push({ ctx: ctx.slice(-8), from: (head + from + tail).trim(), to: (head + to + tail).trim() });
  }
  return { items: out.slice(0, max), more: Math.max(0, out.length - max) };
}
