# Implementation Plan - AI Quiz Show: Beat the Bot & Dark Mode Ad Captions

Build the `AiQuizGame.tsx` 60-second rapid-fire trivia mini-game ("AI Quiz Show: Beat the Bot!") for ClassroomLM, wire up its launch flow after lesson completion and on the quiz screen, grant 2 Free AI Searches (for the current day) upon scoring 5/5, and fix the contrast of Adsterra ads' captions in dark mode.

---

## 1. Dark Mode Ad Caption Visibility Fix
### Problem:
In dark mode, Adsterra ads' captions (`text-slate-400` / `dark:text-slate-500`) blend into dark slate backgrounds (`#090d16` and `#0f172a`), making them difficult or impossible to read.

### Solution:
- In `src/v2/GeneratingClassroom.tsx`, update the `📢 Sponsored Content` caption to `text-[11px] font-semibold tracking-wider text-slate-300 dark:text-slate-200 uppercase mb-2 text-center` with an enhanced high-contrast text tone.
- In `src/components/AdsterraAd.tsx`, replace `dark:text-slate-500` with `dark:text-slate-200 font-semibold` so the "Sponsored" label remains crisp and clearly legible in dark mode.
- In `src/v2/AiQuizGame.tsx`, adopt the same high-contrast styling for the Results Screen Adsterra 300x250 banner heading.

---

## 2. New Component: `AiQuizGame.tsx` ("AI Quiz Show: Beat the Bot!")
Create `src/v2/AiQuizGame.tsx` adhering to ClassroomLM's sleek, dark-themed UI (slate backgrounds, indigo/violet/cyan accent gradients, crisp typography, and smooth transitions):

### Game Flow & State:
- **Input**:
  - `questions: QuizQuestion[]` (array of questions with options and `correctIndex`).
  - `onClose: () => void`: callback to exit the mini-game.
  - `onClaimBonus: (credits: number, wonFreeSearches: boolean) => void`: callback when claiming rewards.
  - `mascotVoice / language`: optional config for teacher emotion quips.
- **60-Second Countdown Timer**:
  - Prominent countdown ring / progress bar at the top displaying remaining seconds with dynamic color transitions (cyan -> amber -> rose under 10 seconds).
  - Ticking sound effect / visual pulse under 10 seconds.
  - Automatic transition to Results Screen when time reaches 0.
- **Rapid-Fire Gameplay**:
  - Displays 1 question at a time with 4 styled options.
  - **Correct Answer**:
    - Score increments (+10 points).
    - Teacher avatar displays happy/celebrating reaction with an encouraging quip ("Bullseye!", "Lightning fast!").
    - Confetti micro-burst, then moves to next question.
  - **Incorrect Answer**:
    - Selected option turns red, correct option highlights green.
    - Teacher avatar displays gentle explaining/thinking reaction.
    - Automatically advances after 1 second.

### Results & Monetization Screen:
- Shows final score (e.g. `50 pts`), questions answered correctly out of total (e.g. `5 / 5`).
- **Reward Card**:
  - When the user scores **5 out of 5**: Special unlocked badge: `"🎉 Perfect 5/5! 2 Free AI Searches Unlocked Today! ⚡"`.
  - General bonus: `"+25 Bonus Credits"`.
- **Adsterra 300x250 Banner Ad**:
  - Subtitle heading with dark-mode high-contrast caption:
    ```html
    <p className="text-[11px] font-semibold tracking-wider text-slate-300 dark:text-slate-200 uppercase mb-2 text-center">
      📢 Sponsored Content
    </p>
    ```
  - Placeholder constant `ADSTERRA_300X250_CODE` with key `c3eeae34a18a75771d0ca2d366de6937`.
  - Injected via `useEffect` into an ad container ref with complete cleanup on unmount.
- **Action Buttons**:
  - Primary: `"⚡ Claim Bonus Credits & Return"`
  - Secondary: `"⚡ Top Up Credits to Play Again"` linking to smartlink `https://araplhn.org/4/1318a0beea33cd491f0b903cf1be47fd`.

---

## 3. Free AI Searches Daily Reward Integration
- Store daily free searches in local storage & user state:
  `localStorage.getItem('classroomlm_daily_free_ai_searches')` storing `{ date: 'YYYY-MM-DD', remaining: 2 }`.
- In `src/v2/LandingPage.tsx`:
  - When `handleSearchSubmit` runs:
    - Check if `remaining > 0` and `date === currentDayDate`.
    - If active: bypass normal credit deduction, decrement `remaining`, and show a banner/toast: `"⚡ Free AI Search Pass Applied! (X remaining today)"`.

---

## 4. Launch Triggers in ClassroomLM
- In `src/v2/LiveClassroom.tsx`:
  - **Lesson Completion**: When reaching the final slide and narration finishes, display `"🤖 Beat the Bot (60s Mini-Game)"` next to `"Take Lesson Quiz"`.
  - **Quiz Screen**: On `InteractiveQuiz2D.tsx` (top bar and completion banner), add a glowing `"⚡ Beat the Bot!"` button allowing students to challenge the rapid-fire quiz.
- Mount `AiQuizGame` seamlessly inside `LiveClassroom.tsx` with smooth overlay transitions.

---

## 5. Verification & Testing
1. Verify `GeneratingClassroom.tsx` and `AdsterraAd.tsx` captions are bright and legible in dark mode.
2. Launch "Beat the Bot" mini-game from lesson completion and quiz screen.
3. Test 60-second countdown, question progression, teacher avatar reactions, and game-over transitions.
4. Verify Adsterra 300x250 banner injection and unmount cleanup.
5. Verify 5/5 score unlocks 2 Free AI Searches for the day without deducting credits in AI Search.
6. Run `lint_applet` and `compile_applet`.
