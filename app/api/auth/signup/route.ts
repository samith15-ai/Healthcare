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

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      error: "DATABASE_URL is not set in environment variables. Please add DATABASE_URL in your hosting environment settings (e.g. Vercel Project Settings > Environment Variables).",
    }, { status: 500 });
  }

  if (
    process.env.NODE_ENV === "production" &&
    (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) &&
    (process.env.DATABASE_URL.includes("localhost") || process.env.DATABASE_URL.includes("127.0.0.1"))
  ) {
    return NextResponse.json({
      error: "DATABASE_URL is set to localhost in production. Cloud deployments require a remote hosted PostgreSQL database (e.g., Neon, Supabase, Railway).",
    }, { status: 500 });
  }

  try {
    let existing = null;
    try {
      existing = await prisma.user.findUnique({ where: { email } });
    } catch (queryErr: unknown) {
      const msg = queryErr instanceof Error ? queryErr.message : String(queryErr);
      const code = (queryErr as { code?: string })?.code;
      if (code === "P2021" || msg.includes("does not exist") || msg.includes("relation")) {
        console.log("Database schema missing on signup. Auto-creating schema tables...");
        const { ensureDatabaseSchema } = await import("@/lib/seed");
        await ensureDatabaseSchema(prisma);
        existing = await prisma.user.findUnique({ where: { email } }).catch(() => null);
      } else {
        throw queryErr;
      }
    }

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
    const cleanMsg = msg.split("\n").filter(Boolean).pop() || msg;
    return NextResponse.json({
      error: `Database connection error: ${cleanMsg}`,
    }, { status: 500 });
  }
}