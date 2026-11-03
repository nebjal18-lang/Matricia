import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  workers: 1,
  projects: [375, 390, 768, 1440].map(width => ({
    name: `audit30-${width}`,
    use: { ...devices["Desktop Chrome"], viewport: {width,height:900}, hasTouch:width<768 },
  })),
});
