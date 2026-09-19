import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
export const SESSION_COOKIE = "medcare_session";
export async function getSession() {
  const jar = cookies();
  const userId = jar.get(SESSION_COOKIE)?.value;
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { patientProfile: true, doctorProfile: true } });
  return user;
}
export async function requireRole(roles: string[]) {
  const s = await getSession();
  if (!s || !roles.includes(s.role)) { const e = new Error("Forbidden"); (e as Error & { status?: number }).status = 403; throw e; }
  return s;
}
export function sessionCookie(userId: string) {
  const isProd = process.env.NODE_ENV === "production";
  return `${SESSION_COOKIE}=${userId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${isProd ? "; Secure" : ""}`;
}
export function clearSessionCookie() {
  const isProd = process.env.NODE_ENV === "production";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProd ? "; Secure" : ""}`;
}
export function setAuthCookie(res: NextResponse, userId: string) {
  const isProd = process.env.NODE_ENV === "production";
  res.cookies.set({
    name: SESSION_COOKIE,
    value: userId,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 86400,
    secure: isProd,
  });
  res.headers.set("Set-Cookie", sessionCookie(userId));
}
export function clearAuthCookie(res: NextResponse) {
  const isProd = process.env.NODE_ENV === "production";
  res.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: isProd,
  });
  res.headers.set("Set-Cookie", clearSessionCookie());
}
export function patientIdFor(user: { id: string; role: string; patientProfile?: { id: string } | null }) {
  return user.role === "PATIENT" ? user.patientProfile?.id ?? user.id : null;
}