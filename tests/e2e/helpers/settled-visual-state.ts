import type {Page} from "@playwright/test";

/** Measure the rendered UI after its finite entrance animations and fonts settle. */
export async function settleVisualState(page:Page) {
  await page.evaluate(()=>document.fonts.ready.then(()=>undefined));
  await page.waitForFunction(()=>document.getAnimations().every(animation=>{
      const end=animation.effect?.getComputedTiming().endTime;
      return typeof end!=="number" || !Number.isFinite(end) || animation.playState==="finished" || animation.playState==="idle";
    }),undefined,{timeout:5000});
}
