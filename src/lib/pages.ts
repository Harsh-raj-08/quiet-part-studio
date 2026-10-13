/** Page ranges as written in the book data: "97–104", "23-27", "12, 40-42", "p. 5". */
export function pageRanges(v: string): [number, number][] {
  const out: [number, number][] = [];
  String(v ?? '').replace(/[‐-―−]/g, '-').split(/[,;&]|\band\b/i).forEach((tok) => {
    const m = tok.match(/(\d+)\s*(?:-\s*(\d+))?/);
    if (!m) return;
    let lo = +m[1]!;
    let hi = m[2] != null ? +m[2] : lo;
    // "1245-9" means 1245-1249
    if (m[2] != null && hi < lo && m[2].length < m[1]!.length) hi = +(m[1]!.slice(0, m[1]!.length - m[2].length) + m[2]);
    if (hi < lo) { const t = lo; lo = hi; hi = t; }
    out.push([lo, hi]);
  });
  return out;
}

export function pagesOverlap(a: string, b: string): boolean {
  const A = pageRanges(a);
  const B = pageRanges(b);
  return A.some((x) => B.some((y) => x[0] <= y[1] && y[0] <= x[1]));
}
