# ClassroomLM: Credit Quota Hardening, Username-Based Auth & Sustainable Ad Layout

Implement quota safeguards to prevent daily generation credits from exceeding 100 (+50 top up restricted when balance > 50 and gated for authenticated users), streamline account creation with clean username input without '@' and duplicate username alerts, and eliminate excess whitespace below homepage ads sustainably without `overflow: hidden`.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions were confirmed based on user feedback:
> - **Top Up Credit Hard Cap (Max 100)**: Users with more than 50 credits cannot top up (+50 would exceed 100 quota). The CTA button is disabled and clearly labeled `Max 100 Credits Reached` with a helper badge explaining that credits must be spent before topping up.
> - **Guest User Gating**: Guests cannot top up generation credits. The modal displays a dedicated `Sign In to Claim +50 Credits` action button that smoothly opens the authentication flow.
> - **Username Without '@' for Signup & Signin**: The auth form accepts a clean student username without requiring '@' or triggering HTML5 email validation tooltips. Internally, accounts map to sanitized student credentials, and duplicate registrations display a clear warning: `This name already exists. Please choose a different username or sign in.`
> - **Sustainable Ad Height Measurement**: Excess whitespace below the homepage ads is eliminated by measuring the true bounding rect of the rendered ad cards (`getDeepestBottom`), removing reliance on `document.documentElement.scrollHeight` which causes compounding height inflation, without using `overflow: hidden`.

---

## 1. Overview & Core Concept

- **What It Does**: 
  1. Enforces strict quota protection on the Adsterra Smartlink credit engine: only authenticated users with $\le 50$ credits can trigger the reward, preventing balance overflow past 100.
  2. Simplifies student onboarding by replacing standard email inputs with intuitive username-based authentication that never asks for "@".
  3. Ensures immediate feedback if a chosen student username is already registered (`This name already exists`).
  4. Optimizes the homepage native ad container so the space below ads fits snugly without compounding gaps or mobile scroll lag.
- **Target Audience**: K-12 and university students accessing AI lessons, visual scan problem-solving, and chalkboard search.
- **Key Value**: Fair-use monetization protection, friction-free student signups, and a polished, tight homepage layout.

---

## 2. User Experience & Visual Design

### Key User Flows

```
[Student Visits Top Up Modal]
       │
       ├── Is Guest? ────────────────────────► Shows "Sign In to Claim +50 Credits" CTA
       │                                        └── Click opens AuthModal in signin/signup mode
       │
       ├── Has > 50 Credits (e.g. 75)? ───────► Button Disabled: "⚡ Max 100 Credits Reached"
       │                                        └── Badge: "Spend credits before topping up"
       │
       └── Has <= 50 Credits & Signed In? ───► Button Active: "⚡ Get 50 Free Credits"
                                                └── Click grants +50, triggers 30s anti-spam timer

[Student Creates Account (Sign Up)]
       │
       ├── Input field labeled "Username" (type="text", placeholder="e.g. alex2026")
       ├── No "@" required, no browser tooltips demanding "@"
       └── If username already taken:
             └── Instant Alert: "This name already exists. Please choose a different username."
```

### Visual Identity & Theme
- **Theme Consistency**: High-contrast dark theme matching ClassroomLM (`bg-slate-900`, `border-slate-700/80`, `text-white`).
- **Quota Cap Indicators**: Amber/slate muted disabled state for the top-up CTA with lock/clock iconography when balance > 50.
- **Input Styling**: Neutral background (`bg-slate-800 border-slate-700`), blue focus ring, leading icon (`User`), no HTML5 browser email tooltip popups.
- **Adsterra Container**: Tightly bounded container with zero excessive bottom margin (`mb-2` instead of inflating padding), maintaining `touch-action: pan-y` for mobile fluidity.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Quota Ceiling Enforcement (>50 Credits)**
  - *Chosen Approach*: Button disabled when `credits > 50`, accompanied by status indicator `Max 100 Credits Reached`. Backend/context credit addition checks `Math.min(DAILY_CREDITS_QUOTA, current + 50)`.
  - *Why*: Eliminates credit hoarding and guarantees compliance with the 100 daily quota rule.
