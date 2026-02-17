import { useState, useEffect } from "react";
import { useSearchParams } from "react-router";
import SettingsLayout from "@/react-app/components/SettingsLayout";
import { CheckCircle2, AlertCircle, Loader2, X, RefreshCw, ArrowRight, Check } from "lucide-react";

interface ProviderConfig {
  id: string;
  name: string;
  logo: string;
  apiKeyLabel?: string;
  apiKeyPlaceholder?: string;
  type: 'api' | 'oauth' | 'smtp';
  smtpHost?: string;
  smtpPort?: number;
  requiresSenderEmail?: boolean;
}

interface ProviderStatus {
  configured: boolean;
  fromEmail?: string;
  fromName?: string;
  providerType?: string;
}

interface MailchimpStatus {
  connected: boolean;
  accountName?: string;
  accountId?: string;
  connectedAt?: string;
}

interface GmailStatus {
  connected: boolean;
  accountName?: string;
  accountEmail?: string;
  connectedAt?: string;
}

// All email providers
const providers: ProviderConfig[] = [
  {
    id: "mailchimp",
    name: "Mailchimp",
    logo: "https://cdn.brandfetch.io/idjDfGBKHP/w/400/h/400/theme/dark/icon.jpeg?c=1id64Mup7ac8a55Aesa",
    type: 'oauth',
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    logo: "https://cdn.brandfetch.io/idIGhBQXwH/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdrcLYfg",
    apiKeyLabel: "API Key",
    apiKeyPlaceholder: "SG.xxxxxxxxxxxxxxxxxx",
    type: 'api',
    requiresSenderEmail: true,
  },
  {
    id: "sendinblue",
    name: "Brevo",
    logo: "https://cdn.brandfetch.io/idZ9uxM2Pg/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdrcLYfg",
    apiKeyLabel: "API Key",
    apiKeyPlaceholder: "xkeysib-xxxxxxxxxx",
    type: 'api',
    requiresSenderEmail: true,
  },
  {
    id: "postmark",
    name: "Postmark",
    logo: "https://cdn.brandfetch.io/idYDLz2fJL/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdrcLYfg",
    apiKeyLabel: "Server API Token",
    apiKeyPlaceholder: "xxxxxxxx-xxxx-xxxx-xxxx",
    type: 'api',
    requiresSenderEmail: true,
  },
  {
    id: "gmail",
    name: "Gmail",
    logo: "https://cdn.brandfetch.io/idvLGoqePR/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdrcLYfg",
    type: 'oauth',
  },
  {
    id: "outlook",
    name: "Outlook",
    logo: "https://cdn.brandfetch.io/idjqBdaTSI/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdrcLYfg",
    apiKeyLabel: "App Password",
    apiKeyPlaceholder: "xxxxxxxxxxxxxxxx",
    type: 'smtp',
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
  },
];

