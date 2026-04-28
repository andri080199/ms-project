import { prisma } from '@/lib/prisma';
import { fireAndForgetMail } from '@/lib/mailer';

export type RequestKind = 'overtime' | 'reimbursement' | 'business-trip' | 'leave';

const KIND_LABEL: Record<RequestKind, string> = {
  overtime: 'Lembur',
  reimbursement: 'Reimbursement',
  'business-trip': 'Perjalanan Dinas',
  leave: 'Cuti',
};

const KIND_PATH: Record<RequestKind, string> = {
  overtime: '/overtime',
  reimbursement: '/reimbursement',
  'business-trip': '/business-trip',
  leave: '/leave',
};

type Submitter = {
  id: string;
  name: string;
  email: string;
  spvId: string | null;
  department: string | null;
};

type SubmissionInput = {
  kind: RequestKind;
  requestId: string;
  summary: string[];
  submitter: Submitter;
};

type DecisionInput = {
  kind: RequestKind;
  requestId: string;
  summary: string[];
  submitter: Submitter;
  action: 'APPROVE' | 'REJECT';
  stage: 'SPV' | 'HR';
  decidedBy: { id: string; name: string };
  comment: string | undefined;
  isFinalApproval: boolean;
};

function appUrl() {
  return process.env.APP_URL ?? 'http://localhost:3000';
}

function wrapHtml(opts: {
  badgeColor: string;
  badgeLabel: string;
  title: string;
  greeting: string;
  intro: string;
  rows: Array<[string, string]>;
  cta?: { label: string; href: string };
  footerNote?: string;
}) {
  const rowsHtml = opts.rows
    .map(
      ([k, v]) => `
        <tr>
          <td style="padding: 8px 12px; color: #64748b; font-size: 13px; vertical-align: top; width: 140px;">${k}</td>
          <td style="padding: 8px 12px; color: #0f172a; font-size: 14px; font-weight: 500;">${v}</td>
        </tr>`,
    )
    .join('');

  const ctaHtml = opts.cta
    ? `<div style="margin-top: 20px; text-align: center;">
        <a href="${opts.cta.href}" style="display: inline-block; padding: 10px 20px; background: linear-gradient(135deg, #1F6F5F, #2FA084); color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">${opts.cta.label}</a>
      </div>`
    : '';

  return `
    <div style="font-family: -apple-system, system-ui, 'Segoe UI', sans-serif; padding: 24px; background: #f1f5f9;">
      <div style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 14px; padding: 28px; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
        <div style="display: inline-block; padding: 4px 12px; background: ${opts.badgeColor}; color: #fff; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 12px;">${opts.badgeLabel}</div>
        <h2 style="margin: 0 0 8px; color: #0f172a; font-size: 20px;">${opts.title}</h2>
        <p style="color: #475569; line-height: 1.6; margin: 0 0 4px;">${opts.greeting}</p>
        <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">${opts.intro}</p>
        <table style="width: 100%; border-collapse: collapse; background: #f8fafc; border-radius: 10px; overflow: hidden;">
          ${rowsHtml}
        </table>
        ${ctaHtml}
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0 12px;">
        <div style="font-size: 11px; color: #94a3b8; text-align: center;">${opts.footerNote ?? 'Email otomatis dari FIERSA (Finance, Integrated Employee Reimbursement System & Approval) — jangan reply.'}</div>
      </div>
    </div>
  `;
}

function getUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
}

const REIMBURSEMENT_APPROVER_POSITION = 'People & GA Officer';

async function getReimbursementApprovers() {
  const rows = await prisma.user.findMany({
    where: { position: { name: REIMBURSEMENT_APPROVER_POSITION } },
    select: { name: true, email: true },
  });
  return rows.filter((r) => !!r.email);
}

function summaryRows(submitter: Submitter, summary: string[]): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ['Karyawan', `${submitter.name}${submitter.department ? ` (${submitter.department})` : ''}`],
  ];
  for (const line of summary) {
    const [k, ...rest] = line.split(':');
    rows.push([k.trim(), rest.join(':').trim()]);
  }
  return rows;
}

