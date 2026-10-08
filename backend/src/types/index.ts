export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
export type EnrollmentStatus =
  | 'PENDING'
  | 'PAID'
  | 'INVITED'
  | 'ENROLLED'
  | 'FAILED'
  | 'REMOVAL_PENDING'
  | 'REMOVED';

export interface LeadRecord {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  email_normalized: string;
  payment_status: PaymentStatus;
  enrollment_status: EnrollmentStatus;
  razorpay_customer_id?: string | null;
  latest_order_id?: string | null;
  google_classroom_course_id?: string | null;
  google_classroom_user_id?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentRecord {
  id: string;
  lead_id: string;
  razorpay_order_id: string;
  razorpay_payment_id?: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  signature?: string | null;
  paid_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface EnrollmentRecord {
  id: string;
  payment_id: string;
  user_id?: string | null;
  email: string;
  course_id: string;
  status: 'PAID' | 'INVITED' | 'ENROLLED' | 'FAILED';
  attempts: number;
  last_error?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ClassroomEnrollmentRecord {
  id: string;
  lead_id: string;
  course_id: string;
  google_email: string;
  google_user_id?: string | null;
  invitation_id?: string | null;
  status: EnrollmentStatus;
  attempt_count: number;
  last_error_code?: string | null;
  last_error_message?: string | null;
  enrolled_at?: Date | null;
  removed_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentEventRecord {
  id: string;
  event_id: string;
  event_type: string;
  payload_hash: string;
  processed: boolean;
  processed_at?: Date | null;
  created_at: Date;
}

export interface CheckoutOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export interface EnrollmentStatusResponse {
  status:
  | 'PAYMENT_PENDING'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'ENROLLMENT_PENDING'
  | 'INVITED'
  | 'ENROLLMENT_SUCCESS'
  | 'ENROLLMENT_FAILED'
  | 'INVALID_GOOGLE_EMAIL'
  | 'ALREADY_ENROLLED'
  | 'REFUNDED'
  | 'NOT_FOUND';
  message: string;
  classroomUrl?: string;
  email?: string;
  orderId?: string;
}

