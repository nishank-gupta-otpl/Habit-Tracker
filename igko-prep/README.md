# GK Olympiad Prep — Class 3 (IGKO 2026–27)

A phone app for practising the International General Knowledge Olympiad when the workbook isn't at hand.
It installs on Android from Chrome ("Add to Home screen") and works offline. There is no Play Store step,
and everything is stored on the phone.

It is a separate app from the Momentum habit tracker in the rest of this repo, and has no build step:
the folder is the app.

## What it does

| | |
|---|---|
| **Chapter practice** | 11 chapters, 197 original questions (written for this app, not copied from the MTG workbook). Instant right/wrong feedback with a short explanation. Modes: 10 random, all, Achievers-only, and "my mistakes". |
| **English + Hindi** | The **अ+A** button shows every question, option, explanation and button label in English with Hindi underneath. 🔊 reads the question aloud (in Hindi too when it's switched on). |
| **Mock test** | 35 questions, 40 marks, 60 minutes: General Awareness 20 × 1, Current Affairs 5 × 1, Life Skills 5 × 1, Achievers 5 × 2. There's an OMR-style answer sheet to mark answers on, the timer auto-submits, and a test survives closing the app. |
| **My Questions** | Add questions by **typing**, by **speaking** (🎤 on every box, English or Hindi), or by **photographing** a question or a whole page. The app reads the text, finds the numbered questions and the (A)–(D) or (क)–(घ) options, and you check each one before saving. Photographing the answer-key page fills in the correct answers. 🌐 translates English → Hindi (or Hindi → English). |
| **Progress** | Accuracy per chapter, a list of weak chapters, mock-test history, and backup/restore to copy everything to the other parent's phone. |

## Put it on your phones

The app needs to be served over HTTPS once. Any static host works. The simplest options:

1. **Netlify Drop** (free account): open <https://app.netlify.com/drop> on a computer and drag the `igko-prep`
   folder onto the page. Sign in so the site stays up, then open the link it gives you on each Android phone in Chrome.
2. **GitHub Pages:** enable Pages for this repository (Settings → Pages → deploy from branch), then open
   `https://<user>.github.io/<repo>/igko-prep/`. Private repositories need a paid GitHub plan for Pages.
3. **Your existing Firebase project:** copy the folder into the Momentum build output, or add a second
   Hosting site. See the main README for Firebase setup.

Then, on each phone in Chrome, open the link, tap **⋮ → Add to Home screen / Install app** (or the
"Install on this phone" button on the home screen), and open it once while online so it caches itself.

Questions and progress are stored **per phone**. To share questions one parent has added:
**Progress → Save backup** on that phone, send the file (WhatsApp, email), then **Restore** on the other phone.
Restoring merges the two; it never deletes anything.

## What needs internet, and what is sent where

| Feature | Offline? | Notes |
|---|---|---|
| Practice, mock tests, Hindi view, progress | ✅ | Everything is stored on the phone (IndexedDB). |
| Read-aloud 🔊 | Usually | Uses the phone's own text-to-speech voices. Hindi needs a Hindi voice installed (Android settings → Text-to-speech). |
| Reading text from photos 📷 | After first use | The first scan downloads the Tesseract.js text reader, about 9 MB. After that it runs on the phone, and photos never leave it. |
| Voice typing 🎤 | ❌ | Chrome sends the audio to Google to turn it into text. The 🎤 on the phone's keyboard is an alternative. |
| Translate 🌐 | ❌ | Sends the text to the free MyMemory service, which allows roughly 5,000 characters a day per phone. |

## Accuracy notes

- **Exam pattern** (35 Q / 40 marks / 60 min, Achievers 2 marks each) comes from published IGKO Class 3
  guides. The SOF website itself couldn't be checked from the environment this was built in. If SOF changes
  the pattern, edit `MOCK_SECTIONS` at the top of `app.js`.
- **Current affairs** are up to date as of October 2026 (see `CURRENT_AFFAIRS_AS_OF` in `questions.js`).
  News changes, so add newer items yourself under My Questions before the exam.
- **Hindi translations** of the built-in questions were written for this app. If a word reads differently
  from what your child's school uses, fix it in `questions-hi.js`. The Hindi is listed chapter by chapter
  in the same order as `questions.js`.
- **Photo reading** works best on flat, well-lit, close-up photos of printed text. Text inside pictures, and
  marks next to pictures, can come out as stray letters, so check each question before saving.
  Picture-based questions need to be typed in.
- Photos of the workbook are copyrighted material. The app keeps what you scan on your phone, so keep
  backups within your family.

## Files

```
index.html            page shell
styles.css            styles (light + dark)
app.js                screens, mock test, storage, voice, OCR, translation
parse.js              turns OCR text into questions / reads answer keys (tested)
questions.js          built-in questions (English) and chapter list
questions-hi.js       Hindi for every built-in question, same order
sw.js                 offline cache
manifest.webmanifest  install details; icons/ has the app icons
tests/check.js        data and parser checks: `cd igko-prep && npm test`
```

Run locally: `cd igko-prep && npm start`, then open <http://localhost:8080>.
