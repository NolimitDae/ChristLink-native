# Motion audit (LAUNCH step C.1)

- **Commit audited**: `f3109b5` (branch `claude/railway-launch`)
- **Date**: 2026-10-20
- **Method**: `improve-animations` skill (recon, audit against its eight categories, vet every finding at its file:line), judged against the `animate-expo` rules (`.claude/skills/animate-expo/SKILL.md` + `RECIPES.md`).
- **Scope**: `components/ui`, `components/community`, `components/event`, `components/home`, `components/tickets`, `components/TabBar.tsx`, the stack options in `app/_layout.tsx`, plus the screens that host those components (`app/event/[id]/index.tsx`) and `contexts/ToastContext.tsx` where it mattered.
- **No code was changed.** This file is the only output. Plans are grouped into the C.2 groups (1–6) and C.3 (navigation and tab bar), with a foundation step that every group depends on.

## Design reference used

`docs/DESIGN.pdf` is not in the repo. The design reference for this audit is:

- `CLAUDE.md` design rules: respect Reduce Motion (`t.reduceMotion`) and Dynamic Type, skeletons not spinners, 44pt touch targets, accessibility labels, design-system tokens only.
- `lib/theme.ts:185-190` motion tokens: `fast: 150`, `base: 250`, `slow: 420`, `celebrate: 900`, and `t.reduceMotion` (set in `contexts/ThemeContext.tsx:17-24` from `AccessibilityInfo`).
- The signature moments named in code comments: `components/ui/LightBurst.tsx:7-10` (RSVP confirmed, ticket purchased, "I prayed") and `components/event/RsvpCelebration.tsx:28-31` (ticket that lands in the Tickets tab).

Settled design decisions that are respected, not re-litigated: the custom floating glass tab bar with a raised Host button (so no `NativeTabs`), the sliding active dot, the stretchy event hero, the wallet-style ticket stack, and the gold light burst.

## Recon summary

- **Stack**: Expo SDK 58, React Native 0.88, New Architecture, `react-native-reanimated` 4.7.1 + `react-native-worklets` 0.13.0 installed, `react-native-gesture-handler` 3.3.0 (v3 hook API: `usePanGesture`, `onActivate` / `onUpdate` / `onDeactivate`, `event.canceled`), `expo-haptics` via `lib/haptics.ts`, `expo-router` JS tabs with a custom `TabBar`.
- **Reanimated is installed but unused.** Every animation in the app uses React Native's core `Animated` (15 files: `Button`, `BottomSheet`, `LightBurst`, `Segmented`, `Skeleton`, `Badge`, `TabBar`, `PrayerCard`, `RollingNumber`, `PostCard`, `EventHero`, `RsvpCelebration`, `TonightCarousel`, `WalletStack`, plus `app/event/[id]/index.tsx` and `app/host/scan.tsx`). `BottomSheet` uses `PanResponder`.
- **No `GestureHandlerRootView`** anywhere (`app/_layout.tsx:114-128`). Gesture Handler does nothing without it. Required before Group 2.
- **Spring configs are mass/stiffness/damping**, and all of them bounce. With mass 1 the damping ratio is `damping / (2 * sqrt(stiffness * mass))`:

  | File:line | Config | Damping ratio |
  | --- | --- | --- |
  | `components/TabBar.tsx:37` | damping 18, stiffness 220 | 0.61 |
  | `components/ui/Segmented.tsx:22` | damping 20, stiffness 240 | 0.65 |
  | `components/ui/BottomSheet.tsx:44` | damping 22, stiffness 220 | 0.74 |
  | `components/ui/BottomSheet.tsx:63` | default (friction 7, tension 40) | ~0.55 |
  | `components/tickets/WalletStack.tsx:50` | damping 18, stiffness 190, mass 0.9 | 0.69 |
  | `components/tickets/WalletStack.tsx:51` | damping 16, stiffness 220 | 0.54 |
  | `components/event/RsvpCelebration.tsx:71` | damping 11, stiffness 160, mass 0.8 | 0.49 |
  | `components/ui/Button.tsx:56` | speed 40, bounciness 6 | bouncy |

  None of these is driven by a finger carrying momentum, so none should overshoot (animate-expo step 5: "Bounce only when the gesture carried momentum").
- **Frequency map**: tens per day: Button / Chip / Card presses, tab switches, Segmented, ticket wallet taps, "I prayed", Amen. Occasional: bottom sheets (25 files use `BottomSheet`), checkout, screen pushes, toasts. Rare: RSVP / purchase celebration, LightBurst, publish-event burst.
- **Already right (no action)**: `EventHero` and `TonightCarousel` scroll effects use `Animated.event(..., { useNativeDriver: true })`, so they already run on the UI thread; the event top bar crossfades the opacity of a static `Glass` (never animates blur intensity) at `app/event/[id]/index.tsx:300,513`; tab switches don't slide (JS `Tabs` default is no animation); `LightBurst`, `PrayerCard` and `RsvpCelebration` already have Reduce Motion branches that keep opacity and drop movement; haptics fire on the causal frame and are always paired with a visual.

## Findings, ranked by impact

