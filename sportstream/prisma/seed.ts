/**
 * Seed script — FICTIONAL DEMO DATA ONLY.
 * No real broadcasting rights, real teams' logos, or real payment
 * credentials are used here. Safe for local/dev environments only.
 */
import { PrismaClient, UserRole, AccountStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding fictional demo data...');

  const adminPasswordHash = await argon2.hash('DemoAdminPass123!');
  await prisma.user.upsert({
    where: { email: 'admin@demo.sportstream.test' },
    update: {},
    create: {
      email: 'admin@demo.sportstream.test',
      passwordHash: adminPasswordHash,
      fullName: 'Demo Admin',
      role: UserRole.ADMIN,
      status: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });

  const football = await prisma.sport.upsert({
    where: { slug: 'football' },
    update: {},
    create: {
      name: 'Football',
      slug: 'football',
      config: { periodLabels: ['1st Half', '2nd Half'], scoreUnit: 'goal' },
    },
  });

  const uganda = await prisma.country.upsert({
    where: { isoCode2: 'UG' },
    update: {},
    create: {
      name: 'Uganda',
      isoCode2: 'UG',
      isoCode3: 'UGA',
      timezone: 'Africa/Kampala',
      currency: 'UGX',
    },
  });

  await prisma.subscriptionPlan.upsert({
    where: { code: 'DEMO_MONTHLY_ALLACCESS' },
    update: {},
    create: {
      name: 'Demo All-Access Monthly',
      code: 'DEMO_MONTHLY_ALLACCESS',
      interval: 'MONTHLY',
      priceAmount: 25000,
      currency: 'UGX',
      scope: 'ALL_ACCESS',
    },
  });

  console.log('Seed complete:', {
    sport: football.slug,
    country: uganda.isoCode2,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
