import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

  console.log("Seeded demo users:");
  for (const user of demoUsers) {
    console.log(`  ${user.email} / ${user.password} (${user.role})`);
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