| # | Severity | Category | Location | Finding | Fix (group) |
| --- | --- | --- | --- | --- | --- |
| 1 | HIGH | Performance, Interruptibility | `components/ui/BottomSheet.tsx:55-66` | Drag uses `PanResponder` + `translate.setValue` on the JS thread. The sheet stutters whenever JS is busy (the checkout sheet re-quotes prices while open). Grabbing a sheet mid-animation teleports it (`setValue(g.dy)` ignores the current position). Dismiss is distance-or-`vy` only, release velocity is thrown away, snap-back uses the default bouncy spring, and dragging up hits a hard stop. Used by 25 files. | Reanimated + `usePanGesture`, velocity projection, rubber band (2) |
| 2 | HIGH | Accessibility, Purpose | `app/_layout.tsx:92-97` | Every push is forced to `slide_from_right` and no screen transition reads `t.reduceMotion`, so Reduce Motion users get full slides everywhere. `auth` and `ticket/[id]` override the native modal transition with `slide_from_bottom`. Self-contained tasks (legal pages, host verification, create event) push like hierarchy. | Platform default, `fade` under Reduce Motion, modals for tasks (C.3) |
| 3 | HIGH | Performance, Purpose | `components/community/RollingNumber.tsx:23-34` | Counts with `useNativeDriver: false` and a listener that calls `setState` every frame for 600ms (one React render per frame on every prayer card). For the usual +1 change, `Math.round` flips the number once at ~300ms, so the user sees a delayed jump, not a roll. | Keyed digit roll with layout animations, UI thread (3) |
| 4 | HIGH | Physicality | `components/community/PostCard.tsx:41,51` | Double-tap Amen heart pops from `scale: 0` (and its opacity jumps to 1 on the first frame). | Start at 0.8 + opacity 0 (3) |
| 5 | MEDIUM | Easing, Interruptibility | `components/ui/Button.tsx:54-57` | Press scale is a core `Animated.spring` with `bounciness: 6` started from JS on press-in/out, so it wobbles on release and is skipped entirely under Reduce Motion (fine), while `Card`, `TicketShell`, `Chip`, `EventCard` and the raised Host tab have only an instant opacity change. Press feedback is inconsistent across the most-touched controls. | Shared `PressableScale` with a 120ms CSS transition (1) |
| 6 | MEDIUM | Easing, Interruptibility | `components/event/RsvpCelebration.tsx:71,74,105` | Ticket landing uses `Easing.in(Easing.cubic)` for 680ms (the motion starts slowly, exactly when the eye is on it). The entry spring has damping ratio 0.49 (visible wobble) from scale 0.5. The full-screen overlay intercepts every touch for ~2.4s. | `EASE_OUT`, spring 400/0.8, `pointerEvents="none"` (4) |
| 7 | MEDIUM | Cohesion, Easing | table above | All springs use mass/stiffness and overshoot on motion no finger drove. No shared easing or spring tokens; `t.motion` holds durations only. | Duration + damping-ratio tokens (Foundation) |
| 8 | MEDIUM | Accessibility, Purpose | `components/ui/Segmented.tsx:21-23` | No Reduce Motion branch. On first layout the thumb springs from x=0 to the selected segment, so every screen that opens on a non-first segment slides on mount. Bouncy spring (0.65) on a tap toggle. | `withTiming` 200ms `EASE_IN_OUT`, no animation on first layout (6) |
| 9 | MEDIUM | Purpose, Easing | `components/TabBar.tsx:33-38` | The active dot springs (0.61, overshoots) on the most frequent action in the app. At that frequency motion must be near-imperceptible. | `withTiming` 150ms `EASE_IN_OUT` (C.3) |
| 10 | MEDIUM | Accessibility | `components/ui/BottomSheet.tsx:42,49` | Under Reduce Motion the sheet appears at full opacity on frame 1 and disappears instantly on close while the backdrop still fades for 250ms. Should crossfade. | Part of (2) |
| 11 | LOW | Easing | `components/community/PrayerCard.tsx:33-36` | Glow uses core `Animated.timing` default easing (ease-in-out) for the rise; an arriving glow should ease out. | `EASE_OUT` rise, Reanimated (3) |
| 12 | LOW | Cohesion, Performance | `components/ui/LightBurst.tsx:15-29` | Weak `Easing.out(Easing.cubic)`; the 13 burst views stay mounted (opacity 0) forever after the first play; `onDone` in the effect deps would replay the burst on every parent render if a caller ever passed an inline callback. | Reanimated, `EASE_OUT`, unmount when done (4) |
| 13 | LOW | Accessibility, Cohesion | `components/event/EventHero.tsx:27` | Core `Animated` (already on the UI thread, so no jank). Under Reduce Motion all transforms are dropped, so an iOS pull-down reveals an empty gap above the cover instead of stretching. | Reanimated scroll handler; keep stretch, drop parallax under Reduce Motion (5) |
| 14 | LOW | Cohesion | `components/ui/Skeleton.tsx:14-33`, `components/ui/Badge.tsx:46-61` | Core `Animated.loop` per instance. Correct behaviour, wrong tool: these are CSS-animation cases (loop, no state). | Reanimated CSS animations (6) |
| 15 | LOW | Setup | `app.json` `ios.infoPlist` | `CADisableMinimumFrameDurationOnPhone` is not set explicitly. Recent Expo SDKs add it, but it must be confirmed or ProMotion iPhones cap our animations at 60fps. | Verify in a build (C.3) |

### Missed opportunities (additive)

1. **Toasts teleport** in and out (`contexts/ToastContext.tsx:54-69`). Plan in the Extras section.
2. **Checkout ticket-type selection** swaps border and background colour instantly (`components/event/CheckoutSheet.tsx:293-296`). A 150ms colour transition makes the choice read as a state change. Included in Group 2.
3. **Wallet stack container height jumps** to the expanded height in one frame while the cards spring (`components/tickets/WalletStack.tsx:62-66`), so content below the stack jumps ahead of the cards. Plan in Extras.

---

## Shared conventions for every plan below

- **Reduce Motion source**: use `t.reduceMotion` from `useTheme()` (project rule in `CLAUDE.md`). Do not add `useReducedMotion()` as a second source. Reduced means fewer and gentler: keep opacity and colour, drop translate, scale, parallax and overshoot.
- **Shared values**: read and write with `.get()` / `.set()`, never `.value`, and never during render.
- **Worklet to JS**: `scheduleOnRN(fn, ...args)` from `react-native-worklets`. `runOnJS` is deprecated.
- **Layout-animation builders** (`FadeIn...`) go at module scope.
- **Mechanical check after every group**: `npm run typecheck && npm run lint && npm test`, all passing.
- **Feel check**: on a release build (`eas build --profile preview`) on the slowest Android you support and an iPhone. Expo Go and the simulator don't count. Toggle Reduce Motion in iOS Settings → Accessibility → Motion, and Android Settings → Accessibility → Remove animations. `/styleguide` has a Motion block (`app/styleguide.tsx:389-400`) for LightBurst and BottomSheet.
- **Drift rule**: if the code at a cited line no longer matches the excerpt, stop and report. Don't improvise.
- Don't touch payment, API or fee logic. Motion and press-feedback code only.

---

## Foundation: motion tokens (do first, every group depends on it)

- **Severity**: MEDIUM · **Category**: Cohesion & tokens · **Scope**: 2 files, ~40 lines

### Problem
`lib/theme.ts:185-190` has durations only:

```ts
export const motion = {
  fast: 150,
  base: 250,
  slow: 420,
  celebrate: 900,
} as const;
```

Each component types its own spring (see the recon table) and easing (`Easing.out(Easing.cubic)`, `Easing.in(Easing.cubic)`, `Easing.out(Easing.back(2))`).

### Target
1. In `lib/theme.ts`, extend `motion` with plain data (no new imports, so `lib/theme.ts` stays importable from jest without Reanimated):

```ts
export const motion = {
  fast: 150,
  base: 250,
  slow: 420,
  celebrate: 900,
  press: 120,
  /** Reanimated withSpring configs: Apple's duration + dampingRatio form. */
  spring: {
    settle: { duration: 400, dampingRatio: 1 },   // default, no overshoot
    snap: { duration: 400, dampingRatio: 0.8 },   // reposition / snap back after a drag (add velocity)
    sheet: { duration: 300, dampingRatio: 0.8 },  // sheet or drawer released by a finger (add velocity)
  },
} as const;
```

2. Create `lib/motion.ts` (Reanimated-dependent curves, imported only by animated components):

```ts
import { Easing, cubicBezier } from 'react-native-reanimated';

/** withTiming easings. Never use Easing.in on UI. */
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);      // entering / exiting
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);  // moving on screen
export const EASE_SHEET = Easing.bezier(0.32, 0.72, 0, 1);    // iOS sheet curve

/** Same curves for Reanimated CSS transitions/animations (transitionTimingFunction). */
export const CSS_EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);
export const CSS_EASE_IN_OUT = cubicBezier(0.77, 0, 0.175, 1);
```

### Steps
1. Edit `lib/theme.ts:185-190` as above. `Theme.motion` is `typeof motion`, so the type updates automatically.
2. Create `lib/motion.ts` exactly as above.
3. Run the mechanical check.

