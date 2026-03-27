const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { chromium } = require("playwright");

function sha256(obj) {
  return crypto.createHash("sha256").update(JSON.stringify(obj)).digest("hex");
}

(async () => {
  const targetUrl = process.argv[2] || "https://cryptonews.net";
  const outDir = process.argv[3] || "/tmp";
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const runId = `${Date.now()}`;
  const jsonPath = path.join(outDir, `screen_${runId}_rich.json`);
  const screenshotPath = path.join(outDir, `screen_${runId}.png`);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  console.log("Navigating:", targetUrl);
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  try {
    await page.waitForLoadState("networkidle", { timeout: 15000 });
  } catch (e) {}
  await page.waitForTimeout(3000);
  const data = await page.evaluate(() => {
    const getText = (el) => (el?.innerText || el?.textContent || "").trim();
    const isVisible = (el) => {
      if (!el) return false;
      const s = window.getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden") return false;
      if (Number(s.opacity || "1") === 0) return false;
      const r = el.getBoundingClientRect();
      return r && r.width > 0 && r.height > 0;
    };
    const nearestLandmark = (el) => {
      const lm = el.closest(
        "main, header, nav, aside, footer, [role=main], [role=navigation], [role=banner]"
      );
      if (!lm) return null;
      return { tag: lm.tagName, role: lm.getAttribute("role") || "", ariaLabel: lm.getAttribute("aria-label") || "", id: lm.id || "" };
    };
    const nearestSection = (el) => {
      const sec = el.closest("section, article, [role=region], [role=tabpanel]");
      if (!sec) return null;
      const h = sec.querySelector("h1,h2,h3,h4,h5,h6");
      return { role: sec.getAttribute("role") || "", ariaLabel: sec.getAttribute("aria-label") || "", heading: h ? getText(h) : "" };
    };
    const computedName = (el) => {
      const al = el.getAttribute("aria-label");
      if (al) return al.trim();
      const lb = el.getAttribute("aria-labelledby");
      if (lb) {
        const t = lb
          .split(/\s+/)
          .map((id) => document.getElementById(id))
          .filter(Boolean)
          .map((n) => getText(n))
          .join(" ")
          .trim();
        if (t) return t;
      }
      const ti = el.getAttribute("title");
      if (ti) return ti.trim();
      if (el.tagName === "IMG") {
        const alt = el.getAttribute("alt");
        if (alt) return alt.trim();
      }
      return getText(el).slice(0, 120);
    };
    const headings = {
      h1: Array.from(document.querySelectorAll("h1")).map((el) => getText(el)).filter(Boolean),
      h2: Array.from(document.querySelectorAll("h2")).map((el) => getText(el)).filter(Boolean),
      h3: Array.from(document.querySelectorAll("h3")).map((el) => getText(el)).filter(Boolean),
    };
    const landmarks = Array.from(document.querySelectorAll("header, main, nav, aside, footer, [role=main], [role=navigation], [role=banner]")).map((el) => ({ tag: el.tagName, role: el.getAttribute("role") || "", ariaLabel: el.getAttribute("aria-label") || "", id: el.id || "" }));
    const sections = Array.from(document.querySelectorAll("section, article, [role=region], [role=tabpanel]")).slice(0, 30).map((el) => {
      const h = el.querySelector("h1,h2,h3,h4,h5,h6");
      const heading = h ? getText(h) : "";
      const ariaLabel = el.getAttribute("aria-label") || "";
      if (!heading && !ariaLabel) return null;
      return { heading, ariaLabel, role: el.getAttribute("role") || "" };
    }).filter(Boolean);
    const statusMessages = Array.from(document.querySelectorAll('[role=alert], [role=status], .error, .warning, .success, .notification, .toast, [aria-live]')).map((el) => getText(el)).filter(Boolean).slice(0, 50);
    const captured = [];
    const nodes = Array.from(document.querySelectorAll("button, a, input, select, textarea, [role=button], [role=tab], [role=menuitem], [role=menu], [role=menuitemcheckbox], [role=menuitemradio]"));
    nodes.forEach((el, i) => {
      if (!isVisible(el)) return;
      const r = el.getBoundingClientRect();
      captured.push({ id: i + 1, tag: el.tagName, roleAttr: el.getAttribute("role") || "", type: el.getAttribute("type") || "", href: el.tagName === "A" ? (el.getAttribute("href") || "").slice(0, 240) : "", text: getText(el).slice(0, 160), nameGuess: computedName(el).slice(0, 160), ariaLabel: el.getAttribute("aria-label") || "", placeholder: el.getAttribute("placeholder") || "", nameAttr: el.getAttribute("name") || "", state: { disabled: !!el.disabled || el.getAttribute("aria-disabled") === "true", required: !!el.required || el.getAttribute("aria-required") === "true", ariaExpanded: el.getAttribute("aria-expanded") || "", ariaCurrent: el.getAttribute("aria-current") || "", ariaHaspopup: el.getAttribute("aria-haspopup") || "", }, rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }, inViewport: r.bottom > 0 && r.right > 0 && r.x < window.innerWidth && r.y < window.innerHeight, context: { landmark: nearestLandmark(el), section: nearestSection(el) } });
    });
    const primaryActionCandidates = captured.filter((e) => {
      const t = (e.text || e.nameGuess || "").toLowerCase();
      const isButtonish = e.tag === "BUTTON" || e.roleAttr === "button" || (e.tag === "INPUT" && ["submit", "button"].includes(e.type));
      if (!isButtonish) return false;
      if (e.type === "submit") return true;
      return /(save|create|add|new|continue|next|submit|publish|confirm|sign in|log in|register|download)/.test(t);
    }).slice(0, 20);
    return { identity: { url: window.location.href, path: window.location.pathname, title: document.title, metaDescription: document.querySelector('meta[name="description"]')?.content || "" }, headings, landmarks, sections, statusMessages, elements: captured, primaryActionCandidates };
  });
  await page.screenshot({ path: screenshotPath, fullPage: false });
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
  console.log('WROTE', jsonPath, 'and', screenshotPath);
  await browser.close();
})();
