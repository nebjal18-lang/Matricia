# Native Client browser evidence — 2026-11-02

The source database is an owned, no-network canonical migration setup source.
The target is a disposable internal Docker network with loopback-only gateway
and app. Native GoTrue OTP/TOTP identities are retained throughout. Credentials,
JWTs, OTPs, cookies, headers, dumps and private state are never exported here.

- `buyer-native-8721910.json`: keyboard reservation and touch cancellation use
  real UI Server Actions; the funded member envelope persists 3 → 0 → 3.
  Foreign cancellation, foreign organization, global wallet RLS and Admin RPC
  are refused. The immediate-read failure before persistence polling is retained
  separately. Two real cancellation cycles share the same original DEMO payment.
- `buyer-demo-preserved-payment.json`: the exact original DEMO intent, event and
  paid-at were resumed and replayed without duplicate payment. Ten canonical
  credits fund the Box; the plain Buyer receives a limit of three. Owner and
  Buyer have no Finance platform role; governance uses two other native actors.
- `buyer-global-finance-468fa307.json`: both global financial document/source
  RPCs reject the genuine Buyer with SQLSTATE 42501.
- `canonical-acl-historical457.json` remains historical. The current 458-migration
  inspection matches all 3,915 objects/definitions/owners/ACLs with zero changes.
  `guard-delta37000.json` verifies the three deferred SECURITY DEFINER guards,
  pg_catalog search path and revoked runtime execution. No ledger grant was
  added. These setup/inspection artifacts are not a green SQL replay receipt;
  the independent strict 904-assertion SQL replay is reported separately.
- `axe-final-468fa307.json`: all 32 scans pass with zero violations/errors and
  zero excluded rules. Four pages, FR/AR, 375/768, account menu closed/open;
  keyboard menu opening; WCAG2 A/AA and WCAG2.1 A/AA. Incomplete results remain
  incomplete and do not imply full manual WCAG certification.
- `contrast-before236caf9/`: the full 32-state review covers 1,409 incomplete
  nodes. Sixteen French caption states show actual opaque glyph contrast 4.1324.
  Raw computed ancestors include opacity, filters, blending, clipping and menu
  stacking; unrendered/clipped/covered areas are explicitly unmeasured. Four
  representative normal/background capture pairs accompany compressed full data.
- `contrast-after236caf9/`: after the shared opaque caption background fix,
  every changed caption in all 32 states has actual opaque glyph contrast at
  least 5.1597, with 27–52 core samples per caption. All 64 normal/background
  screenshots and full measured styles are exported. Font Range rectangles
  extending outside the caption background still have indeterminate bounds;
  they are never relabelled as passing. Antialias edge pixels are excluded.

SHA256 manifests bind exported files. The final application tree is
`468fa3077d29a31ae3d071eef830ff9f96b5a964`; the earlier business operation tree
`8721910b794a7d3533f96a99b8d63fddc3701d02` differs only by the caption background
correction. Helpers and reproduction instructions are under
`tests/e2e/helpers/client-isolated/README.md`. Browser fixtures do not certify
external PSP, native compliance onboarding, commercial publication, physical
antivirus or production operation. No production deployment or data mutation
is included.
