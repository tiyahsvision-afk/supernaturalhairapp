import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function minutesAgo(mins) {
  return new Date(Date.now() - mins * 60000);
}
function minutesFromNow(mins) {
  return new Date(Date.now() + mins * 60000);
}

async function main() {
  const existing = await prisma.company.findFirst({ where: { joinCode: "GLRX-2026" } });
  if (existing) {
    console.log("Seed data already present (company GLRX-2026 exists) — skipping.");
    return;
  }

  const passwordHash = bcrypt.hashSync("password123", 8);
  const adminUserEmail = "admin@medtrace.app";
  const dispatcherEmail = "dispatch@greatlakesrx.com";
  const driver1Email = "j.rivera@greatlakesrx.com";
  const driver2Email = "s.okafor@greatlakesrx.com";

  const company = await prisma.company.create({
    data: {
      id: "co_greatlakes",
      name: "Great Lakes Pharmacy Courier",
      address: "4400 Grand River Ave",
      city: "Lansing",
      state: "MI",
      licenseNumber: "MI-BOP-88231",
      industry: "Pharmaceutical Delivery",
      contactPhone: "517-555-0142",
      joinCode: "GLRX-2026",
      status: "active",
    },
  });

  await prisma.user.create({
    data: { id: "user_admin", email: adminUserEmail, name: "Platform Admin", passwordHash, role: "admin" },
  });
  await prisma.user.create({
    data: {
      id: "user_dispatch",
      email: dispatcherEmail,
      name: "Dana Whitfield",
      passwordHash,
      role: "user",
      companyId: company.id,
      companyRole: "admin",
    },
  });
  await prisma.user.create({
    data: {
      id: "user_driver1",
      email: driver1Email,
      name: "Javier Rivera",
      passwordHash,
      role: "user",
      companyId: company.id,
      companyRole: "driver",
    },
  });
  await prisma.user.create({
    data: {
      id: "user_driver2",
      email: driver2Email,
      name: "Simi Okafor",
      passwordHash,
      role: "user",
      companyId: company.id,
      companyRole: "driver",
    },
  });

  const drv1 = await prisma.driver.create({
    data: {
      id: "drv_1",
      name: "Javier Rivera",
      userEmail: driver1Email,
      vehicle: "Ford Transit - Refrigerated Van 3",
      phone: "517-555-0110",
      licenseNumber: "MI-DL-5521098",
      status: "on_route",
      currentLat: 42.7325,
      currentLng: -84.5555,
      miBopLicense: "MI-BOP-DRV-4471",
      companyId: company.id,
    },
  });
  const drv2 = await prisma.driver.create({
    data: {
      id: "drv_2",
      name: "Simi Okafor",
      userEmail: driver2Email,
      vehicle: "Chevy Bolt EUV 1",
      phone: "517-555-0187",
      licenseNumber: "MI-DL-6690231",
      status: "available",
      currentLat: 42.7409,
      currentLng: -84.5495,
      miBopLicense: "MI-BOP-DRV-4488",
      companyId: company.id,
    },
  });

  const ord1 = await prisma.order.create({
    data: {
      id: "ord_1001",
      orderNumber: "GLRX-1001",
      patientName: "Harold Beckett",
      patientDob: "1958-03-11",
      patientAddress: "812 Maplewood Dr, Lansing, MI",
      patientPhone: "517-555-2231",
      pickupPharmacy: "Great Lakes Specialty Pharmacy",
      pickupAddress: "4400 Grand River Ave, Lansing, MI",
      deliveryAddress: "812 Maplewood Dr, Lansing, MI",
      status: "in_transit",
      priority: "stat",
      packageType: "controlled_substance",
      requiresDualSignature: true,
      miBopLicense: "MI-BOP-88231",
      pharmacistInCharge: "Dr. Alicia Munroe, PharmD",
      driverId: drv1.id,
      routeSequence: 1,
      barcode: "GLRX1001BC",
      deliveryLat: 42.751,
      deliveryLng: -84.5312,
      companyId: company.id,
      deadline: minutesFromNow(90),
      notes: "Schedule II — requires dual signature on delivery.",
    },
  });
  await prisma.order.create({
    data: {
      id: "ord_1002",
      orderNumber: "GLRX-1002",
      patientName: "Renee Castillo",
      patientDob: "1972-09-02",
      patientAddress: "215 Sparrow Ln, East Lansing, MI",
      patientPhone: "517-555-9910",
      pickupPharmacy: "Great Lakes Specialty Pharmacy",
      pickupAddress: "4400 Grand River Ave, Lansing, MI",
      deliveryAddress: "215 Sparrow Ln, East Lansing, MI",
      status: "pending",
      priority: "urgent",
      packageType: "refrigerated",
      temperatureRequired: true,
      temperatureMin: 2,
      temperatureMax: 8,
      miBopLicense: "MI-BOP-88231",
      pharmacistInCharge: "Dr. Alicia Munroe, PharmD",
      barcode: "GLRX1002BC",
      deliveryLat: 42.7369,
      deliveryLng: -84.4839,
      companyId: company.id,
      deadline: minutesFromNow(180),
      notes: "Cold-chain biologic — keep 2-8C, log temp on pickup and delivery.",
    },
  });
  const ord3 = await prisma.order.create({
    data: {
      id: "ord_1003",
      orderNumber: "GLRX-1003",
      patientName: "Wanda Price",
      patientDob: "1965-12-20",
      patientAddress: "77 Birchwood Ct, Okemos, MI",
      patientPhone: "517-555-4420",
      pickupPharmacy: "Great Lakes Specialty Pharmacy",
      pickupAddress: "4400 Grand River Ave, Lansing, MI",
      deliveryAddress: "77 Birchwood Ct, Okemos, MI",
      status: "delivered",
      priority: "routine",
      packageType: "standard",
      miBopLicense: "MI-BOP-88231",
      pharmacistInCharge: "Dr. Alicia Munroe, PharmD",
      driverId: drv2.id,
      routeSequence: 1,
      barcode: "GLRX1003BC",
      deliveryLat: 42.7175,
      deliveryLng: -84.4297,
      companyId: company.id,
      recipientSignatureUrl: "signed:Wanda Price",
      deliveredAt: minutesAgo(45),
      deadline: minutesAgo(30),
      notes: "",
    },
  });

  await prisma.chainOfCustodyEvent.createMany({
    data: [
      {
        id: "evt_1",
        orderId: ord1.id,
        orderNumber: ord1.orderNumber,
        driverId: drv1.id,
        driverName: "Javier Rivera",
        eventType: "assigned",
        timestamp: minutesAgo(40),
        gpsLat: 42.7325,
        gpsLng: -84.5555,
        companyId: company.id,
        notes: "Assigned to Javier Rivera",
      },
      {
        id: "evt_2",
        orderId: ord1.id,
        orderNumber: ord1.orderNumber,
        driverId: drv1.id,
        driverName: "Javier Rivera",
        eventType: "picked_up",
        timestamp: minutesAgo(30),
        gpsLat: 42.7325,
        gpsLng: -84.5555,
        barcodeScan: "GLRX1001BC",
        companyId: company.id,
        notes: "Picked up from Great Lakes Specialty Pharmacy",
      },
      {
        id: "evt_3",
        orderId: ord1.id,
        orderNumber: ord1.orderNumber,
        driverId: drv1.id,
        driverName: "Javier Rivera",
        eventType: "in_transit",
        timestamp: minutesAgo(15),
        gpsLat: 42.742,
        gpsLng: -84.542,
        companyId: company.id,
        notes: "En route to patient",
      },
      {
        id: "evt_4",
        orderId: ord3.id,
        orderNumber: ord3.orderNumber,
        driverId: drv2.id,
        driverName: "Simi Okafor",
        eventType: "delivered",
        timestamp: minutesAgo(45),
        gpsLat: 42.7175,
        gpsLng: -84.4297,
        barcodeScan: "GLRX1003BC",
        companyId: company.id,
        notes: "Delivered, signed by patient",
      },
    ],
  });

  await prisma.driverMessage.create({
    data: {
      id: "msg_1",
      driverId: drv1.id,
      driverName: "Javier Rivera",
      senderName: "Dana Whitfield",
      senderId: "user_dispatch",
      message: "Heads up — GLRX-1001 requires a dual signature, Schedule II.",
      companyId: company.id,
      createdAt: minutesAgo(35),
    },
  });

  console.log("Seeded Great Lakes Pharmacy Courier demo data.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
