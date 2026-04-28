import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  try {
    const data = await prisma.user.findMany({
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        employeeId: true,
        email: true,
        name: true,
        role: true,
        isSuperAdmin: true,
        phone: true,
        department: true,
        spvId: true,
        positionId: true,
        position: { select: { id: true, name: true, baseRole: true, department: true } },
        spv: { select: { id: true, name: true } },
        createdAt: true,
      },
    });
    console.log(`OK — ${data.length} users`);
    console.log(JSON.stringify(data[0], null, 2));
  } catch (e) {
    console.error('ERROR:', e);
  } finally {
    await prisma.$disconnect();
  }
})();
