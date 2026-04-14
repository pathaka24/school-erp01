import { z } from 'zod';

// ─── Auth ───
export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

// ─── Fee Payment ───
export const feePaySchema = z.object({
  studentId: z.string().uuid(),
  feeStructureId: z.string().uuid(),
  amountPaid: z.number().positive('Amount must be positive'),
  paymentMethod: z.string().optional(),
  transactionId: z.string().optional(),
  receiptNumber: z.string().min(1, 'Receipt number required'),
  discount: z.number().min(0).optional(),
  scholarshipAmt: z.number().min(0).optional(),
  familyReceiptId: z.string().optional(),
});

// ─── Fee Ledger Charge ───
export const ledgerChargeSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1, 'At least one student required'),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM format'),
  category: z.string().optional(),
  description: z.string().optional(),
  amount: z.number().positive('Amount must be positive'),
});

// ─── Fee Ledger Deposit ───
export const ledgerDepositSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.number().positive(),
  paymentMethod: z.string().min(1, 'Payment method required'),
  receivedBy: z.string().optional(),
  splitEvenly: z.boolean().optional(),
});

// ─── Bulk Charge ───
export const bulkChargeSchema = z.object({
  classId: z.string().uuid(),
  sectionId: z.string().uuid().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  category: z.string().min(1),
  description: z.string().optional(),
  amount: z.number().positive(),
});

// ─── Family Payment ───
export const familyPaySchema = z.object({
  payments: z.array(z.object({
    studentId: z.string().uuid(),
    feeStructureId: z.string().uuid(),
    amount: z.number().positive(),
  })).min(1),
  paymentMethod: z.string().min(1),
  transactionId: z.string().optional(),
});

// ─── Attendance Mark ───
export const attendanceMarkSchema = z.object({
  date: z.string().min(1, 'Date required'),
  records: z.array(z.object({
    studentId: z.string().uuid(),
    status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
    remarks: z.string().optional(),
  })).min(1, 'At least one record required'),
});

// ─── Grade Submit ───
export const gradeSubmitSchema = z.object({
  examSubjectId: z.string().uuid(),
  grades: z.array(z.object({
    studentId: z.string().uuid(),
    marksObtained: z.number().min(0),
    grade: z.string().optional(),
    remarks: z.string().optional(),
  })).min(1),
});

// ─── Academic Rollover ───
export const rolloverSchema = z.object({
  fromYear: z.string().regex(/^\d{4}-\d{4}$/),
  toYear: z.string().regex(/^\d{4}-\d{4}$/),
});

// Helper: validate and return parsed data or error Response
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): { data: T } | { error: Response } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
    return { error: Response.json({ error: 'Validation failed', details: errors }, { status: 400 }) };
  }
  return { data: result.data };
}
