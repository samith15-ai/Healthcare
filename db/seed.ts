import { PrismaClient } from "@prisma/client";
import { seedDemoData } from "../lib/seed";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");
  const counts = await seedDemoData(prisma);
  console.log("Seed complete:", counts);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());