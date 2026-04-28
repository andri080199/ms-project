import { PrismaClient, Role, RequestStatus, ReimbursementCategory, TripType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  await prisma.approvalHistory.deleteMany();
  await prisma.reimbursementItem.deleteMany();
  await prisma.reimbursementRequest.deleteMany();
  await prisma.overtimeRequest.deleteMany();
  await prisma.businessTripRequest.deleteMany();
  await prisma.user.deleteMany();
  await prisma.position.deleteMany();

  const positions = await Promise.all([
    prisma.position.create({ data: { name: 'Super Admin', baseRole: Role.ADMIN } }),
    prisma.position.create({ data: { name: 'Manager HR', baseRole: Role.HR } }),
    prisma.position.create({ data: { name: 'Supervisor Engineering', baseRole: Role.SPV } }),
    prisma.position.create({ data: { name: 'Supervisor Marketing', baseRole: Role.SPV } }),
    prisma.position.create({ data: { name: 'Staff Engineering', baseRole: Role.EMPLOYEE } }),
    prisma.position.create({ data: { name: 'Staff Marketing', baseRole: Role.EMPLOYEE } }),
  ]);
  const [posAdmin, posHr, posSpvEng, posSpvMkt, posStaffEng, posStaffMkt] = positions;

  const hashAdmin = await bcrypt.hash('admin123', 10);
  const hashHr = await bcrypt.hash('hr123', 10);
  const hashSpv = await bcrypt.hash('spv123', 10);
  const hashEmp = await bcrypt.hash('emp123', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@company.com',
      name: 'Admin System',
      password: hashAdmin,
      role: Role.ADMIN,
      phone: '081200000001',
      department: 'IT',
      positionId: posAdmin.id,
    },
  });

  const hr = await prisma.user.create({
    data: {
      email: 'hr@company.com',
      name: 'Rina HR',
      password: hashHr,
      role: Role.HR,
      phone: '081200000002',
      department: 'Human Resources',
      positionId: posHr.id,
    },
  });

  const spv1 = await prisma.user.create({
    data: {
      email: 'spv1@company.com',
      name: 'Budi Supervisor',
      password: hashSpv,
      role: Role.SPV,
      phone: '081200000003',
      department: 'Engineering',
      positionId: posSpvEng.id,
    },
  });

  const spv2 = await prisma.user.create({
    data: {
      email: 'spv2@company.com',
      name: 'Siti Supervisor',
      password: hashSpv,
      role: Role.SPV,
      phone: '081200000004',
      department: 'Marketing',
      positionId: posSpvMkt.id,
    },
  });

  const emp1 = await prisma.user.create({
    data: {
      email: 'emp1@company.com',
      name: 'Andi Karyawan',
      password: hashEmp,
      role: Role.EMPLOYEE,
      phone: '081200000005',
      department: 'Engineering',
      spvId: spv1.id,
      positionId: posStaffEng.id,
    },
  });

  const emp2 = await prisma.user.create({
    data: {
      email: 'emp2@company.com',
      name: 'Dewi Karyawan',
      password: hashEmp,
      role: Role.EMPLOYEE,
      phone: '081200000006',
      department: 'Engineering',
      spvId: spv1.id,
      positionId: posStaffEng.id,
    },
  });

  const emp3 = await prisma.user.create({
    data: {
      email: 'emp3@company.com',
      name: 'Eko Karyawan',
      password: hashEmp,
      role: Role.EMPLOYEE,
      phone: '081200000007',
      department: 'Marketing',
      spvId: spv2.id,
      positionId: posStaffMkt.id,
    },
  });

  const emp4 = await prisma.user.create({
    data: {
      email: 'emp4@company.com',
      name: 'Fitri Karyawan',
      password: hashEmp,
      role: Role.EMPLOYEE,
      phone: '081200000008',
      department: 'Marketing',
      spvId: spv2.id,
      positionId: posStaffMkt.id,
    },
  });

  const today = new Date();
  const day = (offset: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const at = (base: Date, h: number, m = 0) => {
    const d = new Date(base);
    d.setHours(h, m, 0, 0);
    return d;
  };

  // Overtime samples
  await prisma.overtimeRequest.create({
    data: {
      userId: emp1.id,
      date: day(-2),
      startTime: at(day(-2), 18),
      endTime: at(day(-2), 21),
      durationMinutes: 180,
      reason: 'Rilis fitur pembayaran batch untuk customer enterprise.',
      status: RequestStatus.SUBMITTED,
    },
  });

  await prisma.overtimeRequest.create({
    data: {
      userId: emp2.id,
      date: day(-5),
      startTime: at(day(-5), 19),
      endTime: at(day(-5), 22, 30),
      durationMinutes: 210,
      reason: 'Debug incident production di service order pipeline.',
      status: RequestStatus.SPV_APPROVED,
      spvApprovedAt: day(-4),
    },
  });

  const ot3 = await prisma.overtimeRequest.create({
    data: {
      userId: emp3.id,
      date: day(-10),
      startTime: at(day(-10), 17, 30),
      endTime: at(day(-10), 20),
      durationMinutes: 150,
      reason: 'Menyiapkan materi campaign akhir bulan bersama tim.',
      status: RequestStatus.DONE,
      spvApprovedAt: day(-9),
      hrApprovedAt: day(-8),
    },
  });
  await prisma.approvalHistory.createMany({
    data: [
      { approverId: spv2.id, stage: 'SPV', action: 'APPROVE', overtimeId: ot3.id, comment: 'Setuju.' },
      { approverId: hr.id, stage: 'HR', action: 'APPROVE', overtimeId: ot3.id },
    ],
  });

  // Reimbursement samples
  const rb1 = await prisma.reimbursementRequest.create({
    data: {
      userId: emp1.id,
      totalAmount: 450000,
      status: RequestStatus.SUBMITTED,
      items: {
        create: [
          {
            category: ReimbursementCategory.TRANSPORTATION,
            amount: 150000,
            transactionDate: day(-3),
            description: 'Grab ke kantor klien',
          },
          {
            category: ReimbursementCategory.MEAL,
            amount: 300000,
            transactionDate: day(-3),
            description: 'Makan siang dengan klien',
          },
        ],
      },
    },
  });

  const rb2 = await prisma.reimbursementRequest.create({
    data: {
      userId: emp4.id,
      totalAmount: 1250000,
      status: RequestStatus.DONE,
      hrApprovedAt: day(-6),
      items: {
        create: [
          {
            category: ReimbursementCategory.HOTEL,
            amount: 1250000,
            transactionDate: day(-8),
            description: 'Hotel meeting Surabaya (2 malam)',
          },
        ],
      },
    },
  });
  await prisma.approvalHistory.create({
    data: { approverId: hr.id, stage: 'HR', action: 'APPROVE', reimbursementId: rb2.id },
  });

  const rb3 = await prisma.reimbursementRequest.create({
    data: {
      userId: emp2.id,
      totalAmount: 80000,
      status: RequestStatus.REJECTED,
      rejectedReason: 'Bukti pembayaran tidak lengkap. Mohon lampirkan struk.',
      items: {
        create: [
          {
            category: ReimbursementCategory.TOLL,
            amount: 80000,
            transactionDate: day(-12),
            description: 'Tol ke site visit',
          },
        ],
      },
    },
  });
  await prisma.approvalHistory.create({
    data: {
      approverId: hr.id,
      stage: 'HR',
      action: 'REJECT',
      reimbursementId: rb3.id,
      comment: 'Bukti pembayaran tidak lengkap.',
    },
  });

  // Business trip samples
  await prisma.businessTripRequest.create({
    data: {
      userId: emp3.id,
      startDate: day(7),
      endDate: day(9),
      destination: 'Bandung',
      purpose: 'Meeting strategi partnership dengan distributor regional.',
      tripType: TripType.WEEKDAY,
      status: RequestStatus.SUBMITTED,
    },
  });

  await prisma.businessTripRequest.create({
    data: {
      userId: emp1.id,
      startDate: day(-3),
      endDate: day(-1),
      destination: 'Surabaya',
      purpose: 'Onsite deployment aplikasi klien enterprise.',
      tripType: TripType.WEEKDAY,
      status: RequestStatus.SPV_APPROVED,
      spvApprovedAt: day(-4),
    },
  });

  console.log('✅ Seed complete.');
  console.log('   Admin : admin@company.com / admin123');
  console.log('   HR    : hr@company.com / hr123');
  console.log('   SPV   : spv1@company.com, spv2@company.com / spv123');
  console.log('   Emp   : emp1..4@company.com / emp123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