### Boundaries
Don't change the existing four duration values (screens use `t.motion.base` and `t.motion.celebrate`). No component edits in this step.

### Done when
Both files exist, the check passes, and `grep -rn "damping:\|stiffness:\|bounciness" components app` still shows the old configs (later groups remove them).

---

## Group 1: Button, cards and chips press feedback

- **Severity**: MEDIUM · **Category**: Easing, Physicality, Cohesion · **Scope**: 1 new file + 5 edited files
- **Depends on**: Foundation.

### Problem
- `components/ui/Button.tsx:46,54-57,60,67-68`: core spring, bouncy release, started from JS:

```tsx
const scale = useRef(new Animated.Value(1)).current;
const animate = (to: number) => {
  if (t.reduceMotion) return;
  Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
};
<Animated.View style={[{ transform: [{ scale }] }, fullWidth && styles.full, style]}>
  <Pressable ... onPressIn={() => animate(0.97)} onPressOut={() => animate(1)}
```

- `components/ui/Card.tsx:49-58` (`Card` pressable branch): only `opacity: pressed ? 0.85 : 1`. `TicketShell` (`Card.tsx:80-104`) has no press feedback at all.
- `components/ui/Chip.tsx:31-39`: only `opacity: pressed ? 0.75 : 1`.
- `components/EventCard.tsx:102,136,159`: only `opacity: pressed ? 0.9 : 1`.
- The raised Host button in `components/TabBar.tsx:53-67`: no feedback (handled in C.3, which reuses this component).

### Target
One shared component, `components/ui/PressableScale.tsx`. Press feedback is a two-state change with no finger tracking, so it's a Reanimated **CSS transition**, not a shared value (animate-expo step 3, Press feedback recipe).

```tsx
import React, { useState } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTheme } from '../../contexts/ThemeContext';
import { CSS_EASE_OUT } from '../../lib/motion';

type Props = Omit<PressableProps, 'style'> & {
  /** Scale while pressed. 0.97 for buttons and chips, 0.98 for large cards. */
  pressedScale?: number;
  /** Outer (animated) wrapper style: margins, width, alignSelf. */
  style?: StyleProp<ViewStyle>;
  /** Style for the Pressable itself; may be a function of { pressed }. */
  pressableStyle?: PressableProps['style'];
};

export function PressableScale({ pressedScale = 0.97, style, pressableStyle, onPressIn, onPressOut, children, ...rest }: Props) {
  const t = useTheme();
  const [pressed, setPressed] = useState(false); // fires twice per press, never per frame
  const scale = pressed && !t.reduceMotion ? pressedScale : 1;
  return (
    <Animated.View
      style={[
        {
          transform: [{ scale }],
          transitionProperty: 'transform',
          transitionDuration: t.motion.press, // 120ms
          transitionTimingFunction: CSS_EASE_OUT,
        },
        style,
      ]}
    >
      <Pressable
        {...rest}
        pressRetentionOffset={16}
        onPressIn={e => { setPressed(true); onPressIn?.(e); }}
        onPressOut={e => { setPressed(false); onPressOut?.(e); }}
        style={pressableStyle}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
```

Values: scale **0.97** (Button, Chip, Host tab), **0.98** (Card, TicketShell, EventCard: large surfaces move too many points at 0.97), **120ms**, `cubic-bezier(0.23, 1, 0.32, 1)`, feedback on press-in and commit on press-out. Keep each component's existing pressed opacity/colour change: that is the Reduce Motion feedback.

**Reduce Motion**: no scale (`scale` stays 1). The existing instant opacity / `goldPressed` background change remains, so feedback never disappears.

### Steps
1. Create `components/ui/PressableScale.tsx` as above and export it from `components/ui/index.ts` (add `export * from './PressableScale';` matching the existing export style in that file).
2. `components/ui/Button.tsx`: delete `useRef`, `Animated`, `scale`, `animate`. Replace the outer `<Animated.View>` + `<Pressable>` pair (lines 60-100) with `<PressableScale style={[fullWidth && styles.full, style]} pressableStyle={({ pressed }) => [...existing array from lines 75-86...]} ...same props as the Pressable (testID, onPress, disabled, accessibility*, hitSlop)>`. Remove the `onPressIn`/`onPressOut` props. Result: no `Animated` import from `react-native` in this file.
3. `components/ui/Card.tsx` `Card` (lines 49-58): replace `Pressable` with `PressableScale pressedScale={0.98}`, moving the current `style` function to `pressableStyle`. Keep `opacity: pressed ? 0.85 : 1`. `TicketShell` (lines 80-104): when `onPress` is set, use `PressableScale pressedScale={0.98}` instead of `Pressable` (the `Wrapper` variable); the style array moves to `pressableStyle`.
4. `components/ui/Chip.tsx:23-40`: replace `Pressable` with `PressableScale` (default 0.97); the style function moves to `pressableStyle`; `style` prop (outer margins) goes to `style`. Note `styles.chip` must stay on the Pressable (it carries `flexDirection: 'row'`).
5. `components/EventCard.tsx` lines 102, 136, 159: same swap with `pressedScale={0.98}`. Where the current style sets `width` or `flex: 1`, put that on the outer `style` so the animated wrapper keeps the layout, and keep the rest on `pressableStyle`.
6. Run the mechanical check.

### Boundaries
- Don't change `IconButton` or `ListRow` (opacity-only is right for small icons and settings rows hit constantly; scaling a full-width list row reads as a bug).
- Don't change haptics, labels, hit slop or colours.
- Don't add press scale to anything inside a horizontal scroll that also has `snapToInterval` other than the cards listed.

### Verification
- **Feel check**: press and hold a primary Button: it shrinks within ~1 frame of touch and holds at 0.97, with no wobble on release. Press a Chip in a `ChipRow`, then drag sideways: the scroll wins and the chip springs back without firing. Tap an EventCard in the home carousel: subtle 0.98 dip, no layout shift of neighbours. Screen-record at 240fps and step through: release returns in ≤120ms with no overshoot frame.
- **Reduce Motion on**: no scale anywhere; primary buttons still darken to `goldPressed`, cards still dim.
- **Done when**: `grep -n "Animated" components/ui/Button.tsx` returns nothing, and every listed component renders through `PressableScale`.

---

## Group 2: BottomSheet and the checkout sheet

- **Severity**: HIGH · **Category**: Performance, Interruptibility, Accessibility · **Scope**: `app/_layout.tsx` (1 wrapper), `components/ui/BottomSheet.tsx` (rewrite of motion code), `components/event/CheckoutSheet.tsx` (2 small edits)
- **Depends on**: Foundation.

### Problem
`components/ui/BottomSheet.tsx`, current code:

