import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = process.env.ADMIN_E2E_ORIGIN || "http://127.0.0.1:4173";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  await page.goto(origin + "/", { waitUntil: "domcontentloaded" });
  await page.locator('[data-storefront-component="home.hero"] h1').waitFor({ timeout: 30_000 });
  const originalTitle = await page.locator('[data-storefront-component="home.hero"] h1').textContent();
  assert.ok(originalTitle?.trim(), "The published hero should render normally");
  assert.equal(await page.locator('[data-storefront-component="home.hero"]').count(), 1);

  await page.evaluate(() => {
    window.__adminSelected = null;
    window.addEventListener("message", (event) => {
      if (event.origin === window.location.origin && event.data?.type === "herencia:preview:select") {
        window.__adminSelected = event.data.componentId;
      }
    });
    const iframe = document.createElement("iframe");
    iframe.id = "admin-e2e-preview";
    iframe.title = "Vista de prueba";
    iframe.src = "/?__herencia_preview=1";
    iframe.style.width = "1100px";
    iframe.style.height = "850px";
    document.body.appendChild(iframe);
  });

  const frame = page.frameLocator("#admin-e2e-preview");
  await frame.locator('[data-storefront-component="home.hero"] h1').waitFor({ timeout: 30_000 });
  await page.evaluate(() => {
    document.querySelector("#admin-e2e-preview").contentWindow.postMessage({
      type: "herencia:editor:sync",
      siteRaw: JSON.stringify({ marketExperience: { home: { title: "VISTA PRIVADA HERENCIA PRUEBA" } } }),
    }, window.location.origin);
  });
  await frame.locator('[data-storefront-component="home.hero"] h1').getByText("VISTA PRIVADA HERENCIA PRUEBA").waitFor({ timeout: 15_000 });

  assert.notEqual((await page.locator('[data-storefront-component="home.hero"] h1').textContent())?.trim(), "VISTA PRIVADA HERENCIA PRUEBA",
    "A draft preview must never overwrite the public page.");

  await frame.locator('[data-storefront-component="home.hero"] h1').click({ timeout: 10_000 });
  await page.waitForFunction(() => window.__adminSelected === "home.hero", { timeout: 15_000 });

  const previewUrl = await page.locator("#admin-e2e-preview").evaluate((frame) => frame.contentWindow.location.pathname);
  assert.equal(previewUrl, "/", "Clicking a component must not navigate away from the preview");

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await mobile.goto(origin + "/", { waitUntil: "domcontentloaded" });
  await mobile.locator('[data-storefront-component="home.hero"]').waitFor({ timeout: 30_000 });
  assert.equal(await mobile.locator('[data-storefront-component="home.hero"]').isVisible(), true);
  await page.screenshot({ path: "admin-e2e-desktop.png", fullPage: false });
  await mobile.screenshot({ path: "admin-e2e-mobile.png", fullPage: false });
  await mobile.close();

  console.log("Admin visual smoke: public home, isolated draft, click-to-select, no accidental navigation, mobile render OK");
  await page.close();
} finally {
  await browser.close();
}
