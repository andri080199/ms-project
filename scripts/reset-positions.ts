import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SEED: Array<{ name: string; department: string }> = [
  { name: 'AI Software Engineer', department: 'Technology' },
  { name: 'Associate Software Engineer', department: 'Technology' },
  { name: 'CEO', department: 'Board' },
  { name: 'COO', department: 'Board' },
  { name: 'CTO', department: 'Board' },
  { name: 'Engineering Manager', department: 'Technology' },
  { name: 'FAT Manager', department: 'OPS - General Support' },
  { name: 'Full Stack Engineer', department: 'Technology' },
  { name: 'Jr. Technical Project Manager', department: 'OPS - Project' },
  { name: 'Jr. TechOps', department: 'OPS - Project' },
  { name: 'Lead Product Manager', department: 'Technology' },
  { name: 'OB', department: 'OPS - General Support' },
  { name: 'People & GA Officer', department: 'People & Culture' },
  { name: 'Product Manager', department: 'Technology' },
  { name: 'Solution Engineer', department: 'Technology' },
  { name: 'Solution Manager', department: 'Technology' },
  { name: 'Sr. AI Software Engineer', department: 'Technology' },
  { name: 'Sr. FAT', department: 'OPS - General Support' },
  { name: 'Sr. Software Engineer', department: 'Technology' },
  { name: 'Technical Project Manager', department: 'OPS - Project' },
  { name: 'Technical Project Manager Supervisor', department: 'OPS - Project' },
  { name: 'Vision AI Engineer', department: 'Technology' },
];

async function main() {
  const nulled = await prisma.user.updateMany({
    where: { positionId: { not: null } },
    data: { positionId: null, department: null },
  });
  console.log(`User di-unassign dari posisi lama: ${nulled.count}`);

  const deleted = await prisma.position.deleteMany({});
  console.log(`Posisi lama dihapus: ${deleted.count}`);

  const created = await prisma.position.createMany({ data: SEED });
  console.log(`Posisi baru dibuat: ${created.count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
