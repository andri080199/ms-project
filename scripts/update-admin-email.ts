import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({
    where: { email: 'admin@company.com' },
    select: { id: true, name: true, email: true },
  });
  if (!existing) {
    console.log('Admin dengan email admin@company.com tidak ditemukan.');
    return;
  }
  const updated = await prisma.user.update({
    where: { id: existing.id },
    data: { email: 'andri@nodeflux.io' },
    select: { id: true, name: true, email: true, role: true },
  });
  console.log('Updated:', updated);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
