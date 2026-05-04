import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // 1. Cleanup (Reverse order so we don't hit foreign key errors)
  await prisma.booking.deleteMany();
  await prisma.listingPhoto.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.user.deleteMany();

  const password = await bcrypt.hash("password123", 10);

  // 2. Upsert Users
  const heeseung = await prisma.user.upsert({
    where: { email: "heeseung@enhypen.com" },
    update: {},
    create: { name: "Lee Heeseung", email: "heeseung@enhypen.com", username: "heeseung", password, role: "HOST" },
  });

  const sunghoon = await prisma.user.upsert({
    where: { email: "sunghoon@enhypen.com" },
    update: {},
    create: { name: "Park Sunghoon", email: "sunghoon@enhypen.com", username: "iceprince", password, role: "GUEST" },
  });

  // (Add the rest of the members here following the same pattern!)

  // 3. Create Listings (Individually so we get IDs for bookings)
  const penthouse = await prisma.listing.create({
    data: {
      title: "Seoul Penthouse with Vocal Room",
      description: "OT7 approved workspace.",
      location: "Seoul",
      pricePerNight: 500,
      guests: 7,
      type: "APARTMENT",
      amenities: ["Wi-Fi", "Studio", "Mic"],
      hostId: heeseung.id,
    }
  });

  // 4. Create Bookings
  await prisma.booking.create({
    data: {
      checkIn: new Date("2026-06-01"),
      checkOut: new Date("2026-06-05"),
      totalPrice: 2000,
      status: "PENDING",
      guestId: sunghoon.id,
      listingId: penthouse.id,
    }
  });

  console.log("✅ Seeding complete!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => await prisma.$disconnect());