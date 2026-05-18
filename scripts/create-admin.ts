import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email    = "vtcbcn2025@gmail.com";
  const password = "EliteBCN@2025!";
  const name     = "Admin";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Ensure role is ADMIN
    await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
    console.log("✅ User already exists — role set to ADMIN");
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { email, name, passwordHash: hash, role: "ADMIN" },
  });
  console.log("✅ Admin account created:");
  console.log("   Email:   ", email);
  console.log("   Password:", password);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