export async function notifyNewSubmission(input: SubmissionInput) {
  try {
    const { kind, requestId, summary, submitter } = input;
    const label = KIND_LABEL[kind];

    let recipients: string[] = [];
    let greetingName = '';

    if (kind === 'reimbursement') {
      const approvers = await getReimbursementApprovers();
      if (approvers.length === 0) {
        console.warn(`[notifyNewSubmission] tidak ada user dengan posisi "${REIMBURSEMENT_APPROVER_POSITION}" — reimbursement notif di-skip`);
        return;
      }
      recipients = approvers.map((a) => a.email);
      greetingName = approvers.length === 1 ? approvers[0].name : `Tim ${REIMBURSEMENT_APPROVER_POSITION}`;
    } else {
      if (!submitter.spvId) {
        console.warn(`[notifyNewSubmission] submitter ${submitter.id} belum punya approval — notif di-skip`);
        return;
      }
      const approver = await getUser(submitter.spvId);
      if (!approver?.email) {
        console.warn(`[notifyNewSubmission] approver ${submitter.spvId} tidak ditemukan / email kosong`);
        return;
      }
      recipients = [approver.email];
      greetingName = approver.name;
    }

    const html = wrapHtml({
      badgeColor: '#2FA084',
      badgeLabel: 'Pengajuan Baru',
      title: `Pengajuan ${label} Baru`,
      greeting: `Halo ${greetingName},`,
      intro: `Ada pengajuan <b>${label.toLowerCase()}</b> baru menunggu persetujuan Anda.`,
      rows: summaryRows(submitter, summary),
      cta: { label: 'Buka Persetujuan', href: `${appUrl()}/approvals` },
    });

    fireAndForgetMail(
      {
        to: recipients,
        subject: `[FIERSA] Pengajuan ${label} baru dari ${submitter.name}`,
        html,
      },
      `new-submission:${kind}:${requestId}`,
    );
  } catch (err) {
    console.error('[notifyNewSubmission] error', err);
  }
}

export function notifyDecisionToSubmitter({
  kind,
  requestId,
  summary,
  submitter,
  action,
  stage,
  decidedBy,
  comment,
  isFinalApproval,
}: DecisionInput) {
  if (!submitter.email) return;
  const label = KIND_LABEL[kind];
  const isApprove = action === 'APPROVE';
  const stageLabel = stage === 'SPV' ? 'atasan' : 'HR';

  const rows = summaryRows(submitter, summary);
  rows.push(['Diputuskan oleh', `${decidedBy.name} (${stageLabel})`]);
  if (comment) rows.push([isApprove ? 'Catatan' : 'Alasan', comment]);

  let badgeColor: string;
  let badgeLabel: string;
  let title: string;
  let intro: string;
  let subject: string;

  if (!isApprove) {
    badgeColor = '#dc2626';
    badgeLabel = 'Ditolak';
    title = `Pengajuan ${label} Ditolak`;
    intro = `Pengajuan <b>${label.toLowerCase()}</b> Anda telah <b>ditolak</b> oleh ${stageLabel}.`;
    subject = `[FIERSA] Pengajuan ${label} Anda ditolak`;
  } else if (isFinalApproval) {
    badgeColor = '#16a34a';
    badgeLabel = 'Disetujui';
    title = `Pengajuan ${label} Disetujui`;
    intro = `Pengajuan <b>${label.toLowerCase()}</b> Anda telah <b>disetujui</b> sepenuhnya. Selesai.`;
    subject = `[FIERSA] Pengajuan ${label} Anda disetujui`;
  } else {
    badgeColor = '#0ea5e9';
    badgeLabel = 'Lolos Tahap SPV';
    title = `Pengajuan ${label} Lolos Tahap SPV`;
    intro = `Pengajuan <b>${label.toLowerCase()}</b> Anda telah disetujui oleh ${stageLabel} dan diteruskan ke HR untuk persetujuan akhir.`;
    subject = `[FIERSA] Pengajuan ${label} Anda lolos tahap SPV`;
  }

  const html = wrapHtml({
    badgeColor,
    badgeLabel,
    title,
    greeting: `Halo ${submitter.name},`,
    intro,
    rows,
    cta: { label: `Lihat Detail`, href: `${appUrl()}${KIND_PATH[kind]}` },
  });

  fireAndForgetMail(
    {
      to: submitter.email,
      subject,
      html,
    },
    `decision:${kind}:${stage}:${action}:${requestId}`,
  );
}
