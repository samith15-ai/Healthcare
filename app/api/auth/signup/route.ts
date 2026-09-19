import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { setAuthCookie } from "@/lib/auth";
import { audit } from "@/lib/audit";

const schema = z.object({ email: z.string().email(), password: z.string().min(6), fullName: z.string().min(1), role: z.enum(["PATIENT", "DOCTOR"]) });
function hash(pw: string) { return crypto.createHash("sha256").update(pw).digest("hex"); }

export async function POST(req: Request) {
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid input. Password must be at least 6 characters." }, { status: 400 });
  const { email, password, fullName, role } = body.data;

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    const user = await prisma.user.create({ data: { email, passwordHash: hash(password), role } });
    if (role === "PATIENT") await prisma.patientProfile.create({ data: { userId: user.id, fullName } });
    else await prisma.doctorProfile.create({ data: { userId: user.id, fullName } });
    await audit({ actorId: user.id, actorRole: role, action: "SIGNUP", targetType: "User", targetId: user.id });
    const res = NextResponse.json({ id: user.id, role });
    setAuthCookie(res, user.id);
    return res;
  } catch (e: unknown) {
    console.error("Signup server error:", e);
    const msg = e instanceof Error ? e.message : String(e);
    const code = (e as { code?: string })?.code;
    if (code === "P2021" || msg.includes("does not exist") || msg.includes("relation")) {
      return NextResponse.json({
        error: "Database schema not migrated. Please run prisma migrate deploy on your database.",
      }, { status: 500 });
    }
    if (msg.includes("reach database server") || msg.includes("connect") || msg.includes("ECONNREFUSED")) {
      return NextResponse.json({
        error: "Database connection failed. Please check DATABASE_URL in your deployment settings.",
      }, { status: 500 });
    }
    return NextResponse.json({
      error: "Signup failed due to a server error. Please try again.",
    }, { status: 500 });
  }
}