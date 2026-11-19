/** Marge plateforme en basis points — calcul entier exact (half-up via reste). */
export const DEFAULT_BOX_PLATFORM_MARGIN_BPS = 1500;

export function applyMarginBps(costMinor: bigint, marginBps: number): bigint {
  if (marginBps < 1 || marginBps > 10000) {
    throw new Error("INVALID_MARGIN_BPS");
  }
  if (costMinor < BigInt(0)) {
    throw new Error("INVALID_COST");
  }
  const bps = BigInt(marginBps);
  const numerator = costMinor * bps;
  const quotient = numerator / BigInt(10000);
  const remainder = numerator % BigInt(10000);
  const rounded = remainder * BigInt(2) >= BigInt(10000) ? quotient + BigInt(1) : quotient;
  return costMinor + rounded;
}

export function sumWholesaleCosts(pricesMinor: string[]): bigint {
  return pricesMinor.reduce((acc, value) => {
    if (!/^\d+$/u.test(value)) throw new Error("INVALID_MINOR");
    return acc + BigInt(value);
  }, BigInt(0));
}
