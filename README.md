# ইসলামী বিশ্বকোষ ও আল হাদিস S2 — প্রোমো ভিডিও রেন্ডারার

HTML + CSS + JavaScript + SVG থেকে সময়-নির্ভর (deterministic) প্রোমো ভিডিও বানায়। কাজ করে GitHub Actions-এর ভেতরে (Playwright Chromium + FFmpeg)। পিসি, GPU বা পেইড সার্ভিস লাগে না।

## দুটি থিম
| থিম | ফাইল | সাইজ |
|---|---|---|
| `infographic` | `index-infographic.html` | 1080×1920 (9:16), প্রেজেন্টার ছাড়া |
| `podcast` | `index-podcast.html` | 1920×1080 (16:9), ইলাস্ট্রেটেড হোস্ট + স্টুডিও |

## ফাইল স্ট্রাকচার
```
index-infographic.html
index-podcast.html
render.js
package.json
timestamps.txt            <- আপনার টেক্সট, হুবহু
audio.mp3                 <- ঐচ্ছিক (আপনি যোগ করবেন)
assets/logo.png
assets/google-play-badge.png   <- অফিসিয়াল ব্যাজ
assets/fonts/             <- SolaimanLipi TTF (ঐচ্ছিক, workflow নিজে নামায়)
.github/workflows/render.yml
```

## ফোন থেকে ধাপে ধাপে
1. GitHub-এ নতুন repository খুলুন (Public হলে ফ্রি মিনিট বেশি)।
2. **Add file → Upload files** দিয়ে root-এর ফাইলগুলো আপলোড করুন: `index-*.html`, `render.js`, `package.json`, `timestamps.txt`।
3. `assets` ও `assets/fonts` ফোল্ডার বানাতে ফাইল-নামের ঘরে `assets/logo.png` লিখে আপলোড করুন (স্ল্যাশ দিলে ফোল্ডার তৈরি হয়)। একইভাবে `assets/google-play-badge.png`।
4. `.github/workflows/render.yml` — নতুন ফাইল বানিয়ে পুরো লেখা পেস্ট করুন (পথটি নামের ঘরে লিখুন)।
5. অডিও থাকলে root-এ `audio.mp3` নামে আপলোড করুন (`.wav`, `.m4a`, `.aac`-ও চলে)।
6. **Actions → Render Video → Run workflow** → theme বাছুন (`podcast`, `infographic` বা `both`) → প্রথমে `preview`।
7. ঠিক থাকলে আবার `full` দিয়ে চালান। শেষ হলে run পেজের নিচে **Artifacts → video** থেকে ডাউনলোড করুন।

SolaimanLipi ফন্ট workflow নিজে নামায়। না নামলে (লগে হলুদ ::warning:: দেখাবে) `SolaimanLipi-Regular.ttf` ও `SolaimanLipi-Bold.ttf` নিজে `assets/fonts/`-এ আপলোড করুন।

## Environment variables (`node render.js`)
`THEME` (podcast), `WIDTH`, `FPS` (30), `OUT` (`out/video-THEME.mp4`), `START`, `END` (অংশ রেন্ডারের জন্য), `AUDIO_VOLUME` (1.0)।

## টাইমস্ট্যাম্প ফরম্যাট
`start | end | text | mood` — প্রতি লাইনে একটি সিন। mood: respectful, happy, informative, excited, calm, enthusiastic (অজানা হলে happy)। `❝ ❞` এর ভেতরের নাম সোনালি হাইলাইট হয়। সিনের মাঝে ফাঁক চলে, ওভারল্যাপ হলে আগের সিনের শেষ ছেঁটে দেওয়া হয়।

## নোট
- **লিপ-সিংক:** মুখের নড়াচড়া শব্দের আনুমানিক সময় ও অডিওর জোরের (loudness) সাথে চলে। সঠিক লিপ-সিংকের জন্য phoneme ডেটা লাগত।
- **স্টোর ব্যাজ:** শুধু আপনার দেওয়া অফিসিয়াল ব্যাজ ব্যবহার হয়; ফাইল না থাকলে নিরপেক্ষ সোনালি বাটন দেখায়। অফিসিয়াল ব্যাজ: https://developer.android.com/distribute/tools/promote/badges
- **হোস্ট:** সম্পূর্ণ মৌলিক ইলাস্ট্রেশন, কোনো বাস্তব ব্যক্তি নয়। `index-podcast.html`-এর শুরুতে `FACELESS = true` দিলে মুখহীন ভার্সন পাবেন।
- ভিডিও সম্পূর্ণ সময়ের ফাংশন: CSS animation, timer, `Math.random`, রিমোট URL ব্যবহার হয়নি, তাই প্রতিবার একই রেন্ডার।
