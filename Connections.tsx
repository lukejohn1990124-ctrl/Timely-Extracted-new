import { useState, useEffect } from "react";
import { CheckCircle2, ExternalLink, AlertCircle, Loader2, Link2 } from "lucide-react";
import DashboardNav from "@/react-app/components/DashboardNav";

interface IntegrationStatus {
  connected: boolean;
  lastSynced: string | null;
  userIdentifier?: string;
  accountId?: string;
  balance?: { currency: string; value: string } | null;
}

interface Integration {
  id: string;
  name: string;
  description: string;
  connected: boolean;
  logo: string;
  color: string;
  lastSynced?: string;
  userIdentifier?: string;
  accountId?: string;
  balance?: { currency: string; value: string } | null;
}

const integrationConfigs = [
  {
    id: "paypal",
    name: "PayPal",
    description: "Sync PayPal invoices and track payments automatically",
    logo: "P",
    color: "bg-[#0070ba]"
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Connect your Stripe account to automatically sync invoices and payment data",
    logo: "S",
    color: "bg-[#635bff]"
  },
  {
    id: "wave",
    name: "Wave",
    description: "Import Wave accounting invoices and client data",
    logo: "W",
    color: "bg-gray-700"
  },
  {
    id: "gumroad",
    name: "Gumroad",
    description: "Track digital product sales and send payment reminders",
    logo: "G",
    color: "bg-pink-500"
  },
];

