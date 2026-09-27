# PIN Code Buddy

A dead-simple, mobile-first utility: type a 6-digit Indian PIN code, get the
post office, district, state and delivery status instantly — straight from
India Post's own public records.

No framework, no build step, no server-side logic beyond serving static
files. Deployed as a Cloudflare Worker with static assets.

## Project structure

```
pin-code-buddy/
├── public/                  # everything served to the browser
│   ├── index.html           # app shell — Home + About tabs
│   ├── css/styles.css       # design system + layout
│   ├── js/app.js            # search, postmark animation, recents, share
│   ├── manifest.webmanifest # PWA / Add to Home Screen
│   ├── sw.js                # service worker (app-shell caching)
│   └── assets/              # icons + Open Graph image
├── src/
│   └── worker.js            # Cloudflare Worker: serves public/, adds headers
├── wrangler.toml            # Worker + static assets config
└── README.md
```

## How it works

- The browser calls `https://api.postalpincode.in/pincode/{PIN}` directly —
  there's no backend API of our own, so there's nothing to keep in sync.
- `src/worker.js` only serves the files in `public/` (via Cloudflare's
  built-in static assets binding) and layers on cache-control + a few
  security headers. It falls back to `index.html` for any unknown path
  without a file extension, so deep links still open the app.
- Recent searches are stored in `localStorage` on the user's device only.

## Local development

```bash
npm install -g wrangler   # if you don't have it already
wrangler dev
```

This serves the app at `http://localhost:8787` using the same Worker that
runs in production.

## Deploying via GitHub sync (Cloudflare Workers)

1. Push this repository to GitHub.
2. In the Cloudflare dashboard: **Workers & Pages → Create → Connect to Git**,
   and pick this repo.
3. Cloudflare reads `wrangler.toml` automatically — no build command is
   needed (it's a static/vanilla project), so leave the build command blank
   and deploy.
4. Every push to your default branch redeploys automatically.

Or deploy directly from the CLI:

```bash
wrangler deploy
```

## Before you ship

- Swap the placeholder icons/OG image in `public/assets/` for your own if
  you want a custom look — they're generated placeholders, sized correctly
  (192×192, 512×512, and 1200×630 for the OG image) so any replacement just
  needs to match those dimensions.
- Update `APP_URL` in `public/js/app.js` and the `og:url` / canonical tags
  in `index.html` if you deploy to a different domain than
  `pin-code-buddy.suvadipchakraborty.workers.dev`.
