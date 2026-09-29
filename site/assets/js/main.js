/* Genie Bath & Kitchen — cinematic scroll engine */
gsap.registerPlugin(ScrollTrigger);

const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ——————————————————— nav + progress ——————————————————— */
const nav = document.getElementById("nav");
addEventListener("scroll", () => {
  nav.classList.toggle("scrolled", scrollY > 40);
}, { passive: true });

gsap.to("#progressBar", {
  scaleX: 1,
  ease: "none",
  scrollTrigger: { start: 0, end: () => document.body.scrollHeight - innerHeight, scrub: 0.3 }
});

/* ——————————————————— hero ——————————————————— */
/* portrait phones get the AI-reframed 9:16 master — no side cropping */
{
  const heroV = document.getElementById("heroVideo");
  if (innerHeight / innerWidth > 1.05) {
    heroV.src = "assets/video/hero-portrait.mp4";
    heroV.poster = "assets/img/hero-portrait-poster.jpg";
  }
}
gsap.from("[data-hero-line]", {
  y: 46, opacity: 0, duration: 1.4, stagger: 0.14, ease: "power3.out", delay: 0.25
});
if (!prefersReduced) {
  gsap.to("#heroVideo", {
    scale: 1.18, ease: "none",
    scrollTrigger: { trigger: "#hero", start: "top top", end: "bottom top", scrub: true }
  });
  gsap.to(".hero-content", {
    y: -90, opacity: 0, ease: "none",
    scrollTrigger: { trigger: "#hero", start: "top top", end: "72% top", scrub: true }
  });
}

/* ——————————————————— transformation: canvas frame film ———————————————————
   One continuous frame sequence (demo → build → reveal, 12 fps WebP)
   drawn to a canvas. Scroll swaps pre-decoded images — no video seeking,
   perfectly smooth in both directions. Two sets: 16:9 for landscape
   viewports, AI-reframed 9:16 for portrait (phones).                     */
const FILM_SETS = {
  landscape: { dir: "assets/frames", count: 291, frames: null, started: false }
};
const isPortraitView = () => innerHeight / innerWidth > 1.05;
let film = FILM_SETS.landscape;

const canvas = document.getElementById("tfCanvas");
const ctx = canvas.getContext("2d");
let frameFloat = 0;      // smoothed position (fraction of film, 0..1 scaled by count below)
let frameTarget = 0;     // scroll-driven target
let lastDrawn = null;    // last drawn image element

function sizeCanvas() {
  const dpr = Math.min(devicePixelRatio || 1, 1.5); // cap for perf
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  lastDrawn = null; // force redraw
}
sizeCanvas();

function drawFrame(i) {
  const img = film.frames && film.frames[i];
  if (!img || img === lastDrawn) return;
  lastDrawn = img;

  const cw = canvas.width, ch = canvas.height;
  // On mobile/portrait viewports, fit width and auto-scale height proportionally so frames are never stretched
  const isPortrait = isPortraitView();
  const s = isPortrait ? (cw / img.width) : Math.max(cw / img.width, ch / img.height);
  const w = img.width * s, h = img.height * s;

  ctx.fillStyle = "#0d141b";
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  canvas.style.background = "none"; // poster no longer needed
}

/* nearest loaded frame at or around the desired index */
function nearestLoaded(i) {
  if (!film.frames) return -1;
  if (film.frames[i]) return i;
  for (let d = 1; d < film.count; d++) {
    if (film.frames[i - d]) return i - d;
    if (film.frames[i + d]) return i + d;
  }
  return -1;
}

/* progressive preload: coarse pass first (every 6th), then fill */
function loadSet(set) {
  if (set.started) return;
  set.started = true;
  set.frames = new Array(set.count).fill(null);
  const src = i => `${set.dir}/f${String(i + 1).padStart(4, "0")}.webp`;
  const order = [];
  for (let i = 0; i < set.count; i += 6) order.push(i);
  for (let i = 0; i < set.count; i++) if (i % 6) order.push(i);
  let cursor = 0, inflight = 0, errors = 0;
  const MAX = 8;
  (function pump() {
    while (inflight < MAX && cursor < order.length) {
      const idx = order[cursor++];
      const img = new Image();
      inflight++;
      img.onload = img.onerror = () => {
        inflight--;
        if (img.width) { set.frames[idx] = img; }
        else if (++errors > 4 && set.fallback && film === set) {
          // portrait set missing/broken → serve landscape rather than nothing
          film = FILM_SETS[set.fallback];
          loadSet(film);
          return;
        }
        if (idx === 0 && film === set) drawFrame(0);
        pump();
      };
      img.src = src(idx);
    }
  })();
}
loadSet(film);

