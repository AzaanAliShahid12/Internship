import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, homePathForRole } from '../context/AuthContext';
import { ProtectedRoute } from '../components/layout/ProtectedRoute';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { PageLoading } from '../components/ui/feedback';

import Login from '../pages/auth/Login';
import ForgotPassword from '../pages/auth/ForgotPassword';
import ResetPassword from '../pages/auth/ResetPassword';
import Unauthorized from '../pages/auth/Unauthorized';
import NotFound from '../pages/auth/NotFound';

import AdminDashboard from '../pages/admin/AdminDashboard';
import Members from '../pages/admin/Members';
import AddMember from '../pages/admin/AddMember';
import EditMember from '../pages/admin/EditMember';
import MemberDetails from '../pages/admin/MemberDetails';
import Plans from '../pages/admin/Plans';
import Memberships from '../pages/admin/Memberships';
import QrGenerator from '../pages/admin/QrGenerator';
import QrScanner from '../pages/admin/QrScanner';
import FaceEnroll from '../pages/admin/FaceEnroll';
import FaceScanner from '../pages/admin/FaceScanner';
import AttendancePage from '../pages/admin/AttendancePage';
import Trainers from '../pages/admin/Trainers';
import Payments from '../pages/admin/Payments';
import Notifications from '../pages/admin/Notifications';
import Reports from '../pages/admin/Reports';
import Users from '../pages/admin/Users';
import Settings from '../pages/admin/Settings';

import ReceptionDashboard from '../pages/staff/ReceptionDashboard';
import TrainerDashboard from '../pages/staff/TrainerDashboard';
import TrainerMembers from '../pages/staff/TrainerMembers';

import MemberDashboard from '../pages/member/MemberDashboard';
import MemberProfile from '../pages/member/MemberProfile';
import MemberQr from '../pages/member/MemberQr';
import MemberAttendance from '../pages/member/MemberAttendance';
import MemberMembership from '../pages/member/MemberMembership';

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoading />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={homePathForRole(user.role)} replace />;
}

const ADMIN = ['super_admin', 'gym_admin'] as const;
const STAFF = ['super_admin', 'gym_admin', 'receptionist'] as const;

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/unauthorized" element={<Unauthorized />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          {/* Admin */}
          <Route element={<ProtectedRoute roles={[...ADMIN]} />}>
            <Route path="/dashboard" element={<AdminDashboard />} />
            <Route path="/users" element={<Users />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          {/* Staff (admins + receptionist) */}
          <Route element={<ProtectedRoute roles={[...STAFF]} />}>
            <Route path="/members" element={<Members />} />
            <Route path="/members/new" element={<AddMember />} />
            <Route path="/members/:id" element={<MemberDetails />} />
            <Route path="/members/:id/edit" element={<EditMember />} />
            <Route path="/plans" element={<Plans />} />
            <Route path="/memberships" element={<Memberships />} />
            <Route path="/qr-generator" element={<QrGenerator />} />
            <Route path="/qr-scanner" element={<QrScanner />} />
            <Route path="/face-enroll" element={<FaceEnroll />} />
            <Route path="/face-scanner" element={<FaceScanner />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/trainers" element={<Trainers />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/reports" element={<Reports />} />
          </Route>
          {/* Receptionist home */}
          <Route element={<ProtectedRoute roles={['receptionist']} />}>
            <Route path="/reception" element={<ReceptionDashboard />} />
          </Route>
          {/* Trainer */}
          <Route element={<ProtectedRoute roles={['trainer']} />}>
            <Route path="/trainer-dashboard" element={<TrainerDashboard />} />
            <Route path="/trainer-members" element={<TrainerMembers />} />
          </Route>
          {/* Member portal */}
          <Route element={<ProtectedRoute roles={['member']} />}>
            <Route path="/portal" element={<MemberDashboard />} />
            <Route path="/portal/profile" element={<MemberProfile />} />
            <Route path="/portal/qr" element={<MemberQr />} />
            <Route path="/portal/attendance" element={<MemberAttendance />} />
            <Route path="/portal/membership" element={<MemberMembership />} />
          </Route>
          {/* Shared */}
          <Route path="/notifications" element={<Notifications />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
