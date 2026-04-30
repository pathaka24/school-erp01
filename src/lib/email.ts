// Email helper. Uses Resend if RESEND_API_KEY is set; otherwise logs to console (no-op).
// To enable: sign up at resend.com (free tier: 3,000 emails/month), add to env:
//   RESEND_API_KEY=re_xxxxx
//   EMAIL_FROM=noreply@yourschool.in   (must be a verified domain in Resend)

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@school.local';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!RESEND_API_KEY) {
    // No-op fallback: log to server console so you can see what would have been sent during dev.
    console.log('[EMAIL] (no RESEND_API_KEY set — would send)', {
      to: opts.to,
      subject: opts.subject,
      preview: (opts.text || opts.html || '').slice(0, 120),
    });
    return { ok: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: Array.isArray(opts.to) ? opts.to : [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        reply_to: opts.replyTo,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[EMAIL] Resend error', res.status, errorText);
      return { ok: false, error: `Resend ${res.status}: ${errorText}` };
    }

    const data = await res.json();
    return { ok: true, id: data.id };
  } catch (e: any) {
    console.error('[EMAIL] send failed', e);
    return { ok: false, error: e.message };
  }
}

// ─── Pre-built templates ───

export function leaveDecisionEmail(opts: {
  parentName: string;
  studentName: string;
  fromDate: string;
  toDate: string;
  status: 'APPROVED' | 'REJECTED';
  reviewNote?: string;
  reviewerName?: string;
}) {
  const status = opts.status === 'APPROVED' ? 'approved' : 'rejected';
  const color = opts.status === 'APPROVED' ? '#16a34a' : '#dc2626';
  return {
    subject: `Leave request ${status}: ${opts.studentName} (${opts.fromDate} – ${opts.toDate})`,
    html: `
      <div style="font-family:system-ui;max-width:560px;margin:auto;padding:24px;color:#1e293b">
        <h2 style="color:${color};margin-top:0">Leave ${status}</h2>
        <p>Dear ${opts.parentName},</p>
        <p>The leave request for <strong>${opts.studentName}</strong> from <strong>${opts.fromDate}</strong> to <strong>${opts.toDate}</strong> has been <strong style="color:${color}">${status}</strong>${opts.reviewerName ? ` by ${opts.reviewerName}` : ''}.</p>
        ${opts.reviewNote ? `<p style="background:#f1f5f9;padding:12px;border-radius:8px"><strong>Note:</strong> ${opts.reviewNote}</p>` : ''}
        <p style="color:#64748b;font-size:13px;margin-top:24px">— Pathak Educational Foundation School</p>
      </div>
    `,
    text: `Leave ${status} for ${opts.studentName} (${opts.fromDate} – ${opts.toDate})${opts.reviewNote ? `. Note: ${opts.reviewNote}` : ''}`,
  };
}

export function admissionWelcomeEmail(opts: {
  studentName: string;
  parentName: string;
  className: string;
  admissionNo: string;
}) {
  return {
    subject: `Welcome to Pathak Educational Foundation School — ${opts.studentName}`,
    html: `
      <div style="font-family:system-ui;max-width:560px;margin:auto;padding:24px;color:#1e293b">
        <h2 style="color:#1e40af;margin-top:0">Welcome aboard 🎓</h2>
        <p>Dear ${opts.parentName},</p>
        <p>We're delighted to confirm <strong>${opts.studentName}</strong>'s admission to <strong>${opts.className}</strong>.</p>
        <p>Admission number: <strong>${opts.admissionNo}</strong></p>
        <p>Log in to the parent portal to track attendance, fees, exam results, daily diary, and more.</p>
        <p style="color:#64748b;font-size:13px;margin-top:24px">— Pathak Educational Foundation School</p>
      </div>
    `,
    text: `Welcome! ${opts.studentName} has been admitted to ${opts.className}. Admission number: ${opts.admissionNo}.`,
  };
}

export function feeReminderEmail(opts: {
  parentName: string;
  studentName: string;
  amountDue: number;
  dueDate: string;
}) {
  return {
    subject: `Fee reminder for ${opts.studentName} — ₹${opts.amountDue} due on ${opts.dueDate}`,
    html: `
      <div style="font-family:system-ui;max-width:560px;margin:auto;padding:24px;color:#1e293b">
        <h2 style="color:#d97706;margin-top:0">Fee reminder</h2>
        <p>Dear ${opts.parentName},</p>
        <p>This is a friendly reminder that <strong>₹${opts.amountDue}</strong> is due for <strong>${opts.studentName}</strong> by <strong>${opts.dueDate}</strong>.</p>
        <p>Please log in to the parent portal to view the breakdown and pay.</p>
        <p style="color:#64748b;font-size:13px;margin-top:24px">— Pathak Educational Foundation School</p>
      </div>
    `,
    text: `Fee reminder: ₹${opts.amountDue} due for ${opts.studentName} by ${opts.dueDate}.`,
  };
}
