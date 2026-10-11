# Promo video renderer (HTML + CSS + JS + SVG -> Playwright -> FFmpeg)

Renders a timed promo video for **ইসলামী বিশ্বকোষ ও আল হাদিস S2** entirely inside GitHub Actions. Two themes are included:

| Theme | File | Size |
|---|---|---|
| `infographic` | `index-infographic.html` | 1080x1920 (9:16), no presenter |
| `podcast` | `index-podcast.html` | 1920x1080 (16:9), illustrated host in a studio |

## Files

- `common.js` - shared deterministic engine (timestamp parser, scene design, icons, karaoke captions, audio-reactive motion). Both HTML files load it with a relative path.
- `index-infographic.html`, `index-podcast.html` - theme layouts. Each exposes `window.init`, `window.fit`, `window.seek`, `window.setAudio`.
- `render.js`, `package.json` - Playwright + FFmpeg renderer (only dependency: `playwright`).
- `timestamps.txt` - your script, unchanged. `assets/` - your logo, badge and reference image, unchanged.
- `.github/workflows/render.yml` - the manual "Render Video" workflow.
- `test/run-tests.js` - optional developer checks (not used by the workflow).

## Phone steps

1. On github.com create a new repository (public repos get free Actions minutes).
2. Upload every file from the zip with "Add file -> Upload files". Create the `assets` and `assets/fonts` folders by typing the path in the file name box, for example `assets/fonts/SolaimanLipi-Regular.ttf`.
3. Optional: upload `audio.mp3` to the repo root (narration or background sound) and, if you have it, `assets/fonts/SolaimanLipi-Regular.ttf` and `-Bold.ttf`.
4. Open Actions -> Render Video -> Run workflow -> choose a theme and `preview` first. Then run `full`.
5. When the run finishes, open it and download the `video` artifact (mp4 inside a zip).

Environment variables for `render.js` (the workflow sets them): `THEME`, `WIDTH`, `FPS`, `OUT`, `START`, `END`, `AUDIO_VOLUME`.

## How the text is shown

- Your text is shown exactly as written; the markers around the app name only turn that name gold.
- Karaoke timing is an estimate from word length (weight = characters + 1). With a real `audio.mp3` the lips and glow follow the loudness and the word timing; exact lip-sync would need phoneme data.
- Numbers spoken in words in the script are converted by hand in `common.js` (table `MAN`), because a reliable Bengali number-word parser is not part of this project. Digits written in new lines are detected automatically. If you change the script text, new lines get an automatic layout (cards from comma-separated items, counters from digits); add a `MAN` entry to control a line exactly.

| Spoken | Shown |
|---|---|
| দুটি | ২ |
| আটটি | ৮ |
| পঁয়তাল্লিশটি | ৪৫ |
| দুই লক্ষ সত্তর হাজার তিনশো পঁয়ত্রিশ | ২,৭০,৩৩৫ |
| আটশত এর বেশি | ৮০০+ |
| এক হাজারের বেশি | ১,০০০+ |

## Store badge

`assets/google-play-badge.png` is used as supplied (white margins are cropped away automatically at render time, the file itself is never changed). No store logo is drawn by this project. Without the file a neutral gold button appears. Official badges: https://developer.android.com/distribute/tools/promote/badges

## Icons (all original inline SVG, no emoji)

Drawn once as `<symbol>` in `common.js` (100x100 viewBox, gold line art):

| Icon | Meaning | Used for |
|---|---|---|
| book | book | কানযুল ঈমান |
| quran | closed book with eight-pointed star | ইরফানুল কুরআন, closing |
| book-open | open book | তাফসীরে মাযহারী, তাফসীরে খাযাইনুল ইরফান |
| library | shelf of books | (auto rule: কিতাব, বই) |
| pdf | document | (auto rule: পিডিএফ) |
| pen | quill pen | লেখক |
| grid | subjects | বিষয়ভিত্তিক |
| clock | prayer time | নামাজের সময় |
| crescent | crescent | সেহরি ইফতার, closing |
| compass | compass | কিবলা কম্পাস |
| mosque | mosque | মসজিদ খুঁজি |
| beads | tasbih | ডিজিটাল তাসবিহ |
| voice | sound wave | বয়ান, নাত |
| scroll | scroll | মাসনুন দোয়া |
| tag | name plate | ইসলামিক নাম |
| kaaba | cube with gold band | লাইভ হারামাইন সম্প্রচার |
| play | play arrow | neutral store button (only without badge) |
| star8 | eight-pointed star | brand scene, closing, default |
| star4, diamond | ornaments | caption panel decoration |
| arabesque, magnifier, phone, download, globe, heart | spare icons for new lines | auto rules |

## Host (podcast theme)

Original flat illustration (warm brown skin, white topi, beard, round glasses, headphones, boom microphone, cream kurta with gold collar). It is not a real person. `assets/body.jpg` is kept in the repo but not used by the renderer (the spec requires an original SVG host). The faceless variant is not built because the brief says `no`.
