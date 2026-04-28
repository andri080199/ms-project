import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const pos = await prisma.position.findUnique({
    where: { name: 'People & GA Officer' },
    select: { id: true },
  });
  if (!pos) {
    console.log('Posisi "People & GA Officer" belum ada — skip.');
    return;
  }
  const updated = await prisma.user.updateMany({
    where: { positionId: pos.id, isSuperAdmin: false },
    data: { isSuperAdmin: true },
  });
  console.log(`User dengan posisi People & GA Officer di-set super admin: ${updated.count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