/* orientation flip (rotate, window resize across threshold): swap sets */
addEventListener("resize", () => {
  sizeCanvas();
  lastDrawn = null;
  drawNearest();
});

function drawNearest() {
  const want = Math.round(frameFloat);
  const have = nearestLoaded(Math.max(0, Math.min(film.count - 1, want)));
  if (have >= 0) drawFrame(have);
}

/* smooth draw loop — lerp toward the scroll target, draw nearest ready frame */
(function drawLoop() {
  frameFloat += (frameTarget - frameFloat) * 0.22;
  if (Math.abs(frameTarget - frameFloat) < 0.5) frameFloat = frameTarget;
  drawNearest();
  requestAnimationFrame(drawLoop);
})();

/* tiny debug/observability hook */
window.__film = {
  get frame() { return film.frames ? film.frames.indexOf(lastDrawn) : -1; },
  get target() { return Math.round(frameTarget); },
  get loaded() { return film.frames ? film.frames.filter(Boolean).length : 0; },
  get set() { return "landscape"; }
};

const railItems = [...document.querySelectorAll(".tf-rail li")];
const captions = [...document.querySelectorAll(".tf-caption")];
const capWindows = [
  [0.00, 0.10],
  [0.13, 0.34],
  [0.38, 0.63],
  [0.80, 1.00]
];

function clamp01(v) { return Math.min(1, Math.max(0, v)); }

ScrollTrigger.create({
  trigger: "#transformation",
  start: "top top",
  end: "+=4600",
  pin: ".tf-stage",
  pinSpacing: true,
  scrub: true,
  onUpdate(self) {
    const p = self.progress;

    // film runs across progress 0.04 – 0.92; holds first/last frame outside
    const filmP = clamp01((p - 0.04) / 0.88);
    frameTarget = filmP * (film.count - 1);
    // big jump (anchor nav, fast fling): snap instead of chasing
    if (Math.abs(frameTarget - frameFloat) > 30) frameFloat = frameTarget;
    frameFloat += (frameTarget - frameFloat) * 0.22; // advance even if rAF is throttled
    drawNearest(); // synchronous draw so the film tracks scroll immediately

    // captions
    captions.forEach((cap, i) => {
      const [a, b] = capWindows[i];
      const inF = 0.035;
      let o = 0;
      if (p >= a && p <= b) {
        o = Math.min((p - a) / inF, (b - p) / inF, 1);
      }
      cap.style.opacity = clamp01(o);
      cap.style.transform = `translateY(${(1 - clamp01(o)) * 18}px)`;
    });

    // step rail
    const idx = Math.min(9, Math.floor(p * 10.4));
    railItems.forEach((li, i) => {
      li.classList.toggle("on", i === idx);
      li.classList.toggle("done", i < idx);
    });

    // hint fades once scrolling starts
    document.querySelector(".tf-hint").style.opacity = p < 0.03 ? 0.85 : 0;
  }
});

/* ——————————————————— anatomy: exploded drift ——————————————————— */
{
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: "#anatomy",
      start: "top top",
      end: "+=1900",
      pin: ".anatomy-pin",
      scrub: 0.6
    }
  });
  tl.fromTo("#explodedImg",
    { scale: 1.22, rotateY: -7, transformOrigin: "40% 50%", filter: "brightness(.7)" },
    { scale: 1, rotateY: 0, filter: "brightness(1)", ease: "power1.out", duration: 0.55 }, 0);
  tl.from(".anatomy-copy .kicker", { opacity: 0, y: 26, duration: 0.12 }, 0.06);
  tl.from(".anatomy-copy h2", { opacity: 0, y: 34, duration: 0.16 }, 0.12);
  tl.from("[data-al]", { opacity: 0, x: 42, stagger: 0.055, duration: 0.1 }, 0.24);
  tl.to({}, { duration: 0.18 }); // hold
}

