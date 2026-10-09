# Design system

The EliteBCN mobile design system: one set of tokens and components (`packages/ui` in `elitebcn-apps`) used by both apps. A copy of this document is kept in that repository.

## 1. Direction

EliteBCN is a private chauffeur service in Barcelona. The apps should feel like a hotel concierge, not a taxi hail. That means calm, precise, and sparing.

**Subject and job.** A passenger needs to know who is coming, when, and where, and to trust it. A driver needs the next action and the facts to do it, at arm's length, without being distracted.

**The memorable element: the journey line.** A ride is drawn as a single hairline between two places, a ring at the pickup, a square at the destination, the times in tabular figures. No map thumbnail, no card. When the ride is live the line turns gold, and that is the only place it does.

**Where gold is allowed.** Exactly three things: the one primary action on a screen, the live state of a ride, and key figures. Nowhere else. This restraint is what makes it read as luxury.

**What it avoids.** Gradients, glass, heavy shadows, rounded cards stacked on cards, icon decoration, looping animation, all-caps labels, anything that looks like a ride-hailing app.

## 2. Principles

1. **One primary action per screen.** It is the only filled gold control.
2. **Hairlines, not boxes.** Rows are divided by thin lines. A raised surface is used only when lifting something carries meaning.
3. **Type carries hierarchy.** Size and weight do the work colour and shadow do elsewhere.
4. **Every screen has all its states.** Empty, loading, failed, offline, success, disabled. Written once, in `States.tsx`.
5. **Say what happened and what to do.** Plain words, never a code. Errors do not apologise.
6. **Accessible from the start.** Contrast is tested, targets are large, text scales, motion respects the phone's setting.
7. **Motion explains.** It marks arrival, change and completion, then stops.

## 3. Tokens (`packages/ui/src/tokens.ts`)

### Colour

Two themes, both from the brand: **ink** (dark, the brand default) and a neutral light. The phone's setting chooses; dark is the fallback.

| Role | Dark | Light | Use |
|---|---|---|---|
| bg | `#0A0A0A` | `#F6F6F4` | page |
| surface | `#121212` | `#FFFFFF` | fields, avatars |
| line | `#262626` | `#E4E4E0` | hairline dividers |
| outline | `#707070` | `#85857F` | borders of controls (3:1) |
| text | `#F2F2F0` | `#111111` | body |
| textMuted | `#A6A6A2` | `#55554F` | secondary |
| textFaint | `#80807C` | `#6F6F69` | tertiary, still 4.5:1 |
| accent | `#C9A84C` | `#C9A84C` | gold fills |
| accentText | `#D6B65C` | `#7A5C0A` | gold as text, tuned to read |
| onAccent | `#0A0A0A` | `#0A0A0A` | text on gold |
| success / warning / danger | `#6FBF8E` / `#E69A5C` / `#F0766A` | `#1F7A4D` / `#9A4F15` / `#B22E24` | status |

Every text pairing is held to WCAG AA by `packages/ui/test/tokens.test.ts`: body 7:1, muted and faint 4.5:1, gold text 4.5:1, text on gold 7:1, status colours 4.5:1, control borders and focus ring 3:1. A test failure caught real misses during construction (a light-theme warning and danger colour, and control borders) and they were corrected.

### Type

Two typefaces, the same pair as the website: **Inter** for everything read or tapped, **Playfair Display** for a few display moments in the customer app only (the greeting, "Booking confirmed", the driver's name). The driver app never sets the serif.

| Variant | Customer | Driver |
|---|---|---|
| display | Playfair 34 / 42 | Inter 600, 32 / 40 |
| title | Inter 600, 24 / 30 | 28 / 34 |
| heading | 18 / 24 | 21 / 28 |
| body | 16 / 24 | 18 / 26 |
| caption | 13 / 18 | 14 / 20 |
| numeral | tabular, 16 / 24 | tabular, 20 / 26 |

Nothing under 13 points. Text scales with the phone's setting up to 130%. Times and amounts use tabular figures so they do not jitter. Sentence case throughout.

### Space, shape, targets

- Spacing is a 4-point scale. Screen gutter 24.
- One small radius set: control 10, container 14, sheet 22 (top only), status pill full. Nothing else is rounded.
- Touch targets: 48 minimum everywhere; primary buttons 56 (customer) and **64 (driver)**.

### Motion

Durations 80 / 140 / 220 / 360 ms, one decelerating curve for entrances, one accelerating for exits.

| | Customer: expressive | Driver: functional |
|---|---|---|
| A card arrives | short rise and fade | short fade, no movement |
| Status changes | cross-fade of the label | same |
| Booking confirmed | ring draws, then a tick, once | same, once |
| Driver arrives | one soft ring, once | none |
| Screen change | fade | none |
| Loading | gentle skeleton fade (stops when content arrives) | same |

Everything shows its end state at once under "reduce motion". Nothing loops except the loading skeleton. Nothing moves in a driver's eyeline. Animations use the native driver where possible to save battery.

## 4. Components

| Component | Purpose |
|---|---|
| `Text` | all text, from the tokens |
| `Button` | primary (gold), secondary (outlined), quiet (text), danger (outlined). Loading keeps its width. Disabled is announced |
| `Field` | label always visible, helper, error that says how to fix it, show/hide for passwords |
| `Screen`, `Header`, `Section`, `ListRow`, `ActionBar` | page structure. The action bar pins the primary action and can show a total the server quoted |
| `StatusPill` | dot and words together, so it reads without colour. `live` is the one gold status |
| `RouteSummary` | the journey line |
| `DriverCard` | name first, then car and plate (what a passenger looks for at the kerb), call and message |
| `RideProgress` | segments plus the named current step, which cross-fades |
| `ConfirmationMark`, `ArrivalPulse`, `Reveal`, `StatusSwap`, `Skeleton` | the motion helpers |
| `EmptyState`, `ErrorState`, `OfflineBanner`, `UpdateRequired`, `LoadingLines` | the four honest states |
| `Icon` | one family of line icons, 24-point grid, 1.75 stroke |

## 5. Screens prepared for

Both apps have the shell, Welcome, Sign in, Home (empty state) and a **Design check** screen that shows every component in every state with sample data (not reachable in a production build).

Customer, to be built on this foundation: Splash, Welcome, Sign in, Sign up, Forgot password, Home, Book ride, Quote, Vehicle selection, Extras, Payment, Booking confirmation, Upcoming ride, Active ride, Live tracking, Past rides, Cancelled rides, Ride details, Driver details, Rating, Notifications, Profile, Support.

Driver: Onboarding, Sign in, Sign up, Document upload, Pending approval, Home, Online/offline, New ride, Ride details, Today's rides, Upcoming, Past rides, Navigation, Arrived, Start ride, Complete ride, Notifications, Profile, Vehicle, Documents, Earnings.

## 6. Driver app rules

Speed, clarity, large controls, minimal distraction. The next action is a single large control at the bottom, the facts needed to do the job sit above it, the type is larger, the serif is absent, and nothing animates between screens.

## 7. How it was checked

The customer app was run as a web build at phone width, in light and dark, and reviewed visually, including the Welcome screen and the full Design check. Contrast is tested automatically. **Not yet done:** testing on a physical iPhone and Android phone, screen-reader passes, and text-size testing at the largest settings. Those are part of Phase 2 review.

## 8. Still needed from you

App icon, splash mark and store screenshots. The apps use a text wordmark ("ELITEBCN" in letter-spaced gold) until a logo file is supplied.
