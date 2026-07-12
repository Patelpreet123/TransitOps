import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { updateVehicleByPlateNumber } from "../src/routes/vehicles.js";

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

const demoMaintenance = [
  {
    vehiclePlateNumber: "TR-2111",
    serviceType: "Brake inspection",
    scheduledDate: "2026-07-14T00:00:00.000Z",
    completionDate: null,
    cost: 780,
    notes: "Scheduled follow-up after long-haul use",
    status: "SCHEDULED" as const,
  },
  {
    vehiclePlateNumber: "TR-5155",
    serviceType: "Engine diagnostics",
    scheduledDate: "2026-07-09T00:00:00.000Z",
    completionDate: "2026-07-10T00:00:00.000Z",
    cost: 1250,
    notes: "Completed and returned to service",
    status: "COMPLETED" as const,
  },
  {
    vehiclePlateNumber: "TR-4288",
    serviceType: "Annual inspection",
    scheduledDate: "2026-07-11T00:00:00.000Z",
    completionDate: null,
    cost: 450,
    notes: "Cancelled because vehicle is retired",
    status: "CANCELLED" as const,
  },
];

const demoFuel = [
  {
    vehiclePlateNumber: "TR-2048",
    tripId: null,
    fuelType: "Diesel",
    liters: 125,
    unitPrice: 1.42,
    refueledAt: "2026-07-11T16:30:00.000Z",
    odometerKm: 18485,
    notes: "Post-route top-up",
    status: "RECORDED" as const,
  },
  {
    vehiclePlateNumber: "TR-2111",
    tripId: null,
    fuelType: "Diesel",
    liters: 98,
    unitPrice: 1.39,
    refueledAt: "2026-07-10T09:00:00.000Z",
    odometerKm: 16280,
    notes: "Pre-service replenishment",
    status: "RECORDED" as const,
  },
  {
    vehiclePlateNumber: "TR-4330",
    tripId: null,
    fuelType: "Diesel",
    liters: 110,
    unitPrice: 1.44,
    refueledAt: "2026-07-09T14:15:00.000Z",
    odometerKm: 26890,
    notes: "Regional fuel stop",
    status: "RECORDED" as const,
  },
];

const demoExpenses = [
  {
    title: "Toll charges - East corridor",
    category: "Tolls",
    amount: 84,
    expenseDate: "2026-07-12T00:00:00.000Z",
    vendor: "City Toll Authority",
    paymentMethod: "Card",
    vehiclePlateNumber: "TR-2048",
    tripId: null,
    notes: "Multiple passes during the morning delivery route",
    status: "APPROVED" as const,
  },
  {
    title: "Fuel card settlement",
    category: "Fuel",
    amount: 176.4,
    expenseDate: "2026-07-11T00:00:00.000Z",
    vendor: "North Depot Fuel Hub",
    paymentMethod: "Fuel Card",
    vehiclePlateNumber: "TR-2111",
    tripId: null,
    notes: "Linked to refuel event",
    status: "PAID" as const,
  },
  {
    title: "Inspection permit renewal",
    category: "Permits",
    amount: 240,
    expenseDate: "2026-07-08T00:00:00.000Z",
    vendor: "Transit Compliance Office",
    paymentMethod: "Transfer",
    vehiclePlateNumber: null,
    tripId: null,
    notes: "Pending final signoff",
    status: "PENDING" as const,
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
  await prisma.maintenanceRecord.deleteMany();
  await prisma.fuelRecord.deleteMany();
  await prisma.expenseRecord.deleteMany();

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

  for (const maintenance of demoMaintenance) {
    await prisma.maintenanceRecord.create({
      data: {
        vehiclePlateNumber: maintenance.vehiclePlateNumber,
        serviceType: maintenance.serviceType,
        scheduledDate: new Date(maintenance.scheduledDate),
        completionDate: maintenance.completionDate ? new Date(maintenance.completionDate) : null,
        cost: maintenance.cost,
        notes: maintenance.notes,
        status: maintenance.status,
      },
    });
  }

  for (const fuel of demoFuel) {
    await prisma.fuelRecord.create({
      data: {
        vehiclePlateNumber: fuel.vehiclePlateNumber,
        tripId: fuel.tripId,
        fuelType: fuel.fuelType,
        liters: fuel.liters,
        unitPrice: fuel.unitPrice,
        totalCost: fuel.liters * fuel.unitPrice,
        refueledAt: new Date(fuel.refueledAt),
        odometerKm: fuel.odometerKm,
        notes: fuel.notes,
        status: fuel.status,
      },
    });
  }

  for (const expense of demoExpenses) {
    await prisma.expenseRecord.create({
      data: {
        title: expense.title,
        category: expense.category,
        amount: expense.amount,
        expenseDate: new Date(expense.expenseDate),
        vendor: expense.vendor,
        paymentMethod: expense.paymentMethod,
        vehiclePlateNumber: expense.vehiclePlateNumber,
        tripId: expense.tripId,
        notes: expense.notes,
        status: expense.status,
      },
    });
  }

  updateVehicleByPlateNumber("TR-2111", { lifecycleStatus: "IN_SHOP", status: "maintenance" });
  updateVehicleByPlateNumber("TR-5155", { lifecycleStatus: "ACTIVE", status: "available" });
  updateVehicleByPlateNumber("TR-4288", { lifecycleStatus: "RETIRED", status: "maintenance" });

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

  console.log("Seeded demo maintenance records:");
  for (const maintenance of demoMaintenance) {
    console.log(`  ${maintenance.vehiclePlateNumber} - ${maintenance.serviceType} (${maintenance.status})`);
  }

  console.log("Seeded demo fuel records:");
  for (const fuel of demoFuel) {
    console.log(`  ${fuel.vehiclePlateNumber} - ${fuel.fuelType} (${fuel.liters}L)`);
  }

  console.log("Seeded demo expense records:");
  for (const expense of demoExpenses) {
    console.log(`  ${expense.title} (${expense.status})`);
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
