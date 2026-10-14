/**
 * One-shot hand-offs between screens ("open this chapter", "scroll to this book"), so the URL stays
 * short. The receiving screen takes the value once, on mount or when it changes.
 */
type Kind = 'chapter' | 'book';
const pending = new Map<Kind, string>();
const subs = new Set<() => void>();
export function setFocus(kind: Kind, id: string): void { pending.set(kind, id); subs.forEach((f) => f()); }
export function takeFocus(kind: Kind): string | null { const v = pending.get(kind) ?? null; pending.delete(kind); return v; }
export function onFocus(f: () => void): () => void { subs.add(f); return () => { subs.delete(f); }; }
