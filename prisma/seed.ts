import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] as string });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log("🌱 Seeding database...");

  // 1. CLEANUP — reverse dependency order
  await prisma.booking.deleteMany();
  await prisma.listingPhoto.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();

  const password = await bcrypt.hash("password123", 10);

  // 2. UPSERT USERS — safe to run multiple times
  const heeseung = await prisma.user.upsert({
    where: { email: "heeseung@enhypen.com" },
    update: {},
    create: {
      name: "Lee Heeseung",
      email: "heeseung@enhypen.com",
      username: "heeseung",
      phone: "1234567891",
      password,
      role: "HOST",
    },
  });

  const jay = await prisma.user.upsert({
    where: { email: "jay@enhypen.com" },
    update: {},
    create: {
      name: "Park Jay",
      email: "jay@enhypen.com",
      username: "jay",
      phone: "1234567892",
      password,
      role: "HOST",
    },
  });

  const jake = await prisma.user.upsert({
    where: { email: "jake@enhypen.com" },
    update: {},
    create: {
      name: "Sim Jake",
      email: "jake@enhypen.com",
      username: "jake",
      phone: "1234567893",
      password,
      role: "HOST",
    },
  });

  const sunghoon = await prisma.user.upsert({
    where: { email: "sunghoon@enhypen.com" },
    update: {},
    create: {
      name: "Park Sunghoon",
      email: "sunghoon@enhypen.com",
      username: "sunghoon",
      phone: "1234567894",
      password,
      role: "GUEST",
    },
  });

  const sunoo = await prisma.user.upsert({
    where: { email: "sunoo@enhypen.com" },
    update: {},
    create: {
      name: "Kim Sunoo",
      email: "sunoo@enhypen.com",
      username: "sunoo",
      phone: "1234567895",
      password,
      role: "GUEST",
    },
  });

  const jungwon = await prisma.user.upsert({
    where: { email: "jungwon@enhypen.com" },
    update: {},
    create: {
      name: "Yang Jungwon",
      email: "jungwon@enhypen.com",
      username: "jungwon",
      phone: "1234567896",
      password,
      role: "GUEST",
    },
  });

  const niki = await prisma.user.upsert({
    where: { email: "niki@enhypen.com" },
    update: {},
    create: {
      name: "Nishimura Riki",
      email: "niki@enhypen.com",
      username: "niki",
      phone: "1234567897",
      password,
      role: "GUEST",
    },
  });

  console.log("✅ 7 users created");

  // 3. CREATE LISTINGS — one of each type
  const penthouse = await prisma.listing.create({
    data: {
      title: "Seoul Penthouse with Vocal Room",
      description: "Perfect for late-night gaming and singing. OT7 approved workspace with a full recording studio.",
      location: "Seoul, South Korea",
      pricePerNight: 500,
      guests: 7,
      type: "APARTMENT",
      amenities: ["Wi-Fi", "Gaming PC", "Recording Studio", "Mic", "Air Conditioning"],
      hostId: heeseung.id,
    },
  });

  const beachHouse = await prisma.listing.create({
    data: {
      title: "Jeju Island Beach House",
      description: "Stunning ocean views, perfect for a relaxing getaway with the crew.",
      location: "Jeju, South Korea",
      pricePerNight: 350,
      guests: 4,
      type: "HOUSE",
      amenities: ["Wi-Fi", "Pool", "Beach Access", "BBQ", "Outdoor Shower"],
      hostId: jay.id,
    },
  });

  const oceanVilla = await prisma.listing.create({
    data: {
      title: "Busan Oceanview Villa",
      description: "Luxury villa with breathtaking ocean views, private pool, and chef kitchen.",
      location: "Busan, South Korea",
      pricePerNight: 450,
      guests: 6,
      type: "VILLA",
      amenities: ["Wi-Fi", "Private Pool", "Ocean View", "Chef Kitchen", "Home Theater"],
      hostId: jake.id,
    },
  });

  const mountainCabin = await prisma.listing.create({
    data: {
      title: "Gangwon Mountain Cabin",
      description: "Cozy cabin in the mountains, perfect for a winter escape with hot springs nearby.",
      location: "Gangwon, South Korea",
      pricePerNight: 200,
      guests: 3,
      type: "CABIN",
      amenities: ["Wi-Fi", "Fireplace", "Hot Tub", "Mountain View", "Hiking Trails"],
      hostId: heeseung.id,
    },
  });

  console.log("✅ 4 listings created");

  // 4. CREATE BOOKINGS — at least one CONFIRMED and one PENDING
  await prisma.booking.create({
    data: {
      checkIn: new Date("2026-06-01"),
      checkOut: new Date("2026-06-05"),
      totalPrice: 4 * penthouse.pricePerNight,
      status: "CONFIRMED",
      guestId: sunghoon.id,
      listingId: penthouse.id,
    },
  });

  await prisma.booking.create({
    data: {
      checkIn: new Date("2026-07-10"),
      checkOut: new Date("2026-07-15"),
      totalPrice: 5 * beachHouse.pricePerNight,
      status: "PENDING",
      guestId: sunoo.id,
      listingId: beachHouse.id,
    },
  });

  await prisma.booking.create({
    data: {
      checkIn: new Date("2026-08-20"),
      checkOut: new Date("2026-08-25"),
      totalPrice: 5 * oceanVilla.pricePerNight,
      status: "CONFIRMED",
      guestId: jungwon.id,
      listingId: oceanVilla.id,
    },
  });

  console.log("✅ 3 bookings created");
  console.log("🎉 Seeding complete! OT7 forever.");
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(async () => await prisma.$disconnect());