```tsx
// :36-53
const translate = useRef(new Animated.Value(SCREEN_H)).current;
const backdrop = useRef(new Animated.Value(0)).current;
useEffect(() => {
  if (visible) {
    setMounted(true);
    translate.setValue(t.reduceMotion ? 0 : SCREEN_H * 0.5);
    Animated.parallel([
      Animated.spring(translate, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }),
      Animated.timing(backdrop, { toValue: 1, duration: t.motion.base, useNativeDriver: true }),
    ]).start();
  } else if (mounted) {
    Animated.parallel([
      Animated.timing(translate, { toValue: SCREEN_H * 0.6, duration: t.reduceMotion ? 0 : t.motion.base, useNativeDriver: true }),
      Animated.timing(backdrop, { toValue: 0, duration: t.motion.base, useNativeDriver: true }),
    ]).start(() => setMounted(false));
  }
}, [...]);

// :55-66
const pan = useRef(PanResponder.create({
  onMoveShouldSetPanResponder: (_e, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
  onPanResponderMove: (_e, g) => { if (g.dy > 0) translate.setValue(g.dy); },
  onPanResponderRelease: (_e, g) => {
    if (g.dy > 120 || g.vy > 1.2) onClose();
    else Animated.spring(translate, { toValue: 0, useNativeDriver: true }).start();
  },
})).current;
```

What's wrong:
1. The drag runs on the JS thread (`PanResponder` + `setValue` per move).
2. Grabbing the sheet mid-open jumps it to the finger offset (starts from 0, not the current position).
3. Dismiss is decided by distance (120pt) or raw velocity. A short flick doesn't project, and the release velocity isn't handed to the exit animation (`onClose` → 250ms timing with default ease-in-out from wherever it is).
4. Snap-back uses the default spring (~0.55 damping ratio, slow wobble).
5. Opens from a fixed `SCREEN_H * 0.5`: a tall sheet (`maxHeightRatio` 0.88) is already half on screen at frame 1; a short sheet starts off screen. Inconsistent.
6. Dragging up stops dead; it should resist.
7. Reduce Motion: the sheet pops in at full opacity and vanishes instantly on close while the backdrop fades.
8. `components/event/CheckoutSheet.tsx:255` makes `onClose` a no-op while paying. With a velocity-driven dismiss the sheet could animate away while the parent keeps it "open", so the sheet needs to know it's not dismissible.

### Target
- Reanimated shared values: `translateY` (px), `sheetH` (measured by `onLayout`, initial `SCREEN_H`), `opacity` (for Reduce Motion), `gestureClosing` (boolean).
- Gesture Handler v3 `usePanGesture` on the existing handle area only (`styles.handleArea`, so the body `ScrollView` keeps scrolling), `activeOffsetY: [-10, 10]`.
- **Open** (no finger): from `translateY = sheetH` to 0 with `withSpring(0, { duration: 300, dampingRatio: 1 })` (no overshoot: no finger drove it); backdrop opacity 0→1 `withTiming(1, { duration: t.motion.base, easing: EASE_OUT })`.
- **Drag**: `onActivate` captures the current `translateY` into `context`; `onUpdate` sets `context + translationY` when ≥ 0, else `rubberband(next, sheetH)` (worklets below).
- **Release**: `projected = translateY + project(velocityY)`. If `dismissible && projected > sheetH * 0.4`: `withSpring(sheetH, { duration: 300, dampingRatio: 1, velocity: e.velocityY, overshootClamping: true }, finished => finished && scheduleOnRN(onClose))` and set `gestureClosing` true. Otherwise `withSpring(0, { ...t.motion.spring.sheet, velocity: e.velocityY })` (= `{ duration: 300, dampingRatio: 0.8, velocity }`) and `scheduleOnRN(haptic.light)` (it snapped home).
- **Programmatic close** (X button, backdrop tap, Android back, parent sets `visible=false`): `withTiming(sheetH, { duration: t.motion.base, easing: EASE_SHEET })` + backdrop to 0 with the same timing, then `scheduleOnRN(setMounted, false)`. If `gestureClosing` is true the sheet is already off screen: skip the animation, reset `gestureClosing`, and unmount.
- **Backdrop while dragging** derives from the same value: `opacity: interpolate(translateY, [0, sheetH], [1, 0], Extrapolation.CLAMP) * backdropIn`.
- **New prop** `dismissible?: boolean` (default `true`). When false, release always snaps back.
- **Reduce Motion**: no translate. Open = sheet `opacity` 0→1 and backdrop 0→1, both `withTiming(1, { duration: 200, easing: EASE_OUT })`. Close = both to 0 over 200ms, then unmount. The drag still follows the finger (direct manipulation), but release uses `{ duration: 300, dampingRatio: 1 }` (no overshoot) for snap-back, and a dismiss fades opacity to 0 over 200ms instead of sliding.

Worklets (copy verbatim, from animate-expo RECIPES):

```ts
function project(velocity: number, decelerationRate = 0.998) {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}
function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  'worklet';
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
```

### Steps
1. `app/_layout.tsx`: import `{ GestureHandlerRootView } from 'react-native-gesture-handler'` and wrap the `SafeAreaProvider` in `RootLayout` (line 115) with `<GestureHandlerRootView style={{ flex: 1 }}>…</GestureHandlerRootView>`.
2. `components/ui/BottomSheet.tsx`:
   1. Imports: remove `Animated`, `PanResponder` from `react-native`. Add `Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, interpolate, Extrapolation } from 'react-native-reanimated'`, `{ GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler'`, `{ scheduleOnRN } from 'react-native-worklets'`, `{ EASE_OUT, EASE_SHEET } from '../../lib/motion'`, `{ haptic } from '../../lib/haptics'`.
   2. Add `dismissible?: boolean` to `BottomSheetProps` (default `true`).
   3. Replace lines 36-53 with shared values (`translateY = useSharedValue(SCREEN_H)`, `sheetH = useSharedValue(SCREEN_H)`, `backdrop = useSharedValue(0)`, `opacity = useSharedValue(t.reduceMotion ? 0 : 1)`, `gestureClosing = useSharedValue(false)`, `context = useSharedValue(0)`) and an effect implementing Open / Programmatic close / Reduce Motion exactly as in Target. On open, set `translateY` to `sheetH.get()` before starting the spring (non-reduced), or to 0 (reduced).
   4. Replace lines 55-66 with `const pan = usePanGesture({ activeOffsetY: [-10, 10], onActivate, onUpdate, onDeactivate })` implementing Drag / Release. `onClose` and `dismissible` are read inside the callbacks; the hook manages identity (no `useMemo` with v3).
   5. Add `onLayout={e => sheetH.set(e.nativeEvent.layout.height)}` to the sheet `Animated.View` (line 77).
   6. Animated styles: `sheetStyle = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ translateY: translateY.get() }] }))` and `backdropStyle` as in Target. Swap the two `Animated.View`s (lines 73 and 77) to Reanimated `Animated.View` with these styles; keep every other style key.
   7. Inside the `<Modal>`, wrap the content in `<GestureHandlerRootView style={{ flex: 1 }}>` (Android modals are a separate root, so gestures need their own root view), and replace `<View {...pan.panHandlers} style={styles.handleArea}>` with `<GestureDetector gesture={pan}><View style={styles.handleArea}>…</View></GestureDetector>`.
3. `components/event/CheckoutSheet.tsx:253-256`: add `dismissible={!paying}` to `<BottomSheet>` (keep the existing `onClose={paying ? () => undefined : onClose}`).
4. `components/event/CheckoutSheet.tsx:283-297` (missed opportunity 2): wrap the type-card body in a Reanimated `Animated.View` that carries `borderColor`/`backgroundColor` with `transitionProperty: ['borderColor', 'backgroundColor'], transitionDuration: t.motion.fast /* 150 */, transitionTimingFunction: CSS_EASE_OUT`, or apply those transition keys to an `Animated.View` placed inside the `Pressable` that takes over `s.typeCard`. Colour transitions are kept under Reduce Motion (no movement).
5. Run the mechanical check.

