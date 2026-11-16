import { api, ApiResponse } from '../lib/api';
import type {
  Attendance, CheckInResult, Device, Member, Membership, MembershipPlan,
  NotificationItem, PageResult, Payment, Trainer, User,
} from '../types';

async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const res = await api.get<ApiResponse<T>>(url, { params });
  return res.data.data;
}
async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await api.post<ApiResponse<T>>(url, body);
  return res.data.data;
}
async function put<T>(url: string, body?: unknown): Promise<T> {
  const res = await api.put<ApiResponse<T>>(url, body);
  return res.data.data;
}
async function del<T>(url: string): Promise<T> {
  const res = await api.delete<ApiResponse<T>>(url);
  return res.data.data;
}

export interface DashboardStats {
  totalMembers: number; activeMembers: number; expiredMemberships: number; expiringSoon: number;
  todaysCheckIns: number; currentOccupancy: number; totalTrainers: number; monthlyRevenue: number;
  pendingPayments: number; newMembersThisMonth: number;
  recentActivity: {
    registrations: Member[]; checkIns: Attendance[]; rejected: Attendance[];
    renewals: (Membership & { member?: { fullName: string; memberId: string }; plan?: MembershipPlan })[];
  };
}

export const dashboardApi = {
  stats: () => get<DashboardStats>('/dashboard/stats'),
  attendance: (days = 30) => get<{ date: string; count: number; qr: number; face: number; manual: number }[]>('/dashboard/attendance', { days }),
  revenue: (months = 6) => get<{ revenue: { month: string; total: number; count: number }[]; membershipDistribution: { plan: string; count: number }[] }>('/dashboard/revenue', { months }),
};

export const membersApi = {
  list: (params: Record<string, unknown>) => get<PageResult<Member>>('/members', params),
  get: (id: string) => get<Member>(`/members/${id}`),
  create: (body: unknown) => post<Member>('/members', body),
  update: (id: string, body: unknown) => put<Member>(`/members/${id}`, body),
  remove: (id: string) => del<{ message: string }>(`/members/${id}`),
  attendance: (id: string, params?: Record<string, unknown>) => get<PageResult<Attendance>>(`/members/${id}/attendance`, params),
  payments: (id: string, params?: Record<string, unknown>) => get<PageResult<Payment>>(`/members/${id}/payments`, params),
  exportCsv: async () => {
    const res = await api.get('/members/export/csv', { responseType: 'text' });
    return res.data as string;
  },
};

export const plansApi = {
  list: (status?: string) => get<MembershipPlan[]>('/plans', status ? { status } : undefined),
  create: (body: unknown) => post<MembershipPlan>('/plans', body),
  update: (id: string, body: unknown) => put<MembershipPlan>(`/plans/${id}`, body),
  remove: (id: string) => del<{ message: string }>(`/plans/${id}`),
};

export const membershipsApi = {
  list: (params: Record<string, unknown>) => get<PageResult<Membership & { member?: Member; plan?: MembershipPlan }>>('/memberships', params),
  assign: (body: unknown) => post<Membership>('/memberships', body),
  update: (id: string, body: unknown) => put<Membership>(`/memberships/${id}`, body),
  renew: (id: string) => post<Membership>(`/memberships/${id}/renew`),
  upcoming: (days = 7) => get<(Membership & { member?: Member; plan?: MembershipPlan })[]>('/memberships/upcoming-renewals', { days }),
};

export const qrApi = {
  generate: (memberId: string) => post<{ token: string; qrImage: string; credentialId: string }>(`/qr/generate/${memberId}`),
  revoke: (memberId: string) => post<{ message: string }>(`/qr/revoke/${memberId}`),
  status: (memberId: string) => get<{ hasActiveCredential: boolean; eligible: boolean; eligibilityReason?: string; membershipStatus: string; credentialCreatedAt?: string }>(`/qr/status/${memberId}`),
  verify: (token: string, deviceId?: string) => post<CheckInResult>('/qr/verify', { token, deviceId }),
};

export const faceApi = {
  enroll: (memberId: string, samples: number[][]) => post<{ faceEnrolled: boolean; samplesCount: number }>(`/face/enroll`, { memberId, consent: true, samples }),
  verify: (descriptor: number[], deviceId?: string) => post<CheckInResult>('/face/verify', { descriptor, deviceId }),
  status: (memberId: string) => get<{ enrolled: boolean; consentGiven: boolean; samplesCount: number; enrolledAt?: string }>(`/face/status/${memberId}`),
  remove: (memberId: string) => del<{ message: string }>(`/face/${memberId}`),
};

