import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PortalLayout } from './components/PortalLayout';
import { PublicLayout, PublicNotFound } from './components/PublicLayout';

import Home from './pages/public/Home';
import HowItWorks from './pages/public/HowItWorks';
import ForProfessionals from './pages/public/ForProfessionals';
import ForEmployers from './pages/public/ForEmployers';
import Pricing from './pages/public/Pricing';
import TrustSafety from './pages/public/TrustSafety';
import Faq from './pages/public/Faq';
import Contact from './pages/public/Contact';
import Marketplace from './pages/public/Marketplace';
import ProfessionalProfile from './pages/public/ProfessionalProfile';

import Login from './pages/auth/Login';
import RegisterProfessional from './pages/auth/RegisterProfessional';
import RegisterEmployer from './pages/auth/RegisterEmployer';

import ProfessionalDashboard from './pages/portal/professional/Dashboard';
import ProfessionalProfilePage from './pages/portal/professional/Profile';
import ProfessionalAssessments from './pages/portal/professional/Assessments';
import AssessmentRunner from './pages/portal/professional/AssessmentRunner';
import ProfessionalAssignments from './pages/portal/professional/Assignments';
import ProfessionalAssignmentDetail from './pages/portal/professional/AssignmentDetail';
import ProfessionalTimesheets from './pages/portal/professional/Timesheets';
import ProfessionalFinance from './pages/portal/professional/Finance';
import ProfessionalCareer from './pages/portal/professional/Career';
import ProfessionalReviews from './pages/portal/professional/Reviews';
import ProfessionalInterviews from './pages/portal/professional/Interviews';
import ProfessionalSettings from './pages/portal/professional/Settings';

import EmployerDashboard from './pages/portal/employer/Dashboard';
import EmployerRequirements from './pages/portal/employer/Requirements';
import EmployerTalent from './pages/portal/employer/Talent';
import EmployerShortlist from './pages/portal/employer/Shortlist';
import EmployerInterviews from './pages/portal/employer/Interviews';
import EmployerAssignments from './pages/portal/employer/Assignments';
import EmployerAssignmentDetail from './pages/portal/employer/AssignmentDetail';
import EmployerTimesheets from './pages/portal/employer/Timesheets';
import EmployerFinance from './pages/portal/employer/Finance';
import EmployerReviews from './pages/portal/employer/Reviews';
import EmployerProfile from './pages/portal/employer/Profile';
import EmployerSettings from './pages/portal/employer/Settings';

import AdminDashboard from './pages/portal/admin/Dashboard';
import AdminVerifications from './pages/portal/admin/Verifications';
import AdminAssessments from './pages/portal/admin/Assessments';
import AdminFinance from './pages/portal/admin/Finance';
import AdminDisputes from './pages/portal/admin/Disputes';
import AdminUsers from './pages/portal/admin/Users';
import AdminSettings from './pages/portal/admin/Settings';
import AdminAudit from './pages/portal/admin/Audit';
import AdminReports from './pages/portal/admin/Reports';

const missing = (path: string) => <Navigate to={path} replace />;

export default function App() {
  return (
    <Routes>
      {/* Public marketplace */}
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="how-it-works" element={<HowItWorks />} />
        <Route path="professionals" element={<Marketplace />} />
        <Route path="professionals/:id" element={<ProfessionalProfile />} />
        <Route path="for-professionals" element={<ForProfessionals />} />
        <Route path="for-employers" element={<ForEmployers />} />
        <Route path="employers" element={<ForEmployers />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="trust-safety" element={<TrustSafety />} />
        <Route path="faq" element={<Faq />} />
        <Route path="contact" element={<Contact />} />
        <Route path="*" element={<PublicNotFound />} />
      </Route>

      {/* Authentication */}
      <Route path="/login" element={<Login />} />
      <Route path="/register/professional" element={<RegisterProfessional />} />
      <Route path="/register/employer" element={<RegisterEmployer />} />

      {/* Professional portal */}
      <Route
        path="/portal/professional"
        element={
          <ProtectedRoute role="professional">
            <PortalLayout role="professional" />
          </ProtectedRoute>
        }
      >
        <Route index element={<ProfessionalDashboard />} />
        <Route path="profile" element={<ProfessionalProfilePage />} />
        <Route path="assessments" element={<ProfessionalAssessments />} />
        <Route path="assessments/:id" element={<AssessmentRunner />} />
        <Route path="assignments" element={<ProfessionalAssignments />} />
        <Route path="assignments/:id" element={<ProfessionalAssignmentDetail />} />
        <Route path="timesheets" element={<ProfessionalTimesheets />} />
        <Route path="finance" element={<ProfessionalFinance />} />
        <Route path="career" element={<ProfessionalCareer />} />
        <Route path="reviews" element={<ProfessionalReviews />} />
        <Route path="interviews" element={<ProfessionalInterviews />} />
        <Route path="settings" element={<ProfessionalSettings />} />
        <Route path="*" element={missing('/portal/professional')} />
      </Route>

      {/* Employer portal */}
      <Route
        path="/portal/employer"
        element={
          <ProtectedRoute role="employer">
            <PortalLayout role="employer" />
          </ProtectedRoute>
        }
      >
        <Route index element={<EmployerDashboard />} />
        <Route path="requirements" element={<EmployerRequirements />} />
        <Route path="talent" element={<EmployerTalent />} />
        <Route path="shortlist" element={<EmployerShortlist />} />
        <Route path="interviews" element={<EmployerInterviews />} />
        <Route path="assignments" element={<EmployerAssignments />} />
        <Route path="assignments/:id" element={<EmployerAssignmentDetail />} />
        <Route path="timesheets" element={<EmployerTimesheets />} />
        <Route path="finance" element={<EmployerFinance />} />
        <Route path="reviews" element={<EmployerReviews />} />
        <Route path="profile" element={<EmployerProfile />} />
        <Route path="settings" element={<EmployerSettings />} />
        <Route path="*" element={missing('/portal/employer')} />
      </Route>

      {/* Administration portal */}
      <Route
        path="/portal/admin"
        element={
          <ProtectedRoute role="admin">
            <PortalLayout role="admin" />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="verifications" element={<AdminVerifications />} />
        <Route path="assessments" element={<AdminAssessments />} />
        <Route path="finance" element={<AdminFinance />} />
        <Route path="disputes" element={<AdminDisputes />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="audit" element={<AdminAudit />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="*" element={missing('/portal/admin')} />
      </Route>
    </Routes>
  );
}
