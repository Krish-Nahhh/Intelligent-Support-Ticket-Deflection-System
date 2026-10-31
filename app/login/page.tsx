
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Login failed. Please try again.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#2C1A0E] px-5 py-10 text-[#F5F0E8]">
      <section className="w-full max-w-md border border-[#594438] p-7 sm:p-10">
        <a href="/" className="inline-flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center bg-[#F5F0E8] text-lg font-bold text-[#2C1A0E]">
            R
          </span>
          <span className="text-xl font-bold">
            resolve<span className="text-[#9E8B7A]">.</span>
          </span>
        </a>

        <p className="mt-10 text-[10px] uppercase tracking-[0.22em] text-[#9E8B7A]">
          Intelligent support
        </p>

        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Welcome back.
        </h1>

        <p className="mt-3 text-sm leading-6 text-[#B8A697]">
          Sign in to access your support dashboard and tickets.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-xs font-semibold text-[#B8A697]"
            >
              Email address
            </label>

            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full border border-[#594438] bg-transparent px-4 py-3 text-sm outline-none transition placeholder:text-[#806E5F] focus:border-[#9E8B7A]"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-xs font-semibold text-[#B8A697]"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              className="w-full border border-[#594438] bg-transparent px-4 py-3 text-sm outline-none transition placeholder:text-[#806E5F] focus:border-[#9E8B7A]"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="border border-[#6B1E2D] bg-[#6B1E2D]/20 p-3 text-sm text-[#E6A9AE]"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2A4A3A] px-5 py-3.5 text-sm font-semibold text-[#F5F0E8] transition hover:bg-[#355D49] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-7 border-t border-[#594438] pt-5 text-center text-xs text-[#9E8B7A]">
          Resolve · Intelligent Support
        </p>
      </section>
    </main>
  );
}

