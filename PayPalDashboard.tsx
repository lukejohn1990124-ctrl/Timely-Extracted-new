import { useState, useEffect } from "react";
import { useAuth } from "@getmocha/users-service/react";
import { useNavigate } from "react-router";
import { DollarSign, RefreshCw, AlertCircle, CheckCircle2, Clock, ExternalLink, TrendingUp, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import DashboardNav from "@/react-app/components/DashboardNav";

interface Invoice {
  id: number;
  invoice_number: string;
  client_name: string;
  client_email: string | null;
  amount: number;
  due_date: string;
  status: string;
  payment_date: string | null;
  external_id: string;
  created_at: string;
  updated_at: string;
}

interface IntegrationStatus {
  connected: boolean;
  lastSynced: string | null;
}

interface InvoiceStats {
  total: number;
  paid: number;
  pending: number;
  overdue: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
}

export default function PayPalDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [status, setStatus] = useState<IntegrationStatus>({ connected: false, lastSynced: null });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncInfo, setSyncInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchStatus();
    fetchInvoices();
  }, [user, navigate]);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/integrations/paypal/status');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch PayPal status:', err);
    }
  };

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/invoices/paypal');
      if (response.ok) {
        const data = await response.json();
        setInvoices(data.invoices || []);
        if (data.debug) {
          console.log('PayPal invoices debug info:', data.debug);
          console.log('Current user ID from API:', data.debug.currentUserId);
          console.log('Found for this user:', data.debug.foundForUser);
          console.log('All invoices in DB:', data.debug.allInDb);
        }
      } else {
        throw new Error('Failed to fetch invoices');
      }
    } catch (err) {
      setError('Failed to load PayPal invoices');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    setSyncInfo(null);
    try {
      const response = await fetch('/api/integrations/paypal/sync', {
        method: 'POST',
      });
      
      const data = await response.json();
      console.log('PayPal sync response:', data);
      
      if (data.debug) {
        console.log('=== SYNC DEBUG INFO ===');
        console.log('Current user ID:', data.debug.currentUserId);
        console.log('Total from PayPal:', data.debug.totalFromPayPal);
        console.log('Invoice IDs from PayPal:', data.debug.invoiceIds);
        console.log('All invoices in DB:', data.debug.allInvoicesInDb);
        console.log('This user invoices:', data.debug.thisUserInvoices);
        console.log('=======================');
        
        const syncedNew = data.syncedCount || 0;
        const updated = data.updatedCount || 0;
        const fromPayPal = data.debug.totalFromPayPal || 0;
        const inDb = data.debug.thisUserInvoices?.length || 0;
        
        if (fromPayPal === 0) {
          setSyncInfo(`PayPal returned 0 invoices. Make sure you have created invoices in your PayPal account.${data.debug.fetchError ? ` Error: ${data.debug.fetchError}` : ''}`);
        } else {
          setSyncInfo(`Synced ${syncedNew} new, updated ${updated}. PayPal has ${fromPayPal} invoices, ${inDb} now in database.`);
        }
      }
      
      if (response.ok) {
        await fetchInvoices();
        await fetchStatus();
        setError(null);
      } else {
        throw new Error(data.error || 'Sync failed');
      }
    } catch (err) {
      setError('Failed to sync PayPal invoices. Please try again.');
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  const calculateStats = (): InvoiceStats => {
    const now = new Date();
    const stats = {
      total: invoices.length,
      paid: 0,
      pending: 0,
      overdue: 0,
      totalAmount: 0,
      paidAmount: 0,
      pendingAmount: 0,
    };

    invoices.forEach(inv => {
      stats.totalAmount += inv.amount;
      
      if (inv.status === 'paid') {
        stats.paid++;
        stats.paidAmount += inv.amount;
      } else if (inv.status === 'pending') {
        const dueDate = new Date(inv.due_date);
        if (dueDate < now) {
          stats.overdue++;
        } else {
          stats.pending++;
        }
        stats.pendingAmount += inv.amount;
      }
    });

    return stats;
  };

  const getMonthlyData = () => {
    const monthlyMap = new Map<string, number>();
    
    invoices
      .filter(inv => inv.status === 'paid' && inv.payment_date)
      .forEach(inv => {
        const date = new Date(inv.payment_date!);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + inv.amount);
      });

    return Array.from(monthlyMap.entries())
      .sort()
      .slice(-6)
      .map(([key, amount]) => ({
        month: new Date(key + '-01').toLocaleDateString('en-US', { month: 'short' }),
        amount: Math.round(amount),
      }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatLastSynced = (lastSynced: string | null) => {
    if (!lastSynced) return 'Never';
    
    const date = new Date(lastSynced);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const isOverdue = (invoice: Invoice) => {
    if (invoice.status === 'paid') return false;
    const dueDate = new Date(invoice.due_date);
    return dueDate < new Date();
  };

  const stats = calculateStats();
  const monthlyData = getMonthlyData();

  if (!status.connected) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <DashboardNav />

        <div className="flex-1 container mx-auto px-6 py-16">
          <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="w-20 h-20 bg-blue-500 rounded-2xl flex items-center justify-center text-white font-bold text-3xl mx-auto mb-6">
              P
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Connect Your PayPal Account</h2>
            <p className="text-gray-600 mb-8">
              To view and manage your PayPal invoices, you need to connect your PayPal account first. 
              This will allow you to automatically sync invoices and track payments.
            </p>
            <button
              onClick={() => navigate('/connections')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium inline-flex items-center gap-2 transition"
            >
              Go to Connections <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <DashboardNav />

      <div className="flex-1">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-[1200px] mx-auto flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">PayPal Dashboard</h1>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium inline-flex items-center gap-2 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        </div>

        <div className="max-w-[1200px] mx-auto px-6 py-8">
          {/* Connection Status */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-500 rounded-xl flex items-center justify-center text-white font-bold text-xl">
                  P
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="font-semibold text-gray-900 text-lg">PayPal</h2>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      <CheckCircle2 className="w-3 h-3" />
                      Connected
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Last synced: {formatLastSynced(status.lastSynced)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm font-medium">{error}</span>
              </div>
            </div>
          )}
          
          {syncInfo && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-blue-800">
                <RefreshCw className="w-5 h-5" />
                <span className="text-sm font-medium">{syncInfo}</span>
              </div>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">Total Invoices</h3>
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500 mt-1">${stats.totalAmount.toLocaleString()}</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">Paid</h3>
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-green-600">{stats.paid}</p>
              <p className="text-sm text-gray-500 mt-1">${stats.paidAmount.toLocaleString()}</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">Pending</h3>
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
              <p className="text-sm text-gray-500 mt-1">${stats.pendingAmount.toLocaleString()}</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">Overdue</h3>
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <p className="text-3xl font-bold text-red-600">{stats.overdue}</p>
            </div>
          </div>

          {/* Monthly Revenue Chart */}
          {monthlyData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Monthly PayPal Revenue</h3>
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                    label={{ value: 'Amount ($)', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6b7280' } }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                    formatter={(value: number | undefined) => value ? [`$${value.toLocaleString()}`, 'Revenue'] : ['', '']}
                  />
                  <Bar 
                    dataKey="amount" 
                    fill="#0070ba"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Invoices Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">PayPal Invoices</h2>
            </div>
            
            {loading ? (
              <div className="p-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-4" />
                <p className="text-gray-600">Loading invoices...</p>
              </div>
            ) : invoices.length === 0 ? (
              <div className="p-12 text-center">
                <DollarSign className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No PayPal Invoices</h3>
                <p className="text-gray-600 mb-6">
                  Click "Sync Now" to import your PayPal invoices
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Date</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {invoice.invoice_number}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{invoice.client_name}</div>
                          {invoice.client_email && (
                            <div className="text-xs text-gray-500">{invoice.client_email}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                          ${invoice.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatDate(invoice.due_date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                            invoice.status === 'paid' ? 'bg-green-100 text-green-700' :
                            isOverdue(invoice) ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {invoice.status === 'paid' && <CheckCircle2 className="w-3 h-3" />}
                            {isOverdue(invoice) && <AlertCircle className="w-3 h-3" />}
                            {invoice.status === 'pending' && !isOverdue(invoice) && <Clock className="w-3 h-3" />}
                            {invoice.status === 'paid' ? 'Paid' : isOverdue(invoice) ? 'Overdue' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {invoice.payment_date ? formatDate(invoice.payment_date) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