### Boundaries
- Don't change the sheet's layout, `KeyboardAvoidingView`, header, footer, `maxHeightRatio` handling or the public props other than adding `dismissible`.
- Keep the pan on the handle area only. Don't make the scroll body draggable in this change.
- Don't touch payment logic in `CheckoutSheet` (`pay`, `finish`, coupon, quotes).
- If `usePanGesture`'s config keys differ from `activeOffsetY`/`onActivate`/`onUpdate`/`onDeactivate` in `node_modules/react-native-gesture-handler/lib/typescript/v3/hooks/gestures/pan/PanTypes.d.ts`, stop and report.

### Verification
- **Feel check** (release build, slowest Android + iPhone):
  - Open any sheet (`/styleguide` → Open BottomSheet): it rises from fully off screen, whatever its height, with no overshoot.
  - Grab the handle while it is still opening: it continues from where it is, with no jump.
  - Flick down a few points fast: it dismisses and keeps the flick's speed (no pause at release). Drag slowly 60% down and let go with no speed: it dismisses. Drag 20% slowly and release: it springs home with a slight settle and one light haptic.
  - Drag up: it moves less and less (rubber band), then returns.
  - Open the checkout sheet, tap Pay, and while the Stripe sheet is up or loading try to drag the checkout sheet down: it always snaps back.
  - With a heavy JS task (open checkout while the price quote is loading) the drag stays smooth.
- **Reduce Motion on**: sheets fade in and out over 200ms with no slide; backdrop and sheet fade together.
- **Done when**: no `PanResponder` or core `Animated` in `BottomSheet.tsx`, and all 25 `BottomSheet` consumers open and close (spot-check ReportSheet, EditProfileSheet, DeleteAccountSheet, InviteSheet, CheckoutSheet).

---

## Group 3: PrayerCard glow and RollingNumber (plus the Amen pop)

- **Severity**: HIGH (RollingNumber, PostCard `scale(0)`), LOW (glow) · **Category**: Performance, Physicality, Easing · **Scope**: 3 files
- **Depends on**: Foundation, Group 1 (for the "I prayed" button press feedback).

### Problem
1. `components/community/RollingNumber.tsx:23-34`:

```tsx
const id = anim.addListener(({ value: v }) => setShown(Math.round(v)));
Animated.timing(anim, { toValue: value, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => setShown(value));
```

This is a React render per frame on the JS thread. For a +1 the visible effect is a 300ms delay, then a jump.

2. `components/community/PrayerCard.tsx:28-38`: glow uses core `Animated.timing` with default easing:

```tsx
Animated.timing(glow, { toValue: 1, duration: t.reduceMotion ? 150 : 260, useNativeDriver: true }),
Animated.timing(glow, { toValue: 0, duration: t.reduceMotion ? 400 : 900, delay: 200, useNativeDriver: true }),
```

The "I prayed" `Pressable` (lines 88-100) has only an opacity dip.

3. `components/community/PostCard.tsx:40-55`: heart pops from `scale: 0`:

```tsx
pop.setValue(t.reduceMotion ? 1 : 0);
popOpacity.setValue(t.reduceMotion ? 0 : 1);
...
Animated.timing(pop, { toValue: 1.2, duration: 180, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
Animated.timing(pop, { toValue: 1, duration: 120, useNativeDriver: true }),
Animated.timing(popOpacity, { toValue: 0, duration: 320, delay: 220, useNativeDriver: true }),
```

### Target
**RollingNumber**: an odometer roll on the UI thread using layout animations on a keyed text. The new number enters from below moving up, and the old one exits upward, both clipped by a container.

```tsx
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutUp, LayoutAnimationConfig } from 'react-native-reanimated';
import { EASE_OUT } from '../../lib/motion';

// Module scope. FadeInDown starts 25pt below and moves up; FadeOutUp moves 25pt up. The container clips both.
const ROLL_IN = FadeInDown.duration(200).easing(EASE_OUT);
const ROLL_OUT = FadeOutUp.duration(160).easing(EASE_OUT);
const FADE_IN = FadeIn.duration(150);
const FADE_OUT = FadeOut.duration(120);

export function RollingNumber({ value, variant = 'caption', tone = 'muted', style }: ...) {
  const t = useTheme();
  return (
    <LayoutAnimationConfig skipEntering>
      <View style={{ overflow: 'hidden' }}>
        <Animated.View key={value} entering={t.reduceMotion ? FADE_IN : ROLL_IN} exiting={t.reduceMotion ? FADE_OUT : ROLL_OUT}>
          <AppText variant={variant} tone={tone} style={style}>{value}</AppText>
        </Animated.View>
      </View>
    </LayoutAnimationConfig>
  );
}
```

`LayoutAnimationConfig skipEntering` stops every count on the wall animating when the list first renders; only changes after mount roll. Exit is ~20% faster than entry. **Reduce Motion**: crossfade only (150ms in / 120ms out), no vertical movement.

**PrayerCard glow**: Reanimated shared value `glow`:
`glow.set(withSequence(withTiming(1, { duration: 200, easing: EASE_OUT }), withDelay(200, withTiming(0, { duration: 700, easing: EASE_OUT }))))`.
**Reduce Motion**: keep the glow (opacity only) with the current reduced durations: `150` in, `200` delay, `400` out, same easing. Wrap the "I prayed" button in `PressableScale` (Group 1, default 0.97), keeping its opacity dip.

**PostCard Amen pop**: shared values `pop` (scale) and `popOpacity`.
- Non-reduced: set `pop` 0.8 and `popOpacity` 0, then `popOpacity.set(withSequence(withTiming(1, { duration: 120, easing: EASE_OUT }), withDelay(220, withTiming(0, { duration: 250, easing: EASE_OUT }))))` and `pop.set(withSpring(1, t.motion.spring.snap))` (`{ duration: 400, dampingRatio: 0.8 }`: a small settle is earned, since a double tap is a deliberate gesture).
- **Reduce Motion**: `pop` fixed at 1; opacity `withSequence(withTiming(1, { duration: 150 }), withDelay(200, withTiming(0, { duration: 350 })))` (same as today).

### Steps
1. Rewrite `components/community/RollingNumber.tsx` as in Target. Keep the props and the doc comment, updated to "Rolls the new value in from below."
2. `components/community/PrayerCard.tsx`: replace the `Animated` import from `react-native` with Reanimated (`Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming, withDelay }`), `glow = useSharedValue(0)`, implement `pray()` per Target, `glowStyle = useAnimatedStyle(() => ({ opacity: glow.get() }))` on the glow view (line 42). Swap the "I prayed" `Pressable` (lines 88-100) to `PressableScale`, moving its style function to `pressableStyle`.
3. `components/community/PostCard.tsx`: same migration for `pop`/`popOpacity` (lines 35-36, 40-55, 115-116), styles via `useAnimatedStyle`. Remove `Easing` and `Animated` from the `react-native` import.
4. Run the mechanical check.

