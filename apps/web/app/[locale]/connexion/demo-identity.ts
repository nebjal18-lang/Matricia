import type { DemoPersona } from "./demo-personas";

export type DemoIdentity = {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
};

// Only server-controlled metadata and reserved, non-deliverable addresses qualify.
export function isDemoIdentity(user: DemoIdentity, email: string, persona: DemoPersona): boolean {
  return /^[^\s@]+@[^\s@]+\.(test|invalid)$/iu.test(email)
    && user.email?.toLowerCase() === email.toLowerCase()
    && user.app_metadata?.matricia_demo === true
    && user.app_metadata?.demo_persona === persona;
}

export async function findDemoIdentity(admin: {
  auth: { admin: { listUsers: (args: { page: number; perPage: number }) => Promise<{
    data: { users: DemoIdentity[] }; error: { message: string } | null;
  }> } };
}, email: string, persona: DemoPersona): Promise<DemoIdentity | null> {
  for (let page = 1; page <= 10; page += 1) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (result.error) return null;
    const user = result.data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
    if (user) return isDemoIdentity(user, email, persona) ? user : null;
    if (result.data.users.length < 200) return null;
  }
  return null;
}