/* ——————————————————— colors: clean entrance ——————————————————— */
gsap.from("[data-sw]", {
  opacity: 0, y: 28,
  stagger: { each: 0.04, from: "start" },
  duration: 0.8, ease: "power3.out",
  scrollTrigger: { trigger: "#colorGrid", start: "top 82%" }
});
gsap.from(".colors .section-head > *", {
  opacity: 0, y: 40, stagger: 0.12, duration: 1, ease: "power3.out",
  scrollTrigger: { trigger: ".colors", start: "top 74%" }
});

/* ——————————————————— craft stats ——————————————————— */
gsap.from("[data-stat]", {
  opacity: 0, y: 44, stagger: 0.12, duration: 0.9, ease: "power3.out",
  scrollTrigger: { trigger: "#craft", start: "top 78%" }
});

/* ——————————————————— gallery: horizontal film strip ——————————————————— */
{
  const track = document.getElementById("galleryTrack");
  const getX = () => -(track.scrollWidth - innerWidth + innerWidth * 0.04);
  gsap.to(track, {
    x: getX,
    ease: "none",
    scrollTrigger: {
      trigger: "#gallery",
      start: "top top",
      end: () => "+=" + (track.scrollWidth - innerWidth + 600),
      pin: ".gallery-pin",
      scrub: 0.5,
      invalidateOnRefresh: true
    }
  });
  gsap.from(".gallery-head > *", {
    opacity: 0, y: 36, stagger: 0.1, duration: 1, ease: "power3.out",
    scrollTrigger: { trigger: "#gallery", start: "top 70%" }
  });
}

/* ——————————————————— promise ——————————————————— */
gsap.from("[data-pr]", {
  opacity: 0, y: 46, letterSpacing: "0.06em", stagger: 0.16, duration: 1.1, ease: "power3.out",
  scrollTrigger: { trigger: "#promise", start: "top 68%" }
});

/* ——————————————————— footer ——————————————————— */
gsap.from(".footer-cta > *", {
  opacity: 0, y: 40, stagger: 0.12, duration: 1, ease: "power3.out",
  scrollTrigger: { trigger: ".footer", start: "top 80%" }
});

/* ——————————————————— sticky lead form & Lead Ingestion Webhook ——————————————————— */
const WEBHOOK_TOKEN = "wh_7HZviHLugPEbCNc4oQTOqiPDApjSFD9Y";
const WEBHOOK_ENDPOINTS = [
  `/api/webhooks/leads?token=${WEBHOOK_TOKEN}`,
  `https://kaos-genie.com/api/webhooks/leads?token=${WEBHOOK_TOKEN}`,
  `https://www.kaos-genie.com/api/webhooks/leads?token=${WEBHOOK_TOKEN}`,
  `https://genie-home-solutions-133626705316.us-west1.run.app/api/webhooks/leads?token=${WEBHOOK_TOKEN}`
];

const lead = document.getElementById("lead");
const leadToggle = document.getElementById("leadToggle");
const leadForm = document.getElementById("leadForm");
const leadDone = document.getElementById("leadDone");
const leadSummaryBox = document.getElementById("leadSummaryBox");
const leadAnotherBtn = document.getElementById("leadAnotherBtn");
const leadSubmitBtn = document.getElementById("leadSubmitBtn");
const leadErrorMsg = document.getElementById("leadErrorMsg");
const selectedColorInput = document.getElementById("selectedColorInput");
const leadNotes = document.getElementById("leadNotes");

const mobileBook = document.getElementById("mobileBook");
const navBookBtn = document.getElementById("navBookBtn");
const heroBookBtn = document.getElementById("heroBookBtn");
const footerBookBtn = document.getElementById("footerBookBtn");

const stepProject = document.getElementById("stepProject");
const stepZip = document.getElementById("stepZip");
const stepFirst = document.getElementById("stepFirst");
const stepLast = document.getElementById("stepLast");
const stepPhone = document.getElementById("stepPhone");
const stepEmail = document.getElementById("stepEmail");
const stepConsent = document.getElementById("stepConsent");

// Ensure no project is pre-selected on initial load
if (stepProject) stepProject.value = "";

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showError(msg) {
  if (!leadErrorMsg) return;
  leadErrorMsg.textContent = msg;
  leadErrorMsg.hidden = false;
}