### Boundaries
Don't change `onPray`/`onAmen` calls, haptics (`haptic.success()` stays on the same frame as the glow start), accessibility labels, or the `LightBurst` usage (Group 4 owns it).

### Verification
- **Feel check**: tap "I prayed" on the prayer wall: the count rolls up (old number slides out the top, new one rises from below in 200ms) together with the glow and burst. Scroll the wall after a fresh load: no counts animate on first render. Double-tap a post: the heart grows from 0.8 with a tiny settle, never from a dot. Profile with the Perf Monitor: JS FPS doesn't dip while the count rolls.
- **Reduce Motion on**: the count crossfades in place; the glow still pulses; the heart only fades.
- **Done when**: no `useNativeDriver: false` and no `addListener` in `components/community`.

---

## Group 4: LightBurst and RsvpCelebration

- **Severity**: MEDIUM · **Category**: Easing, Interruptibility, Cohesion · **Scope**: 2 files
- **Depends on**: Foundation.

### Problem
1. `components/event/RsvpCelebration.tsx:67-77`: arrival uses ease-in, entry wobbles:

```tsx
Animated.spring(enter, { toValue: 1, damping: 11, stiffness: 160, mass: 0.8, useNativeDriver: true }),  // ratio 0.49
Animated.delay(950),
Animated.timing(land, { toValue: 1, duration: 680, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
```

The card scales in from 0.5 (`:95`). The root (`:105`, `<View style={[StyleSheet.absoluteFill, styles.root]} accessibilityViewIsModal>`) swallows every touch for the ~2.4s run.

2. `components/ui/LightBurst.tsx:15-29`: `Easing.out(Easing.cubic)` over `t.motion.celebrate` (900ms); the ring and 12 rays stay mounted at opacity 0 after the first play; `onDone` is an effect dependency (a caller passing an inline `onDone` would replay the burst on every render; no current caller does: `app/event/create.tsx:416`, `app/styleguide.tsx:395`, `PrayerCard.tsx:111`, `RsvpCelebration.tsx:107`).

### Target
**LightBurst** (Reanimated):
- `progress = useSharedValue(0)`; `active` React state. On `play` change (non-zero): `setActive(true)`, `progress.set(0)`, `progress.set(withTiming(1, { duration: t.reduceMotion ? 400 : t.motion.celebrate, easing: EASE_OUT }, finished => { if (finished) scheduleOnRN(finish); }))`, where `finish` sets `active` false and calls `onDoneRef.current?.()`.
- Keep `onDone` in a ref (`const onDoneRef = useRef(onDone); onDoneRef.current = onDone;`) and the effect deps to `[play, t.reduceMotion]`.
- Keep the interpolations: opacity `[0, 0.15, 1] → [0, 1, 0]`; ring scale `0.2 → 1.3`; rays scale `0.3 → 1.15` (a burst of light, not a UI element entering, so the no-`scale(0)` rule is satisfied and the expansion is the point).
- Render `null` when `!active`.
- **Reduce Motion**: unchanged: scale fixed at 1, opacity-only 400ms.

**RsvpCelebration** (Reanimated):
- Shared values `backdrop`, `enter`, `land`.
- Non-reduced sequence:
  - `backdrop.set(withSequence(withTiming(1, { duration: 200, easing: EASE_OUT }), withDelay(950 + 560, withTiming(0, { duration: 220, easing: EASE_OUT }))))`
  - `enter.set(withSpring(1, t.motion.spring.snap))` (`{ duration: 400, dampingRatio: 0.8 }`)
  - `land.set(withDelay(200 + 950, withTiming(1, { duration: 560, easing: EASE_OUT }, f => { if (f) scheduleOnRN(done); })))`
  - The backdrop fade starts when `land` ends; total about the same as today, with the 220ms backdrop fade after landing.
- Card scale: `interpolate(enter, [0, 1], [0.8, 1]) * interpolate(land, [0, 1], [1, 0.12])`. Entry starts at 0.8, not 0.5.
- Landing path unchanged (`translateX 0→dx`, `translateY [0, 0.35, 1] → [0, -28, dy]`, rotate `0→14deg`). Card opacity `land [0, 0.85, 1] → [1, 1, 0]` times clamped `enter`; text opacity `land [0, 0.3] → [1, 0]` (clamped) times `enter`. Same as today.
- Root: add `pointerEvents="none"` and remove `accessibilityViewIsModal`. The announcement at `:55` already tells screen-reader users, and the celebration must never block the screen.
- **Reduce Motion**: unchanged behaviour: `enter = 1`, no transforms, backdrop/card/text fade `withSequence(withTiming(1, { duration: 250 }), withDelay(1400, withTiming(0, { duration: 250 }, f => { if (f) scheduleOnRN(done); })))`.
- Keep `haptic.success()` and the announcement at the start (same frame as the burst).

### Steps
1. Rewrite the animation code in `components/ui/LightBurst.tsx` per Target. Keep the props, size math and ray layout (lines 31-63) except swapping to Reanimated `Animated.View` with `useAnimatedStyle`.
2. Rewrite `components/event/RsvpCelebration.tsx` lines 36-102 per Target. Keep `visible` state for mount/unmount, set false in `done`. On unmount or new `play`, call `cancelAnimation` on the three shared values (replaces `anim.stop()`).
3. Run the mechanical check.

### Boundaries
Don't change the card artwork (lines 109-134), the text, the tab-target math (lines 44-48), or `t.motion.celebrate`.

### Verification
- **Feel check**: RSVP to a free event (and buy a test ticket with `pk_test_`): the burst expands fast and lingers. The ticket arrives with a small settle, holds, then leaves for the Tickets corner immediately (fast start, slowing into the target), shrinking and fading as it lands. During the celebration, tap the Back button: it works. At 240fps the first frames of the landing already show clear movement.
- **Reduce Motion on**: no movement; overlay, card and text fade in, hold, fade out.
- **Done when**: no `Easing.in` anywhere (`grep -rn "Easing.in(" components app` is empty) and both files import no `Animated` from `react-native`.

---

## Group 5: EventHero stretchy header

- **Severity**: LOW · **Category**: Cohesion, Accessibility · **Scope**: 2 files
- **Depends on**: Foundation.

### Problem
`components/event/EventHero.tsx:12,18-27` takes a core `Animated.Value` driven by `Animated.event(..., { useNativeDriver: true })` in `app/event/[id]/index.tsx:85,381-383`. It already runs on the UI thread, so this is a consistency migration. Under Reduce Motion all transforms are dropped (`!t.reduceMotion && { transform: ... }`), so an iOS pull-down shows a bare gap above the cover.

