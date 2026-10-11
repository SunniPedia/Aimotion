# Islamic promo video (HTML + SVG -> MP4 in GitHub Actions)

Renders a timed promo video from `timestamps.txt`. Two themes:

- **infographic**: vertical 9:16, 1080x1920, no presenter (`index-infographic.html`)
- **podcast**: landscape 16:9, 1920x1080, illustrated host in a studio (`index-podcast.html`)

Everything runs in GitHub Actions (Playwright Chromium + FFmpeg). Nothing is needed on your phone except a browser.

## Files

| File | Purpose |
|---|---|
| `timestamps.txt` | Your script: `start | end | text | mood` per line. Markers around a name make it gold. |
| `index-infographic.html`, `index-podcast.html` | The two themes (each file is self-contained: CSS, JS, SVG icons). |
| `render.js`, `package.json` | Renderer (only dependency: `playwright`). |
| `.github/workflows/render.yml` | The "Render Video" workflow. |
| `assets/logo.png`, `assets/google-play-badge.png` | Your logo and the official badge. |
| `assets/fonts/` | SolaimanLipi TTFs (downloaded by the workflow if absent). |
| `audio.mp3` (optional, repo root) | Narration or background sound. |

## Steps from a phone

1. Create a new GitHub repository (public repos get free Actions minutes).
2. Upload all files with **Add file -> Upload files**. Create the folders by typing the path in the file name box (for example `assets/logo.png`, `.github/workflows/render.yml`).
3. Optional: upload `audio.mp3` to the repo root. Without it the video is silent.
4. Optional: upload `SolaimanLipi-Regular.ttf` and `SolaimanLipi-Bold.ttf` into `assets/fonts/`. If you do not, the workflow tries to download them and warns if it cannot.
5. Open **Actions -> Render Video -> Run workflow**. Choose theme (podcast / infographic / both) and quality **preview**. Check the result, then run again with **full**.
6. When the run is green, open it and download **video** from **Artifacts**.

Local/test variables (read by `render.js`): `THEME`, `WIDTH`, `FPS`, `OUT`, `START`, `END`, `AUDIO_VOLUME`.

## How it works

Each page is a pure function of time: `init(rawTimestamps, opts)`, `fit()`, `seek(t)`, `setAudio(envelope, fps)`. No CSS animation, timers or random numbers, so every render is identical. `render.js` serves the folder on `127.0.0.1`, calls `seek(t)` for every frame, screenshots to JPEG and pipes the frames into FFmpeg (libx264, crf 18, yuv420p, faststart). Audio is analysed with FFmpeg (RMS per frame, 95th-percentile normalisation, attack 0.6 / release 0.18) and drives the glow, equalizer and mouth movement. A shorter audio file is looped.

Scene designs live in the `PLAN` array in each HTML file, **one entry per timestamp line, by line number**. If you add or reorder lines, edit `PLAN` to match (extra lines fall back to a single centered card).

Lip movement follows word timing estimated from text length plus the audio loudness. Exact lip-sync would need phoneme data.

## Numbers shown (spoken -> numeral)

| Spoken | Shown |
|---|---|
| আটটি | ৮ |
| পঁয়তাল্লিশটি | ৪৫ |
| দুই লক্ষ সত্তর হাজার তিনশো পঁয়ত্রিশ (2,00,000 + 70,000 + 335) | ২,৭০,৩৩৫ |
| আটশত এর বেশি | ৮০০+ |
| এক হাজারের বেশি | ১,০০০+ |

## Icons (all original inline SVG, no emoji)

| Symbol | Meaning | Used in |
|---|---|---|
| ic-book | book / Quran / kitab | Quran translations, tafsir cards, offline kitab, closing |
| ic-mosque | mosque | "মসজিদ খুঁজি" card |
| ic-crescent | crescent | "সেহরি ইফতার" card, closing |
| ic-star8 | eight-pointed star ornament | "মাসনুন দোয়া" card, closing, panel ornaments |
| ic-clock | prayer time | "নামাজের সময়" card |
| ic-compass | qibla compass | "কিবলা কম্পাস" card |
| ic-beads | prayer beads | "ডিজিটাল তাসবিহ" card |
| ic-phone | app / device | "অনলাইন পিডিএফ বই", "সব কিছু এক অ্যাপেই" cards |
| ic-mic | voice / talk | "বয়ান" card |
| ic-wave | sound | "নাত" card |
| ic-pen | writer | "লেখক" card |
| ic-grid | topics | "বিষয়ভিত্তিক" card |
| ic-broadcast | live broadcast | "লাইভ হারামাইন সম্প্রচার" card |
| ic-spark | neutral ornament | "ইসলামিক নাম" card |
| ic-diamond | ornament | caption panel top line |
| ic-play | play arrow | neutral install button (only when no badge file) |

## Store badge

Only the official badge you supply (`assets/google-play-badge.png`) is shown. Nothing store-related is drawn by the code. If the file is missing, a neutral gold button appears. Official badges: https://developer.android.com/distribute/tools/promote/badges
