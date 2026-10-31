import { vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => {
    const auth = (globalThis as any).__auth as string | null | undefined;
    return new Headers(auth ? { authorization: auth } : {});
  },
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));