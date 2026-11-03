import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { designTokenCssVariables, designTokens, MATRICIA_BREAKPOINT_MIN_PX } from "./tokens";

function relativeLuminance(hex: string): number {
  const channels = hex.match(/[A-Fa-f0-9]{2}/g);
  if (!channels || channels.length !== 3) throw new Error("INVALID_HEX_COLOR");
  const [red = "00", green = "00", blue = "00"] = channels;
  const linear = [red, green, blue].map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
}

function contrast(foreground: string, background: string): number {
  const light = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const dark = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (light + 0.05) / (dark + 0.05);
}

describe("Design Authority A tokens", () => {
  it("conserve le viewport critique à 360 px", () => {
    expect(MATRICIA_BREAKPOINT_MIN_PX).toBe(360);
    expect(designTokens.breakpoint.compact).toBe("360px");
  });

  it("garantit un contraste texte AA sur les surfaces principales", () => {
    expect(contrast(designTokens.color.text, designTokens.color.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(designTokens.color.textMuted, designTokens.color.canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(designTokens.color.surface, designTokens.color.brand)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(designTokens.color.surface, designTokens.color.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(designTokens.color.accent, designTokens.color.accentMuted)).toBeGreaterThanOrEqual(4.5);
  });

  it("expose des variables CSS partagées sans direction physique", () => {
    expect(designTokenCssVariables["--mat-color-brand"]).toBe(designTokens.color.brand);
    expect(Object.keys(designTokenCssVariables).some((key) => /(?:left|right)/i.test(key))).toBe(false);
  });

  it("garde les couleurs TypeScript et CSS synchronisées", () => {
    const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8").toLowerCase();
    const declarations = new Map([...css.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [match[1]!, match[2]!.trim()]));
    function resolveColor(name: string, seen = new Set<string>()): string | undefined {
      if (seen.has(name)) throw new Error(`CSS_VARIABLE_CYCLE:${name}`);
      seen.add(name);
      const value = declarations.get(name);
      const alias = value?.match(/^var\((--[\w-]+)\)$/)?.[1];
      return alias ? resolveColor(alias, seen) : value;
    }
    for (const [name, value] of Object.entries(designTokenCssVariables)) {
      if (!name.startsWith("--mat-color-")) continue;
      expect(resolveColor(name), name).toBe(value.toLowerCase());
    }
  });
});