export default function ConnectionsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>(
    integrationConfigs.map(config => ({ ...config, connected: false }))
  );
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [syncingStates, setSyncingStates] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    // Check for OAuth callback results
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected')) {
      const connectedService = params.get('connected');
      setMessage({ type: 'success', text: `${connectedService} connected successfully!` });
      
      const serviceId = connectedService?.toLowerCase();
      if (serviceId) {
        setIntegrations(prev => prev.map(int => 
          int.id === serviceId 
            ? { ...int, connected: true }
            : int
        ));
      }
      
      window.history.replaceState({}, '', '/connections');
    }
    if (params.get('error')) {
      setMessage({ type: 'error', text: `Failed to connect ${params.get('error')}. Please try again.` });
      window.history.replaceState({}, '', '/connections');
    }
    
    checkIntegrationStatuses();
  }, []);

  const checkIntegrationStatuses = async () => {
    try {
      const response = await fetch('/api/integrations/paypal/status');
      if (response.ok) {
        const status: IntegrationStatus = await response.json();
        updateIntegrationStatus('paypal', status);
      }
    } catch (error) {
      console.error('Failed to check PayPal status:', error);
    }
  };

  const updateIntegrationStatus = (id: string, status: IntegrationStatus) => {
    setIntegrations(prev => prev.map(int => 
      int.id === id 
        ? { 
            ...int, 
            connected: status.connected, 
            lastSynced: status.lastSynced || undefined, 
            userIdentifier: status.userIdentifier,
            accountId: status.accountId,
            balance: status.balance
          }
        : int
    ));
  };

  const handleConnect = async (integrationId: string) => {
    setLoadingStates(prev => ({ ...prev, [integrationId]: true }));
    
    try {
      if (integrationId === 'paypal') {
        const response = await fetch('/api/integrations/paypal/auth-url');
        const data = await response.json();
        if (data.authUrl) {
          window.location.href = data.authUrl;
        } else {
          throw new Error('Failed to get authorization URL');
        }
      } else {
        setMessage({ type: 'error', text: `${integrationId} integration coming soon!` });
      }
    } catch (error) {
      console.error(`Failed to connect ${integrationId}:`, error);
      setMessage({ type: 'error', text: `Failed to connect ${integrationId}` });
    } finally {
      setLoadingStates(prev => ({ ...prev, [integrationId]: false }));
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    if (!confirm(`Are you sure you want to disconnect ${integrationId}?`)) {
      return;
    }

    setLoadingStates(prev => ({ ...prev, [integrationId]: true }));
    
    try {
      const response = await fetch(`/api/integrations/${integrationId}/disconnect`, {
        method: 'POST',
      });
      
      if (response.ok) {
        setIntegrations(prev => prev.map(int => 
          int.id === integrationId 
            ? { ...int, connected: false, lastSynced: undefined }
            : int
        ));
        setMessage({ type: 'success', text: `${integrationId} disconnected successfully` });
      } else {
        throw new Error('Failed to disconnect');
      }
    } catch (error) {
      console.error(`Failed to disconnect ${integrationId}:`, error);
      setMessage({ type: 'error', text: `Failed to disconnect ${integrationId}` });
    } finally {
      setLoadingStates(prev => ({ ...prev, [integrationId]: false }));
    }
  };

  const handleSync = async (integrationId: string) => {
    setSyncingStates(prev => ({ ...prev, [integrationId]: true }));
    
    try {
      const response = await fetch(`/api/integrations/${integrationId}/sync`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (response.ok) {
        let messageText = `Synced ${data.syncedCount} new invoices from ${integrationId}`;
        
        if (data.debug) {
          const debug = data.debug;
          if (debug.fetchError) {
            messageText = `Sync failed: ${debug.fetchError}`;
            setMessage({ type: 'error', text: messageText });
          } else if (debug.totalFromPayPal === 0) {
            messageText = `No invoices found in your ${integrationId} account`;
            setMessage({ type: 'success', text: messageText });
          } else {
            messageText = `Found ${debug.totalFromPayPal} invoices, synced ${data.syncedCount} new`;
            setMessage({ type: 'success', text: messageText });
          }
        } else {
          setMessage({ type: 'success', text: messageText });
        }
        
        await checkIntegrationStatuses();
      } else {
        throw new Error(data.error || 'Failed to sync');
      }
    } catch (error) {
      console.error(`Failed to sync ${integrationId}:`, error);
      setMessage({ type: 'error', text: `Failed to sync ${integrationId}` });
    } finally {
      setSyncingStates(prev => ({ ...prev, [integrationId]: false }));
    }
  };

  const formatLastSynced = (lastSynced?: string) => {
    if (!lastSynced) return null;
    
    const date = new Date(lastSynced);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hours ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <DashboardNav />

      <main className="flex-1 max-w-[900px] mx-auto px-6 py-8 w-full">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Link2 className="w-8 h-8 text-[#1e2a4a]" />
            <h1 className="text-3xl font-bold text-[#1e2a4a]">Connect Your Accounts</h1>
          </div>
          <p className="text-gray-600">Link your payment platforms to automatically sync invoices and track payments</p>
        </div>

        {/* Message Alert */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl border ${
            message.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center gap-2">
              {message.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              <span className="text-sm font-medium">{message.text}</span>
              <button 
                onClick={() => setMessage(null)}
                className="ml-auto text-sm opacity-70 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Integration Cards */}
        <div className="space-y-4">
          {integrations.map((integration) => (
            <div
              key={integration.id}
              className="border border-[#1e2a4a]/20 rounded-2xl p-6 hover:border-[#1e2a4a]/40 transition bg-white"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className={`w-14 h-14 ${integration.color} rounded-xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0`}>
                    {integration.logo}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-[#1e2a4a] text-lg">{integration.name}</h3>
                      {integration.connected && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <CheckCircle2 className="w-3 h-3" />
                          Connected
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{integration.description}</p>
                    
                    {integration.connected && integration.userIdentifier && (
                      <div className="mt-2 text-xs text-gray-500">
                        Connected as: <span className="font-medium text-[#1e2a4a]">{integration.userIdentifier}</span>
                      </div>
                    )}
                    
                    {integration.connected && integration.id === 'paypal' && integration.accountId && (
                      <div className="mt-2 space-y-1">
                        <div className="text-xs text-gray-500">
                          Account ID: <span className="font-mono font-medium text-[#1e2a4a]">{integration.accountId}</span>
                        </div>
                        {integration.balance && (
                          <div className="text-xs text-gray-500">
                            Balance: <span className="font-medium text-[#1e2a4a]">{integration.balance.currency} {integration.balance.value}</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {integration.connected && integration.lastSynced && (
                      <div className="mt-2 text-xs text-gray-500">
                        Last synced: {formatLastSynced(integration.lastSynced)}
                      </div>
                    )}
                    
                    {integration.connected && integration.id === 'paypal' && (
                      <a 
                        href="/paypal" 
                        className="mt-3 text-sm text-[#4a6cb3] hover:text-[#1e2a4a] font-medium inline-flex items-center gap-1"
                      >
                        View PayPal Dashboard →
                      </a>
                    )}
                  </div>
                </div>
                
                <div className="ml-4 flex-shrink-0">
                  {integration.connected ? (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleSync(integration.id)}
                        disabled={syncingStates[integration.id]}
                        className="text-sm text-[#1e2a4a] hover:bg-gray-50 transition px-4 py-2 border border-[#1e2a4a]/30 rounded-full font-medium inline-flex items-center gap-2 disabled:opacity-50"
                      >
                        {syncingStates[integration.id] && <Loader2 className="w-4 h-4 animate-spin" />}
                        Sync Now
                      </button>
                      <button 
                        onClick={() => handleDisconnect(integration.id)}
                        disabled={loadingStates[integration.id]}
                        className="text-sm text-red-600 hover:bg-red-50 transition px-4 py-2 border border-red-200 rounded-full font-medium disabled:opacity-50"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleConnect(integration.id)}
                      disabled={loadingStates[integration.id]}
                      className="bg-[#1e2a4a] hover:bg-[#2a3a5a] text-white px-5 py-2.5 rounded-full text-sm font-medium inline-flex items-center gap-2 transition disabled:opacity-50"
                    >
                      {loadingStates[integration.id] ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          Connect <ExternalLink className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-[#1e2a4a]/5 border border-[#1e2a4a]/20 rounded-2xl p-6">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-[#1e2a4a] flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-[#1e2a4a] mb-1">Secure OAuth Integration</h4>
              <p className="text-sm text-gray-600 mb-2">
                All integrations use secure OAuth 2.0 authentication. We never store your passwords and only request the minimum permissions needed to sync invoice data.
              </p>
              <p className="text-sm text-gray-600">
                <strong>Security:</strong> AES-256-GCM encryption, SOC-2 compliant, HTTPS-only communication.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
