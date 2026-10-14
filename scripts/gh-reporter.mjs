// node:test reporter: one JSON line per failing test (file, name, message, duration). scripts/test.mjs turns these
// into GitHub annotations and a step summary when it runs in Actions.
export default async function* ghReporter(source) {
  for await (const ev of source) {
    if (ev.type === 'test:fail') {
      const d = ev.data;
      const err = d.details?.error;
      const cause = err?.cause ?? err;
      // Skip the parent "file" wrapper events that only say a subtest failed.
      if (err?.failureType === 'subtestsFailed') continue;
      const msg = String(cause?.message ?? err?.message ?? cause ?? 'failed').replace(/\u001b\[[0-9;]*m/g, '');
      yield `${JSON.stringify({ file: d.file ?? '', name: d.name, message: msg, ms: Math.round(d.details?.duration_ms ?? 0) })}\n`;
    } else if (ev.type === 'test:pass' && ev.data.nesting === 0 && ev.data.details?.type !== 'suite') {
      yield `${JSON.stringify({ pass: true, file: ev.data.file ?? '', name: ev.data.name, ms: Math.round(ev.data.details?.duration_ms ?? 0) })}\n`;
    }
  }
}