/* ——— Lead Form Validation (All fields required) ——— */
function validateLeadForm() {
  if (leadErrorMsg) {
    leadErrorMsg.hidden = true;
    leadErrorMsg.textContent = "";
  }

  let ok = true;
  let firstInvalid = null;

  const first = (stepFirst ? stepFirst.value : "").trim();
  const last = (stepLast ? stepLast.value : "").trim();
  const email = (stepEmail ? stepEmail.value : "").trim();
  const phone = (stepPhone ? stepPhone.value : "").trim();
  const zip = (stepZip ? stepZip.value : "").trim();
  const project = (stepProject ? stepProject.value : "").trim();

  // 1. First name
  if (!first) {
    if (stepFirst) stepFirst.classList.add("invalid");
    ok = false;
    if (!firstInvalid) firstInvalid = stepFirst;
  } else if (stepFirst) {
    stepFirst.classList.remove("invalid");
  }

  // 2. Last name
  if (!last) {
    if (stepLast) stepLast.classList.add("invalid");
    ok = false;
    if (!firstInvalid) firstInvalid = stepLast;
  } else if (stepLast) {
    stepLast.classList.remove("invalid");
  }

  // 3. Email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    if (stepEmail) stepEmail.classList.add("invalid");
    ok = false;
    if (!firstInvalid) firstInvalid = stepEmail;
  } else if (stepEmail) {
    stepEmail.classList.remove("invalid");
  }

  // 4. Phone
  const digitsOnly = phone.replace(/\D/g, "");
  if (!phone || digitsOnly.length < 10) {
    if (stepPhone) stepPhone.classList.add("invalid");
    ok = false;
    if (!firstInvalid) firstInvalid = stepPhone;
  } else if (stepPhone) {
    stepPhone.classList.remove("invalid");
  }

  // 5. ZIP Code (5 digits)
  const isValidZip = /^\d{5}$/.test(zip);
  if (!isValidZip) {
    if (stepZip) stepZip.classList.add("invalid");
    ok = false;
    if (!firstInvalid) firstInvalid = stepZip;
  } else if (stepZip) {
    stepZip.classList.remove("invalid");
  }

  // 6. Project
  if (!project) {
    if (stepProject) stepProject.classList.add("invalid");
    ok = false;
    if (!firstInvalid) firstInvalid = stepProject;
  } else if (stepProject) {
    stepProject.classList.remove("invalid");
  }

  // 7. Consent checkbox
  if (stepConsent && !stepConsent.checked) {
    stepConsent.classList.add("invalid");
    ok = false;
    if (!firstInvalid) firstInvalid = stepConsent;
  } else if (stepConsent) {
    stepConsent.classList.remove("invalid");
  }

  if (!ok) {
    showError("Please complete all required fields and check the authorization box.");
    if (firstInvalid && typeof firstInvalid.focus === "function") {
      firstInvalid.focus();
    }
    return false;
  }

  return true;
}

// Clear validation feedback on input
[stepFirst, stepLast, stepEmail, stepPhone, stepZip, stepProject].forEach(input => {
  if (input) {
    input.addEventListener("input", () => input.classList.remove("invalid"));
    input.addEventListener("change", () => input.classList.remove("invalid"));
  }
});
if (stepConsent) {
  stepConsent.addEventListener("change", () => stepConsent.classList.remove("invalid"));
}

/* ——— Color selection helpers ——— */
function selectColor(colorName) {
  if (!colorName) return;
  if (selectedColorInput) selectedColorInput.value = colorName;

  document.querySelectorAll(".swatch[data-color]").forEach(sw => {
    sw.classList.toggle("active-swatch", sw.getAttribute("data-color") === colorName);
  });
}

function clearColor() {
  if (selectedColorInput) selectedColorInput.value = "";
  document.querySelectorAll(".swatch[data-color]").forEach(sw => {
    sw.classList.remove("active-swatch");
  });
}

