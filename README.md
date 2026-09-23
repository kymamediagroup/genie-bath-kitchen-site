# Genie Bath & Kitchen — Cinematic Scroll Website

Handoff package for publishing. The site is a fully static, self-contained build:
no build step, no framework, no external CDN dependencies, no server-side code.

- **Currently live (Higgsfield hosting):** https://shady-branch-163.higgsfield.app
- **Preview channel:** https://preview--shady-branch-163.higgsfield.app
- Business: Genie Bath & Kitchen, 5680 Randolph Blvd, San Antonio, TX 78233 · (210) 988-6449

## What is in this package

```
site/       The deployable web root. Deploy the CONTENTS of this folder — nothing else.
  index.html          Single page, all sections
  favicon.png
  assets/css/         One stylesheet (design tokens at the top)
  assets/js/          main.js (scroll engine) + vendored GSAP 3.12.5 + ScrollTrigger
  assets/fonts/       Self-hosted Cormorant Garamond, Inter, Outfit (woff2 + fonts.css)
  assets/frames/           291 WebP frames — the scroll film, 16:9 (desktop)
  assets/frames-portrait/  291 WebP frames — same film, AI-reframed 9:16 (phones)
  assets/video/       hero.mp4 (16:9) + hero-portrait.mp4 (9:16) — autoplay hero loop
  assets/img/         Logos, exploded-view artwork, 18 color swatches, gallery, OG card

masters/    Source mp4 clips (16:9 and 9:16) the film frames were extracted from.
            NOT part of the deploy. Keep for future re-edits (see "Regenerating frames").
```

Web root is ~71 MB (frame sequences and video are most of it). Largest single file
is 12.7 MB — under every common static-host per-file limit.

## Deploying

Any static host works: Netlify, Vercel, Cloudflare Pages, S3+CloudFront, or the
current Higgsfield hosting. Upload the **contents of `site/`** so `index.html` sits
at the domain root. There is nothing to build, install, or configure.

Local preview & Verification:

```bash
# Verify all assets (291 WebP frames, swatches, fonts, videos)
python3 scripts/build_verify.py

# Start preview server with Range-request & WebP MIME support
./start.sh
# or: python3 scripts/serve.py 8080
```

then open http://localhost:8080. (Use this server rather than double-clicking
index.html — range requests for video scrubbing, WebP MIME types, and font loading
behave accurately over HTTP.)

## Two things to do at publish time

1. **Update the absolute URLs when the domain changes.** The only absolute URLs in
   the codebase are the social-share tags in `index.html` (`og:url` and `og:image`,
   currently pointing at shady-branch-163.higgsfield.app). Search for
   `shady-branch-163` in `index.html` and replace with the final domain, or link
   previews in Slack/iMessage/Facebook will render from the old host.

2. **Wire the lead form to a real endpoint.** The sticky "Book a free consultation"
   form currently validates, stores the submission in the visitor's browser
   (`localStorage`), and shows the success state — a demo handler. In
   `assets/js/main.js`, find the comment
   `// Demo endpoint: persist locally. Wire to CRM/webhook here.` and replace the
   localStorage block with a `fetch()` POST to the CRM/webhook of choice. The
   submitted object already contains: first, last, email, phone, zip, project,
   consent, submittedAt.

## How the site works (for whoever maintains it)

- **Scroll film:** the "before → studs → rebuild → reveal" section is NOT a video
  element. It is a pinned `<canvas>` scrubbing through pre-extracted WebP frames
  (12 fps), which is why it is perfectly smooth in both scroll directions. Desktop
  serves `assets/frames/`; portrait phones serve `assets/frames-portrait/`
  (AI-extended 9:16 versions of the same shots, so nothing is cropped on mobile).
  Orientation is detected at load and swapped live on rotate, with a graceful
  fallback to the landscape set if the portrait set is ever missing.
- **Hero:** a muted autoplay loop; phones get `hero-portrait.mp4` automatically.
- **Animations:** GSAP ScrollTrigger, vendored locally. Pinned sections: the film,
  the exploded "anatomy" view, and the horizontal gallery. A progress bar, step
  rail, and caption system are all driven off one scroll timeline in `main.js`.
- **Sticky form:** fixed right-rail card on desktop; below 1180px it becomes a
  bottom bar that opens a sheet.

### Editing rules (learned the hard way — please keep)

- **Never add CSS `scroll-behavior: smooth`.** It corrupts GSAP ScrollTrigger's
  pin measurements on refresh. Smooth anchor scrolling must stay JS-side.
- **Only the 18 active WishStone colors** may appear in the color vault or gallery:
  Frio, Atlas, Sand Castle, Navajo, Blanco, Aria, Sedona, Ferrera, Alps, Juneau,
  Danville, Calcutta Brown, Crema White, White Castle, Ice Cap, Manchester,
  Milano, Statuary Gray. Variants like Aria Griggio, Juneau Oro, Sedona Gray/White,
  Milano Nero/Gray, or Stonecastle are retired — do not add imagery of them.
- **Design tokens** live at the top of `assets/css/main.css` (GBK design system):
  parchment `#f1ede4`, cream `#f8f4ea`, ink `#1a2530`, teal `#0f4856`/`#1e7a8c`,
  gold `#b89968`, brick `#b04a3c`. Display face Cormorant Garamond, body Outfit.
- **Logo files:** `assets/img/logo-dark.png` (black/blue, for light backgrounds)
  and `logo-light.png` (white, for dark backgrounds). The nav cross-fades between
  them on scroll.

### Regenerating frames (only if the film is ever re-cut)

The film frames were extracted from the clips in `masters/` with ffmpeg:

```bash
ffmpeg -i demo.mp4 -vf "fps=12,scale=1600:-2" -c:v libwebp -quality 75 out/%04d.webp
```

(portrait: `scale=810:-2`). The three clips per orientation are concatenated into
one continuously numbered sequence (f0001…f0291). If the frame count changes,
update `count` in `FILM_SETS` at the top of `assets/js/main.js`.

## Content notes

- Copy tone is intentional: quiet, expensive, very few words. Please resist
  padding it.
- Warranty language ("for as long as you own your home"; chipping, scratching,
  peeling, fading) mirrors the official Genie Bath Systems warranty page.
- The hero film, rebuild film, and exploded anatomy artwork were generated from
  Genie's real WishStone installation sequence photography (Seedance 2.0 +
  Nano Banana via Higgsfield); the portrait versions are AI reframes of the same
  masters.
