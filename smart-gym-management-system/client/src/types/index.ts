export type Role = 'super_admin' | 'gym_admin' | 'receptionist' | 'trainer' | 'member';

export interface User { id: string; name: string; email: string; role: Role; isActive: boolean; lastLoginAt?: string; createdAt?: string; }

export interface MembershipPlan {
  _id: string; name: string; description?: string;
  planType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'custom';
  durationDays: number; price: number; features: string[]; status: 'active' | 'inactive';
}

export interface Membership {
  _id: string; member: string | MemberRef; plan: MembershipPlan | string;
  startDate: string; expiryDate: string;
  status: 'active' | 'expired' | 'suspended' | 'cancelled';
  pricePaid: number; isCurrent: boolean; remainingDays?: number;
}

export interface MemberRef { _id: string; fullName: string; memberId: string; email?: string; profilePicture?: string; }

export interface Member {
  _id: string; memberId: string; fullName: string; email: string; phone: string;
  profilePicture?: string; gender?: string; dateOfBirth?: string; address?: string;
  emergencyContact?: { name?: string; phone?: string; relationship?: string };
  registrationDate: string; status: 'active' | 'inactive' | 'suspended';
  assignedTrainer?: { _id: string; fullName: string; trainerId: string } | string;
  faceEnrolled: boolean; notes?: string;
  currentMembership?: Membership | null; membershipPlan?: string | null;
  membershipStatus?: string; membershipExpiryDate?: string;
}

export interface Trainer {
  _id: string; trainerId: string; fullName: string; email: string; phone: string;
  specialization: string; experienceYears: number; salary?: number; profileImage?: string;
  availability?: string; isActive: boolean; assignedCount?: number;
  assignedMembers?: Member[];
}

export interface Attendance {
  _id: string; member: MemberRef | string; checkInAt: string; checkOutAt?: string;
  date: string; method: 'QR' | 'FACE' | 'MANUAL';
  status: 'checked_in' | 'checked_out';
  verificationResult: 'success' | 'rejected'; rejectionReason?: string;
}

export interface Payment {
  _id: string; paymentId: string; member: MemberRef | string;
  plan?: { _id: string; name: string } | string; membership?: string;
  amount: number; discount: number; method: 'cash' | 'bank_transfer' | 'card' | 'other';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  transactionReference?: string; paidAt: string; notes?: string;
}

export interface NotificationItem {
  _id: string; type: string; title: string; message: string; isRead: boolean; createdAt: string;
  member?: string;
}

export interface PageResult<T> { items: T[]; total: number; page: number; limit: number; totalPages: number; }

export interface Device { _id: string; name: string; location?: string; type: string; isActive: boolean; lastSeenAt?: string; deviceKey: string; }

export interface CheckInResult {
  allowed: boolean; reason?: string;
  member?: { id: string; memberId: string; fullName: string; profilePicture?: string; status: string };
  plan?: string; expiryDate?: string; checkInAt?: string; method?: string; distance?: number;
}
