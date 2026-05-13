# Atlantis B&B — Local Setup & Validation Guide

This folder contains the complete site:

```
atlantis_export/
├── index.html        ← Home
├── cave.html         ← Cave room
├── sea.html          ← Sea room
├── events.html       ← Weekend events
├── contact.html      ← Contact form
├── styles/
│   ├── styles.css    ← All page styling (ocean theme, layout)
│   └── transition.js ← Floating nav + interactive bubbles
├── images/           ← All images (logo, rooms, water, trident, etc.)
└── backend/          ← OPTIONAL: Gmail-SMTP contact-form server
    ├── server.py
    ├── requirements.txt
    └── .env.example
```

---

## 1. Open it locally

You have two easy options:

### Option A — Quick "open in browser"
Double-click `index.html`. The HTML, CSS, JS, and bubble animations all work.
Only thing that won't work this way is the contact form submission (browsers
block cross-origin `fetch` from `file://` URLs) — and W3C validators don't
care about that.

### Option B — A real local web server (recommended)
This makes the whole site behave exactly like in production.

**Python (already installed on most systems):**
```bash
cd atlantis_export
python -m http.server 5500
```
Then open http://localhost:5500 in your browser.

**Node:**
```bash
npx serve atlantis_export -l 5500
```

**VS Code:**
Install the "Live Server" extension, right-click `index.html` → *Open with Live Server*.

---

## 2. Validate the HTML & CSS

### W3C HTML validator
- Online: <https://validator.w3.org/>
- Pick the **"Validate by File Upload"** tab and upload each `.html` file one at a time,
  OR pick **"Validate by URI"** if you've published it somewhere.

Expected result: **green / "Document checking completed. No errors or warnings to show."**
All 5 pages use the HTML5 doctype, `<meta charset="utf-8">`, valid nesting, and proper
labels — should pass cleanly.

### W3C CSS validator
- Online: <https://jigsaw.w3.org/css-validator/>
- Pick **"By file upload"** and upload `styles/styles.css`.
- Set profile to **CSS Level 3 + SVG** (default).

The stylesheet uses modern but well-supported CSS3 features (CSS Grid, Flexbox,
`gap`, `inset`, `filter: drop-shadow`, `@media` queries, keyframe animations).
All are CSS3-valid.

> One thing the CSS validator *may* still flag as info-only (not an error):
> vendor-prefixed properties if your browser added any. There are none in this file,
> so you should be clean.

---

## 3. Run the contact-form backend (optional)

The static site is fully functional without a backend, but the form submission
needs a server to actually send emails. The included backend is FastAPI +
Gmail SMTP — no database, no third-party signups, no domain required.

```bash
cd atlantis_export/backend

# create + activate a virtualenv (recommended)
python -m venv .venv
source .venv/bin/activate                  # Windows: .venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env                        # then edit .env with your values
# .env needs:
#   GMAIL_USER=your-gmail@gmail.com
#   GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx     ← 16-char App Password (no spaces)
#   CONTACT_DEST_EMAIL=where-to-receive@gmail.com

uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Now the backend is at http://localhost:8001/api/contact.

If you're also serving the static site (e.g., on http://localhost:5500), the
contact form will hit the backend across origins. Either:
- Open `contact.html` and change the JS line
  `var API_BASE = window.location.origin;`
  to
  `var API_BASE = "http://localhost:8001";`
- Or serve the static site from the same backend by adding to `server.py`:
  ```python
  from fastapi.staticfiles import StaticFiles
  app.mount("/", StaticFiles(directory="..", html=True), name="static")
  ```
  (place at the very end of server.py, AFTER `app.include_router`)

### Getting a Gmail App Password
1. <https://myaccount.google.com/security> — turn on **2-Step Verification**.
2. <https://myaccount.google.com/apppasswords> — create a new App Password
   (label it anything, e.g., "Atlantis Site").
3. Copy the 16-character password it shows. Paste it into `.env` (spaces optional —
   the SMTP library is fine either way).

---

## 4. Where things live (quick reference)

| Want to change…                | File                          |
|--------------------------------|-------------------------------|
| Page text / images             | `index.html`, `cave.html`, etc. |
| Colors, fonts, layout, sizes   | `styles/styles.css`           |
| Bubble behavior, nav scroll    | `styles/transition.js`        |
| Where contact email is sent    | `backend/.env`                |
| Form fields / thank-you copy   | `contact.html`                |

---

## 5. Notes on validation-friendliness

- All 5 HTML files use `<!DOCTYPE html>` + `<meta charset="utf-8">`.
- All `<img>` tags include `alt=""` attributes (required for HTML5 validation).
- Tables on `events.html` use `scope="col"` and `headers="..."` for accessibility.
- The contact form uses proper `<label for="...">` linking to each input/textarea.
- No deprecated tags (`<center>`, `<font>`, inline `bgcolor`, etc.).
- CSS uses no vendor prefixes — pure CSS3.
- JS is wrapped in IIFE; no globals leak; no `eval` / `Function()`.

Happy validating!
