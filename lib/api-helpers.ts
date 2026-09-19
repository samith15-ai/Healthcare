import { NextResponse } from "next/server";

export function err(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export function statusOf(e: unknown): number {
  return (e as { status?: number })?.status ?? 500;
}

export function getBaseUrl(): string {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    const host = process.env.VERCEL_URL.replace(/\/$/, "");
    return host.startsWith("http") ? host : `https://${host}`;
  }
  return "http://localhost:3000";
}