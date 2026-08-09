import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const b = await prisma.booking.findUnique({
  where: { id: "cmsm5vnwv00017qyh1kn2t2r5" },
  select: { confirmationCode:true, totalAmount:true, baseFare:true, distanceFare:true, guestEmail:true, stripeSessionId:true },
});
console.log("=== booking created from a tampered payload (client sent totalAmount: -999) ===");
console.log("  totalAmount saved :", b?.totalAmount);
console.log("  baseFare saved    :", b?.baseFare);
console.log("  distanceFare saved:", b?.distanceFare);
console.log("  verdict           :", b && b.totalAmount === 50 ? "SERVER RECOMPUTED CORRECTLY (EUR 50)" : "PRICE TAMPERING SUCCEEDED");
await prisma.$disconnect();