### Target
- `app/event/[id]/index.tsx`: `const scrollY = useSharedValue(0); const onScroll = useAnimatedScrollHandler(e => { scrollY.set(e.contentOffset.y); });` with Reanimated `Animated.ScrollView` (`onScroll={onScroll} scrollEventThrottle={16}`). Top bar: `useAnimatedStyle(() => ({ opacity: interpolate(scrollY.get(), [heroHeight - 170, heroHeight - 100], [0, 1], Extrapolation.CLAMP) }))`, same range as `:300`.
- `EventHero` prop `scrollY: SharedValue<number>`; `useAnimatedStyle`:
  - Pull-down (pinning stretch, both modes): for `y < 0`, `scale = interpolate(y, [-height, 0], [2, 1])`, `translateY = interpolate(y, [-height, 0], [-height / 2, 0])`, not clamped on the left (so it keeps pinning past `-height`, as today).
  - Scroll-up parallax (non-reduced only): for `y > 0`, `translateY = interpolate(y, [0, height], [0, height * 0.45], Extrapolation.CLAMP)`, scale 1.
  - **Reduce Motion**: keep the pull-down stretch (it tracks the finger and only fills the overscroll gap), and drop the parallax (`translateY = 0` for `y > 0`).
- Read `t.reduceMotion` into a const outside the worklet and capture it (`const reduced = t.reduceMotion;`).

### Steps
1. Edit `app/event/[id]/index.tsx` lines 2, 85, 300, 381-383, 513 per Target. Keep `RefreshControl`, `contentContainerStyle` and children unchanged.
2. Edit `components/event/EventHero.tsx` per Target. Keep the markup.
3. Run the mechanical check.

### Boundaries
Don't change `heroHeight`, the gradients or the image. Don't animate `height`.

### Verification
- **Feel check** (iPhone): pull down on an event: the cover stretches with its top pinned. Scroll up: the cover moves at ~half speed and the glass title bar fades in at the same point as before. Android: no overscroll stretch (expected), parallax works.
- **Reduce Motion on**: the pull-down still stretches; scrolling up has no parallax.
- **Done when**: no core `Animated` in either file.

---

## Group 6: Skeleton shimmer, Badge pulse and Segmented

- **Severity**: MEDIUM (Segmented), LOW (Skeleton, Badge) · **Category**: Accessibility, Purpose, Cohesion · **Scope**: 3 files
- **Depends on**: Foundation.

### Problem
1. `components/ui/Segmented.tsx:18-23`:

```tsx
const x = useRef(new Animated.Value(0)).current;
useEffect(() => {
  Animated.spring(x, { toValue: idx * segW, useNativeDriver: true, damping: 20, stiffness: 240 }).start();
}, [idx, segW, x]);
```

There is no Reduce Motion branch. When `segW` first becomes known the thumb springs from 0 to the selected segment (a slide on every mount). Damping ratio 0.65 overshoots on a tap toggle.

2. `components/ui/Skeleton.tsx:14-33`: core `Animated.loop` of 800ms up / 800ms down (default ease-in-out), highlight opacity 0 → 0.9; static under Reduce Motion.
3. `components/ui/Badge.tsx:46-61`: `PulseDot` core loop 700ms to 0.3 / 700ms back; static under Reduce Motion.

### Target
**Segmented** (tab indicator recipe, translate only since segments are equal width):
- `x = useSharedValue(0)`; a `useRef(false)` `placed` flag.
- Effect on `[idx, segW, t.reduceMotion]`: if `segW === 0` return; if `!placed.current || t.reduceMotion` → `x.set(idx * segW)` (no animation) and `placed.current = true`; else `x.set(withTiming(idx * segW, { duration: 200, easing: EASE_IN_OUT }))`.
- Thumb style `useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }))`.
- `haptic.tap()` (selection) stays on press, not on landing.
- 200ms is the top of the 150–200ms toggle budget, with ease-in-out because the thumb moves across the control.
- **Reduce Motion**: thumb jumps; the label colour change explains the state.

**Skeleton**: Reanimated CSS animation on the highlight `Animated.View`:

```tsx
const PULSE = { from: { opacity: 0 }, to: { opacity: 0.9 } }; // module scope
style={[StyleSheet.absoluteFill, { backgroundColor: t.c.skeletonHighlight },
  t.reduceMotion ? { opacity: 0 } : {
    animationName: PULSE, animationDuration: 800, animationIterationCount: 'infinite',
    animationDirection: 'alternate', animationTimingFunction: 'ease-in-out',
  }]}
```

The timing is unchanged from today; it's a breathing pulse, not a sweep. Keep the pulse rather than converting to a translating shimmer: many independent skeletons with a sweep look out of sync. **Reduce Motion**: static (as today).

**Badge PulseDot**: same pattern with `const LIVE_PULSE = { from: { opacity: 1 }, to: { opacity: 0.3 } }`, `animationDuration: 700`, `'infinite'`, `'alternate'`, `'ease-in-out'`. **Reduce Motion**: static dot at opacity 1.

### Steps
1. `components/ui/Segmented.tsx`: replace the core `Animated` usage (lines 2, 18, 21-23, 32-34) per Target; imports `Animated, { useSharedValue, useAnimatedStyle, withTiming }` from Reanimated and `EASE_IN_OUT` from `lib/motion`.
2. `components/ui/Skeleton.tsx`: delete `pulse`, the effect and `useRef`/`useEffect` imports if unused; swap to Reanimated `Animated.View` with the CSS animation.
3. `components/ui/Badge.tsx`: same for `PulseDot`.
4. Run the mechanical check.

### Boundaries
Don't change the skeleton shapes (`EventCardSkeleton`, `ListSkeleton`, `PostSkeleton`), Badge colours or labels, the Segmented layout (`minHeight`, `adjustsFontSizeToFit`), or accessibility roles.

### Verification
- **Feel check**: open a screen whose Segmented starts on the second option: the thumb is already there, with no slide-in. Tap between options: a crisp 200ms glide, no overshoot. Home skeletons and the Live badge breathe exactly as before.
- **Reduce Motion on**: the thumb jumps, skeletons are static, the live dot is solid.
- **Done when**: no core `Animated` in the three files.

---

## C.3: Navigation and tab bar

- **Severity**: HIGH (Reduce Motion on all transitions), MEDIUM (tab dot, modal tasks), LOW (120fps check) · **Category**: Accessibility, Purpose · **Scope**: `app/_layout.tsx`, `components/TabBar.tsx`, `components/ui/Screen.tsx`, `app/legal/[doc].tsx`, `app/host/verify.tsx`, `app.json` (conditional)
- **Depends on**: Foundation, Group 1.

### Problem
`app/_layout.tsx:92-97`:

```tsx
<Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.c.bg }, animation: 'slide_from_right' }}>
  <Stack.Screen name="(tabs)" />
  <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
  <Stack.Screen name="auth" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
  <Stack.Screen name="ticket/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
  <Stack.Screen name="host/scan" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
</Stack>
```

- No Reduce Motion handling for any transition.
- `slide_from_right` forced on every push: on Android it replaces the platform transition; on iOS it's a custom animation instead of the native push.
- The modals override the native modal animation.
- Short, abandonable tasks push like hierarchy: `legal/[doc]` (pushed from auth and settings) and `host/verify`.

`components/TabBar.tsx:33-38`: the active dot springs (damping ratio 0.61) on every tab switch. The raised Host button (`:53-67`) has no press feedback.

`app.json` `ios.infoPlist` doesn't set `CADisableMinimumFrameDurationOnPhone`.

