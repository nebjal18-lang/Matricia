import type { EffectCallback } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const effects = vi.hoisted(() => ({ layoutEffect: vi.fn() }));
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useLayoutEffect: effects.layoutEffect,
}));
import { DocumentLocaleSync } from "./document-locale-sync";

beforeEach(() => {
  effects.layoutEffect.mockReset();
  vi.stubGlobal("document", { documentElement: { lang: "fr", dir: "ltr" } });
});
afterEach(() => vi.unstubAllGlobals());

function commit(locale: string) {
  expect(DocumentLocaleSync({ locale })).toBeNull();
  const [effect, dependencies] = effects.layoutEffect.mock.lastCall as [EffectCallback, string[]];
  expect(dependencies).toEqual([locale]);
  return effect();
}

describe("Document locale during client navigation", () => {
  it("synchronizes FR → AR → FR before paint without an outgoing-locale cleanup", () => {
    expect(commit("fr")).toBeUndefined();
    expect(document.documentElement).toMatchObject({ lang: "fr", dir: "ltr" });
    expect(commit("ar")).toBeUndefined();
    expect(document.documentElement).toMatchObject({ lang: "ar", dir: "rtl" });
    expect(commit("fr")).toBeUndefined();
    expect(document.documentElement).toMatchObject({ lang: "fr", dir: "ltr" });
  });

  it.each(["", "en", "ar-MA", "AR", "unknown"])("preserves the current document for unsupported locale %s", (locale) => {
    commit("ar");
    expect(commit(locale)).toBeUndefined();
    expect(document.documentElement).toMatchObject({ lang: "ar", dir: "rtl" });
  });

  it("leaves the server-rendered document untouched during render", () => {
    vi.stubGlobal("document", undefined);
    expect(() => DocumentLocaleSync({ locale: "ar" })).not.toThrow();
    expect(effects.layoutEffect).toHaveBeenCalledTimes(1);
  });
});
