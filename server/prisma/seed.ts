import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const tripStatus = {
  SCHEDULED: "SCHEDULED" as const,
  ACTIVE: "ACTIVE" as const,
  COMPLETED: "COMPLETED" as const,
  CANCELLED: "CANCELLED" as const,
};

const demoDrivers = [
  {
    fullName: "Jordan Miles",
    email: "jordan.miles@transitops.demo",
    phone: "+1 555 210 4478",
    licenseNumber: "LIC-1001",
    licenseExpiryDate: "2027-02-18",
    status: "AVAILABLE" as const,
    assignedVehicle: null,
  },
  {
    fullName: "Priya Khan",
    email: "priya.khan@transitops.demo",
    phone: "+1 555 218 1159",
    licenseNumber: "LIC-1002",
    licenseExpiryDate: "2027-09-04",
    status: "ON_TRIP" as const,
    assignedVehicle: "TR-2048",
  },
  {
    fullName: "Marcus Lee",
    email: "marcus.lee@transitops.demo",
    phone: "+1 555 203 8891",
    licenseNumber: "LIC-1003",
    licenseExpiryDate: "2026-12-22",
    status: "ON_LEAVE" as const,
    assignedVehicle: null,
  },
  {
    fullName: "Tara Singh",
    email: "tara.singh@transitops.demo",
    phone: "+1 555 244 0192",
    licenseNumber: "LIC-1004",
    licenseExpiryDate: "2027-06-12",
    status: "AVAILABLE" as const,
    assignedVehicle: "TR-3224",
  },
];

const demoUsers = [
  {
    email: "fleet@transitops.demo",
    password: "password123",
    name: "Alex Fleet",
    role: "FLEET_MANAGER" as const,
  },
  {
    email: "driver@transitops.demo",
    password: "password123",
    name: "Dana Driver",
    role: "DRIVER" as const,
  },
  {
    email: "safety@transitops.demo",
    password: "password123",
    name: "Sam Safety",
    role: "SAFETY_OFFICER" as const,
  },
  {
    email: "finance@transitops.demo",
    password: "password123",
    name: "Finn Analyst",
    role: "FINANCIAL_ANALYST" as const,
  },
];

const demoTrips = [
  {
    vehiclePlateNumber: "TR-2048",
    driverLicenseNumber: "LIC-1002",
    source: "North Depot",
    destination: "East Terminal",
    cargoDescription: "Pharmaceutical supplies",
    cargoWeightKg: 4800,
    distanceKm: 42.5,
    startDate: "2026-07-12T08:00:00.000Z",
    endDate: "2026-07-12T12:00:00.000Z",
    status: tripStatus.ACTIVE,
  },
  {
    vehiclePlateNumber: "TR-2111",
    driverLicenseNumber: "LIC-1001",
    source: "North Depot",
    destination: "West Hub",
    cargoDescription: "Passenger shuttle",
    cargoWeightKg: 900,
    distanceKm: 18.2,
    startDate: "2026-07-13T09:00:00.000Z",
    endDate: "2026-07-13T10:30:00.000Z",
    status: tripStatus.SCHEDULED,
  },
  {
    vehiclePlateNumber: "TR-4330",
    driverLicenseNumber: "LIC-1004",
    source: "South Depot",
    destination: "Regional Storehouse",
    cargoDescription: "Bulk packaging",
    cargoWeightKg: 6200,
    distanceKm: 57.1,
    startDate: "2026-07-08T07:00:00.000Z",
    endDate: "2026-07-08T11:40:00.000Z",
    status: tripStatus.COMPLETED,
  },
  {
    vehiclePlateNumber: "TR-3172",
    driverLicenseNumber: "LIC-1001",
    source: "East Depot",
    destination: "Maintenance Yard",
    cargoDescription: "Light cargo return",
    cargoWeightKg: 1200,
    distanceKm: 15.4,
    startDate: "2026-07-10T13:00:00.000Z",
    endDate: "2026-07-10T15:00:00.000Z",
    status: tripStatus.CANCELLED,
  },
];

async function main() {
  for (const user of demoUsers) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        passwordHash,
        name: user.name,
        role: user.role,
      },
      create: {
        email: user.email,
        passwordHash,
        name: user.name,
        role: user.role,
      },
    });
  }

  for (const driver of demoDrivers) {
    await prisma.driver.upsert({
      where: { licenseNumber: driver.licenseNumber },
      update: {
        fullName: driver.fullName,
        email: driver.email,
        phone: driver.phone,
        licenseExpiryDate: new Date(driver.licenseExpiryDate),
        status: driver.status,
        assignedVehicle: driver.assignedVehicle,
      },
      create: {
        fullName: driver.fullName,
        email: driver.email,
        phone: driver.phone,
        licenseNumber: driver.licenseNumber,
        licenseExpiryDate: new Date(driver.licenseExpiryDate),
        status: driver.status,
        assignedVehicle: driver.assignedVehicle,
      },
    });
  }

  await prisma.trip.deleteMany();

  const seededDrivers = await prisma.driver.findMany({ select: { id: true, licenseNumber: true } });
  const driverByLicense = new Map(seededDrivers.map((driver) => [driver.licenseNumber, driver.id]));

  for (const trip of demoTrips) {
    const driverId = driverByLicense.get(trip.driverLicenseNumber);
    if (!driverId) {
      continue;
    }

    await prisma.trip.create({
      data: {
        vehiclePlateNumber: trip.vehiclePlateNumber,
        driverId,
        source: trip.source,
        destination: trip.destination,
        cargoDescription: trip.cargoDescription,
        cargoWeightKg: trip.cargoWeightKg,
        distanceKm: trip.distanceKm,
        startDate: new Date(trip.startDate),
        endDate: new Date(trip.endDate),
        status: trip.status,
      },
    });
  }

  const activeTrip = demoTrips.find((trip) => trip.status === tripStatus.ACTIVE);
  if (activeTrip) {
    const activeDriverId = driverByLicense.get(activeTrip.driverLicenseNumber);
    if (activeDriverId) {
      await prisma.driver.update({
        where: { id: activeDriverId },
        data: { status: "ON_TRIP" },
      });
    }
  }

  console.log("Seeded demo users:");
  for (const user of demoUsers) {
    console.log(`  ${user.email} / ${user.password} (${user.role})`);
  }

  console.log("Seeded demo drivers:");
  for (const driver of demoDrivers) {
    console.log(`  ${driver.licenseNumber} - ${driver.fullName} (${driver.status})`);
  }

  console.log("Seeded demo trips:");
  for (const trip of demoTrips) {
    console.log(`  ${trip.vehiclePlateNumber} -> ${trip.destination} (${trip.status})`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
