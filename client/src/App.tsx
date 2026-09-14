import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './stores/AuthContext';
import AppShell from './layouts/AppShell';
import PageLoader from './components/PageLoader';

const Login = lazy(() => import('./pages/auth/Login'));
const Signup = lazy(() => import('./pages/auth/Signup'));
const Onboarding = lazy(() => import('./pages/onboarding/Onboarding'));

const DailyBriefing = lazy(() => import('./pages/DailyBriefing'));
const AIAssistant = lazy(() => import('./pages/AIAssistant'));
const Leads = lazy(() => import('./pages/leads/Leads'));
const LeadDetail = lazy(() => import('./pages/leads/LeadDetail'));
const Contacts = lazy(() => import('./pages/contacts/Contacts'));
const Companies = lazy(() => import('./pages/companies/Companies'));
const Deals = lazy(() => import('./pages/deals/Deals'));
const DealDetail = lazy(() => import('./pages/deals/DealDetail'));
const Activities = lazy(() => import('./pages/activities/Activities'));
const Pipeline = lazy(() => import('./pages/pipeline/Pipeline'));
const Tasks = lazy(() => import('./pages/tasks/Tasks'));
const Calendar = lazy(() => import('./pages/calendar/Calendar'));
const Conversations = lazy(() => import('./pages/conversations/Conversations'));
const Reports = lazy(() => import('./pages/reports/Reports'));
const Forecast = lazy(() => import('./pages/forecast/Forecast'));
const Team = lazy(() => import('./pages/team/Team'));
const ManagerDashboard = lazy(() => import('./pages/manager/ManagerDashboard'));
const ApprovalCenter = lazy(() => import('./pages/approvals/ApprovalCenter'));
const AuditLogs = lazy(() => import('./pages/audit/AuditLogs'));
const SettingsLayout = lazy(() => import('./pages/settings/SettingsLayout'));
const SettingsOrganization = lazy(() => import('./pages/settings/SettingsOrganization'));
const SettingsSalesProcess = lazy(() => import('./pages/settings/SettingsSalesProcess'));
const SettingsAutonomy = lazy(() => import('./pages/settings/SettingsAutonomy'));
const SettingsIntegrations = lazy(() => import('./pages/settings/SettingsIntegrations'));
const SettingsSecurity = lazy(() => import('./pages/settings/SettingsSecurity'));
const Import = lazy(() => import('./pages/import/Import'));
const NotFound = lazy(() => import('./pages/NotFound'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, organization } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (organization && !organization.onboardingCompleted) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

export default function App() {
  const { isLoading } = useAuth();
  if (isLoading) return <PageLoader />;

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/onboarding" element={<Onboarding />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<DailyBriefing />} />
          <Route path="assistant" element={<AIAssistant />} />
          <Route path="leads" element={<Leads />} />
          <Route path="leads/:id" element={<LeadDetail />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="companies" element={<Companies />} />
          <Route path="deals" element={<Deals />} />
          <Route path="deals/:id" element={<DealDetail />} />
          <Route path="activities" element={<Activities />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="conversations" element={<Conversations />} />
          <Route path="reports" element={<Reports />} />
          <Route path="forecast" element={<Forecast />} />
          <Route path="team" element={<Team />} />
          <Route path="manager-dashboard" element={<ManagerDashboard />} />
          <Route path="approvals" element={<ApprovalCenter />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="import" element={<Import />} />
          <Route path="settings" element={<SettingsLayout />}>
            <Route index element={<Navigate to="organization" replace />} />
            <Route path="organization" element={<SettingsOrganization />} />
            <Route path="sales-process" element={<SettingsSalesProcess />} />
            <Route path="autonomy" element={<SettingsAutonomy />} />
            <Route path="integrations" element={<SettingsIntegrations />} />
            <Route path="security" element={<SettingsSecurity />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
