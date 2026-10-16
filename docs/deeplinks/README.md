# Deep links: what the website (ChristLink1) must serve

The native app shares links like `https://christlinksocial.com/event/<id>` and `/church/<id>`.
iOS universal links and Android App Links match **paths**, not `#hash` routes, so the web app needs three small changes:

1. **Serve the association files** (exact paths, `Content-Type: application/json`, no redirects):
   - `/.well-known/apple-app-site-association` ← `apple-app-site-association` in this folder (replace `TEAMID` with
     your Apple Developer Team ID).
   - `/.well-known/assetlinks.json` ← `assetlinks.json` in this folder (replace the fingerprint with the SHA-256 from
     Play Console → App integrity → App signing).
   In Express: `app.get('/.well-known/:file', ...)` before the static/SPA fallback.
2. **Redirect path links to the hash router** so people without the app still land on the right page:
   ```js
   app.get(['/event/:id', '/church/:id'], (req, res) =>
     res.redirect(302, `/#${req.path.split('/')[1]}/${encodeURIComponent(req.params.id)}`));
   ```
   (Church pages need a matching web screen, or redirect `/church/:id` to the home page until one exists.)
3. Verify: `curl -I https://christlinksocial.com/.well-known/apple-app-site-association` returns 200 JSON, and
   Apple's validator / `adb shell pm get-app-links com.christlink.app` show the domain as verified.

As of 2026-10-15 both well-known URLs return the HTML home page, so links open in the browser until this ships.
