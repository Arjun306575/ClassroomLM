# Adsterra Smartlink Monetization & Homepage Ad Layout Polish

Integrate the Adsterra Smartlink monetization model through a sleek, user-friendly Credit Modal (+50 credits per sponsor visit with 30s anti-fraud cooldown) and eliminate excessive empty space beneath ads on the homepage.

### User Review & Critical Decisions

> [!IMPORTANT]
> The implementation strictly adheres to the requested Adsterra Smartlink URL, single-click +50 credit reward model, 30-second cooldown timer, exact UI copywriting, and responsive dark modal styling.

- **Confirmed Decision 1 (Smartlink URL & Reward Trigger)**: Centralized configuration constant `ADSTERRA_SMARTLINK_URL = "https://asiafilm.org/4/2fa49655ff370a4066b732ffd0860242"` in `src/config/adsterra.ts`. Clicking the CTA awards +50 credits immediately to local storage and user state, opening the sponsor link safely with `window.open(..., '_blank', 'noopener,noreferrer')`.
- **Confirmed Decision 2 (Anti-Fraud Cooldown)**: 30-second cooldown timer persisted in `localStorage` (`classroomlm_smartlink_cooldown_until`) preventing ad network policy violations and spam clicking across modal toggles and page reloads.
- **Confirmed Decision 3 (Homepage Ad Spacing Fix)**: Remove artificial minimum height ceilings (`Math.max(280, ...)` and `minHeight: 220px`) inside `AdsterraAd.tsx` so the iframe tightly bounds the native banner height, and tighten `<main>` bottom padding (`pb-14 sm:pb-20` down to `pb-4 sm:pb-6`) in `LandingPage.tsx` to eliminate the dead space before the footer.

---

### 1. Overview & Core Concept

- **What It Does**: ClassroomLM provides free AI lessons, Magic Lens problem breakdowns, and AI chalkboard searches funded through non-intrusive sponsor support. When users need more credits (or run low on daily credits), they can click "⚡ Get 50 Free Credits" to visit an educational sponsor via Adsterra Smartlink, instantaneously receiving +50 generation credits.
- **Target Audience**: Students and self-learners looking to generate unlimited custom lessons without paying subscription fees.
- **Key Value**: Frictionless, single-click top-up experience that rewards students with 50 credits per visit while adhering to ad network anti-fraud standards with a 30-second cooldown guard.

---

### 2. User Experience & Visual Design

#### Key User Flows
1. **Direct Top-Up from Header**:
   - The user taps the header credit counter badge (`⚡ [credits] / 100`).
   - The "Top Up Generation Credits" modal appears with smooth spring entrance animation and backdrop blur.
   - User sees their current balance, feature credit costs, and the primary action button: `"⚡ Get 50 Free Credits"`.
2. **Reward Claim & Cooldown**:
   - User clicks `"⚡ Get 50 Free Credits"`.
   - The Adsterra Smartlink opens in a new background tab safely via `noopener,noreferrer`.
   - Balance immediately increments by +50 credits, accompanied by an instant success notification toast.
   - The CTA button switches to a countdown state (`"Please wait 30s..."`) with animated clock indicator and disabled interaction.
3. **Low / Insufficient Credit Flow**:
   - When a user attempts to generate a lesson or use Magic Lens without sufficient credits, the prompt modal directly offers a `"⚡ Get 50 Free Credits"` button that opens the Credit Modal.
4. **Clean Homepage Flow**:
   - When scrolling to the bottom of the homepage, the native sponsor banner sits comfortably below the feature cards with proportional margins, seamlessly transitioning into the footer with no awkward vertical void.

#### Visual Identity & Theme
- **Color Palette & Glassmorphism**:
  - Deep canvas: `bg-slate-900/95` border with `border-slate-700/80`.
  - Ambient energy: Subtle amber (`rgba(245,158,11,0.18)`) and cyan (`rgba(6,182,212,0.12)`) radial gradients.
  - Accent: High-contrast amber-to-orange gradient (`from-amber-500 via-orange-500 to-amber-600`) for the primary action button.
