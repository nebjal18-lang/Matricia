import { vi } from "vitest";

// These Node tests render server components and import their server actions.
// Next enforces the server-only boundary in application builds; the marker has
// no loader in Vitest. Keep the real repositories and authorization code intact.
vi.mock("server-only", () => ({}));
