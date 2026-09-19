import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { setAuthCookie } from "@/lib/auth";
import { audit } from "@/lib/audit";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  const body = schema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Invalid email or password format" }, { status: 400 });

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
    let user = null;
    try {
      user = await prisma.user.findUnique({ where: { email: body.data.email } });
    } catch (queryErr: unknown) {
      const msg = queryErr instanceof Error ? queryErr.message : String(queryErr);
      const code = (queryErr as { code?: string })?.code;
      if (code === "P2021" || msg.includes("does not exist") || msg.includes("relation")) {
        console.log("Database schema missing. Auto-creating schema tables...");
        const { ensureDatabaseSchema } = await import("@/lib/seed");
        await ensureDatabaseSchema(prisma);
        user = await prisma.user.findUnique({ where: { email: body.data.email } }).catch(() => null);
      } else {
        throw queryErr;
      }
    }

    // If user is missing and demo credentials are submitted, auto-provision demo fixtures
    const isDemoLogin = (body.data.email === "patient@demo.medcare" || body.data.email === "doctor@demo.medcare") && body.data.password === "demo1234";
    if (!user && isDemoLogin) {
      try {
        const { seedDemoData } = await import("@/lib/seed");
        await seedDemoData(prisma);
        user = await prisma.user.findUnique({ where: { email: body.data.email } });
      } catch (seedErr) {
        console.error("Auto-seed error on demo login:", seedErr);
      }
    }

    const hash = crypto.createHash("sha256").update(body.data.password).digest("hex");
    if (!user || user.passwordHash !== hash) {
      const userCount = await prisma.user.count().catch(() => -1);
      if (userCount === 0) {
        return NextResponse.json({
          error: "Database is empty. Please click 'Patient' or 'Doctor' quick demo to auto-initialize demo data.",
        }, { status: 401 });
      }
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    await audit({ actorId: user.id, actorRole: user.role, action: "LOGIN", targetType: "User", targetId: user.id });
    const res = NextResponse.json({ id: user.id, role: user.role });
    setAuthCookie(res, user.id);
    return res;
  } catch (e: unknown) {
    console.error("Signin server error:", e);
    const msg = e instanceof Error ? e.message : String(e);
    const cleanMsg = msg.split("\n").filter(Boolean).pop() || msg;
    return NextResponse.json({
      error: `Database connection error: ${cleanMsg}`,
    }, { status: 500 });
  }
}