import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/auth/AuthProvider';
import { ProtectedRoute, RequireRole } from '@/auth/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import LoginPage from '@/pages/auth/LoginPage';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import ComingSoonPage from '@/pages/common/ComingSoonPage';
import AttendanceCalendarPage from '@/pages/attendance/AttendanceCalendarPage';
import EventRequestPage from '@/pages/attendance/EventRequestPage';
import BalancePage from '@/pages/attendance/BalancePage';
import InOutRecordsPage from '@/pages/attendance/InOutRecordsPage';
import RawInOutRecordsPage from '@/pages/attendance/RawInOutRecordsPage';
import MissingAttendancePage from '@/pages/attendance/MissingAttendancePage';
import MonthlyAnalysisPage from '@/pages/attendance/MonthlyAnalysisPage';
import HolidayListPage from '@/pages/attendance/HolidayListPage';
import PendingApprovalsPage from '@/pages/manager/PendingApprovalsPage';
import ManagerDashboardPage from '@/pages/manager/ManagerDashboardPage';
import TeamAttendancePage from '@/pages/manager/TeamAttendancePage';
import TeamLeavePage from '@/pages/manager/TeamLeavePage';
import TeamReportsPage from '@/pages/manager/TeamReportsPage';
import ProfilePage from '@/pages/eip/ProfilePage';
import PayslipsPage from '@/pages/eip/PayslipsPage';
import PfDetailsPage from '@/pages/eip/PfDetailsPage';
import Form16Page from '@/pages/eip/Form16Page';
import TaxCalculatorPage from '@/pages/eip/TaxCalculatorPage';
import PreviousEmployerDeclarationPage from '@/pages/eip/PreviousEmployerDeclarationPage';
import TaxDeclarationPage from '@/pages/eip/TaxDeclarationPage';
import PoliciesPage from '@/pages/eip/PoliciesPage';
import ExitDashboardPage from '@/pages/exit/ExitDashboardPage';
import ResignationEntryPage from '@/pages/exit/ResignationEntryPage';
import ExitInterviewPage from '@/pages/exit/ExitInterviewPage';
import ExitManagementPage from '@/pages/exit/ExitManagementPage';
import EmployeesPage from '@/pages/admin/EmployeesPage';
import DepartmentsPage from '@/pages/admin/DepartmentsPage';
import DesignationsPage from '@/pages/admin/DesignationsPage';
import LocationsPage from '@/pages/admin/LocationsPage';
import GradesPage from '@/pages/admin/GradesPage';
import ShiftsPage from '@/pages/admin/ShiftsPage';
import AttendanceRulesPage from '@/pages/admin/AttendanceRulesPage';
import LeaveTypesPage from '@/pages/admin/LeaveTypesPage';
import LeavePoliciesPage from '@/pages/admin/LeavePoliciesPage';
import HolidaysPage from '@/pages/admin/HolidaysPage';
import ApprovalWorkflowsPage from '@/pages/admin/ApprovalWorkflowsPage';
import DocumentsPage from '@/pages/admin/DocumentsPage';
import PayrollPage from '@/pages/admin/PayrollPage';
import ReportsPage from '@/pages/admin/ReportsPage';
import NotificationsPage from '@/pages/admin/NotificationsPage';
import EmailTemplatesPage from '@/pages/admin/EmailTemplatesPage';
import EmailDeliveryLogsPage from '@/pages/admin/EmailDeliveryLogsPage';
import BiometricReadersPage from '@/pages/admin/BiometricReadersPage';
import EmailConfigurationPage from '@/pages/admin/EmailConfigurationPage';
import ReconciliationPage from '@/pages/admin/ReconciliationPage';
import AuditLogsPage from '@/pages/admin/AuditLogsPage';
import SystemSettingsPage from '@/pages/admin/SystemSettingsPage';
import { businessRoutes } from '@/config/businessRoutes';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/attendance/calendar" element={<AttendanceCalendarPage />} />
                <Route path="/attendance/event-request" element={<EventRequestPage />} />
                <Route path="/attendance/balance" element={<BalancePage />} />
                <Route path="/attendance/in-out-records" element={<InOutRecordsPage />} />
                <Route path="/attendance/raw-in-out-records" element={<RawInOutRecordsPage />} />
                <Route path="/attendance/missing-attendance" element={<MissingAttendancePage />} />
                <Route path="/attendance/monthly-analysis" element={<MonthlyAnalysisPage />} />
                <Route path="/attendance/holiday-list" element={<HolidayListPage />} />
                <Route
                  path="/manager/dashboard"
                  element={
                    <RequireRole roles={['manager', 'hr_admin', 'super_admin']}>
                      <ManagerDashboardPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/manager/approvals"
                  element={
                    <RequireRole roles={['manager', 'hr_admin', 'super_admin']}>
                      <PendingApprovalsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/manager/team-attendance"
                  element={
                    <RequireRole roles={['manager', 'hr_admin', 'super_admin']}>
                      <TeamAttendancePage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/manager/team-leave"
                  element={
                    <RequireRole roles={['manager', 'hr_admin', 'super_admin']}>
                      <TeamLeavePage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/manager/team-reports"
                  element={
                    <RequireRole roles={['manager', 'hr_admin', 'super_admin']}>
                      <TeamReportsPage />
                    </RequireRole>
                  }
                />
                <Route path="/eip/profile" element={<ProfilePage />} />
                <Route path="/eip/payslips" element={<PayslipsPage />} />
                <Route path="/eip/pf" element={<PfDetailsPage />} />
                <Route path="/eip/form16" element={<Form16Page />} />
                <Route path="/eip/tax-calculator" element={<TaxCalculatorPage />} />
                <Route path="/eip/previous-employer" element={<PreviousEmployerDeclarationPage />} />
                <Route path="/eip/tax-declaration" element={<TaxDeclarationPage />} />
                <Route path="/eip/policies" element={<PoliciesPage />} />
                <Route path="/eip/policies/:year" element={<PoliciesPage />} />
                <Route path="/exit" element={<ExitDashboardPage />} />
                <Route path="/exit/resignation" element={<ResignationEntryPage />} />
                <Route path="/exit/interview" element={<ExitInterviewPage />} />
                <Route
                  path="/exit/manage"
                  element={
                    <RequireRole roles={['manager', 'hr_admin', 'super_admin']}>
                      <ExitManagementPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/employees"
                  element={
                    <RequireRole roles={['hr_admin', 'super_admin']}>
                      <EmployeesPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/departments"
                  element={
                    <RequireRole roles={['hr_admin', 'super_admin']}>
                      <DepartmentsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/designations"
                  element={
                    <RequireRole roles={['hr_admin', 'super_admin']}>
                      <DesignationsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/locations"
                  element={
                    <RequireRole roles={['hr_admin', 'super_admin']}>
                      <LocationsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/grades"
                  element={
                    <RequireRole roles={['hr_admin', 'super_admin']}>
                      <GradesPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/shifts"
                  element={
                    <RequireRole roles={['hr_admin', 'super_admin']}>
                      <ShiftsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/attendance-rules"
                  element={
                    <RequireRole roles={['hr_admin', 'super_admin']}>
                      <AttendanceRulesPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/leave-types"
                  element={
                    <RequireRole roles={['hr_admin', 'super_admin']}>
                      <LeaveTypesPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/leave-policies"
                  element={
                    <RequireRole roles={['hr_admin', 'super_admin']}>
                      <LeavePoliciesPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/holidays"
                  element={
                    <RequireRole roles={['hr_admin', 'super_admin']}>
                      <HolidaysPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/workflows"
                  element={
                    <RequireRole roles={['hr_admin', 'super_admin']}>
                      <ApprovalWorkflowsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/documents"
                  element={
                    <RequireRole roles={['hr_admin', 'super_admin']}>
                      <DocumentsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/payroll"
                  element={
                    <RequireRole roles={['hr_admin', 'super_admin']}>
                      <PayrollPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/reports"
                  element={
                    <RequireRole roles={['hr_admin', 'super_admin']}>
                      <ReportsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/notifications"
                  element={
                    <RequireRole roles={['hr_admin', 'super_admin']}>
                      <NotificationsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/email-templates"
                  element={
                    <RequireRole roles={['hr_admin', 'super_admin']}>
                      <EmailTemplatesPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/email-delivery-logs"
                  element={
                    <RequireRole roles={['hr_admin', 'super_admin']}>
                      <EmailDeliveryLogsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/biometric-readers"
                  element={
                    <RequireRole roles={['hr_admin', 'super_admin']}>
                      <BiometricReadersPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/email-configuration"
                  element={
                    <RequireRole roles={['hr_admin', 'super_admin']}>
                      <EmailConfigurationPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/reconciliation"
                  element={
                    <RequireRole roles={['hr_admin', 'super_admin']}>
                      <ReconciliationPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/audit-logs"
                  element={
                    <RequireRole roles={['hr_admin', 'super_admin']}>
                      <AuditLogsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/system-settings"
                  element={
                    <RequireRole roles={['super_admin']}>
                      <SystemSettingsPage />
                    </RequireRole>
                  }
                />
                {businessRoutes.map((route) => (
                  <Route
                    key={route.path}
                    path={route.path}
                    element={
                      route.roles ? (
                        <RequireRole roles={route.roles}>
                          <ComingSoonPage title={route.title} breadcrumb={route.breadcrumb} />
                        </RequireRole>
                      ) : (
                        <ComingSoonPage title={route.title} breadcrumb={route.breadcrumb} />
                      )
                    }
                  />
                ))}
              </Route>
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
