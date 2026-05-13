/**
 * Atlantis B&B — Interactive Ocean Bubble System + Smooth Follow Nav
 * ---------------------------------------------------------------
 *  Bubbles
 *   • Ambient: always-on gentle stream of bubbles drifting up.
 *   • Mouse interaction: bubbles drift away from the cursor.
 *   • Click-to-pop: clicking a bubble bursts it into tiny particles.
 *   • Page transition: nav-link clicks trigger a full-screen
 *     "bubble bloom" before navigating to the new page.
 *   • Performance: small radii, capped count, single canvas, RAF.
 *
 *  Floating Nav
 *   • Top of nav touches header bottom.
 *   • Right edge always flush with main's left edge.
 *   • Smoothly slides down the page on scroll (lerp easing — gives
 *     the "literal slide" feel the user asked for).
 *   • Clamped so the nav never overlaps the footer.
 */

(function () {
    "use strict";

    /* =================================================================
     *  BUBBLE CANVAS
     * ================================================================= */
    const canvas = document.createElement("canvas");
    canvas.id = "bubble-overlay";
    canvas.style.cssText =
        "position:fixed;inset:0;width:100%;height:100%;z-index:9998;pointer-events:none;";
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d", { alpha: true });

    /* A second invisible hit layer for click detection on bubbles */
    function resizeCanvas() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width = window.innerWidth + "px";
        canvas.style.height = window.innerHeight + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    /* Ocean palette — deep teal, cyan, gold accents */
    const COLORS = [
        "#00d4ff", "#20B2AA", "#66f4ff", "#48D1CC",
        "#87CEFA", "#00b4d8", "#0096c7", "#48cae4",
        "#FFD700", "#FFA500"
    ];

    const mouse = { x: -9999, y: -9999, active: false };
    /* Canvas is purely visual — never blocks clicks on the page.
       We detect bubble clicks via a window listener instead. */
    canvas.style.pointerEvents = "none";

    window.addEventListener("mousemove", function (e) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        mouse.active = true;
    });
    window.addEventListener("mouseleave", function () {
        mouse.x = -9999;
        mouse.y = -9999;
        mouse.active = false;
    });
    /* Mobile touch */
    window.addEventListener("touchmove", function (e) {
        if (e.touches && e.touches[0]) {
            mouse.x = e.touches[0].clientX;
            mouse.y = e.touches[0].clientY;
            mouse.active = true;
        }
    }, { passive: true });

    /* ----------------------- bubble factories ----------------------- */
    function makeBubble(opts) {
        opts = opts || {};
        return {
            x: opts.x != null ? opts.x : Math.random() * window.innerWidth,
            y: opts.y != null ? opts.y : window.innerHeight + 16 + Math.random() * 60,
            r: opts.r != null ? opts.r : 8 + Math.random() * 20,
            color: opts.color || COLORS[Math.floor(Math.random() * COLORS.length)],
            alpha: 0,
            targetAlpha: opts.targetAlpha != null ? opts.targetAlpha : 0.68,
            vx: opts.vx || 0,
            vy: opts.vy != null ? opts.vy : -(0.35 + Math.random() * 0.45),
            wobbleAmp: 0.3 + Math.random() * 0.9,
            wobbleFreq: 0.018 + Math.random() * 0.014,
            wobbleOff: Math.random() * Math.PI * 2,
            frame: 0,
            delay: opts.delay != null ? opts.delay : 0,
            born: false,
            done: false,
            kind: opts.kind || "bubble", /* "bubble" or "spark" */
            life: opts.life || 0,
            maxLife: opts.maxLife || 0,
            popped: false
        };
    }

    function makeSpark(x, y, color) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.4 + Math.random() * 1.6;
        return {
            x: x, y: y,
            r: 1.5 + Math.random() * 2.5,
            color: color,
            alpha: 0.95,
            targetAlpha: 0.95,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 0.6,
            wobbleAmp: 0, wobbleFreq: 0, wobbleOff: 0,
            frame: 0, delay: 0, born: true, done: false,
            kind: "spark",
            life: 0, maxLife: 28 + Math.random() * 14,
            popped: false
        };
    }

    /* ----------------------- draw routines ----------------------- */
    function drawBubble(b) {
        ctx.save();
        ctx.globalAlpha = b.alpha;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.32)";
        ctx.lineWidth = Math.max(1, b.r * 0.14);
        ctx.stroke();
        if (b.r > 10) {
            ctx.beginPath();
            ctx.ellipse(
                b.x - b.r * 0.28, b.y - b.r * 0.28,
                b.r * 0.20, b.r * 0.11,
                -0.6, 0, Math.PI * 2
            );
            ctx.fillStyle = "rgba(255,255,255,0.6)";
            ctx.fill();
        }
        ctx.restore();
    }

    function drawSpark(s) {
        ctx.save();
        ctx.globalAlpha = s.alpha;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.fill();
        ctx.restore();
    }

    /* ----------------------- state ----------------------- */
    let bubbles = [];
    let sparks = [];
    let rafId = null;
    let navAt = null;
    let navCb = null;
    let navDone = false;
    let bloomMode = false;

    /* Performance caps */
    const AMBIENT_TARGET = 14;     /* concurrent ambient bubbles */
    const MAX_BUBBLES   = 60;
    const MAX_SPARKS    = 80;
    const REPEL_RADIUS  = 110;     /* px */
    const REPEL_FORCE   = 0.55;

    function spawnAmbient() {
        if (bubbles.filter(b => !b.done).length >= AMBIENT_TARGET) return;
        const b = makeBubble({
            targetAlpha: 0.45 + Math.random() * 0.25,
            r: 6 + Math.random() * 16
        });
        bubbles.push(b);
    }

    /* Drop ambient bubbles steadily, but throttled */
    let lastAmbient = 0;
    function maybeSpawnAmbient(ts) {
        if (bloomMode) return; /* during transition, ambient pauses to avoid clutter */
        if (ts - lastAmbient > 280) {
            lastAmbient = ts;
            spawnAmbient();
        }
    }

    /* ----------------------- main loop ----------------------- */
    function tick(ts) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (navAt && !navDone && ts >= navAt) {
            navDone = true;
            if (navCb) navCb();
        }

        maybeSpawnAmbient(ts);

        /* update + draw bubbles */
        let alive = false;
        for (let i = 0; i < bubbles.length; i++) {
            const b = bubbles[i];
            if (b.done) continue;

            if (!b.born) {
                b.delay -= 16;
                if (b.delay > 0) { alive = true; continue; }
                b.born = true;
            }

            b.frame++;
            b.x += Math.sin(b.frame * b.wobbleFreq + b.wobbleOff) * b.wobbleAmp + b.vx;
            b.y += b.vy;
            b.vx *= 0.96; /* damp drift */

            /* Mouse repel — only when mouse is moving and bubble nearby */
            if (mouse.active) {
                const dx = b.x - mouse.x;
                const dy = b.y - mouse.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < REPEL_RADIUS * REPEL_RADIUS && distSq > 1) {
                    const dist = Math.sqrt(distSq);
                    const f = (1 - dist / REPEL_RADIUS) * REPEL_FORCE;
                    b.vx += (dx / dist) * f;
                    b.vy += (dy / dist) * f * 0.4;
                }
            }

            /* fade in */
            if (b.alpha < b.targetAlpha) {
                b.alpha = Math.min(b.alpha + 0.025, b.targetAlpha);
            }

            /* fade out as it nears top */
            if (b.y - b.r < window.innerHeight * 0.18) {
                b.alpha = Math.max(b.alpha - 0.012, 0);
            }

            /* off-screen sides — gently bring back */
            if (b.x < -40 || b.x > window.innerWidth + 40) {
                b.done = true;
                continue;
            }
            if (b.alpha <= 0 && b.y < window.innerHeight * 0.18) {
                b.done = true;
                continue;
            }

            drawBubble(b);
            alive = true;
        }

        /* update + draw sparks */
        for (let i = 0; i < sparks.length; i++) {
            const s = sparks[i];
            if (s.done) continue;
            s.life++;
            s.x += s.vx;
            s.y += s.vy;
            s.vy += 0.05; /* slight gravity */
            s.alpha = Math.max(0, 0.95 * (1 - s.life / s.maxLife));
            if (s.life >= s.maxLife) {
                s.done = true;
                continue;
            }
            drawSpark(s);
            alive = true;
        }

        /* GC: prune done objects periodically to keep arrays small */
        if (bubbles.length > MAX_BUBBLES) {
            bubbles = bubbles.filter(b => !b.done);
        }
        if (sparks.length > MAX_SPARKS) {
            sparks = sparks.filter(s => !s.done);
        }

        rafId = requestAnimationFrame(tick);
    }

    /* ----------------------- click-to-pop ----------------------- */
    /* Bound on window — canvas is pointer-events:none so it never
       blocks real page clicks. We pop bubbles in passing without
       interfering with nav/page interactions. */
    window.addEventListener("click", function (e) {
        const x = e.clientX;
        const y = e.clientY;
        /* find topmost bubble hit */
        let hit = null;
        for (let i = bubbles.length - 1; i >= 0; i--) {
            const b = bubbles[i];
            if (b.done || !b.born || b.popped) continue;
            const dx = b.x - x;
            const dy = b.y - y;
            if (dx * dx + dy * dy <= (b.r + 4) * (b.r + 4)) {
                hit = b;
                break;
            }
        }
        if (hit) {
            hit.popped = true;
            hit.done = true;
            const count = 6 + Math.floor(Math.random() * 4);
            for (let i = 0; i < count; i++) {
                sparks.push(makeSpark(hit.x, hit.y, hit.color));
            }
        }
    });

    /* ----------------------- nav-click transition bloom ----------------------- */
    function bloom(onNav) {
        bloomMode = true;
        navDone = false;
        navCb = onNav || null;
        navAt = onNav ? performance.now() + 950 : null;

        resizeCanvas();
        /* push a big burst, but cap total */
        for (let i = 0; i < 28; i++) {
            bubbles.push(makeBubble({
                delay: Math.random() * 900,
                targetAlpha: 0.7,
                r: 9 + Math.random() * 18,
                vy: -(0.6 + Math.random() * 0.6)
            }));
        }
        /* settle bloomMode off after the bloom completes */
        setTimeout(function () { bloomMode = false; }, 1800);
    }

    function entranceBloom() {
        for (let i = 0; i < 14; i++) {
            bubbles.push(makeBubble({
                delay: Math.random() * 1200,
                targetAlpha: 0.55,
                r: 7 + Math.random() * 16,
                vy: -(0.25 + Math.random() * 0.35)
            }));
        }
    }

    /* Start the loop */
    rafId = requestAnimationFrame(tick);

    /* =================================================================
     *  SMOOTH-FOLLOW NAV
     *  - Nav top initially touches header bottom.
     *  - As you scroll, nav slides down with eased "lag" feel.
     *  - Nav right edge is always flush with main's left edge.
     *  - Nav never overlaps the footer.
     * ================================================================= */
    function initFloatingNav() {
        const wrapper = document.getElementById("wrapper");
        const nav = document.querySelector("nav");
        const headerEl = document.querySelector("header");
        const footerEl = document.querySelector("footer");
        const contentRow = document.querySelector(".content-row");
        const navColumn = document.querySelector(".nav-column");
        if (!wrapper || !nav || !headerEl || !footerEl || !contentRow || !navColumn) return;

        /* The nav lives inside .nav-column visually, but we'll switch to
           position: fixed and animate its `top` for the smooth-follow effect. */
        let currentTop = 0;
        let isMobile = false;

        function measure() {
            isMobile = window.innerWidth <= 768;
            if (isMobile) {
                nav.classList.remove("is-floating");
                nav.style.transform = "";
                nav.style.top = "";
                nav.style.left = "";
                nav.style.width = "";
                return null;
            }
            const wrapperRect = wrapper.getBoundingClientRect();
            const navColRect = navColumn.getBoundingClientRect();
            return {
                wrapperLeft: wrapperRect.left + window.scrollX,
                navColLeftViewport: navColRect.left, /* viewport coord */
                navColWidth: navColRect.width
            };
        }

        function frame() {
            if (isMobile) {
                requestAnimationFrame(frame);
                return;
            }
            const m = measure();
            if (!m) { requestAnimationFrame(frame); return; }

            const contentRect = contentRow.getBoundingClientRect();
            const footerRect = footerEl.getBoundingClientRect();
            const navHeight = nav.offsetHeight;

            /* Switch to floating once the content row's top has scrolled out */
            const shouldFloat = contentRect.top < 0;

            let targetTop;
            if (shouldFloat) {
                if (!nav.classList.contains("is-floating")) {
                    nav.classList.add("is-floating");
                }
                /* Aim for a small offset from viewport top, but
                   never let the nav overlap the footer. */
                const idealTop = 12;
                const maxAllowed = footerRect.top - navHeight - 16;
                targetTop = Math.min(idealTop, maxAllowed);

                /* keep horizontally aligned with the original column */
                nav.style.left = m.navColLeftViewport + "px";
                nav.style.width = m.navColWidth + "px";
            } else {
                if (nav.classList.contains("is-floating")) {
                    nav.classList.remove("is-floating");
                }
                nav.style.left = "";
                nav.style.width = "";
                /* Inside the column flow — relative top stays 0 */
                targetTop = 0;
            }

            /* LERP — gives the "literal slide / follow" feel */
            const ease = 0.09;
            currentTop += (targetTop - currentTop) * ease;
            if (Math.abs(targetTop - currentTop) < 0.1) currentTop = targetTop;

            if (shouldFloat) {
                nav.style.top = currentTop + "px";
                nav.style.transform = "";
            } else {
                nav.style.top = "0px";
                /* Slight residual offset for a graceful settle */
                nav.style.transform = "translateY(" + currentTop + "px)";
            }

            requestAnimationFrame(frame);
        }

        window.addEventListener("resize", function () {
            measure();
        });

        requestAnimationFrame(frame);
    }

    /* =================================================================
     *  NAV LINK INTERCEPTION (bubble bloom → navigate)
     * ================================================================= */
    function initNavIntercept() {
        document.querySelectorAll("nav a").forEach(function (link) {
            link.addEventListener("click", function (e) {
                const href = link.getAttribute("href");
                if (!href || href.startsWith("#") ||
                    href.startsWith("mailto") || href.startsWith("http")) return;
                e.preventDefault();
                bloom(function () { window.location.href = href; });
            });
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        initNavIntercept();
        initFloatingNav();
        entranceBloom();
    });

    /* If DOM already ready (script at end of body), trigger now too */
    if (document.readyState === "interactive" || document.readyState === "complete") {
        initNavIntercept();
        initFloatingNav();
        entranceBloom();
    }
})();
