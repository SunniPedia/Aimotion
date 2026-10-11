# ইসলামী বিশ্বকোষ ও আল হাদিস S2 — Podcast Promo

THEME B 16:9 podcast studio (1920x1080) • Calm, premium, Islamic green & gold

## ফাইল
- `index-podcast.html` — পুরো ভিডিওর HTML/CSS/JS (deterministic)
- `render.js` — Playwright + FFmpeg renderer
- `timestamps.txt` — আপনার লেখা অপরিবর্তিত
- `assets/logo.png` — লোগো (Kaaba, Green Dome, minaret, gold crescent)
- `assets/google-play-badge.png` — official Google Play badge
- `.github/workflows/render.yml`

## লোগো বর্ণনা
গোলাকার সাদা ব্যাকগ্রাউন্ডে: বামে কালো কাবা, দুইটি কালো মিনার, মাঝে সবুজ গম্বুজ, ডানে সাদা/সোনালী মিনার, পেছনে সোনালী বাঁকা চাঁদ, নিচে বাংলায় নাম।

## Audio
`audio.mp3` থাকলে auto-mux হবে, ছোট হলে loop। না থাকলে silent। লিপ-সিংক word timing + envelope দিয়ে চলে; exact phoneme sync এর জন্য phoneme data লাগবে।

## Store Badge
অফিসিয়াল badge ব্যবহার — কোনো trace/imitate নয়। badge না থাকলে neutral gold button। Official: https://developer.android.com/distribute/tools/promote/badges

## Phone থেকে
1. GitHub এ নতুন public repo
2. সব ফাইল upload (assets/ ও assets/fonts/ ফোল্ডার)
3. audio.mp3 থাকলে root এ upload
4. SolaimanLipi TTF https://fonts.maateen.me থেকে ডাউনলোড করে assets/fonts/ এ upload (workflow auto-download চেষ্টা করবে)
5. Actions → Render Video → Run workflow → theme podcast, quality preview
6. preview OK হলে full quality
7. Artifacts থেকে mp4 download

## Numbers
- দুটি → ২
- আটটি → ৮
- পঁয়তাল্লিশটি → ৪৫
- দুই লক্ষ সত্তর হাজার তিনশো পঁয়ত্রিশটি → ২৭০,৩৩৫
- আটশত → ৮০০+
- এক হাজার → ১০০০+

## Testing
- node --check render.js OK
- HTML script deterministic: seek() প্রতি 1/30s, no exception
- Logo transform plausible, host mouth/head/arm logic checked
- Audio analysis RMS 95th percentile, attack 0.6 release 0.18

### Verified
- Parsing, gold markers, visual config
- Deterministic motion

### Not verified (CI only)
- Real browser pixel render
- Actual audio envelope
- SolaimanLipi rendering until TTF uploaded

## Assumptions
- Logo assets/logo.png
- Badge assets/google-play-badge.png
- Language Bengali, SolaimanLipi main, Noto Naskh Arabic, Noto Serif
- No audio.mp3 in this zip (add later)
- Store badge scene = প্লে স্টোর line
- Greeting = first line