/* ——— Form open / reset helper ——— */
function resetLeadForm() {
  leadForm.reset();
  if (stepProject) stepProject.value = "";
  leadForm.hidden = false;
  const leadHeader = document.querySelector(".lead-header");
  if (leadHeader) leadHeader.hidden = false;
  leadDone.hidden = true;
  if (leadSummaryBox) leadSummaryBox.innerHTML = "";
  if (leadErrorMsg) {
    leadErrorMsg.hidden = true;
    leadErrorMsg.textContent = "";
  }
  clearColor();
  setSubmitting(false);
}

function openLeadForm(options = {}) {
  // Expand if collapsed
  lead.classList.remove("collapsed");
  leadToggle.setAttribute("aria-expanded", "true");
  const toggleIcon = leadToggle.querySelector(".lead-toggle-icon");
  if (toggleIcon) toggleIcon.textContent = "—";

  // Mobile bottom-sheet trigger
  if (window.innerWidth <= 1180) {
    lead.classList.add("sheet-open");
    lead.scrollTop = 0;
  }

  // Pre-fill color if provided
  if (options.color) {
    selectColor(options.color);
  }

  // Pre-fill project if provided
  if (options.project && stepProject) {
    for (const opt of stepProject.options) {
      if (opt.value.toLowerCase().includes(options.project.toLowerCase()) ||
          opt.text.toLowerCase().includes(options.project.toLowerCase())) {
        stepProject.value = opt.value;
        break;
      }
    }
  }

  // If already in done state, reset
  if (!leadDone.hidden) {
    resetLeadForm();
  }
}

/* ——— Toggle & mobile buttons ——— */
leadToggle.addEventListener("click", () => {
  const collapsed = lead.classList.toggle("collapsed");
  leadToggle.setAttribute("aria-expanded", String(!collapsed));
  leadToggle.querySelector(".lead-toggle-icon").textContent = collapsed ? "+" : "—";
  if (lead.classList.contains("sheet-open") && collapsed) {
    lead.classList.remove("sheet-open", "collapsed");
  }
});

if (mobileBook) mobileBook.addEventListener("click", () => openLeadForm());
if (navBookBtn) navBookBtn.addEventListener("click", () => openLeadForm());
if (heroBookBtn) heroBookBtn.addEventListener("click", () => openLeadForm());
if (footerBookBtn) footerBookBtn.addEventListener("click", () => openLeadForm());
if (leadAnotherBtn) leadAnotherBtn.addEventListener("click", () => resetLeadForm());

/* ——— Swatches interaction (Click to select & open form) ——— */
document.querySelectorAll(".swatch[data-color]").forEach(sw => {
  const color = sw.getAttribute("data-color");
  const activate = () => {
    openLeadForm({
      color: color,
      note: `Requested Tyvarian® WishStone color: ${color}`
    });
  };
  sw.addEventListener("click", activate);
  sw.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  });
});

/* ——— Gallery cards interaction (Click to inquire about style) ——— */
document.querySelectorAll(".g-card[data-gallery-style]").forEach(card => {
  const style = card.getAttribute("data-gallery-style");
  const activate = () => {
    openLeadForm({
      note: `Customer inspired by gallery style: ${style}`
    });
  };
  card.addEventListener("click", activate);
  card.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  });
});

/* ——— Webhook Submission Handler ——— */
function setSubmitting(isSubmitting) {
  if (!leadSubmitBtn) return;
  leadSubmitBtn.disabled = isSubmitting;
  const idle = leadSubmitBtn.querySelector(".btn-idle-text");
  const loading = leadSubmitBtn.querySelector(".btn-submitting-text");
  if (idle) idle.hidden = isSubmitting;
  if (loading) loading.hidden = !isSubmitting;
}

