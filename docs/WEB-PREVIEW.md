# Web preview (sample data)

A browser version of the phone app for showing the design and flows before the store builds are out. It runs the
real screens with **sample data** (web-preview/demoData.ts): nothing is saved, no real API or account is used.

- Live: https://christlink.expo.app (EAS Hosting, project `nolimittechs-organization/christlink`).
- On a phone it runs full screen; on a computer it shows inside a phone-sized frame.
- Not in the preview: payments (Stripe), push and local notifications, maps (a blank panel), camera check-in.

## How it works
- `metro.config.js` maps native-only packages to small stand-ins in `web-preview/stubs/` **for web only**
  (Stripe, Maps, SecureStore → localStorage, Notifications). iOS/Android builds are unchanged.
- With `EXPO_PUBLIC_DEMO=1`, `app/_layout.tsx` loads `web-preview/demo.tsx` on web: it answers every `/api/*` request
  from in-memory sample data (RSVP, pray, waitlist, posts, follows change state until reload) and signs in a sample
  user ("Jordan Ellis").

## Update it
```bash
npm run web:preview                 # EXPO_PUBLIC_DEMO=1 expo export --platform web → dist/
npx eas-cli deploy --prod           # uploads dist/ to christlink.expo.app
```
On Windows PowerShell: `$env:EXPO_PUBLIC_DEMO="1"; npx expo export --platform web --clear`, then the deploy line.
New screens work automatically; add sample rows in `web-preview/demoData.ts` or a route in `web-preview/demo.tsx`
when a screen calls an API the preview doesn't answer yet (unknown GETs return `[]`, writes succeed).
