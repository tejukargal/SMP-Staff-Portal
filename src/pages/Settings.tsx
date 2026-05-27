import { useState, useEffect } from 'react';
import { Plus, Shield, Eye, Trash2, AlertTriangle } from 'lucide-react';
import { getAllUsers, updateUserRole, createUserDoc, deleteAllStaff } from '@/firebase/firestore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import { PageSpinner } from '@/components/ui/Spinner';
import type { UserRecord } from '@/types';
import { currentYear } from '@/utils/dateUtils';

const RESET_PASSKEY = 'giri1977';

function ResetModal({ onClose }: { onClose: () => void }) {
  const { showToast } = useToast();
  const [passkey, setPasskey] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    if (passkey !== RESET_PASSKEY) {
      setError('Incorrect passkey.');
      return;
    }
    setDeleting(true);
    try {
      const count = await deleteAllStaff();
      showToast('success', `${count} staff records deleted successfully.`);
      onClose();
    } catch {
      showToast('error', 'Failed to reset data. Try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-red-100 overflow-hidden">
        <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-red-800">Delete All Staff Data</h3>
            <p className="text-xs text-red-600 mt-0.5">This action cannot be undone</p>
          </div>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <p className="text-sm text-[#374151]">
            All staff records will be permanently deleted from the database. Enter the passkey to confirm.
          </p>
          <Input
            label="Passkey"
            type="password"
            value={passkey}
            onChange={(e) => { setPasskey(e.target.value); setError(''); }}
            placeholder="Enter passkey"
            error={error}
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={deleting}>Cancel</Button>
            <Button
              size="sm"
              loading={deleting}
              onClick={() => { void handleDelete(); }}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete All Data
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'viewer'>('viewer');
  const [saving, setSaving] = useState(false);
  const [showReset, setShowReset] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await getAllUsers();
      setUsers(data);
    } catch {
      showToast('error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchUsers(); }, []);

  const handleRoleChange = async (uid: string, role: 'admin' | 'viewer') => {
    try {
      await updateUserRole(uid, role);
      setUsers((prev) => prev.map((u) => u.uid === uid ? { ...u, role } : u));
      showToast('success', 'Role updated');
    } catch {
      showToast('error', 'Failed to update role');
    }
  };

  const handleAddUser = async () => {
    if (!newEmail.trim() || !newName.trim()) {
      showToast('error', 'Email and name are required');
      return;
    }
    setSaving(true);
    try {
      const tempUid = `pending_${Date.now()}`;
      await createUserDoc(tempUid, {
        email: newEmail.trim().toLowerCase(),
        name: newName.trim().toUpperCase(),
        role: newRole,
      });
      showToast('success', 'User record created. Ask them to sign in to complete setup.');
      setNewEmail('');
      setNewName('');
      setNewRole('viewer');
      setShowAdd(false);
      await fetchUsers();
    } catch {
      showToast('error', 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSpinner />;

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* User Management */}
      <div className="bg-white rounded-xl border border-[#E2E5EA] p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-[#111827]">User Management</h2>
          <Button size="sm" onClick={() => setShowAdd((s) => !s)}>
            <Plus className="w-3.5 h-3.5" />
            Add User
          </Button>
        </div>

        {showAdd && (
          <div className="mb-5 p-4 bg-[#F7F8FA] rounded-lg border border-[#E2E5EA] grid grid-cols-2 gap-3">
            <Input
              label="Name"
              uppercase
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
            <Input
              label="Email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
            <Select
              label="Role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as 'admin' | 'viewer')}
              options={[
                { value: 'viewer', label: 'Viewer' },
                { value: 'admin', label: 'Admin' },
              ]}
            />
            <div className="flex items-end gap-2">
              <Button onClick={() => { void handleAddUser(); }} loading={saving}>
                Create User
              </Button>
              <Button variant="secondary" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        <Table>
          <Thead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Change Role</Th>
            </tr>
          </Thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-sm text-[#6B7280]">
                  No users found
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <Tr key={u.uid}>
                  <Td className="font-medium">{u.name}</Td>
                  <Td className="text-[#6B7280]">{u.email}</Td>
                  <Td>
                    <span className="flex items-center gap-1.5 text-xs font-medium">
                      {u.role === 'admin' ? (
                        <><Shield className="w-3.5 h-3.5 text-[#1B3A6B]" /> Admin</>
                      ) : (
                        <><Eye className="w-3.5 h-3.5 text-[#6B7280]" /> Viewer</>
                      )}
                    </span>
                  </Td>
                  <Td>
                    <select
                      value={u.role}
                      onChange={(e) => { void handleRoleChange(u.uid, e.target.value as 'admin' | 'viewer'); }}
                      className="text-xs px-2 py-1 border border-[#E2E5EA] rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#1B3A6B]"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-xl border border-red-200 p-6">
        <h2 className="text-base font-semibold text-red-700 mb-1 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Danger Zone
        </h2>
        <p className="text-xs text-[#6B7280] mb-4">Irreversible actions that affect all data in the database.</p>
        <div className="flex items-center justify-between p-4 rounded-lg border border-red-100 bg-red-50">
          <div>
            <p className="text-sm font-medium text-[#111827]">Delete All Staff Records</p>
            <p className="text-xs text-[#6B7280] mt-0.5">Permanently removes every staff record from the database.</p>
          </div>
          <Button
            size="sm"
            onClick={() => setShowReset(true)}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-500 shrink-0 ml-4"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Reset Data
          </Button>
        </div>
      </div>

      {showReset && <ResetModal onClose={() => setShowReset(false)} />}

      {/* App Info */}
      <div className="bg-white rounded-xl border border-[#E2E5EA] p-6">
        <h2 className="text-base font-semibold text-[#111827] mb-4">App Information</h2>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between py-2 border-b border-[#F3F4F6]">
            <span className="text-[#6B7280]">Institution</span>
            <span className="font-medium">Sanjay Memorial Polytechnic, Sagar</span>
          </div>
          <div className="flex justify-between py-2 border-b border-[#F3F4F6]">
            <span className="text-[#6B7280]">Academic Year</span>
            <span className="font-medium">{currentYear()}–{currentYear() + 1}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-[#F3F4F6]">
            <span className="text-[#6B7280]">Portal Version</span>
            <span className="font-medium font-mono">v1.0.0</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-[#6B7280]">Database</span>
            <span className="font-medium">Firebase Firestore (asia-south1)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
