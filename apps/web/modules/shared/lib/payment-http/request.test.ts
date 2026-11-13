import { describe, expect, it } from "vitest";
import { paymentOriginAllowed } from "./request";

const app = "https://app.example.com";

describe("paymentOriginAllowed", () => {
  it("accepts same-origin browser JSON posts", () => {
    expect(paymentOriginAllowed(new Request(app, { headers: { origin: app, "content-type": "application/json", "sec-fetch-site": "same-origin" } }), app)).toBe(true);
  });
  it("rejects cross-site fetch even with a matching Origin spoof attempt pattern", () => {
    expect(paymentOriginAllowed(new Request(app, { headers: { origin: app, "content-type": "application/json", "sec-fetch-site": "cross-site" } }), app)).toBe(false);
  });
  it("rejects non-JSON content types when the header is present", () => {
    expect(paymentOriginAllowed(new Request(app, { headers: { origin: app, "content-type": "text/plain", "sec-fetch-site": "same-origin" } }), app)).toBe(false);
  });
  it("rejects a foreign Origin", () => {
    expect(paymentOriginAllowed(new Request(app, { headers: { origin: "https://evil.example", "content-type": "application/json" } }), app)).toBe(false);
  });
});