- **Decision 2: Username Mapping Strategy**
  - *Chosen Approach*: Accept student username input and map internally to `${sanitizedUsername}@classroomlm.app` when communicating with Firebase Auth, while displaying the pure student username in all UI components and Firestore user profile documents.
  - *Why*: Firebase Auth requires an email format under the hood, but students should never be forced to type "@" or have an actual email address.
- **Decision 3: Eliminating Ad Space Without `overflow: hidden`**
  - *Chosen Approach*: Inside the isolated iframe, replace `Math.max(b.scrollHeight, docElem.scrollHeight)` with the exact deepest coordinate of rendered ad elements (`getDeepestBottom`). Prevent compounding height inflation where the iframe height expanded its own document's scroll height.
  - *Why*: `overflow: hidden` would clip drop-shadows or 4th ad content on varying viewports. Exact coordinate tracking fits the ad perfectly with zero lag.

---

## 4. Technical Architecture & Data Strategy

### Component & System Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                               ClassroomLM                              │
├───────────────────────────────────┬────────────────────────────────────┤
│           Credit Modal            │             Auth Modal             │
│   (src/components/CreditModal)    │     (src/components/AuthModal)     │
├───────────────────────────────────┼────────────────────────────────────┤
│ • Guest check: !currentUser       │ • Input type="text" (Username)     │
│   -> "Sign In to Claim" CTA       │ • Strips '@' requirement           │
│ • Quota check: credits > 50       │ • Maps to @classroomlm.app internally│
│   -> Disabled "Max 100 Reached"   │ • Catches auth/email-already-in-use │
│ • Valid click: +50 credits (<=100)│   -> "This name already exists"    │
└─────────────────┬─────────────────┴──────────────────┬─────────────────┘
                  │                                    │
                  ▼                                    ▼
       ┌─────────────────────┐              ┌────────────────────┐
       │   Adsterra Banner   │              │ Firebase Auth/Store│
       │ (src/components/    │              │ (src/firebase/     │
       │    AdsterraAd.tsx)  │              │    authContext)    │
       ├─────────────────────┤              ├────────────────────┤
       │ • getDeepestBottom()│              │ • sanitizeUsername │
       │ • No compounding gap│              │ • credit limits    │
       │ • No overflow:hidden│              │ • duplicate alerts │
       └─────────────────────┘              └────────────────────┘
```

### Key Implementation Steps

1. **Credit Modal & Quota Gating (`CreditModal.tsx`)**:
   - Check `currentUser`: If guest, render a primary button: `🔐 Sign In to Top Up Credits`, which calls `onClose()` and `openAuthModal()`.
   - Check `credits > 50`: If credits > 50, render disabled button: `⚡ Max 100 Credits Reached` with explanation badge: `Your balance is {credits}/100. Spend credits before topping up.`
   - In `handleClaimCredits`: Enforce `if (!currentUser || credits > 50) return;`.

2. **Username Authentication & Error Handling (`AuthModal.tsx` & `authContext.tsx`)**:
   - Change input `type="email"` to `type="text"`, label to `"Username"`, placeholder to `"e.g. satyam or alex2026"`.
   - In `signInWithEmail` and `signUpWithEmail`, if the value does not include `@`, append `@classroomlm.app` automatically.
   - When Firebase throws `auth/email-already-in-use`, display exact user warning: `"This name already exists. Please choose a different username or sign in."`
   - Ensure the student's display name and profile reflect their clean username without `@classroomlm.app`.

3. **Homepage Adsterra Height Optimization (`AdsterraAd.tsx` & `LandingPage.tsx`)**:
   - In `AdsterraAd.tsx` iframe script, compute height strictly from `getDeepestBottom()` of rendered elements inside `#container-f93109a9ce4a4227b16a6d92e94a8b1f`.
   - Remove `b.scrollHeight` and `docElem.scrollHeight` fallback from the calculation, as these reflect the current iframe height and cause compounding growth.
   - Set a clean +12px bottom spacing rather than +35px to prevent excess empty space below the ads.
   - Verify layout stability on both mobile and desktop screens without `overflow: hidden`.
