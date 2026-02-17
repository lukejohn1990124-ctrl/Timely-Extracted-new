import { BrowserRouter as Router, Routes, Route } from "react-router";
import { AuthProvider } from "@getmocha/users-service/react";
import HomePage from "@/react-app/pages/Home";
import DashboardPage from "@/react-app/pages/Dashboard";
import ConnectionsPage from "@/react-app/pages/Connections";
import PayPalDashboardPage from "@/react-app/pages/PayPalDashboard";
import RemindersPage from "@/react-app/pages/settings/Reminders";
import TemplatesPage from "@/react-app/pages/settings/Templates";
import TemplateEditorPage from "@/react-app/pages/TemplateEditor";
import IntegrationsPage from "@/react-app/pages/settings/Integrations";
import EmailProvidersPage from "@/react-app/pages/settings/EmailProviders";
import BillingPage from "@/react-app/pages/settings/Billing";
import LoginPage from "@/react-app/pages/Login";
import SignupPage from "@/react-app/pages/Signup";
import AuthCallbackPage from "@/react-app/pages/AuthCallback";
import PayPalCallbackPage from "@/react-app/pages/PayPalCallback";
import MailchimpCallbackPage from "@/react-app/pages/MailchimpCallback";

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/api/integrations/paypal/callback" element={<PayPalCallbackPage />} />
          <Route path="/api/oauth/mailchimp/callback" element={<MailchimpCallbackPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/connections" element={<ConnectionsPage />} />
          <Route path="/paypal" element={<PayPalDashboardPage />} />
          <Route path="/settings/reminders" element={<RemindersPage />} />
          <Route path="/settings/templates" element={<TemplatesPage />} />
          <Route path="/template/editor" element={<TemplateEditorPage />} />
          <Route path="/settings/integrations" element={<IntegrationsPage />} />
          <Route path="/settings/email-providers" element={<EmailProvidersPage />} />
          <Route path="/settings/billing" element={<BillingPage />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
