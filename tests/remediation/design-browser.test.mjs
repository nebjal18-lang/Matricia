import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { after, before, test } from "node:test";
import { runInNewContext } from "node:vm";
import { chromium, expect } from "@playwright/test";

// Real component and production CSS, with only routing/auth adapters replaced.
// No app server, credentials or database are used by this isolated browser test.
const root = process.cwd();
const web = path.join(root, "apps/web");
async function installed(name, packageName) {
  const folder = (await readdir(path.join(root, "node_modules/.pnpm"))).filter(entry => entry.startsWith(name)).sort().at(-1);
  assert.ok(folder, `Installed dependency ${name} required`);
  return createRequire(path.join(root, "node_modules/.pnpm", folder, "loader.cjs"))(packageName);
}
let browser, script, css, nodeDisplay;
before(async () => {
  const { build } = await installed("esbuild@", "esbuild");
  const displayBundle = await build({ entryPoints: [path.join(web, "modules/shared/lib/format/display.ts")], bundle: true, write: false, platform: "node", format: "cjs" });
  const module = { exports: {} };
  runInNewContext(displayBundle.outputFiles[0].text, { module, exports: module.exports, Date, Intl });
  nodeDisplay = module.exports;
  const { compile } = await installed("@tailwindcss+node@", "@tailwindcss/node");
  const navSource = await readFile(path.join(web, "modules/public/ui/site/public-navigation.tsx"), "utf8");
  const compiler = await compile(await readFile(path.join(web, "app/globals.css"), "utf8"), { base: path.join(web, "app"), onDependency() {} });
  css = compiler.build(navSource.match(/[\w:/.[\]%-]+/g));
  for (const file of ["app/[locale]/(public)/experience.css", "modules/shared/ui/design-system/matricia-ds.css", "modules/client/ui/client-experience.css", "modules/provider/ui/provider-experience.css", "modules/franchise/ui/franchise-experience.css"]) {
    css += (await readFile(path.join(web, file), "utf8")).replace(/^@import[^;]+;/gm, "");
  }
  const output = await build({
    stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {PublicNavigation} from '@/modules/public/ui/site/public-navigation';
      import {formatDateTimeCasablanca, formatMinorAmount} from '@/modules/shared/lib/format/display';
      window.display = {formatDateTimeCasablanca, formatMinorAmount};
      const locale = document.documentElement.lang;
      createRoot(document.getElementById('root')).render(<PublicNavigation locale={locale} sessionNavigation={window.signedIn ? {signedIn:true,landing:'client',options:[{kind:'client',href:'/'+locale+'/tableau-de-bord'},{kind:'provider',href:'/'+locale+'/sous-traitant'}]} : undefined}/>);`, loader: "tsx", resolveDir: web },
    bundle: true, write: false, format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"test"' }, alias: { "@": web },
    plugins: [{ name: "isolated-adapters", setup(build) {
      build.onResolve({ filter: /^(next\/link|next\/navigation|.*\/select-workspace)$/ }, args => ({ path: args.path, namespace: "adapter" }));
      build.onLoad({ filter: /.*/, namespace: "adapter" }, args => ({ resolveDir: web, loader: "jsx", contents: args.path === "next/link" ? `import React from 'react'; export default function Link(props){return <a {...props}/>}` : args.path === "next/navigation" ? `export const usePathname=()=>window.testPath;` : `export async function selectWorkspace(){}` }));
    } }],
  });
  script = output.outputFiles[0].text;
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); });

async function mount(locale, width, signedIn = true, route = "") {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.route("**/*", route => route.abort());
  await page.setContent(`<html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}"><head><style>${css}</style></head><body class="public-root"><div id="root"></div><main class="${route ? "diagnostic-premium-page" : "home-premium-page"}"></main></body></html>`);
  await page.evaluate(({ locale, signedIn, route }) => { window.signedIn = signedIn; window.testPath = `/${locale}${route}`; }, { locale, signedIn, route });
  await page.addScriptTag({ content: script });
  await expect(page.locator(".premium-nav")).toBeVisible();
  return page;
}

for (const locale of ["fr", "ar"]) {
  test(`DATE-01 Node/browser civil time agrees in ${locale}`, async () => {
    const page = await mount(locale, 360);
    try {
      // Independent civil-time fixtures from IANA 2026e, not the host's potentially stale Intl.
      for (const [instant, fr, ar] of [
        ["2025-03-01T23:30:00Z", "1 mar. 2025, 23:30", "1 مارس 2025، 23:30"],
        ["2026-03-01T23:30:00Z", "1 mar. 2026, 23:30", "1 مارس 2026، 23:30"],
        ["2026-02-15T01:59:00Z", "15 fév. 2026, 02:59", "15 فبراير 2026، 02:59"],
        ["2026-02-15T02:00:00Z", "15 fév. 2026, 02:00", "15 فبراير 2026، 02:00"],
        ["2026-03-22T02:00:00Z", "22 mar. 2026, 03:00", "22 مارس 2026، 03:00"],
        ["2026-09-20T00:59:00Z", "20 sept. 2026, 01:59", "20 شتنبر 2026، 01:59"],
        ["2026-09-20T01:00:00Z", "20 sept. 2026, 01:00", "20 شتنبر 2026، 01:00"],
        ["2026-11-14T22:24:00.548972+00:00", "14 nov. 2026, 22:24", "14 نونبر 2026، 22:24"],
        ["2027-03-01T23:30:00Z", "1 mar. 2027, 23:30", "1 مارس 2027، 23:30"],
      ]) {
        const browserValue = await page.evaluate(({instant, locale}) => window.display.formatDateTimeCasablanca(instant, locale), {instant, locale});
        assert.equal(browserValue, locale === "fr" ? fr : ar);
        assert.equal(browserValue, nodeDisplay.formatDateTimeCasablanca(instant, locale));
      }
    } finally { await page.close(); }
  });
  test(`A11Y-04 visible multispaces keyboard order and Escape ${locale}`, async () => {
    const page = await mount(locale, 360);
    try {
      const trigger = page.locator(".premium-menu-trigger");
      await trigger.click();
      const menu = page.locator("#public-mobile-navigation");
      const links = menu.locator("a");
      await expect(links.first()).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(menu.locator("summary")).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(links.first()).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Enter");
      await expect(menu.locator("details")).toHaveAttribute("open", "");
      await page.keyboard.press("Tab");
      await expect(menu.locator('button[value],form button').first()).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(menu.locator("form button").last()).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(links.first()).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(menu).toHaveCount(0);
      await expect(trigger).toBeFocused();
    } finally { await page.close(); }
  });

  test(`UX-03 responsive navigation without overflow ${locale}`, async () => {
    for (const width of [360, 390, 768, 1024, 1440]) {
      for (const signedIn of [false, true]) {
        for (const route of ["", "/diagnostic"]) {
          const page = await mount(locale, width, signedIn, route);
          try {
            const size = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
            assert.ok(size.content <= size.viewport, `${locale} ${width} ${signedIn} ${route}: ${JSON.stringify(size)}`);
            const clipped = await page.locator('.premium-nav a, .premium-nav button, .premium-nav summary').evaluateAll(elements => elements.filter(element => {
              const bounds = element.getBoundingClientRect();
              return bounds.width > 0 && bounds.height > 0 && (bounds.left < -1 || bounds.right > innerWidth + 1);
            }).map(element => element.textContent));
            assert.deepEqual(clipped, [], `Navigation targets outside viewport: ${locale} ${width}`);
            if (width < 1280) await expect(page.locator(".premium-menu-trigger")).toBeVisible();
          } finally { await page.close(); }
        }
      }
    }
  });

  test(`A11Y-01..03 computed contrast and focus ${locale}`, async () => {
    const page = await browser.newPage();
    try {
      await page.setContent(`<html dir="${locale === "ar" ? "rtl" : "ltr"}"><head><style>${css}</style></head><body><div class="client-workspace" data-theme="follow"><main><a class="client-kpi-cta" data-tone="peach" href="#">${locale === "ar" ? "المدفوعات" : "Paiements"}</a><label class="client-shell-search"><span>Recherche</span><input aria-label="Recherche"></label><button>Après</button></main></div></body></html>`);
      const cta = page.locator(".client-kpi-cta");
      const contrast = async locator => locator.evaluate(element => {
        const style = getComputedStyle(element);
        const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((sum, x, i) => sum + x * [.2126, .7152, .0722][i], 0);
        const text = luminance(style.color);
        const surface = luminance(element.tagName === "INPUT" ? getComputedStyle(element.parentElement).backgroundColor : style.backgroundColor);
        return (Math.max(text, surface) + .05) / (Math.min(text, surface) + .05);
      });
      assert.ok(await contrast(cta) >= 4.5);
      await cta.hover();
      assert.ok(await contrast(cta) >= 4.5);
      await page.keyboard.press("Tab");
      await expect(cta).toBeFocused();
      await expect(cta).toHaveCSS("outline-style", "solid");
      await page.keyboard.press("Tab");
      const input = page.getByRole("textbox");
      await expect(input).toBeFocused();
      await expect(page.locator(".client-shell-search")).toHaveCSS("outline-style", "solid");
      await input.fill("Recherche طويلة ".repeat(30));
      assert.ok(await contrast(input) >= 4.5);
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await expect(input).toBeFocused();
      for (const workspace of ["provider", "franchise"]) {
        await page.evaluate(workspace => {
          document.querySelector(".client-workspace").classList.add(`${workspace}-workspace`);
          document.querySelector("main").className = `client-topbar ${workspace}-topbar`;
          document.querySelector(".client-shell-search").classList.add("client-top-search", `${workspace}-shell-search`);
        }, workspace);
        await cta.focus();
        await page.keyboard.press("Tab");
        await expect(input).toBeFocused();
        await expect(page.locator(".client-shell-search")).toHaveCSS("outline-style", "solid");
        assert.ok(await contrast(input) >= 4.5);
        await page.keyboard.press("Tab");
        await page.keyboard.press("Shift+Tab");
        await expect(input).toBeFocused();
        await page.evaluate(workspace => document.querySelector(".client-workspace").classList.remove(`${workspace}-workspace`), workspace);
      }
    } finally { await page.close(); }
  });
}
