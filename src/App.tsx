import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PrivateRoute, AdminRoute } from '@/components/layout/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import StaffList from '@/pages/StaffList';
import StaffForm from '@/pages/StaffForm';
import StaffProfile from '@/pages/StaffProfile';
import SalaryBill from '@/pages/SalaryBill';
import Reports from '@/pages/Reports';
import LeaveRecords from '@/pages/LeaveRecords';
import LicPolicies from '@/pages/LicPolicies';
import Settings from '@/pages/Settings';
import VacancyRegister from '@/pages/VacancyRegister';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<PrivateRoute />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/staff" element={<StaffList />} />
          <Route path="/staff/:id" element={<StaffProfile />} />
          <Route path="/salary" element={<SalaryBill />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/leave-records" element={<LeaveRecords />} />
          <Route path="/lic-policies" element={<LicPolicies />} />

          <Route element={<AdminRoute />}>
            <Route path="/staff/new" element={<StaffForm />} />
            <Route path="/staff/:id/edit" element={<StaffForm />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/vacancy-register" element={<VacancyRegister />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
