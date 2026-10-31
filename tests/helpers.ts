import { POST as loginRoute } from "@/app/api/auth/login/route";

export function authAs(token: string | null) {
  (globalThis as any).__auth = token ? `Bearer ${token}` : null;
}

export const jsonReq = (body?: unknown) =>
  new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export const ctx = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });

export async function login(email: string, password = "password123") {
  const res = await loginRoute(jsonReq({ email, password }));
  const data = await res.json();
  return { status: res.status, token: data.token as string, user: data.user };
}