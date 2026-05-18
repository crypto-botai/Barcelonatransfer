const { PrismaClient } = require("../node_modules/.prisma/client");
const bcrypt = require("../node_modules/bcryptjs");

const prisma = new PrismaClient();
const email    = "vtcbcn2025@gmail.com";
const password = "EliteBCN@2025!";

bcrypt.hash(password, 12).then((hash) => {
  return prisma.user.upsert({
    where:  { email },
    update: { role: "ADMIN", passwordHash: hash },
    create: { email, name: "Admin", passwordHash: hash, role: "ADMIN" },
  });
}).then((u) => {
  console.log("Admin created/updated:", u.email, "| role:", u.role);
  return prisma.$disconnect();
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
