import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = process.env.ADMIN_E2E_ORIGIN || "http://127.0.0.1:4173";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  // Preserve essential-only consent while avoiding the public cookie overlay in layout captures.
  await page.addInitScript(() => {
    localStorage.setItem("herencia_ads_consent_v1", "rejected");
    localStorage.setItem("herencia_cookie_consent", "essential");
  });
  await page.goto(origin + "/", { waitUntil: "domcontentloaded" });
  await page.locator('[data-storefront-component="home.hero"] h1').waitFor({ timeout: 30_000 });
  const originalTitle = await page.locator('[data-storefront-component="home.hero"] h1').textContent();
  assert.ok(originalTitle?.trim(), "The published hero should render normally");
  assert.equal(await page.locator('[data-storefront-component="home.hero"]').count(), 1);
  const heroPosition = await page.locator('[data-storefront-component="home.hero"] section').boundingBox();
  const threeDPosition = await page.locator('[data-storefront-component="home.creations3d"] section').boundingBox();
  assert.ok(heroPosition && threeDPosition && heroPosition.y < threeDPosition.y,
    "The hero must render above the 3D shelf in the admin-controlled commercial order.");

  await page.evaluate(() => {
    window.__adminSelected = null;
    window.__adminPreviewReady = false;
    window.addEventListener("message", (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "herencia:preview:ready") window.__adminPreviewReady = true;
      if (event.data?.type === "herencia:preview:select") {
        window.__adminSelected = event.data.componentId;
      }
    });
    const iframe = document.createElement("iframe");
    iframe.id = "admin-e2e-preview";
    iframe.title = "Vista de prueba";
    iframe.src = "/?__herencia_preview=1";
    iframe.style.width = "1100px";
    iframe.style.height = "850px";
    iframe.style.position = "fixed";
    iframe.style.inset = "0 auto auto 0";
    iframe.style.zIndex = "100000";
    document.body.appendChild(iframe);
  });

  const frame = page.frameLocator("#admin-e2e-preview");
  await frame.locator('[data-storefront-component="home.hero"] h1').waitFor({ timeout: 30_000 });
  // The preview editor listens only after its effect runs. A rendered heading
  // alone does not guarantee the postMessage listener is registered.
  await page.waitForFunction(() => window.__adminPreviewReady === true, { timeout: 15_000 });
  await page.evaluate(() => {
    document.querySelector("#admin-e2e-preview").contentWindow.postMessage({
      type: "herencia:editor:sync",
      siteRaw: JSON.stringify({ marketExperience: { home: {
        referenceHero: false,
        title: "VISTA PRIVADA HERENCIA PRUEBA",
        referenceCategories: true,
        categoryGridLimit: 0,
        categories: [
          { title: "CATEGORIA DE ADMIN", subtitle: "Enlazada al editor", href: "/productos?coleccion=plantas", imageUrl: "", visible: true },
          { title: "CATEGORIA DESACTIVADA", subtitle: "", href: "/productos?buscar=oculta", imageUrl: "", visible: false },
        ],
      } } }),
    }, window.location.origin);
  });
  await frame.locator('[data-storefront-component="home.hero"] h1').getByText("VISTA PRIVADA HERENCIA PRUEBA").waitFor({ timeout: 15_000 });
  await frame.locator('[data-storefront-component="home.categoryStrip"]').getByText("CATEGORIA DE ADMIN").waitFor({ timeout: 15_000 });
  assert.equal(await frame.locator('[data-storefront-component="home.categoryStrip"]').getByText("CATEGORIA DESACTIVADA").count(), 0,
    "An OFF category in Administration must not reappear as a fallback preset.");
  const categoryDestination = await frame.locator('[data-storefront-component="home.categoryStrip"] a').first().getAttribute("href");
  assert.equal(categoryDestination, "/productos?coleccion=plantas",
    "Category cards must keep the administrator's real destination.");


  assert.notEqual((await page.locator('[data-storefront-component="home.hero"] h1').textContent())?.trim(), "VISTA PRIVADA HERENCIA PRUEBA",
    "A draft preview must never overwrite the public page.");

  await frame.locator('[data-storefront-component="home.hero"] h1').click({ timeout: 10_000 });
  await page.waitForFunction(() => window.__adminSelected === "home.hero", { timeout: 15_000 });

  const previewUrl = await page.locator("#admin-e2e-preview").evaluate((frame) => frame.contentWindow.location.pathname);
  assert.equal(previewUrl, "/", "Clicking a component must not navigate away from the preview");

  await page.evaluate(() => document.querySelector("#admin-e2e-preview")?.remove());

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await mobile.addInitScript(() => {
    localStorage.setItem("herencia_ads_consent_v1", "rejected");
    localStorage.setItem("herencia_cookie_consent", "essential");
  });
  await mobile.goto(origin + "/", { waitUntil: "domcontentloaded" });
  await mobile.locator('[data-storefront-component="home.hero"]').waitFor({ timeout: 30_000 });
  assert.equal(await mobile.locator('[data-storefront-component="home.hero"]').isVisible(), true);
  // The build-only server has no backend. Keep backend-unavailable notifications
  // out of visual comparisons without altering real storefront error handling.
  await page.addStyleTag({ content: "[data-sonner-toaster] { display: none !important; }" });
  await mobile.addStyleTag({ content: "[data-sonner-toaster] { display: none !important; }" });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await mobile.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: "admin-e2e-desktop.png", fullPage: false });
  await mobile.screenshot({ path: "admin-e2e-mobile.png", fullPage: false });
  await mobile.close();

  console.log("Admin visual smoke: public home, isolated draft, click-to-select, no accidental navigation, mobile render OK");
  await page.close();
} finally {
  await browser.close();
}