async function sendLeadWebhook(payload) {
  let delivered = false;
  let responseData = null;

  async function deliver(currentPayload) {
    const jsonBody = JSON.stringify(currentPayload);

    for (const url of WEBHOOK_ENDPOINTS) {
      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${WEBHOOK_TOKEN}`
          },
          body: jsonBody
        });

        if (resp.ok) {
          const data = await resp.json().catch(() => ({ success: true }));
          console.info(`[Lead Ingestion] Successfully delivered lead via ${url}`, data);
          return { ok: true, data };
        } else {
          console.warn(`[Lead Ingestion] Endpoint ${url} returned status ${resp.status}`);
          if (resp.status === 500) {
            // Return 500 immediately so out-of-market ZIP fallback can intervene
            return { ok: false, status: 500 };
          }
        }
      } catch (err) {
        console.info(`[Lead Ingestion] Endpoint ${url} bypassed or unreachable:`, err.message || err);
      }
    }
    return { ok: false };
  }

  // Attempt 1: Delivery with user's exact input
  let result = await deliver(payload);

  // Attempt 2: If backend threw 500 (unrecognized ZIP code outside service territory),
  // recover by routing to primary market (78233) while preserving original ZIP code in Notes
  if (!result.ok && result.status === 500 && payload.Postal !== "78233") {
    console.info(`[Lead Ingestion] ZIP ${payload.Postal} unrecognized by backend market routing; recovering with default market.`);
    const recoveredPayload = {
      ...payload,
      Postal: "78233",
      Notes: `[Entered ZIP: ${payload.Postal}] | ${payload.Notes}`
    };
    result = await deliver(recoveredPayload);
  }

  delivered = result.ok;
  responseData = result.data || null;

  // Always store locally in localStorage as a resilient audit log & backup
  try {
    const localAll = JSON.parse(localStorage.getItem("genieLeads") || "[]");
    localAll.push({
      ...payload,
      deliveredAt: new Date().toISOString(),
      delivered: delivered,
      responseId: responseData?.id || null
    });
    localStorage.setItem("genieLeads", JSON.stringify(localAll));
  } catch (storageErr) {
    console.error("Local storage error:", storageErr);
  }

  return { success: delivered, delivered, data: responseData };
}

leadForm.addEventListener("submit", async e => {
  e.preventDefault();

  if (!validateLeadForm()) return;

  setSubmitting(true);

  const fd = new FormData(leadForm);
  const first = (fd.get("first") || "").trim();
  const last = (fd.get("last") || "").trim();
  const email = (fd.get("email") || "").trim();
  const phone = (fd.get("phone") || "").trim();
  const zip = (fd.get("zip") || "").trim();
  const project = (fd.get("project") || "").trim();
  const selectedColor = (fd.get("selected_color") || "").trim();

  // Combine notes
  const noteParts = [];
  if (selectedColor) noteParts.push(`Selected WishStone Stone Color: ${selectedColor}`);
  noteParts.push("Consultation request via Genie Bath & Kitchen website.");
  noteParts.push(`Consent: Authorized call/text at ${phone} on ${new Date().toLocaleString()}`);

  // Build exact Lead Ingestion API payload
  // Ensuring Source is strictly "Website" per Kaos Genie documentation
  const leadPayload = {
    id: `web-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name: `${first} ${last}`.trim(),
    email: email,
    phone: phone,
    Postal: zip,
    Source: "Website",
    Product: project,
    Notes: noteParts.join(" | ")
  };

  try {
    const result = await sendLeadWebhook(leadPayload);

    // If neither network endpoint succeeded, throw so fallback warning displays to customer
    if (!result.delivered) {
      throw new Error("Unable to deliver lead to server. Consultation saved locally.");
    }

    // Populate summary of submitted wish
    if (leadSummaryBox) {
      leadSummaryBox.innerHTML = `
        <p><strong>Project:</strong> ${escapeHtml(project)}</p>
        <p><strong>Location:</strong> ZIP ${escapeHtml(zip)}</p>
        <p><strong>Contact:</strong> ${escapeHtml(first)} ${escapeHtml(last)} · ${escapeHtml(phone)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        ${selectedColor ? `<p><strong>WishStone Stone:</strong> ${escapeHtml(selectedColor)}</p>` : ''}
      `;
    }

    // Show success view
    leadForm.hidden = true;
    const leadHeader = document.querySelector(".lead-header");
    if (leadHeader) leadHeader.hidden = true;
    leadDone.hidden = false;
    gsap.from(leadDone.children, {
      opacity: 0,
      y: 14,
      stagger: 0.1,
      duration: 0.6,
      ease: "power2.out"
    });
  } catch (err) {
    console.error("Submission error:", err);
    showError("We encountered a temporary connection issue, but your consultation request was saved locally. You can also call us directly at (210) 988-6449.");
  } finally {
    setSubmitting(false);
  }
});

/* keep pinned layout honest after fonts/images settle */
addEventListener("load", () => ScrollTrigger.refresh());
