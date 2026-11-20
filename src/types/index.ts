export type UserRole = 'admin' | 'account_officer' | 'borrower';

export interface UserSession {
  id: number;
  member_no: string | null;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'inactive' | 'pending';
}

export interface LoanProduct {
  id: number;
  name: string;
  description: string;
  interest_rate: number;
  term_months: number;
  min_amount: number;
  max_amount: number;
  status: 'active' | 'inactive';
}

export type LoanStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'disbursed' | 'completed';

export interface LoanApplication {
  id: number;
  loan_code: string;
  borrower_id: number;
  borrower_name?: string;
  product_id: number;
  product_name?: string;
  amount_requested: number;
  term_months: number;
  interest_rate: number;
  purpose: string;
  monthly_amortization: number;
  status: LoanStatus;
  assigned_officer_id?: number | null;
  officer_notes?: string | null;
  application_date: string;
  created_at: string;
}

export interface RepaymentSchedule {
  id: number;
  loan_id: number;
  installment_no: number;
  due_date: string;
  principal_amount: number;
  interest_amount: number;
  total_due: number;
  amount_paid: number;
  status: 'unpaid' | 'partially_paid' | 'paid' | 'overdue';
}
