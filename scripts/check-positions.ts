import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const positions = await prisma.position.findMany({
    include: { _count: { select: { users: true } } },
  });
  console.log(`Total posisi lama: ${positions.length}`);
  for (const p of positions) {
    console.log(`- ${p.name} (${p.baseRole}, dept=${p.department ?? '—'}) → ${p._count.users} akun`);
  }
  const usersWithPos = await prisma.user.count({ where: { positionId: { not: null } } });
  console.log(`\nTotal user dengan positionId: ${usersWithPos}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