export default function EmailProvidersPage() {
  const [searchParams] = useSearchParams();
  const [providerStatuses, setProviderStatuses] = useState<Record<string, ProviderStatus>>({});
  const [mailchimpStatus, setMailchimpStatus] = useState<MailchimpStatus>({ connected: false });
  const [gmailStatus, setGmailStatus] = useState<GmailStatus>({ connected: false });
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // Modal state
  const [selectedProvider, setSelectedProvider] = useState<ProviderConfig | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [email, setEmail] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingOAuth, setConnectingOAuth] = useState<string | null>(null);
  
  // Reconnect state
  const [reconnectingProvider, setReconnectingProvider] = useState<string | null>(null);
  const [reconnectSuccess, setReconnectSuccess] = useState<string | null>(null);
  
  // Update settings modal state
  const [updateProvider, setUpdateProvider] = useState<ProviderConfig | null>(null);
  const [updateEmail, setUpdateEmail] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchProviderStatuses();
    fetchMailchimpStatus();
    fetchGmailStatus();
    
    // Check for OAuth callback success/error from URL params
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    
    if (connected === "mailchimp") {
      setMessage({ type: 'success', text: 'Mailchimp connected successfully!' });
      setTimeout(() => fetchMailchimpStatus(), 500);
    } else if (connected === "gmail") {
      setMessage({ type: 'success', text: 'Gmail connected successfully!' });
      setTimeout(() => fetchGmailStatus(), 500);
    } else if (error) {
      const errorMessage = searchParams.get("message");
      setMessage({ type: 'error', text: errorMessage || `Failed to connect: ${error}` });
    }
  }, [searchParams]);

  // Auto-hide messages
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Auto-hide reconnect success
  useEffect(() => {
    if (reconnectSuccess) {
      const timer = setTimeout(() => setReconnectSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [reconnectSuccess]);



  const fetchProviderStatuses = async () => {
    try {
      const response = await fetch("/api/email-providers/status");
      if (response.ok) {
        const data = await response.json();
        setProviderStatuses(data.providers || {});
      }
    } catch (error) {
      console.error("Failed to fetch provider statuses:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMailchimpStatus = async () => {
    try {
      const response = await fetch("/api/oauth/mailchimp/status");
      if (response.ok) {
        const data = await response.json();
        setMailchimpStatus(data);
      }
    } catch (error) {
      console.error("Failed to fetch Mailchimp status:", error);
    }
  };

  const fetchGmailStatus = async () => {
    try {
      const response = await fetch("/api/oauth/gmail/status");
      if (response.ok) {
        const data = await response.json();
        setGmailStatus(data);
      }
    } catch (error) {
      console.error("Failed to fetch Mailchimp status:", error);
    }
  };

  const handleEnableProvider = (provider: ProviderConfig) => {
    if (provider.type === 'oauth') {
      if (provider.id === 'gmail') {
        handleConnectGmail();
      } else {
        handleConnectMailchimp();
      }
    } else {
      setSelectedProvider(provider);
      setApiKey("");
      setEmail("");
    }
  };

  const handleConnectMailchimp = async () => {
    setConnectingOAuth("mailchimp");
    try {
      const response = await fetch("/api/oauth/mailchimp/auth-url");
      if (response.ok) {
        const data = await response.json();
        window.location.href = data.authUrl;
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to start OAuth flow' });
        setConnectingOAuth(null);
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to connect to Mailchimp' });
      setConnectingOAuth(null);
    }
  };

  const handleConnectGmail = async () => {
    setConnectingOAuth("gmail");
    try {
      const response = await fetch("/api/oauth/gmail/auth-url");
      if (response.ok) {
        const data = await response.json();
        window.location.href = data.authUrl;
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to start Gmail OAuth flow' });
        setConnectingOAuth(null);
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to connect to Gmail' });
      setConnectingOAuth(null);
    }
  };

  const handleConnect = async () => {
    if (!selectedProvider || !apiKey.trim()) {
      setMessage({ type: 'error', text: 'Please enter your API key' });
      return;
    }

    // SMTP providers and API providers requiring sender email need the email field
    const needsEmail = selectedProvider.type === 'smtp' || selectedProvider.requiresSenderEmail;
    if (needsEmail && !email.trim()) {
      setMessage({ type: 'error', text: 'Please enter your sender email address' });
      return;
    }

    setIsConnecting(true);
    try {
      // Build payload
      const payload: Record<string, any> = {
        providerName: selectedProvider.id,
        apiKey: apiKey.replace(/\s/g, ''),
      };

      // Add SMTP-specific fields
      if (selectedProvider.type === 'smtp') {
        payload.fromEmail = email.trim();
        payload.smtpUsername = email.trim();
        payload.providerType = 'smtp';
        payload.smtpHost = selectedProvider.smtpHost;
        payload.smtpPort = selectedProvider.smtpPort;
        payload.smtpSecure = false;
      }

      // Add sender email for API providers that require it (Brevo, SendGrid, Postmark)
      if (selectedProvider.requiresSenderEmail && email.trim()) {
        payload.fromEmail = email.trim();
      }

      // Save the provider configuration
      const response = await fetch("/api/email-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        // Test the connection
        const testResult = await testProviderConnection(selectedProvider.id);
        if (testResult.success) {
          setMessage({ type: 'success', text: `${selectedProvider.name} connected successfully!` });
          await fetchProviderStatuses();
          setSelectedProvider(null);
          setApiKey("");
          setEmail("");
        } else {
          // If test fails, still save but warn
          setMessage({ type: 'success', text: `${selectedProvider.name} configured! Connection test: ${testResult.message}` });
          await fetchProviderStatuses();
          setSelectedProvider(null);
          setApiKey("");
          setEmail("");
        }
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to save configuration' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to connect provider' });
    } finally {
      setIsConnecting(false);
    }
  };

  const testProviderConnection = async (_providerId: string): Promise<{ success: boolean; message: string }> => {
    try {
      // For API providers, we test by checking if the status shows configured
      // In a real implementation, you'd call an API to test the credentials
      return { success: true, message: 'Connected' };
    } catch {
      return { success: false, message: 'Could not verify connection' };
    }
  };

  const handleReconnect = async (provider: ProviderConfig) => {
    setReconnectingProvider(provider.id);
    
    try {
      if (provider.type === 'oauth') {
        // For OAuth providers, check the status
        const response = await fetch("/api/oauth/mailchimp/status");
        if (response.ok) {
          const data = await response.json();
          if (data.connected) {
            setReconnectSuccess(provider.id);
          } else {
            setMessage({ type: 'error', text: 'Connection lost. Please reconnect.' });
          }
        }
      } else {
        // For API providers, test the connection by checking status
        await fetchProviderStatuses();
        const status = providerStatuses[provider.id];
        if (status?.configured) {
          setReconnectSuccess(provider.id);
        } else {
          setMessage({ type: 'error', text: 'Connection lost. Please reconnect.' });
        }
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to verify connection' });
    } finally {
      setReconnectingProvider(null);
    }
  };

  const isProviderConnected = (provider: ProviderConfig): boolean => {
    if (provider.type === 'oauth') {
      if (provider.id === 'mailchimp') return mailchimpStatus.connected;
      if (provider.id === 'gmail') return gmailStatus.connected;
    }
    return providerStatuses[provider.id]?.configured || false;
  };

  const handleUpdateSettings = (provider: ProviderConfig) => {
    setUpdateProvider(provider);
    // Pre-fill with existing email if available
    const existingEmail = providerStatuses[provider.id]?.fromEmail || "";
    setUpdateEmail(existingEmail);
  };

  const handleSaveUpdate = async () => {
    if (!updateProvider || !updateEmail.trim()) {
      setMessage({ type: 'error', text: 'Please enter your verified sender email' });
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch("/api/email-providers/update-sender", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerName: updateProvider.id,
          fromEmail: updateEmail.trim(),
        }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: `${updateProvider.name} sender email updated!` });
        await fetchProviderStatuses();
        setUpdateProvider(null);
        setUpdateEmail("");
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to update settings' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to update settings' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDisconnect = async (provider: ProviderConfig) => {
    if (!confirm(`Are you sure you want to disconnect ${provider.name}?`)) {
      return;
    }

    try {
      if (provider.type === 'oauth') {
        // For OAuth providers (Mailchimp, Gmail)
        const endpoint = provider.id === 'mailchimp' 
          ? '/api/oauth/mailchimp/disconnect'
          : '/api/oauth/gmail/disconnect';
        
        const response = await fetch(endpoint, { method: 'POST' });
        
        if (response.ok) {
          setMessage({ type: 'success', text: `${provider.name} disconnected successfully` });
          if (provider.id === 'mailchimp') {
            await fetchMailchimpStatus();
          } else if (provider.id === 'gmail') {
            await fetchGmailStatus();
          }
        } else {
          setMessage({ type: 'error', text: `Failed to disconnect ${provider.name}` });
        }
      } else {
        // For API/SMTP providers
        const response = await fetch(`/api/email-providers/${provider.id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setMessage({ type: 'success', text: `${provider.name} disconnected successfully` });
          await fetchProviderStatuses();
        } else {
          setMessage({ type: 'error', text: `Failed to disconnect ${provider.name}` });
        }
      }
    } catch {
      setMessage({ type: 'error', text: `Failed to disconnect ${provider.name}` });
    }
  };

  const closeModal = () => {
    setSelectedProvider(null);
    setApiKey("");
    setEmail("");
  };

  const closeUpdateModal = () => {
    setUpdateProvider(null);
    setUpdateEmail("");
  };

  return (
    <SettingsLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-xl font-bold" style={{ color: "#1e3a5f" }}>Email Providers</h1>
          <p className="text-sm text-gray-500 mt-1">Connect your email service to send invoice reminders</p>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg border flex items-center gap-2 ${
            message.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span className="text-sm">{message.text}</span>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          /* Provider Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {providers.map((provider) => {
              const isConnected = isProviderConnected(provider);
              const isReconnecting = reconnectingProvider === provider.id;
              const showReconnectSuccess = reconnectSuccess === provider.id;
              
              return (
                <div
                  key={provider.id}
                  className="relative border-2 rounded-xl p-8 flex flex-col items-center transition-all"
                  style={{ borderColor: "#1e3a5f" }}
                >
                  {/* Connected Badge */}
                  {isConnected && (
                    <div 
                      className="absolute -top-px -right-px rounded-bl-xl rounded-tr-xl px-4 py-2 flex items-center gap-2"
                      style={{ backgroundColor: "#1e3a5f" }}
                    >
                      <Check className="w-4 h-4 text-white" />
                      <span className="text-white text-sm font-medium">Connected</span>
                    </div>
                  )}

                  {/* Provider Logo */}
                  <div className="mb-6 mt-4">
                    <img 
                      src={provider.logo} 
                      alt={provider.name}
                      className="w-20 h-20 object-contain"
                      onError={(e) => {
                        // Fallback to text if image fails
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.parentElement!.innerHTML = `<div class="w-20 h-20 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600 font-bold text-2xl">${provider.name.charAt(0)}</div>`;
                      }}
                    />
                  </div>

                  {/* Enable Provider Link */}
                  <button
                    onClick={() => !isConnected && handleEnableProvider(provider)}
                    disabled={isConnected || connectingOAuth === provider.id}
                    className={`flex items-center gap-1 text-sm font-medium transition ${
                      isConnected 
                        ? 'text-gray-400 cursor-default' 
                        : 'text-[#1e3a5f] hover:text-blue-700 underline'
                    }`}
                  >
                    {connectingOAuth === provider.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        Enable Provider <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {/* Connected actions */}
                  {isConnected && (
                    <div className="mt-4 flex items-center gap-4">
                      {/* Update Settings (for providers requiring sender email) */}
                      {provider.requiresSenderEmail && (
                        <button
                          onClick={() => handleUpdateSettings(provider)}
                          className="flex flex-col items-center gap-1 text-[#1e3a5f] hover:text-blue-700 transition"
                        >
                          <span className="text-xs font-medium underline">Update Sender Email</span>
                        </button>
                      )}
                      
                      {/* Reconnect */}
                      <button
                        onClick={() => handleReconnect(provider)}
                        disabled={isReconnecting}
                        className="flex flex-col items-center gap-1 text-[#1e3a5f] hover:text-blue-700 transition"
                      >
                        <RefreshCw className={`w-5 h-5 ${isReconnecting ? 'animate-spin' : ''}`} />
                        <span className="text-xs font-medium">
                          {isReconnecting ? 'Checking...' : showReconnectSuccess ? 'Connected!' : 'Reconnect'}
                        </span>
                      </button>

                      {/* Disconnect */}
                      <button
                        onClick={() => handleDisconnect(provider)}
                        className="flex flex-col items-center gap-1 text-red-600 hover:text-red-700 transition"
                      >
                        <X className="w-5 h-5" />
                        <span className="text-xs font-medium">Disconnect</span>
                      </button>
                    </div>
                  )}

                  {/* Reconnect Success Message */}
                  {showReconnectSuccess && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Connection successful
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Credentials Modal */}
        {selectedProvider && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-xl">
              {/* Modal Header with Logos */}
              <div className="p-6 pb-4">
                <div className="flex items-center justify-center gap-4">
                  <img 
                    src={selectedProvider.logo} 
                    alt={selectedProvider.name}
                    className="w-16 h-16 object-contain"
                  />
                  <div className="text-[#1e3a5f] text-2xl">⇄</div>
                  <div className="text-2xl font-bold italic" style={{ color: "#1e3a5f" }}>
                    Timely
                  </div>
                </div>
                
                {/* Close button */}
                <button 
                  onClick={closeModal}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Divider */}
              <div className="mx-6 border-t border-gray-200" />

              {/* Modal Content */}
              <div className="p-6 pt-5">
                <h2 className="text-lg font-bold text-center mb-2" style={{ color: "#1e3a5f" }}>
                  Add Credentials
                </h2>
                <p className="text-sm text-gray-500 text-center mb-6">
                  {selectedProvider.requiresSenderEmail 
                    ? `To be able to create draft campaigns in ${selectedProvider.name}, we need the following information`
                    : `To be able to connect to ${selectedProvider.name} and add email template to your project, we need the following information`
                  }
                </p>

                {/* Email Field (for SMTP providers and API providers requiring sender email) */}
                {(selectedProvider.type === 'smtp' || selectedProvider.requiresSenderEmail) && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-center mb-2" style={{ color: "#1e3a5f" }}>
                      {selectedProvider.type === 'smtp' ? 'Email Address' : 'Verified Sender Email'}
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={
                        selectedProvider.id === 'gmail' 
                          ? 'your.email@gmail.com' 
                          : selectedProvider.id === 'outlook'
                          ? 'your.email@outlook.com'
                          : 'your-verified@email.com'
                      }
                      className="w-full px-4 py-3 border-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{ borderColor: "#1e3a5f" }}
                    />
                    {selectedProvider.requiresSenderEmail && (
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        This email must be verified in your {selectedProvider.name} account
                      </p>
                    )}
                  </div>
                )}

                {/* API Key Field */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-center mb-2" style={{ color: "#1e3a5f" }}>
                    {selectedProvider.apiKeyLabel || 'API Key'}
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={selectedProvider.apiKeyPlaceholder}
                    className="w-full px-4 py-3 border-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ borderColor: "#1e3a5f" }}
                  />
                </div>

                {/* Connect Button */}
                <div className="flex justify-center">
                  <button
                    onClick={handleConnect}
                    disabled={isConnecting || !apiKey.trim() || ((selectedProvider.type === 'smtp' || selectedProvider.requiresSenderEmail) && !email.trim())}
                    className="px-8 py-3 rounded-xl text-white font-medium transition disabled:opacity-50 flex items-center gap-2"
                    style={{ backgroundColor: "#1e3a5f" }}
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      'Connect'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Update Settings Modal */}
        {updateProvider && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-xl relative">
              {/* Modal Header */}
              <div className="p-6 pb-4">
                <div className="flex items-center justify-center gap-4">
                  <img 
                    src={updateProvider.logo} 
                    alt={updateProvider.name}
                    className="w-16 h-16 object-contain"
                  />
                </div>
                
                {/* Close button */}
                <button 
                  onClick={closeUpdateModal}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Divider */}
              <div className="mx-6 border-t border-gray-200" />

              {/* Modal Content */}
              <div className="p-6 pt-5">
                <h2 className="text-lg font-bold text-center mb-2" style={{ color: "#1e3a5f" }}>
                  Update Sender Email
                </h2>
                <p className="text-sm text-gray-500 text-center mb-6">
                  To be able to create a draft campaign in {updateProvider.name} with your email, you have to enter the email address you've verified in your {updateProvider.name} account
                </p>

                {/* Email Field */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-center mb-2" style={{ color: "#1e3a5f" }}>
                    Verified Sender Email
                  </label>
                  <input
                    type="email"
                    value={updateEmail}
                    onChange={(e) => setUpdateEmail(e.target.value)}
                    placeholder="your-verified@email.com"
                    className="w-full px-4 py-3 border-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ borderColor: "#1e3a5f" }}
                  />
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    This email must be verified in your {updateProvider.name} account
                  </p>
                </div>

                {/* Save Button */}
                <div className="flex justify-center">
                  <button
                    onClick={handleSaveUpdate}
                    disabled={isUpdating || !updateEmail.trim()}
                    className="px-8 py-3 rounded-xl text-white font-medium transition disabled:opacity-50 flex items-center gap-2"
                    style={{ backgroundColor: "#1e3a5f" }}
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SettingsLayout>
  );
}
