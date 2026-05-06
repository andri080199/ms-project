import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

const POSITIONS: Array<{ name: string; baseRole: Role; department: string }> = [
  // Board
  { name: 'CEO', baseRole: Role.ADMIN, department: 'Board' },
  { name: 'CTO', baseRole: Role.ADMIN, department: 'Board' },
  { name: 'COO', baseRole: Role.ADMIN, department: 'Board' },
  // Technology
  { name: 'Engineering Manager', baseRole: Role.SPV, department: 'Technology' },
  { name: 'Solution Manager', baseRole: Role.SPV, department: 'Technology' },
  { name: 'Lead Product Manager', baseRole: Role.SPV, department: 'Technology' },
  { name: 'Product Manager', baseRole: Role.SPV, department: 'Technology' },
  { name: 'Sr. Software Engineer', baseRole: Role.EMPLOYEE, department: 'Technology' },
  { name: 'Sr. AI Software Engineer', baseRole: Role.EMPLOYEE, department: 'Technology' },
  { name: 'AI Software Engineer', baseRole: Role.EMPLOYEE, department: 'Technology' },
  { name: 'Full Stack Engineer', baseRole: Role.EMPLOYEE, department: 'Technology' },
  { name: 'Solution Engineer', baseRole: Role.EMPLOYEE, department: 'Technology' },
  { name: 'Associate Software Engineer', baseRole: Role.EMPLOYEE, department: 'Technology' },
  // OPS - Project
  { name: 'Technical Project Manager Supervisor', baseRole: Role.SPV, department: 'OPS - Project' },
  { name: 'Technical Project Manager', baseRole: Role.SPV, department: 'OPS - Project' },
  { name: 'Jr. Technical Project Manager', baseRole: Role.EMPLOYEE, department: 'OPS - Project' },
  { name: 'Jr. TechOps', baseRole: Role.EMPLOYEE, department: 'OPS - Project' },
  // OPS - General Support
  { name: 'FAT Manager', baseRole: Role.SPV, department: 'OPS - General Support' },
  { name: 'Sr. FAT', baseRole: Role.EMPLOYEE, department: 'OPS - General Support' },
  { name: 'OB', baseRole: Role.EMPLOYEE, department: 'OPS - General Support' },
  // People & Culture
  { name: 'People & GA Officer', baseRole: Role.HR, department: 'People & Culture' },
];

const LEGACY_REMAP: Record<string, string> = {
  'Super Admin': 'CTO',
  'Manager HR': 'People & GA Officer',
  'Supervisor Engineering': 'Engineering Manager',
  'Supervisor Marketing': 'Technical Project Manager Supervisor',
  'Staff Engineering': 'Sr. Software Engineer',
  'Staff Marketing': 'Jr. Technical Project Manager',
};

async function main() {
  for (const p of POSITIONS) {
    await prisma.position.upsert({
      where: { name: p.name },
      create: p,
      update: { baseRole: p.baseRole, department: p.department },
    });
  }
  console.log(`✓ Upsert ${POSITIONS.length} positions Nodeflux`);

  const targetByName = new Map<string, string>();
  for (const p of await prisma.position.findMany({ select: { id: true, name: true } })) {
    targetByName.set(p.name, p.id);
  }

  for (const [legacy, target] of Object.entries(LEGACY_REMAP)) {
    const legacyPos = await prisma.position.findUnique({ where: { name: legacy } });
    if (!legacyPos) continue;
    const targetId = targetByName.get(target);
    if (!targetId) {
      console.warn(`  ! target "${target}" tidak ada — skip remap dari "${legacy}"`);
      continue;
    }
    const moved = await prisma.user.updateMany({
      where: { positionId: legacyPos.id },
      data: { positionId: targetId },
    });
    await prisma.position.delete({ where: { id: legacyPos.id } });
    console.log(`  - "${legacy}" → "${target}" (${moved.count} user dipindah, position lama dihapus)`);
  }

  const remaining = await prisma.position.findMany({
    where: { name: { notIn: POSITIONS.map((p) => p.name) } },
    select: { name: true, _count: { select: { users: true } } },
  });
  if (remaining.length > 0) {
    console.log('  ! Position di luar list Nodeflux yang masih ada:');
    for (const r of remaining) {
      console.log(`    · "${r.name}" (${r._count.users} user)`);
    }
  } else {
    console.log('✓ Tidak ada position legacy tersisa');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