- **Typography & Copy**:
  - Title: `"Top Up Generation Credits"` (20px–24px bold).
  - Subtitle: `"Support ClassroomLM by visiting our sponsor to instantly get 50 credits!"`
  - Primary CTA: `"⚡ Get 50 Free Credits"`
  - Cooldown Indicator: `"Please wait [seconds]s..."` with subtle helper caption `"Anti-spam cooldown active · Button ready in [seconds]s"`.
- **Accessibility & Spacing**:
  - Touch target height: $\ge 48\text{px}$ on all buttons.
  - Tabular figures (`tabular-nums font-mono`) for credit counts and cooldown timers.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Persistent Cooldown in LocalStorage vs. Memory-Only**:
  - *Chosen Approach*: Persist timestamp `classroomlm_smartlink_cooldown_until` in `localStorage`.
  - *Why*: Prevents circumventing the 30-second cooldown by closing and reopening the modal or reloading the page, guaranteeing compliance with Adsterra anti-fraud terms.
- **Decision 2: Optimistic Instant Credit Allocation**:
  - *Chosen Approach*: Apply `addCredits(50)` synchronously on click rather than waiting for window return events.
  - *Why*: Browser security limits cross-origin communication from popup tabs. Rewarding immediately upon outbound click gives instant positive reinforcement to the user.
- **Decision 3: Dynamic Adaptive Height for Adsterra Native Placement**:
  - *Chosen Approach*: Replace hardcoded `Math.max(280, ...)` with true content height detection + ResizeObserver inside the sandbox iframe, and compress homepage main container bottom padding.
  - *Why*: Eliminates the large empty void below homepage ads while ensuring banners never get clipped or truncated.

---

### 4. Technical Architecture & Data Strategy

#### Architecture & Component Diagram

```
┌───────────────────────────────────────────────────────────────┐
│                       ClassroomLM App                         │
├───────────────────────────────┬───────────────────────────────┤
│         LandingPage           │          LiveClassroom        │
│  ┌─────────────────────────┐  │                               │
│  │ Credit Badge / Header   │  │                               │
│  └────────────┬────────────┘  │                               │
│               │ opens         │                               │
│               ▼               │                               │
│  ┌─────────────────────────┐  │                               │
│  │       CreditModal       │  │                               │
│  │ ⚡ Get 50 Free Credits  │  │                               │
│  └────────────┬────────────┘  │                               │
└───────────────┼───────────────┴───────────────────────────────┘
                │
                ├──────────────────────────────────────┐
                ▼                                      ▼
    ┌──────────────────────┐               ┌──────────────────────┐
    │  Adsterra Smartlink  │               │   AuthContext State  │
    │  window.open(...)    │               │  credits += 50       │
    │  (External Sponsor)  │               │  localStorage Sync   │
    └──────────────────────┘               └──────────────────────┘
```

#### State & Storage Contracts

- `src/config/adsterra.ts`:
  - `ADSTERRA_SMARTLINK_URL`: `"https://asiafilm.org/4/2fa49655ff370a4066b732ffd0860242"`
  - `SMARTLINK_CREDIT_REWARD`: `50`
  - `SMARTLINK_COOLDOWN_SECONDS`: `30`
  - `SMARTLINK_COOLDOWN_STORAGE_KEY`: `"classroomlm_smartlink_cooldown_until"`
- `CreditModal.tsx`:
  - Manages `cooldownSeconds` state decremented via `setInterval`.
  - Triggers `addCredits(50)` and opens Smartlink in new tab with `noopener,noreferrer`.
- `AdsterraAd.tsx`:
  - Dynamically calculates iframe height from actual container scroll/offset height without enforcing excessive 280px/220px minimums.
- `LandingPage.tsx`:
  - Wires `isCreditModalOpen` state.
  - Credit badge in header opens `CreditModal`.
  - Insufficient credit dialog triggers `CreditModal`.
  - Adjusts spacing beneath feature cards and main container (`pb-4 sm:pb-6`).
