import {
  getFirestore,
  collection,
  collectionGroup,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
  enableIndexedDbPersistence,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { app } from './config';
import type { StaffRecord, UserRecord, LeaveBalance, LeaveRecord, LicPolicy } from '@/types';

export const db = getFirestore(app);

enableIndexedDbPersistence(db).catch(() => {
  // Persistence unavailable (multiple tabs or browser restriction) — silently ignore
});

function staffFromDoc(snap: QueryDocumentSnapshot<DocumentData>): StaffRecord {
  return { id: snap.id, ...snap.data() } as StaffRecord;
}

// ── Staff ──────────────────────────────────────────────────────────────

export async function getAllStaff(): Promise<StaffRecord[]> {
  const q = query(collection(db, 'staff'), orderBy('sl', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(staffFromDoc);
}

export async function getStaffById(id: string): Promise<StaffRecord | null> {
  const snap = await getDoc(doc(db, 'staff', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as StaffRecord;
}

export async function addStaff(
  data: Omit<StaffRecord, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'staff'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateStaff(
  id: string,
  data: Partial<Omit<StaffRecord, 'id' | 'createdAt'>>
): Promise<void> {
  await updateDoc(doc(db, 'staff', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteStaff(id: string): Promise<void> {
  await deleteDoc(doc(db, 'staff', id));
}

export async function deleteAllStaff(): Promise<number> {
  const snap = await getDocs(collection(db, 'staff'));
  const CHUNK = 450;
  let deleted = 0;
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    docs.slice(i, i + CHUNK).forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += Math.min(CHUNK, docs.length - i);
  }
  return deleted;
}

export async function isEmpIdUnique(empId: string, excludeId?: string): Promise<boolean> {
  const all = await getAllStaff();
  return !all.some((s) => s.empId === empId && s.id !== excludeId);
}

// ── Leave ──────────────────────────────────────────────────────────────

export async function getLeaveBalance(staffId: string): Promise<LeaveBalance> {
  const snap = await getDoc(doc(db, 'staff', staffId));
  const bal = snap.exists() ? (snap.data().leaveBalance as LeaveBalance | undefined) : undefined;
  return bal ?? { cl: 0, hpl: 0, el: 0 };
}

export async function updateLeaveBalance(staffId: string, balance: LeaveBalance): Promise<void> {
  await updateDoc(doc(db, 'staff', staffId), { leaveBalance: balance, updatedAt: serverTimestamp() });
}

function leaveFromDoc(snap: QueryDocumentSnapshot<DocumentData>): LeaveRecord {
  return { id: snap.id, ...snap.data() } as LeaveRecord;
}

export async function getLeaveRecords(staffId: string): Promise<LeaveRecord[]> {
  const snap = await getDocs(collection(db, 'staff', staffId, 'leaveRecords'));
  return snap.docs
    .map(leaveFromDoc)
    .sort((a, b) => b.fromDate.localeCompare(a.fromDate));
}

export async function getAllLeaveRecords(): Promise<LeaveRecord[]> {
  const snap = await getDocs(collectionGroup(db, 'leaveRecords'));
  return snap.docs
    .map(leaveFromDoc)
    .sort((a, b) => b.fromDate.localeCompare(a.fromDate));
}


export async function addLeaveRecord(
  staffId: string,
  data: Omit<LeaveRecord, 'id' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'staff', staffId, 'leaveRecords'), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateLeaveRecord(
  staffId: string,
  recordId: string,
  data: Partial<Omit<LeaveRecord, 'id' | 'createdAt'>>,
): Promise<void> {
  await updateDoc(doc(db, 'staff', staffId, 'leaveRecords', recordId), data as DocumentData);
}

export async function deleteLeaveRecord(staffId: string, recordId: string): Promise<void> {
  await deleteDoc(doc(db, 'staff', staffId, 'leaveRecords', recordId));
}

// ── LIC Policies ──────────────────────────────────────────────────────

function licFromDoc(snap: QueryDocumentSnapshot<DocumentData>): LicPolicy {
  return { id: snap.id, ...snap.data() } as LicPolicy;
}

export async function getLicPolicies(staffId: string): Promise<LicPolicy[]> {
  const snap = await getDocs(collection(db, 'staff', staffId, 'licPolicies'));
  return snap.docs
    .map(licFromDoc)
    .sort((a, b) => a.policyNumber.localeCompare(b.policyNumber));
}

export async function addLicPolicy(
  staffId: string,
  data: Omit<LicPolicy, 'id' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'staff', staffId, 'licPolicies'), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateLicPolicy(
  staffId: string,
  policyId: string,
  data: Omit<LicPolicy, 'id' | 'createdAt'>,
): Promise<void> {
  await updateDoc(doc(db, 'staff', staffId, 'licPolicies', policyId), data as DocumentData);
}

export async function deleteLicPolicy(staffId: string, policyId: string): Promise<void> {
  await deleteDoc(doc(db, 'staff', staffId, 'licPolicies', policyId));
}

// ── Users ──────────────────────────────────────────────────────────────

export async function getUserById(uid: string, email?: string): Promise<UserRecord | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (snap.exists()) return { uid, ...snap.data() } as UserRecord;

  // First login: check pendingUsers by email, then self-register under real UID
  if (!email) return null;
  const pendingSnap = await getDoc(doc(db, 'pendingUsers', email.toLowerCase()));
  if (!pendingSnap.exists()) return null;

  const data = pendingSnap.data() as Omit<UserRecord, 'uid'>;
  await setDoc(doc(db, 'users', uid), data);
  await deleteDoc(pendingSnap.ref);

  return { uid, ...data };
}

export async function getAllUsers(): Promise<UserRecord[]> {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserRecord));
}

export async function setUser(uid: string, data: Omit<UserRecord, 'uid'>): Promise<void> {
  await updateDoc(doc(db, 'users', uid), data as DocumentData);
}

export async function createUserDoc(_uid: string, data: Omit<UserRecord, 'uid'>): Promise<void> {
  await setDoc(doc(db, 'pendingUsers', data.email.toLowerCase()), data);
}

export async function updateUserRole(uid: string, role: 'admin' | 'viewer'): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { role });
}
