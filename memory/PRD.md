# Atlantis B&B — Static Website (Bubble Bloom v6)

## Problem Statement
User provided an HTML/CSS/JS template (atlantis_v5.zip) for an Atlantis B&B website and asked:
1. Navigation separated from main and header.
2. Top of nav touches the header (flush, no gap).
3. Right border of nav touches main's left border with no overlap.
4. Nav floats down the webpage on scroll, sliding next to main (smooth literal follow effect).
5. Nav never reaches the footer (clamped above).
6. Bubbles improved to be more interactive without lag, in a cool ocean theme.

## User Choices
- Tech stack: Static HTML/CSS/JS (kept original template stack).
- Sticky nav behavior: Option B — literal slide with smooth follow lag (JS lerp easing).
- Bubble interactivity: All options — ambient bubbles + mouse repel + click-to-pop + transition bloom.

## Architecture
- Pure static site served from `/app/frontend/public/`.
- Pages: index.html, cave.html, sea.html, events.html, contact.html (all flat at root).
- Shared assets: `/styles/styles.css`, `/styles/transition.js`, `/images/*`.
- React app (CRA) bundle still injected but no-op (no #root element).

## Implementation (May 13, 2026)
- New layout uses `display: flex` on #wrapper with header (full-width), `.content-row` (grid: 192px / 1fr) holding `.nav-column` and `<main>`, and footer (full-width).
- Nav is `position: absolute` inside `.nav-column` initially, toggles to `position: fixed` once `contentRect.top < 0`, with `top` value lerped each RAF frame (ease 0.09).
- Nav width/left tracked via `nav-column.getBoundingClientRect()` so right edge always touches main.
- Footer-clamp: when `footerRect.top - navHeight - 16 < idealTop`, target top is clamped above footer.
- Bubble canvas: full-screen `<canvas>` with `pointer-events:none`; window-level click handler detects bubble hits without blocking links.
- Bubbles: ambient spawn every ~280ms (cap 14 visible), mouse-repel within 110px radius, pop-spark on click, full transition bloom on nav click (28 bubbles + navigate after 950ms).
- Ocean palette: deep teal (#001f33, #00657a), cyan accents (#00d4ff, #66f4ff), gold highlights (#FFD700, #FFA500).

## Personas / Audience
General visitors browsing the Atlantis B&B (a fictional underwater resort): potential guests exploring rooms, events, and contacting the property.

## Core Requirements (Static)
- 5 static pages with shared layout.
- Visual ocean theme, sea-life imagery.
- Interactive bubble effects.
- Reflow-correct nav that follows scroll without overlapping content.

## P0 Backlog (Implemented)
- [x] Refactored layout: nav as separate floating element.
- [x] Smooth-follow nav with JS lerp easing.
- [x] Ambient + mouse + click bubbles + transition bloom.
- [x] Ocean color palette throughout.
- [x] Mobile/tablet responsive.

## P1 Backlog (Deferred)
- Real form submission backend for contact page.
- Booking/availability widget.
- Image gallery with lightbox.
- Reviews/testimonials section.

## P2 Backlog (Deferred)
- Pricing / packages page.
- Newsletter signup.
- Multilingual support.