### Target
1. **Stack defaults**: `animation: t.reduceMotion ? 'fade' : 'default'`. The platform push, unmodified; the iOS back swipe keeps working.
2. **Modals**:
   - `auth` and `ticket/[id]`: `{ presentation: 'modal', ...(t.reduceMotion && { animation: 'fade' }) }`. Drop `slide_from_bottom` so iOS shows the native page sheet.
   - `host/scan`: `{ presentation: 'fullScreenModal', ...(t.reduceMotion && { animation: 'fade' }) }`.
   - `onboarding`: unchanged (`fade`, gesture off).
3. **Task screens as modals**:
   - Add `<Stack.Screen name="legal/[doc]" options={{ presentation: 'modal', ...(t.reduceMotion && { animation: 'fade' }) }} />` and the same for `host/verify`.
   - Add a `close?: boolean` prop to `components/ui/Screen.tsx`. When true, the header button uses `icon="close"` and `label="Close"` instead of `chevron-back` / `Back` (same `onPress`).
   - Pass `close` in `app/legal/[doc].tsx` (both `<Screen back ...>` at lines 19 and 33) and in `app/host/verify.tsx` (both `<Screen ... back>` at lines 107 and 118).
   - Out of scope for now: `event/create` and `church/edit` also fit `modal`, but both finish with `router.replace` to a detail page (`app/event/create.tsx:262`, `app/church/edit.tsx:180`), which would open the detail page inside the modal. Leave them as pushes and log a follow-up.
4. **Tab dot**: Reanimated `dotX = useSharedValue(0)`; effect: if `!slot` return; first placement or `t.reduceMotion` → `dotX.set(to)`; else `dotX.set(withTiming(to, { duration: 150, easing: EASE_IN_OUT }))`. 150ms with no overshoot is the "near-imperceptible" tier for a tens-per-day action. The custom bar itself stays (design decision; `NativeTabs` can't do the floating glass bar with the raised Host button). Tab screens keep no transition (JS `Tabs` default; do not add one).
5. **Host button**: wrap the Host tab's `Pressable` (`:55-66`) in `PressableScale` (Group 1, `pressedScale` 0.97, Reduce Motion = no scale).
6. **120fps**: after the next EAS build, check the built `Info.plist` (EAS build logs → "Prebuild" artifact, or `npx expo prebuild --platform ios --no-install` in a throwaway copy of the repo, never in the working tree) for `CADisableMinimumFrameDurationOnPhone = true`. If it's missing, add `"CADisableMinimumFrameDurationOnPhone": true` to `app.json` → `expo.ios.infoPlist`.

### Steps
1. Edit `app/_layout.tsx:92-97` per Targets 1-3.
2. Edit `components/ui/Screen.tsx` (add `close` prop next to `back`, lines 13, 20, 38-39) and pass `close` in the two screens.
3. Edit `components/TabBar.tsx` per Targets 4-5. Remove `Animated` from the `react-native` import and import Reanimated.
4. Do Target 6 only when a build is available. Otherwise leave it as an open item in `docs/PROGRESS.md`.
5. Run the mechanical check.

### Boundaries
- Don't convert `event/create` or `church/edit` to modals in this change.
- Don't change the tab bar layout, Glass intensity, icons or the Host button art.
- Don't add `animationMatchesGesture` (only needed with custom animations, and this plan removes them).

### Verification
- **Feel check**: on iOS, push an event: it's the native push, and an edge swipe back tracks the finger. Open a ticket: native page sheet you can pull down. Open Terms from sign-in: modal with a Close (X) button. On Android, pushes use the system transition. Switch tabs quickly back and forth: the dot glides in 150ms with no overshoot, and the screens swap with no slide.
- **Reduce Motion on**: every push and modal crossfades, and the dot jumps.
- **Done when**: no `slide_from_right` or `slide_from_bottom` remains in `app/_layout.tsx`, and every `Stack.Screen` honours `t.reduceMotion`.

---

## Extras outside the C.2 groups (optional, low effort)

### E1: Toasts enter and exit (missed opportunity)
- `contexts/ToastContext.tsx:55-69` renders toasts as plain `View`s, so they teleport.
- Target: make each toast a Reanimated `Animated.View` with module-scope builders:
  - `TOAST_IN = FadeInUp.duration(300).easing(EASE_OUT)` (FadeInUp starts 25pt above and moves down, right for a top toast)
  - `TOAST_OUT = FadeOutUp.duration(250).easing(EASE_OUT)` (exits the way it came, ~20% faster)
  - Under Reduce Motion use `FadeIn.duration(200)` / `FadeOut.duration(150)`.
  - Add `layout={LinearTransition.duration(200)}` so stacked toasts reflow.
- Feel check: trigger two toasts quickly (e.g. publish an event); they slide down from under the status bar and leave upward. Tune the reflow by eye.

### E2: WalletStack springs and height jump
- `components/tickets/WalletStack.tsx:49-52` uses bouncy springs (ratios 0.69 and 0.54) for a tap-driven reflow.
- `:62-66` sets the container height in one frame.
- Target: Reanimated shared values per card. `y` uses `withSpring(y, t.motion.spring.settle)` (`{ duration: 400, dampingRatio: 1 }`); `scale` uses the same.
- The container height becomes a shared value animated with the same spring (`height` is a layout property, but it's one container per screen and the cards are absolutely positioned; feel-check on a low-end Android, and if it stutters, snap the height on expand and animate it only on collapse).
- Reduce Motion: set values instantly (as today).

### E3: TonightCarousel parallax
- `components/home/TonightCarousel.tsx:17-33,60` is correct today (native driver, off under Reduce Motion).
- Migrate to `useAnimatedScrollHandler` + `useAnimatedStyle` only when touching the file for another reason. Same values (`PARALLAX = 18`, scale `[0.95, 1, 0.95]`, clamp).

### Noticed, out of scope
- `app/host/scan.tsx:110-113`: the full-screen result flash (140ms in / 460ms out, default easing) fires on every scan at the door (hundreds of times per event for a host). It's the primary feedback, so keep it, but consider a 100ms in / 300ms out `EASE_OUT` flash on a migration pass.

---

## Recommended execution order

| Order | Plan | Severity | Depends on | Status |
| --- | --- | --- | --- | --- |
| 1 | Foundation: motion tokens | MEDIUM | none | TODO |
| 2 | Group 2: BottomSheet + checkout | HIGH | Foundation | TODO |
| 3 | C.3: Navigation + tab bar (Targets 1-3, 6 first; 4-5 after Group 1) | HIGH | Foundation, Group 1 for Host button | TODO |
| 4 | Group 1: Press feedback | MEDIUM | Foundation | TODO |
| 5 | Group 3: RollingNumber, glow, Amen pop | HIGH | Foundation, Group 1 | TODO |
| 6 | Group 4: LightBurst + RsvpCelebration | MEDIUM | Foundation | TODO |
| 7 | Group 6: Segmented, Skeleton, Badge | MEDIUM/LOW | Foundation | TODO |
| 8 | Group 5: EventHero | LOW | Foundation | TODO |
| 9 | Extras E1-E3 | LOW | Foundation | TODO |

After all groups: `grep -rn "Animated" components app | grep "from 'react-native'"` should return nothing, and no `damping:` / `stiffness:` / `bounciness` remain.
