import { NextResponse } from "next/server";
import { seedDemoData } from "@/lib/seed";
import { prisma } from "@/lib/db";

export async function GET() {
  return handleSeed();
}

export async function POST() {
  return handleSeed();
}

async function handleSeed() {
  try {
    const counts = await seedDemoData(prisma);
    return NextResponse.json({ ok: true, message: "Database seeded successfully", counts });
  } catch (e: unknown) {
    console.error("Seed route failed:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

