import { PrismaClient, type Role } from '@prisma/client';

const prisma = new PrismaClient();

const SEED: Array<{ name: string; department: string; baseRole: Role }> = [
  { name: 'AI Software Engineer', department: 'Technology', baseRole: 'EMPLOYEE' },
  { name: 'Associate Software Engineer', department: 'Technology', baseRole: 'EMPLOYEE' },
  { name: 'CEO', department: 'Board', baseRole: 'EMPLOYEE' },
  { name: 'COO', department: 'Board', baseRole: 'EMPLOYEE' },
  { name: 'CTO', department: 'Board', baseRole: 'EMPLOYEE' },
  { name: 'Engineering Manager', department: 'Technology', baseRole: 'EMPLOYEE' },
  { name: 'FAT Manager', department: 'OPS - General Support', baseRole: 'EMPLOYEE' },
  { name: 'Full Stack Engineer', department: 'Technology', baseRole: 'EMPLOYEE' },
  { name: 'Jr. Technical Project Manager', department: 'OPS - Project', baseRole: 'EMPLOYEE' },
  { name: 'Jr. TechOps', department: 'OPS - Project', baseRole: 'EMPLOYEE' },
  { name: 'Lead Product Manager', department: 'Technology', baseRole: 'EMPLOYEE' },
  { name: 'OB', department: 'OPS - General Support', baseRole: 'EMPLOYEE' },
  { name: 'People & GA Officer', department: 'People & Culture', baseRole: 'EMPLOYEE' },
  { name: 'Product Manager', department: 'Technology', baseRole: 'EMPLOYEE' },
  { name: 'Solution Engineer', department: 'Technology', baseRole: 'EMPLOYEE' },
  { name: 'Solution Manager', department: 'Technology', baseRole: 'EMPLOYEE' },
  { name: 'Sr. AI Software Engineer', department: 'Technology', baseRole: 'EMPLOYEE' },
  { name: 'Sr. FAT', department: 'OPS - General Support', baseRole: 'EMPLOYEE' },
  { name: 'Sr. Software Engineer', department: 'Technology', baseRole: 'EMPLOYEE' },
  { name: 'Technical Project Manager', department: 'OPS - Project', baseRole: 'EMPLOYEE' },
  { name: 'Technical Project Manager Supervisor', department: 'OPS - Project', baseRole: 'EMPLOYEE' },
  { name: 'Vision AI Engineer', department: 'Technology', baseRole: 'EMPLOYEE' },
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
