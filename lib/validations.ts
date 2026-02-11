import { z } from 'zod'

// Bed validation
const bedSchema = z.object({
  name: z.string().min(1, 'Bed name is required'),
  price: z.string().refine((val) => {
    const num = parseFloat(val)
    return !isNaN(num) && num >= 0
  }, 'Bed price must be a valid number'),
})

// Room validation
export const roomSchema = z.object({
  name: z.string().min(1, 'Room name is required'),
  floor: z.string().optional(),
  beds: z.array(bedSchema).min(1, 'At least one bed is required'),
  totalBeds: z.string().refine((val) => {
    const num = parseInt(val)
    return !isNaN(num) && num > 0
  }, 'Total beds must be a positive number'),
  monthlyRentPerBed: z.string().optional(),
})

// Student validation
export const studentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone is required'),
  guardianName: z.string().optional(),
  guardianPhone: z.string().optional(),
  roomId: z.string().min(1, 'Room is required'),
  bedNumber: z.string().min(1, 'Bed is required'),
  joiningDate: z.string().min(1, 'Joining date is required'),
  monthlyRent: z.string().optional(),
  securityDeposit: z.string().optional(),
  unionFee: z.string().optional(),
  initialRentPaid: z.string().optional(),
})


// Payment validation
export const paymentSchema = z.object({
  billingMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Billing month must be in YYYY-MM format').optional(),
  paidAmount: z.string().refine((val) => {
    const num = parseFloat(val)
    return !isNaN(num) && num > 0
  }, 'Paid amount must be a positive number'),
  paymentMethod: z.enum(['cash', 'bkash', 'bank']),
  transactionId: z.string().optional(),
  notes: z.string().optional(),
  isAdvance: z.boolean().optional(),
}).refine((data) => {
  // If not advance, billing month is required
  if (!data.isAdvance && !data.billingMonth) {
    return false
  }
  return true
}, {
  message: 'Billing month is required for regular payments',
  path: ['billingMonth'],
})

// Admission validation
export const admissionSchema = z.object({
  studentName: z.string().min(1, 'Student name is required'),
  phone: z.string().min(1, 'Phone is required'),
  guardianName: z.string().optional(),
  guardianPhone: z.string().optional(),
  course: z.string().min(1, 'Course is required'),
  batch: z.string().min(1, 'Batch is required'),
  totalFee: z.string().refine((val) => {
    const num = parseFloat(val)
    return !isNaN(num) && num >= 0
  }, 'Total fee must be a valid number'),
  admissionDate: z.string().min(1, 'Admission date is required'),
  paidAmount: z.string().optional(),
})

// Admission payment validation
export const admissionPaymentSchema = z.object({
  paidAmount: z.string().refine((val) => {
    const num = parseFloat(val)
    return !isNaN(num) && num > 0
  }, 'Paid amount must be a positive number'),
  paymentMethod: z.enum(['cash', 'bkash', 'bank']),
  transactionId: z.string().optional(),
  notes: z.string().optional(),
})
