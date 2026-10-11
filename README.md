# ইসলামী বিশ্বকোষ ও আল হাদিস S2 — Promo Video Renderer

এই repository একই `timestamps.txt` ও assets ব্যবহার করে দুটি ভিডিও থিম রেন্ডার করে:
- **Podcast:** 16:9, 1920×1080
- **Infographic:** 9:16, 1080×1920

রেন্ডার সম্পূর্ণ GitHub Actions-এ চলে। ফোনে ব্রাউজার দিয়েই ফাইল আপলোড ও ভিডিও ডাউনলোড করা যাবে।

## ফাইল
- `index-podcast.html` — illustrated host-সহ স্টুডিও
- `index-infographic.html` — vertical infographic
- `render.js` — Playwright/Chromium frame renderer এবং FFmpeg encoder/muxer
- `timestamps.txt` — মূল বাংলা scene text, অপরিবর্তিত
- `assets/logo.png` — দেওয়া logo
- `assets/google-play-badge.png` — দেওয়া official badge
- `.github/workflows/render.yml` — GitHub Actions workflow

## GitHub Actions দিয়ে রেন্ডার
1. GitHub-এ নতুন repository বানান।
2. `assets` এবং `assets/fonts` folder তৈরি করে সব ফাইল upload করুন। `assets/logo.png`, `assets/google-play-badge.png`, `timestamps.txt`-এর নাম ও অবস্থান ঠিক রাখুন।
3. চাইলে narration/background audio ফাইলটিকে root-এ `audio.mp3` নামে upload করুন (অথবা `audio.wav`, `audio.m4a`, `audio.aac`)।
4. `Actions` → `Render Video` → `Run workflow` খুলুন।
5. `theme` থেকে `podcast`, `infographic`, অথবা `both` নির্বাচন করুন। `preview` দ্রুত পরীক্ষা করার জন্য; ঠিক থাকলে `full` নির্বাচন করুন।
6. `Run workflow` চাপুন। কাজ শেষ হলে workflow run-এর **Artifacts** অংশ থেকে `video` নামের artifact ডাউনলোড করুন। ZIP খুললে MP4 পাবেন।

## ফন্ট
Workflow `assets/fonts/SolaimanLipi-Regular.ttf` এবং `SolaimanLipi-Bold.ttf` না থাকলে স্বয়ংক্রিয়ভাবে ডাউনলোডের চেষ্টা করে। ব্যর্থ হলে GitHub Actions warning দেখাবে; তখন ওই দুই ফাইল নিজে `assets/fonts/`-এ upload করুন। Noto fonts Ubuntu package থেকে আসে। HTML-এ কোনো CDN বা remote font নেই।

## স্থানীয় রান (ঐচ্ছিক)
Node.js 20, FFmpeg এবং Playwright Chromium লাগবে:
```bash
npm install
npx playwright install --with-deps chromium
THEME=podcast node render.js
THEME=infographic WIDTH=540 FPS=15 node render.js
```
Output: `out/video-podcast.mp4` অথবা `out/video-infographic.mp4`।

## Environment variables
- `THEME`: `podcast` বা `infographic` (default `podcast`)
- `WIDTH`: output viewport width; height design ratio অনুযায়ী স্কেল হয়
- `FPS`: default 30
- `OUT`: output file path
- `START`, `END`: partial render-এর সময়সীমা
- `AUDIO_VOLUME`: mux করা audio-র volume; default 1.0

## অডিও ও lip-sync
Root-এ audio ফাইল থাকলে সেটি ভিডিওতে যোগ করা হয় এবং তার loudness থেকে deterministic visual level তৈরি হয়। মুখের নড়াচড়া আনুমানিক scene timing ও loudness অনুসরণ করে; **phoneme data ছাড়া exact lip-sync নয়**। অডিও না থাকলে ভিডিও silent হবে।

## Google Play badge
দেওয়া official badge-টিই ব্যবহার করা হয়; কোনো third-party badge নতুন করে আঁকা বা অনুকরণ করা হয় না। Badge অনুপস্থিত হলে neutral gold install button দেখানো হবে। Official badge পাওয়া যায়: https://developer.android.com/distribute/tools/promote/badges

## সীমাবদ্ধতা ও assumptions
- Brief-এ audio.mp3 ও reference ZIP-এর অস্তিত্ব স্পষ্টভাবে নিশ্চিত করা হয়নি; repository-তে audio বা reference ZIP অন্তর্ভুক্ত করা হয়নি।
- Timestamp-এর `... (all remaining lines)` অংশ নয়, আপলোড করা সম্পূর্ণ `timestamps.txt`-এর 16টি scene ব্যবহার করা হয়েছে।
- দৃশ্যের ভিজ্যুয়াল text থেকে heuristic-ভাবে বাছা হয়; প্রতিটি বাংলা তালিকা/সংখ্যার অর্থ যাচাই করে সম্পূর্ণ কাস্টম illustration নয়।
- Bengali font download workflow-তে network access নেয়; render নিজে কোনো CDN বা remote asset ব্যবহার করে না।
- GitHub Actions-এ বাস্তব রেন্ডার চালানো হয়নি বলে এখানে MP4, browser screenshot inspection, audio mux duration, lip-sync, font glyph rendering বা workflow runtime সফল হয়েছে বলে দাবি করা হচ্ছে না.
