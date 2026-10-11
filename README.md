# ইসলামী বিশ্বকোষ ও আল হাদিস S2 – প্রোমো ভিডিও (Playwright + FFmpeg)

## রিপোজিটরির ফাইল
| ফাইল | কাজ |
|---|---|
| `index.html` | পুরো অ্যানিমেশন (HTML/CSS/JS) |
| `render.js` | Playwright দিয়ে ফ্রেম ক্যাপচার + FFmpeg দিয়ে MP4 |
| `timestamps.txt` | সিনের সময়, লেখা, মুড |
| `package.json` | Playwright ডিপেন্ডেন্সি |
| `.github/workflows/render.yml` | GitHub Actions ওয়ার্কফ্লো |
| `assets/logo.png` | অ্যাপ লোগো |

## আপনার নিজের যোগ করার ফাইল (ঐচ্ছিক, কিন্তু প্রস্তাবিত)
| ফাইল | কাজ |
|---|---|
| `audio.mp3` | ব্যাকগ্রাউন্ড সাউন্ড। ভিডিওর চেয়ে ছোট হলে নিজে লুপ হয়, শুরুতে/শেষে ফেড হয়। এর ভলিউম অনুযায়ী ক্যাপশন প্যানেলের গ্লো ও ইকুয়ালাইজার নড়ে। |
| `assets/google-play-badge.png` | অফিশিয়াল Google Play ব্যাজ। না দিলে সাধারণ ইনস্টল বাটন দেখাবে। ব্যাজ পাবেন: https://developer.android.com/distribute/tools/promote/badges |
| `assets/fonts/SolaimanLipi-Regular.ttf` ও `SolaimanLipi-Bold.ttf` | না দিলে ওয়ার্কফ্লো নিজে ডাউনলোড করার চেষ্টা করবে। ডাউনলোড ব্যর্থ হলে ফাইল দুটি এখানে আপলোড করুন। |

## ফন্ট
- বাংলা লেখা: SolaimanLipi
- ইংরেজি/লাতিন লেখা (যেমন "S2"): Noto Serif
- আরবি: Noto Naskh Arabic

## রান করা
GitHub → Actions → Render Video → Run workflow।
`quality`: `preview` (৫৪০ পিক্সেল, ১৫fps, দ্রুত) অথবা `full` (১০৮০×১৯২০, ৩০fps)।
`audio_volume`: ব্যাকগ্রাউন্ড সাউন্ডের ভলিউম (যেমন `0.5`)।
শেষ হলে রান পেজের নিচে Artifacts → `video` ডাউনলোড করুন।
