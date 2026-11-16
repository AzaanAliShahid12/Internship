/**
 * Database seed — creates demo accounts, plans, a trainer, sample members,
 * memberships, payments, QR credentials and entrance devices.
 *
 * Run:  npm --prefix server run seed
 *
 * Demo logins (change these passwords before any real use):
 *   superadmin@gym.com / Admin@123     (Super Admin)
 *   admin@gym.com      / Admin@123     (Gym Admin)
 *   reception@gym.com  / Staff@123     (Receptionist)
 *   trainer@gym.com    / Trainer@123   (Trainer)
 *   member@gym.com     / Member@123    (Member)
 */
import { connectDB, disconnectDB } from './config/db';
import { User, hashPassword } from './models/User';
import { Member } from './models/Member';
import { Trainer } from './models/Trainer';
import { MembershipPlan } from './models/MembershipPlan';
import { Membership } from './models/Membership';
import { Payment } from './models/Payment';
import { QrCredential } from './models/QrCredential';
import { Device } from './models/Device';
import { Attendance, todayStr } from './models/Attendance';
import { Notification } from './models/Notification';
import { generateQrToken, hashQrToken } from './utils/qrToken';
import { encryptString } from './utils/crypto';

async function main() {
  await connectDB();

  await Promise.all([
    User.deleteMany({}), Member.deleteMany({}), Trainer.deleteMany({}),
    MembershipPlan.deleteMany({}), Membership.deleteMany({}), Payment.deleteMany({}),
    QrCredential.deleteMany({}), Device.deleteMany({}), Attendance.deleteMany({}),
    Notification.deleteMany({}),
  ]);

  const [superAdmin, gymAdmin, receptionist, trainerUser, memberUser] = await Promise.all([
    User.create({ name: 'Super Admin', email: 'superadmin@gym.com', passwordHash: await hashPassword('Admin@123'), role: 'super_admin' }),
    User.create({ name: 'Gym Admin', email: 'admin@gym.com', passwordHash: await hashPassword('Admin@123'), role: 'gym_admin' }),
    User.create({ name: 'Front Desk', email: 'reception@gym.com', passwordHash: await hashPassword('Staff@123'), role: 'receptionist' }),
    User.create({ name: 'Ali Raza', email: 'trainer@gym.com', passwordHash: await hashPassword('Trainer@123'), role: 'trainer' }),
    User.create({ name: 'Ahmed Khan', email: 'member@gym.com', passwordHash: await hashPassword('Member@123'), role: 'member' }),
  ]);
  void gymAdmin; void receptionist; void superAdmin;

  const trainer = await Trainer.create({
    user: trainerUser._id, fullName: 'Ali Raza', email: 'trainer@gym.com', phone: '+92 300 1112233',
    specialization: 'Strength & Conditioning', experienceYears: 8, salary: 120000,
    availability: 'Mon–Sat, 6am–12pm',
  });

  const plans = await MembershipPlan.insertMany([
    { name: 'Daily Pass', planType: 'daily', durationDays: 1, price: 500, features: ['All equipment', 'Locker'], description: 'One-day access' },
    { name: 'Weekly', planType: 'weekly', durationDays: 7, price: 2000, features: ['All equipment', 'Locker', '1 group class'], description: '7-day access' },
    { name: 'Monthly', planType: 'monthly', durationDays: 30, price: 5000, features: ['All equipment', 'Locker', 'Group classes', 'Sauna'], description: '30-day access' },
    { name: 'Quarterly', planType: 'quarterly', durationDays: 90, price: 13000, features: ['All equipment', 'Locker', 'Group classes', 'Sauna', 'Diet plan'], description: '90-day access' },
    { name: 'Half-Yearly', planType: 'half_yearly', durationDays: 180, price: 24000, features: ['Everything in Quarterly', 'Personal trainer (4 sessions)'], description: '180-day access' },
    { name: 'Yearly', planType: 'yearly', durationDays: 365, price: 42000, features: ['Everything in Half-Yearly', 'Personal trainer (12 sessions)', 'Guest passes'], description: '365-day access' },
  ]);
  const monthly = plans[2];
  const yearly = plans[5];

  const ahmed = await Member.create({
    user: memberUser._id, fullName: 'Ahmed Khan', email: 'member@gym.com', phone: '+92 321 5551234',
    gender: 'male', assignedTrainer: trainer._id, status: 'active',
    emergencyContact: { name: 'Fatima Khan', phone: '+92 321 5559876', relationship: 'Sister' },
  });
  const saraUser = await User.create({ name: 'Sara Malik', email: 'sara@example.com', passwordHash: await hashPassword('Member@123'), role: 'member' });
  const sara = await Member.create({
    user: saraUser._id, fullName: 'Sara Malik', email: 'sara@example.com', phone: '+92 333 4445566',
    gender: 'female', assignedTrainer: trainer._id, status: 'active',
  });
  const bilal = await Member.create({
    fullName: 'Bilal Hussain', email: 'bilal@example.com', phone: '+92 300 7778899', gender: 'male', status: 'active',
  });

  const now = new Date();
  const inDays = (n: number) => new Date(Date.now() + n * 24 * 3600 * 1000);
  await Membership.create({ member: ahmed._id, plan: monthly._id, startDate: now, expiryDate: inDays(24), pricePaid: monthly.price, status: 'active', isCurrent: true });
  await Membership.create({ member: sara._id, plan: yearly._id, startDate: now, expiryDate: inDays(340), pricePaid: yearly.price, status: 'active', isCurrent: true });
  await Membership.create({ member: bilal._id, plan: monthly._id, startDate: inDays(-40), expiryDate: inDays(-10), pricePaid: monthly.price, status: 'active', isCurrent: true }); // expired (effective)

  await Payment.create({ member: ahmed._id, plan: monthly._id, amount: monthly.price, discount: 0, method: 'card', status: 'completed', transactionReference: 'TXN-DEMO-001', recordedBy: gymAdmin._id });
  await Payment.create({ member: sara._id, plan: yearly._id, amount: yearly.price, discount: 2000, method: 'bank_transfer', status: 'completed', transactionReference: 'TXN-DEMO-002', recordedBy: gymAdmin._id });
  await Payment.create({ member: bilal._id, plan: monthly._id, amount: monthly.price, discount: 0, method: 'cash', status: 'pending', recordedBy: receptionist._id });

  // QR credentials for the two active members (token printed once here for demo use)
  for (const m of [ahmed, sara]) {
    const token = generateQrToken();
    await QrCredential.create({ member: m._id, tokenHash: hashQrToken(token), encryptedToken: encryptString(token), status: 'active' });
    console.log(`[seed] QR token for ${m.fullName} (${m.memberId}): ${token}`);
  }

  await Device.create({ name: 'Main Entrance QR Scanner', location: 'Entrance', type: 'qr_scanner' });
  await Device.create({ name: 'Main Entrance Face Terminal', location: 'Entrance', type: 'face_terminal' });

  await Attendance.create({ member: ahmed._id, method: 'QR', date: todayStr(), verificationResult: 'success', status: 'checked_out', checkInAt: new Date(Date.now() - 3 * 3600 * 1000), checkOutAt: new Date(Date.now() - 2 * 3600 * 1000) });

  console.log('[seed] done. Demo accounts:');
  console.log('  superadmin@gym.com / Admin@123 (Super Admin)');
  console.log('  admin@gym.com / Admin@123 (Gym Admin)');
  console.log('  reception@gym.com / Staff@123 (Receptionist)');
  console.log('  trainer@gym.com / Trainer@123 (Trainer)');
  console.log('  member@gym.com / Member@123 (Member — Ahmed Khan)');
  await disconnectDB();
}

main().catch(err => { console.error('[seed] failed', err); process.exit(1); });
