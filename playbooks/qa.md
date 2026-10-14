PLAYBOOK: QA (checks a finished reel before posting)
Inputs: the job (ideaCode, packId, optional videoAssetId / voiceAssetId, request), the idea doc (videoAssetId, voiceAssetId if the job doesn't name them), the pack doc, the brand digest.
Get files: Worker API file-url {path: the idea's videoAssetId / voiceAssetId (storage paths)}, then download the returned 10-minute link. No video -> fail the job "no video uploaded".
Measure (ffprobe/ffmpeg, local only):
1. Format: width x height (expect 9:16; 1080x1920 ideal, 720x1280 acceptable for a QA proxy and say so), fps, duration vs pack durationSec (warn beyond ±10%), codec.
2. Audio: integrated loudness and true peak (ebur128): target about -14 to -16 LUFS, peak <= -1 dBTP; silences > 1.5 s (silencedetect -35 dB); clipping. If a voiceover file exists, compare its duration with the video's speech span.
3. Frames: extract one frame every 0.5 s plus scene changes; make contact sheets with timestamps (ffmpeg tile, ~360 px wide cells). Look at them yourself.
4. Captions: OCR the lower-third band of each 0.5 s frame (crop y 1180-1560 of 1920, scale proportionally; tesseract --psm 6). Merge consecutive identical text. Align the OCR stream to the pack's beats in order (fuzzy, ignore case/punctuation); flag missing beats, wrong words, and captions that appear > 0.7 s before/after their beat window. OCR is imperfect: confirm any 'wrong word' by looking at that frame before reporting it.
5. Safe zones: draw the UI zones (top 220 px, bottom 420 px, right 120 px on 1080x1920; scale for other sizes) as translucent red boxes on 6 representative frames (hook, source-chip moment, 3 mid beats, end card); check no text or key visual sits in them.
6. Hook: first frame must already show the hook visual (no black/blank opening); hook text lands by 2.5 s.
7. Brand and facts: source chip visible at least once; on-screen labels/numbers match the pack (names, years, figures); no book covers, photos of real people, or off-brand colour floods; pacing - a visible change at least every ~2 s (from scene-change times).
8. Loop: compare first and last frames (ffmpeg ssim); report whether it loops when the pack intends a loop.
9. Cover: the frame at the cover moment (or 0.0 s) cropped to the centre 3:4 (1080x1440) - is the hook text fully inside?
Upload images with upload-url to exports/qa/<packId>/<name>.png: the contact sheet(s) and one safe-zone overlay sheet. Keep their paths.
Verdict: GO (no fails), FIX (fails that are quick edits), or NO-GO (wrong/missing content, factual error, or broken audio).
Write qa/<packId>-<YYYYMMDDHHmm> = {ideaCode, packId, videoAssetId, at, verdict, summary (2-3 sentences), checks:[{name, status: pass|warn|fail, detail, t? ("0:14" when the check is about a moment)}], fixes:[{t: "0:12.5", issue, fix}], measurements:{width, height, fps, durationSec, lufs, truePeak, safeZonePct, firstWordSec, silences:[...], ssimLoop}, images:[{path, label}]}.
Then update the idea: qaLast = {qaId, verdict, at}. Do NOT change the idea's status; moving to "QA passed" is the owner's decision.
Runs summary: verdict + the top 3 fixes with timestamps.
