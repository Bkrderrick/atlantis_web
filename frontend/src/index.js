/* Atlantis site is fully static (in /public).
 * The React bundle is still injected by CRA into the HTML,
 * but there is no #root element to mount into — so we
 * intentionally do nothing. This prevents React from
 * throwing on missing #root. */
const root = document.getElementById("root");
if (root) {
  // No-op: static site renders directly from HTML.
}
