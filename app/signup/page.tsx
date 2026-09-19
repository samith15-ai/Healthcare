"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function SignUp() {
  const r = useRouter();
  const [form, setForm] = useState({ email: "", password: "", fullName: "", role: "PATIENT" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(j.error || "Sign up failed");
        return;
      }
      window.location.href = j.role === "DOCTOR" ? "/doctor/dashboard" : "/patient/overview";
    } catch {
      setErr("Failed to reach server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-black">Create account</h1>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <label className="block text-sm">Full name<input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="mt-1 w-full rounded-lg border p-2" /></label>
        <label className="block text-sm">Email<input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 w-full rounded-lg border p-2" /></label>
        <label className="block text-sm">Password<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1 w-full rounded-lg border p-2" /></label>
        <label className="block text-sm">Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="mt-1 w-full rounded-lg border p-2"><option value="PATIENT">Patient</option><option value="DOCTOR">Doctor</option></select></label>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button disabled={loading} className="w-full rounded-xl bg-clinical-600 py-2 font-bold text-white disabled:opacity-50">
          {loading ? "Creating account…" : "Sign up"}
        </button>
      </form>
    </main>
  );
}