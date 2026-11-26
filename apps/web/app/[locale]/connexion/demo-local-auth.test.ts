import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("SEC-03 requires mailbox confirmation while preserving six-digit email OTP signup", () => {
  const config = readFileSync(fileURLToPath(new URL("../../../../../supabase/config.toml", import.meta.url)), "utf8");
  const email = config.split("[auth.email]")[1]?.split(/\n\[/u)[0];
  expect(email).toMatch(/^enable_confirmations = true$/mu);
  expect(email).toMatch(/^enable_signup = true$/mu);
  expect(email).toMatch(/^otp_length = 6$/mu);
  expect(email).toMatch(/^otp_expiry = 600$/mu);
});
