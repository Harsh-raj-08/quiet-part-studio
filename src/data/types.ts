import { z } from 'zod';

/** The 14 document collections (one Postgres table each). */
export const COLLECTIONS = [
  'books', 'booknotes', 'ideas', 'packs', 'posts', 'jobs', 'runs',
  'reports', 'qa', 'metrics', 'chats', 'ratings', 'playbooks', 'settings', 'account',
] as const;
export type CollectionName = (typeof COLLECTIONS)[number];

export const STAGES = ['Idea', 'Approved', 'Scripted', 'Voiced', 'Produced', 'QA passed', 'Posted'] as const;
export const ALL_STATUS = [...STAGES, 'Dropped'] as const;
export type Stage = (typeof STAGES)[number];
export type Status = (typeof ALL_STATUS)[number];
export const EVIDENCE = ['SUPPORTED', 'MIXED', 'MYTH', 'STORY', 'PHILOSOPHY', 'CHECK'] as const;
export type Evidence = (typeof EVIDENCE)[number];
export const SCORE_KEYS = [['hook', 'Hook'], ['visual', 'Visual'], ['truth', 'Truth'], ['send', 'Send']] as const;

/** A stored document as the adapters hand it out. */
export interface Doc {
  id: string;
  data: Record<string, unknown>;
  version: number;
  /** Row timestamps (created_at / updated_at columns); absent when the adapter has none. */
  createdAt?: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------- helpers
const str = (v: unknown): string => (v == null ? '' : String(v));
const numOr = (v: unknown, d: number | null): number | null => {
  if (v == null || v === '') return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const isO = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
export const isHttps = (u: unknown): u is string => typeof u === 'string' && /^https:\/\//i.test(u.trim());

const Loose = z.record(z.string(), z.unknown());

// ---------------------------------------------------------------- zod schemas (raw documents)
// These describe the stored shape. Readers are lenient (see the normalisers below): a bad field
// never hides a whole collection from the owner.
export const BookDoc = z.object({
  title: z.string().optional(), author: z.string().optional(), lane: z.string().optional(),
  why: z.string().optional(), status: z.string().optional(), order: z.number().optional(),
  code: z.string().optional(), digest: z.string().optional(), topic: z.string().optional(),
  notesCount: z.number().nullable().optional(), ideaCount: z.number().nullable().optional(), researchedAt: z.string().optional(),
  filePath: z.string().optional(), fileName: z.string().optional(), fileSize: z.number().optional(), uploadedAt: z.string().optional(),
}).passthrough();

export const IdeaDoc = z.object({
  code: z.string().optional(), bookId: z.string().optional(), rank: z.number().nullable().optional(),
  hook: z.string().optional(), quietPart: z.string().optional(), why: z.string().optional(),
  fromBook: z.string().optional(), tryThis: z.string().optional(),
  evidence: z.string().optional(), evidenceNote: z.string().optional(),
  sources: z.array(z.union([z.string(), z.object({ title: z.string().optional(), url: z.string().optional() })])).optional(),
  visual: z.string().optional(), pages: z.string().optional(),
  scores: z.object({ hook: z.number(), visual: z.number(), truth: z.number(), send: z.number() }).partial().optional(),
  total: z.number().optional(), format: z.string().optional(),
  status: z.enum(ALL_STATUS).optional(), updatedAt: z.string().optional(),
  history: z.array(z.object({ status: z.string(), at: z.string().optional() })).optional(),
  posted: z.object({ date: z.string().optional(), link: z.string().optional() }).nullable().optional(),
  dropReason: z.string().optional(), packCurrent: z.string().optional(),
  voiceAssetId: z.string().optional(), voiceFileName: z.string().optional(), voiceUploadedAt: z.string().optional(),
  videoAssetId: z.string().optional(), videoFileName: z.string().optional(), videoSize: z.number().optional(), videoUploadedAt: z.string().optional(),
  hookStyle: z.string().optional(),
  qaLast: z.object({ qaId: z.string().optional(), verdict: z.string().optional(), at: z.string().optional() }).nullable().optional(),
}).passthrough();

export const PackDoc = z.object({
  ideaCode: z.string().optional(), version: z.number().optional(), title: z.string().optional(),
  intro: z.string().optional(), durationSec: z.number().optional(),
  beats: z.array(z.object({ t: z.string().optional(), vo: z.string().optional(), onscreen: z.string().optional(), visual: z.string().optional() })).optional(),
  voiceover: z.string().optional(), designPrompt: z.string().optional(), cover: z.string().optional(), caption: z.string().optional(), captionFinal: z.string().optional(),
  watchouts: z.union([z.array(z.string()), z.string()]).optional(),
  frames: z.array(z.object({ t: z.string().optional(), path: z.string().optional(), note: z.string().optional() }).passthrough()).optional(),
  hooks: z.array(z.object({ style: z.string(), vo: z.string(), onscreen: z.string().optional(), why: z.string().optional() })).optional(),
}).passthrough();

export const JobDoc = z.object({
  node: z.string().optional(), ideaCode: z.string().optional(), bookId: z.string().optional(), packId: z.string().optional(),
  request: z.string().optional(), status: z.string().optional(), error: z.string().optional(), kind: z.string().optional(),
  createdAt: z.string().optional(), startedAt: z.string().optional(), finishedAt: z.string().optional(), videoAssetId: z.string().optional(),
  progress: z.object({ step: z.number().optional(), of: z.number().optional(), label: z.string().optional() }).nullable().optional(),
}).passthrough();

export const BookNoteDoc = z.object({
  bookId: z.string().optional(), chapterNo: z.number().optional(), title: z.string().optional(), pages: z.string().optional(), summary: z.string().optional(),
  keyIdeas: z.array(Loose).optional(), stories: z.array(Loose).optional(), claimsToCheck: z.array(Loose).optional(), lines: z.array(Loose).optional(),
}).passthrough();

export const ReportDoc = z.object({ type: z.string().optional(), at: z.string().optional(), candidates: z.array(Loose).optional() }).passthrough();
export const MetricDoc = z.object({ ideaCode: z.string().optional(), postedAt: z.string().optional(), latest: Loose.nullable().optional(), snapshots: z.array(Loose).optional() }).passthrough();
export const QaDoc = z.object({
  ideaCode: z.string().optional(), packId: z.string().optional(), videoAssetId: z.string().optional(), verdict: z.string().optional(), at: z.string().optional(), summary: z.string().optional(),
  checks: z.array(Loose).optional(), fixes: z.array(Loose).optional(), measurements: Loose.optional(), images: z.array(Loose).optional(),
}).passthrough();
export const PostDoc = z.object({ ideaCode: z.string().optional(), kind: z.string().optional(), version: z.number().optional(), slides: z.array(Loose).optional(), frames: z.array(Loose).optional(), postedAt: z.string().optional() }).passthrough();
export const RatingDoc = z.object({ packId: z.string(), ideaCode: z.string().optional(), version: z.number().optional(), score: z.number().int().min(1).max(10), note: z.string().optional(), at: z.string() }).passthrough();
export const GenericDoc = Loose;

export const SCHEMAS: Record<CollectionName, z.ZodTypeAny> = {
  books: BookDoc, booknotes: BookNoteDoc, ideas: IdeaDoc, packs: PackDoc, posts: PostDoc, jobs: JobDoc, runs: GenericDoc,
  reports: ReportDoc, qa: QaDoc, metrics: MetricDoc, chats: GenericDoc, ratings: RatingDoc, playbooks: GenericDoc, settings: GenericDoc, account: GenericDoc,
};

// ---------------------------------------------------------------- normalised domain types
export interface Book {
  id: string; version: number; title: string; author: string; lane: string; topic: string; why: string; status: string; order: number; code: string; digest: string;
  notesCount: number | null; ideaCount: number | null; researchedAt: string; filePath: string; fileName: string; fileSize: number; uploadedAt: string;
}
export interface Source { title: string; url: string }
export interface Scores { hook: number; visual: number; truth: number; send: number }
export interface Idea {
  id: string; version: number; code: string; bookId: string; rank: number | null; hook: string; quietPart: string; why: string; fromBook: string; tryThis: string;
  evidence: string; evidenceNote: string; sources: Source[]; visual: string; pages: string; scores: Scores; total: number; format: string;
  status: Status; updatedAt: string; history: { status: string; at: string }[]; posted: { date: string; link: string } | null; dropReason: string; packCurrent: string;
  voiceAssetId: string; voiceFileName: string; voiceUploadedAt: string; videoAssetId: string; videoFileName: string; videoSize: number; videoUploadedAt: string;
  hookStyle: string; qaLast: { qaId: string; verdict: 'GO' | 'FIX' | 'NO-GO'; at: string } | null;
}
export interface Beat { t: string; vo: string; onscreen: string; visual: string; lit?: boolean }
export interface Frame { t: string; path: string; note: string }
export interface HookOpt { style: string; vo: string; onscreen: string; why: string }
export interface Pack {
  id: string; ideaCode: string; version: number; title: string; intro: string; durationSec: number; beats: Beat[];
  voiceover: string; designPrompt: string; cover: string; caption: string; captionFinal: string; watchouts: string[];
  createdBy: string; createdAt: string; basedOn: string; changeNote: string; frames: Frame[]; hooks: HookOpt[];
  /** Set by every owner edit from the app (ISO) and who made it. */
  editedAt: string; editedBy: string; rowCreatedAt: string; rowUpdatedAt: string;
  story: { belief: string; truth: string; scene: string; turn: string; feeling: string } | null;
  critic: { total: number | null; scores: Record<string, number | null>; predictedOwnerScore: number | null; notes: string } | null;
}
export interface Job {
  id: string; node: string; ideaCode: string; bookId: string; packId: string; chatId: string; request: string; status: string; error: string; kind: string;
  createdAt: string; startedAt: string; finishedAt: string; progress: { step: number | null; of: number | null; label: string } | null;
}
export interface BookNote {
  id: string; bookId: string; chapterNo: number; title: string; pages: string; summary: string;
  keyIdeas: { idea: string; mechanism: string; pages: string }[]; stories: { who: string; what: string; pages: string }[];
  claims: { claim: string; pages: string }[]; lines: { text: string; page: string }[];
}
export interface Report { id: string; type: string; at: string; d: Record<string, unknown> }
export const METRIC_FIELDS = [['views', 'Views'], ['reach', 'Reach'], ['avgWatchSec', 'Avg watch (s)'], ['watchThroughPct', 'Watch-through %'], ['likes', 'Likes'], ['comments', 'Comments'],
  ['saves', 'Saves'], ['shares', 'Shares'], ['follows', 'Follows'], ['profileVisits', 'Profile visits'], ['skipRatePct', 'Skip rate %']] as const;
export type MetricField = (typeof METRIC_FIELDS)[number][0];
export type Snap = Record<MetricField, number | null> & { at: string; day: number | null; source: string; note: string };
export interface Metric { id: string; ideaCode: string; postedAt: string; latest: Snap | null; snapshots: Snap[]; screenshots: { path: string; fileName: string; at: string }[]; updatedAt: string }
export interface ChatTurn { role: 'user' | 'assistant'; content: string; at: string; sources: string[]; ideas: { bookTitle: string; hook: string }[]; books: { title: string; author: string; year: string; lane: string; why: string }[] }
export interface Chat { id: string; title: string; createdAt: string; updatedAt: string; jobs: string[]; turns: ChatTurn[] }
export interface Run { id: string; node: string; jobId: string; summary: string; at: string; status: string; startedAt: string; finishedAt: string; target: string }
export interface Account { id: string; at: string; followers: number | null; source: string }
export interface StudioSettings {
  workerSchedule: string; workerSeenAt: string; triggerSet: boolean;
  writerLane: 'careful' | 'quick'; cadence: string; autoArt: boolean; notifyQa: boolean; spacePhilosophy: boolean;
}
export interface QaCheck { name: string; status: 'pass' | 'warn' | 'fail'; detail: string; t: string }
export interface QaRec {
  id: string; ideaCode: string; packId: string; videoAssetId: string; verdict: string; at: string; summary: string;
  checks: QaCheck[]; fixes: { t: string; issue: string; fix: string }[];
  meas: { width: number | null; height: number | null; fps: number | null; durationSec: number | null; lufs: number | null; truePeak: number | null; silences: unknown[]; ssimLoop: number | null; safeZonePct: number | null; firstWordSec: number | null };
  images: { path: string; label: string }[];
}
export interface Sticker { type: string; prompt: string; options: string[] }
export interface Post {
  id: string; ideaCode: string; kind: 'carousel' | 'story'; version: number;
  slides: { n: number; headline: string; body: string; visual: string }[];
  frames: { n: number; text: string; visual: string; sticker: Sticker | null }[];
  designPrompt: string; cover: string; caption: string; altText: string; createdAt: string; postedAt: string; editedAt: string; editedBy: string; rowCreatedAt: string;
}
export interface Rating { id: string; packId: string; ideaCode: string; version: number; score: number; note: string; at: string }

export function normVerdict(v: unknown): '' | 'GO' | 'FIX' | 'NO-GO' {
  let s = str(v).trim().toUpperCase().replace(/[\s_]+/g, '-');
  if (s === 'NOGO') s = 'NO-GO';
  return s === 'GO' || s === 'FIX' || s === 'NO-GO' ? s : '';
}

export function normBook(d: Doc): Book {
  const x = d.data;
  return { id: d.id, version: d.version, title: str(x.title) || d.id, author: str(x.author), lane: str(x.lane), topic: str(x.topic), why: str(x.why), status: str(x.status),
    order: numOr(x.order, 1e9) as number, code: str(x.code).trim().toUpperCase(), digest: str(x.digest), notesCount: numOr(x.notesCount, null), ideaCount: numOr(x.ideaCount, null), researchedAt: str(x.researchedAt),
    filePath: str(x.filePath), fileName: str(x.fileName), fileSize: numOr(x.fileSize, 0) as number, uploadedAt: str(x.uploadedAt) };
}

export function normIdea(d: Doc): Idea {
  const x = d.data;
  const sc = isO(x.scores) ? x.scores : {};
  const scores: Scores = { hook: 0, visual: 0, truth: 0, send: 0 };
  let sum = 0;
  for (const [k] of SCORE_KEYS) { scores[k] = numOr(sc[k], 0) as number; sum += scores[k]; }
  const sources: Source[] = arr(x.sources)
    .map((s) => (typeof s === 'string' ? { title: s, url: isHttps(s) ? s : '' } : s))
    .filter(isO).map((s) => ({ title: str(s.title), url: str(s.url) }));
  const status = (ALL_STATUS as readonly string[]).includes(str(x.status)) ? (str(x.status) as Status) : 'Idea';
  const posted = isO(x.posted) ? { date: str(x.posted.date), link: str(x.posted.link) } : null;
  const ql = isO(x.qaLast) ? x.qaLast : null;
  const verdict = ql ? normVerdict(ql.verdict) : '';
  return {
    id: d.id, version: d.version, code: str(x.code) || d.id, bookId: str(x.bookId), rank: numOr(x.rank, null), hook: str(x.hook), quietPart: str(x.quietPart),
    why: str(x.why), fromBook: str(x.fromBook), tryThis: str(x.tryThis), evidence: str(x.evidence).toUpperCase(), evidenceNote: str(x.evidenceNote),
    sources, visual: str(x.visual), pages: str(x.pages), scores, total: numOr(x.total, sum) as number, format: str(x.format), status, updatedAt: str(x.updatedAt),
    history: arr(x.history).filter(isO).filter((h) => h.status).map((h) => ({ status: str(h.status), at: str(h.at) })),
    posted, dropReason: str(x.dropReason), packCurrent: str(x.packCurrent),
    voiceAssetId: str(x.voiceAssetId), voiceFileName: str(x.voiceFileName), voiceUploadedAt: str(x.voiceUploadedAt),
    videoAssetId: str(x.videoAssetId), videoFileName: str(x.videoFileName), videoSize: numOr(x.videoSize, 0) as number, videoUploadedAt: str(x.videoUploadedAt),
    hookStyle: str(x.hookStyle),
    qaLast: ql && verdict ? { qaId: str(ql.qaId), verdict, at: str(ql.at) } : null,
  };
}

export function normPack(d: Doc): Pack {
  const x = d.data;
  const wo = x.watchouts;
  const st = isO(x.story) ? x.story : null;
  const cr = isO(x.critic) ? x.critic : null;
  return { id: d.id, ideaCode: str(x.ideaCode), version: numOr(x.version, 1) as number, title: str(x.title) || d.id, intro: str(x.intro), durationSec: numOr(x.durationSec, 0) as number,
    beats: arr(x.beats).filter(isO).map((b) => ({ t: str(b.t), vo: str(b.vo), onscreen: str(b.onscreen), visual: str(b.visual), ...(b.lit === true ? { lit: true } : {}) })),
    voiceover: str(x.voiceover), designPrompt: str(x.designPrompt), cover: str(x.cover), caption: str(x.caption), captionFinal: str(x.captionFinal),
    watchouts: Array.isArray(wo) ? wo.map(str).filter(Boolean) : str(wo).split('\n').map((l) => l.replace(/^\s*[-•]\s*/, '').trim()).filter(Boolean),
    createdBy: str(x.createdBy), createdAt: str(x.createdAt), basedOn: str(x.basedOn), changeNote: str(x.changeNote),
    editedAt: str(x.editedAt), editedBy: str(x.editedBy), rowCreatedAt: str(d.createdAt), rowUpdatedAt: str(d.updatedAt),
    frames: arr(x.frames).filter(isO).map((f) => ({ t: str(f.t), path: str(f.path || f.assetId || (isHttps(str(f.url)) ? f.url : "")), note: str(f.note) })),
    hooks: arr(x.hooks).filter(isO).map((h) => ({ style: str(h.style), vo: str(h.vo), onscreen: str(h.onscreen), why: str(h.why) })).filter((h) => h.vo.trim()),
    story: st ? { belief: str(st.belief), truth: str(st.truth), scene: str(st.scene), turn: str(st.turn), feeling: str(st.feeling) } : null,
    critic: cr ? { total: numOr(cr.total, null), scores: isO(cr.scores) ? Object.fromEntries(Object.entries(cr.scores).map(([k, v]) => [k, numOr(v, null)])) : {}, predictedOwnerScore: numOr(cr.predictedOwnerScore, null),
      notes: Array.isArray(cr.notes) ? cr.notes.map(str).filter(Boolean).join('\n') : str(cr.notes) } : null,
  };
}

export function normJob(d: Doc): Job {
  const x = d.data;
  return { id: d.id, node: str(x.node), ideaCode: str(x.ideaCode), bookId: str(x.bookId), packId: str(x.packId), chatId: str(x.chatId), request: str(x.request), status: str(x.status),
    error: str(x.error), kind: str(x.kind), createdAt: str(x.createdAt), startedAt: str(x.startedAt), finishedAt: str(x.finishedAt),
    progress: isO(x.progress) ? { step: numOr(x.progress.step, null), of: numOr(x.progress.of, null), label: str(x.progress.label) } : null };
}

export function normNote(d: Doc): BookNote {
  const x = d.data;
  const o = (a: unknown) => arr(a).filter(isO);
  return { id: d.id, bookId: str(x.bookId) || d.id.replace(/-\d+$/, ''), chapterNo: numOr(x.chapterNo, 0) as number, title: str(x.title), pages: str(x.pages), summary: str(x.summary),
    keyIdeas: o(x.keyIdeas).map((k) => ({ idea: str(k.idea), mechanism: str(k.mechanism), pages: str(k.pages) })),
    stories: o(x.stories).map((k) => ({ who: str(k.who), what: str(k.what), pages: str(k.pages) })),
    claims: o(x.claimsToCheck).map((k) => ({ claim: str(k.claim), pages: str(k.pages) })),
    lines: o(x.lines).map((k) => ({ text: str(k.text), page: str(k.page) })) };
}

export function normReport(d: Doc): Report {
  return { id: d.id, type: str(d.data.type), at: str(d.data.at), d: d.data };
}

export function normSnap(x: Record<string, unknown>): Snap {
  const o = { at: str(x.at), day: numOr(x.day, null), source: str(x.source), note: str(x.note) } as Snap;
  for (const [k] of METRIC_FIELDS) o[k] = numOr(x[k], null);
  return o;
}
export function normMetric(d: Doc): Metric {
  const x = d.data;
  const snapshots = arr(x.snapshots).filter(isO).map(normSnap);
  const latest = isO(x.latest) ? normSnap(x.latest) : snapshots.length ? snapshots[snapshots.length - 1]! : null;
  return { id: d.id, ideaCode: str(x.ideaCode) || d.id, postedAt: str(x.postedAt), latest, snapshots,
    screenshots: arr(x.screenshots).filter(isO).map((s) => ({ path: str(s.path ?? s.assetId), fileName: str(s.fileName), at: str(s.at) })).filter((s) => s.path),
    updatedAt: str(x.updatedAt) };
}

export function normChat(d: Doc): Chat {
  const x = d.data;
  const turns: ChatTurn[] = arr(x.turns).filter(isO).filter((t) => t.role === 'user' || t.role === 'assistant').map((t) => ({
    role: t.role as ChatTurn['role'], content: str(t.content), at: str(t.at),
    sources: arr(t.sources).map((s) => (isO(s) ? str(s.title || s.url) : str(s))).filter(Boolean),
    ideas: arr(t.ideas).filter(isO).map((i) => ({ bookTitle: str(i.bookTitle), hook: str(i.hook) })).filter((i) => i.hook),
    books: arr(t.books).filter(isO).map((b) => ({ title: str(b.title), author: str(b.author), year: str(b.year), lane: str(b.lane), why: str(b.why) })).filter((b) => b.title),
  }));
  return { id: d.id, title: str(x.title) || 'Untitled chat', createdAt: str(x.createdAt), updatedAt: str(x.updatedAt), jobs: arr(x.jobs).map(str).filter(Boolean), turns };
}

export function normRun(d: Doc): Run {
  const x = d.data;
  return { id: d.id, node: str(x.node), jobId: str(x.jobId), summary: str(x.summary), at: str(x.at), status: str(x.status), startedAt: str(x.startedAt), finishedAt: str(x.finishedAt), target: str(x.target) };
}
export function normAccount(d: Doc): Account {
  return { id: d.id, at: str(d.data.at), followers: numOr(d.data.followers, null), source: str(d.data.source) };
}
export function normSettings(docs: Doc[]): StudioSettings {
  const x = docs.find((d) => d.id === 'studio')?.data ?? {};
  const lane = str(x.writerLane).toLowerCase();
  return {
    workerSchedule: str(x.workerSchedule), workerSeenAt: str(x.workerSeenAt), triggerSet: !!str(x.workerTriggerId).trim(),
    writerLane: lane === 'quick' ? 'quick' : 'careful', cadence: str(x.cadence) || '4 per week',
    autoArt: x.autoArt == null ? true : !!x.autoArt, notifyQa: x.notifyQa == null ? true : !!x.notifyQa, spacePhilosophy: !!x.spacePhilosophy,
  };
}

export function normQa(d: Doc): QaRec {
  const x = d.data;
  const o = (a: unknown) => arr(a).filter(isO);
  const m = isO(x.measurements) ? x.measurements : {};
  const n = (v: unknown) => numOr(v, null);
  return {
    id: d.id, ideaCode: str(x.ideaCode), packId: str(x.packId), videoAssetId: str(x.videoAssetId), verdict: normVerdict(x.verdict), at: str(x.at), summary: str(x.summary),
    checks: o(x.checks).map((c) => { const st = str(c.status).toLowerCase(); return { name: str(c.name), status: (st === 'pass' || st === 'fail' ? st : 'warn') as QaCheck['status'], detail: str(c.detail), t: str(c.t) }; }),
    fixes: o(x.fixes).map((f) => ({ t: str(f.t), issue: str(f.issue), fix: str(f.fix) })),
    meas: { width: n(m.width), height: n(m.height), fps: n(m.fps), durationSec: n(m.durationSec), lufs: n(m.lufs), truePeak: n(m.truePeak), silences: arr(m.silences), ssimLoop: n(m.ssimLoop), safeZonePct: n(m.safeZonePct), firstWordSec: n(m.firstWordSec) },
    images: o(x.images).map((f) => ({ path: str(f.path ?? f.assetId), label: str(f.label) })),
  };
}

export function normPost(d: Doc): Post {
  const x = d.data;
  const m = d.id.match(/^(.*)-(carousel|story)-v(\d+)$/);
  const o = (a: unknown) => arr(a).filter(isO);
  return {
    id: d.id, ideaCode: str(x.ideaCode) || (m ? m[1]! : ''), kind: m ? (m[2] as Post['kind']) : str(x.kind) === 'story' ? 'story' : 'carousel', version: numOr(x.version, m ? +m[3]! : 1) as number,
    slides: o(x.slides).map((s, k) => ({ n: numOr(s.n, k + 1) as number, headline: str(s.headline), body: str(s.body), visual: str(s.visual) })),
    frames: o(x.frames).map((f, k) => ({ n: numOr(f.n, k + 1) as number, text: str(f.text), visual: str(f.visual),
      sticker: isO(f.sticker) ? { type: str(f.sticker.type), prompt: str(f.sticker.prompt), options: arr(f.sticker.options).map(str) } : null })),
    designPrompt: str(x.designPrompt), cover: str(x.cover), caption: str(x.caption), altText: str(x.altText), createdAt: str(x.createdAt), postedAt: str(x.postedAt), editedAt: str(x.editedAt), editedBy: str(x.editedBy), rowCreatedAt: str(d.createdAt),
  };
}

export function normRating(d: Doc): Rating {
  const x = d.data;
  return { id: d.id, packId: str(x.packId) || d.id, ideaCode: str(x.ideaCode), version: numOr(x.version, 1) as number, score: numOr(x.score, 0) as number, note: str(x.note), at: str(x.at) };
}

/** Parse a raw document against its schema; on failure keep the raw data (readers stay lenient). */
export function checkDoc(coll: CollectionName, data: unknown): boolean {
  return SCHEMAS[coll].safeParse(data).success;
}

export interface StudioUser { id: string; email: string }
export type StudioMode = 'supabase' | 'mock' | 'demo';
export interface QpConfig { mode: StudioMode; supabaseUrl: string; supabaseAnonKey: string }