export const attendanceApi = {
  list: (params: Record<string, unknown>) => get<PageResult<Attendance>>('/attendance', params),
  today: (params?: Record<string, unknown>) => get<PageResult<Attendance> & { occupancy: number; rejectedToday: number }>('/attendance/today', params),
  occupancy: () => get<{ count: number; members: Attendance[] }>('/attendance/occupancy'),
  checkIn: (memberId: string) => post<{ allowed: boolean; reason?: string }>('/attendance/check-in', { memberId }),
  checkOut: (memberId: string) => post<Attendance>('/attendance/check-out', { memberId }),
  member: (memberId: string, params?: Record<string, unknown>) => get<PageResult<Attendance>>(`/attendance/member/${memberId}`, params),
  exportCsv: async (params?: Record<string, unknown>) => {
    const res = await api.get('/attendance/export/csv', { params, responseType: 'text' });
    return res.data as string;
  },
};

export const trainersApi = {
  list: (params: Record<string, unknown>) => get<PageResult<Trainer>>('/trainers', params),
  get: (id: string) => get<Trainer>(`/trainers/${id}`),
  create: (body: unknown) => post<Trainer>('/trainers', body),
  update: (id: string, body: unknown) => put<Trainer>(`/trainers/${id}`, body),
  remove: (id: string) => del<{ message: string }>(`/trainers/${id}`),
  assignMember: (id: string, memberId: string) => post<{ message: string }>(`/trainers/${id}/assign-member`, { memberId }),
  myMembers: () => get<{ trainer: Trainer; members: Member[] }>('/trainers/me/members'),
};

export const paymentsApi = {
  list: (params: Record<string, unknown>) => get<PageResult<Payment>>('/payments', params),
  get: (id: string) => get<Payment>(`/payments/${id}`),
  create: (body: unknown) => post<Payment>('/payments', body),
  updateStatus: (id: string, status: string, transactionReference?: string) => put<Payment>(`/payments/${id}/status`, { status, transactionReference }),
  receipt: (id: string) => get<Record<string, unknown>>(`/payments/${id}/receipt`),
};

export const notificationsApi = {
  list: (params?: Record<string, unknown>) => get<PageResult<NotificationItem> & { unread: number }>('/notifications', params),
  markRead: (id: string) => put<NotificationItem>(`/notifications/${id}/read`),
  markAllRead: () => put<{ message: string }>('/notifications/read-all'),
};

export const reportsApi = {
  attendance: (params: Record<string, unknown>) => get<Record<string, unknown>[]>('/reports/attendance', params),
  revenue: (params: Record<string, unknown>) => get<{ totalRevenue: number; completedTransactions: number; byMethod: { method: string; total: number; count: number }[]; byStatus: { status: string; total: number; count: number }[] }>('/reports/revenue', params),
  memberships: () => get<{ totalMembers: number; statusCounts: Record<string, number>; byPlan: { plan: string; count: number }[] }>('/reports/memberships'),
  rejected: (params: Record<string, unknown>) => get<{ reason: string; count: number }[]>('/reports/rejected', params),
  occupancy: (params: Record<string, unknown>) => get<{ date: string; checkIns: number; uniqueMembers: number }[]>('/reports/occupancy', params),
  registrations: (params: Record<string, unknown>) => get<{ date: string; count: number }[]>('/reports/registrations', params),
};

export const usersApi = {
  list: (params: Record<string, unknown>) => get<PageResult<User>>('/users', params),
  create: (body: unknown) => post<User>('/users', body),
  update: (id: string, body: unknown) => put<User>(`/users/${id}`, body),
  remove: (id: string) => del<{ message: string }>(`/users/${id}`),
};

export const devicesApi = {
  list: () => get<Device[]>('/devices'),
  create: (body: unknown) => post<Device>('/devices', body),
  update: (id: string, body: unknown) => put<Device>(`/devices/${id}`, body),
  remove: (id: string) => del<{ message: string }>(`/devices/${id}`),
};

export const auditApi = {
  list: (params: Record<string, unknown>) => get<PageResult<Record<string, unknown>>>('/audit-logs', params),
};

export const portalApi = {
  profile: () => get<Member>('/me/profile'),
  updateProfile: (body: unknown) => put<Member>('/me/profile', body),
  qr: () => get<{ hasCredential: boolean; qrImage?: string; memberId?: string; fullName?: string; message?: string }>('/me/qr'),
  attendance: (params?: Record<string, unknown>) => get<PageResult<Attendance> & { stats: { totalVisits: number; thisMonth: number } }>('/me/attendance', params),
  payments: (params?: Record<string, unknown>) => get<PageResult<Payment>>('/me/payments', params),
  membership: () => get<(Membership & { plan?: MembershipPlan }) | null>('/me/membership'),
  requestRenewal: () => post<{ message: string }>('/me/renewal-request'),
};
