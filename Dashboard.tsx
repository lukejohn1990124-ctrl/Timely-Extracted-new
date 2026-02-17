import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Search, Plus, RefreshCw, ArrowRight, Pencil } from "lucide-react";
import { useAuth } from "@getmocha/users-service/react";
import DashboardNav from "@/react-app/components/DashboardNav";
import NewReminderOverlay from "@/react-app/components/NewReminderOverlay";
import NewTemplateOverlay from "@/react-app/components/NewTemplateOverlay";
import BulkReminderOverlay from "@/react-app/components/BulkReminderOverlay";
import EditReminderOverlay from "@/react-app/components/EditReminderOverlay";

interface Invoice {
  id: number;
  invoice_number: string;
  client_name: string;
  client_email?: string;
  amount: number;
  due_date?: string;
  status: string;
  external_id: string;
  last_reminder_sent?: string;
}

interface SavedEmailTemplate {
  id: string;
  name: string;
  type: string;
  subject: string;
  body: string;
  customHtml: string;
  lastModified: string;
}

interface ReminderQueueItem {
  id: number;
  invoiceId: number;
  invoiceNumber: string;
  clientName: string;
  clientEmail?: string;
  clientId: string;
  amount: number;
  scheduledDate: string;
  daysOverdue: number;
  recipientEmails: string[];
  templateName: string;
  createdAt: string;
  scheduleType: string;
  bulkGroupId?: string | null;
}

interface GroupedReminder {
  bulkGroupId: string;
  scheduledDate: string;
  daysOverdue: number;
  templateName: string;
  createdAt: string;
  recipientEmails: string[];
  reminders: ReminderQueueItem[];
}



interface ReminderInvoice {
  id: number;
  invoiceNumber: string;
  clientName: string;
  amount: string;
  email?: string;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, isPending } = useAuth();
  const [showSessionExpired, setShowSessionExpired] = useState(false);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

  // Check if session expired (user was logged in but session is now invalid)
  useEffect(() => {
    if (!isPending) {
      if (!user && hasCheckedAuth) {
        // User was logged in but session is now gone (cookies cleared, etc.)
        setShowSessionExpired(true);
      }
      setHasCheckedAuth(true);
    }
  }, [user, isPending, hasCheckedAuth]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoiceFilter, setInvoiceFilter] = useState("");
  const [templateFilter, setTemplateFilter] = useState("");
  const [reminderFilter, setReminderFilter] = useState("");
  const [reminderOverlayOpen, setReminderOverlayOpen] = useState(false);
  const [selectedInvoiceForReminder, setSelectedInvoiceForReminder] = useState<ReminderInvoice | null>(null);
  const [templateOverlayOpen, setTemplateOverlayOpen] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<SavedEmailTemplate[]>([]);
  const [selectedInvoiceContext] = useState({ clientName: "Taylor Studio", invoiceNumber: "1842", amount: "$200" });
  const [scheduledReminders, setScheduledReminders] = useState<ReminderQueueItem[]>([]);
  const [loadingReminders, setLoadingReminders] = useState(true);
  const [bulkReminderOverlayOpen, setBulkReminderOverlayOpen] = useState(false);
  const [editReminderOverlayOpen, setEditReminderOverlayOpen] = useState(false);
  const [selectedReminderForEdit, setSelectedReminderForEdit] = useState<ReminderQueueItem | null>(null);

  // Load saved templates from database
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetch("/api/templates");
        if (response.ok) {
          const data = await response.json();
          setSavedTemplates(data.templates || []);
        }
      } catch (error) {
        console.error("Error fetching templates:", error);
      }
    };
    fetchTemplates();
  }, []);

  // Fetch scheduled reminders
  const fetchScheduledReminders = async () => {
    try {
      setLoadingReminders(true);
      const response = await fetch("/api/reminders/scheduled");
      if (response.ok) {
        const data = await response.json();
        setScheduledReminders(data.reminders || []);
      }
    } catch (error) {
      console.error("Error fetching scheduled reminders:", error);
    } finally {
      setLoadingReminders(false);
    }
  };

  useEffect(() => {
    fetchScheduledReminders();
  }, []);

  const handleCreateTemplate = (templateName: string, templateType: string) => {
    setTemplateOverlayOpen(false);
    navigate(`/template/editor?name=${encodeURIComponent(templateName)}&type=${templateType}&clientName=${encodeURIComponent(selectedInvoiceContext.clientName)}&invoiceNumber=${selectedInvoiceContext.invoiceNumber}&amount=${encodeURIComponent(selectedInvoiceContext.amount)}`);
  };

  const handleEditTemplate = (template: SavedEmailTemplate) => {
    navigate(`/template/editor?id=${template.id}&name=${encodeURIComponent(template.name)}&type=${template.type}&clientName=${encodeURIComponent(selectedInvoiceContext.clientName)}&invoiceNumber=${selectedInvoiceContext.invoiceNumber}&amount=${encodeURIComponent(selectedInvoiceContext.amount)}`);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        const updatedTemplates = savedTemplates.filter((t) => t.id !== templateId);
        setSavedTemplates(updatedTemplates);
      } else {
        alert("Failed to delete template");
      }
    } catch (error) {
      console.error("Error deleting template:", error);
      alert("Failed to delete template");
    }
  };

  const openReminderOverlay = (invoiceId: number, invoiceNumber: string, clientName: string, amount: string, email?: string) => {
    setSelectedInvoiceForReminder({
      id: invoiceId,
      invoiceNumber: invoiceNumber.replace('#', ''),
      clientName,
      amount,
      email,
    });
    setReminderOverlayOpen(true);
  };

  const closeReminderOverlay = () => {
    setReminderOverlayOpen(false);
    setSelectedInvoiceForReminder(null);
  };

  const handleCreateReminder = async (invoiceId: number, schedules: any[], recipientEmails: string[]) => {
    try {
      const response = await fetch("/api/reminders/scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId,
          schedules,
          recipientEmails,
        }),
      });

      if (response.ok) {
        await fetchScheduledReminders();
        closeReminderOverlay();
      } else {
        console.error("Failed to create reminder");
      }
    } catch (error) {
      console.error("Error creating reminder:", error);
    }
  };

  const handleUpdateReminder = async (reminderId: number, updates: { scheduledDate: string; recipientEmails: string[]; daysOverdue: number }) => {
    try {
      const response = await fetch(`/api/reminders/scheduled/${reminderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        await fetchScheduledReminders();
      } else {
        console.error("Failed to update reminder");
        alert("Failed to update reminder");
      }
    } catch (error) {
      console.error("Error updating reminder:", error);
      alert("Error updating reminder");
    }
  };

  const handleDeleteReminder = async (reminderId: number) => {
    try {
      const response = await fetch(`/api/reminders/scheduled/${reminderId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchScheduledReminders();
      } else {
        console.error("Failed to delete reminder");
        alert("Failed to delete reminder");
      }
    } catch (error) {
      console.error("Error deleting reminder:", error);
      alert("Error deleting reminder");
    }
  };

  const openEditReminderOverlay = (reminder: ReminderQueueItem) => {
    setSelectedReminderForEdit(reminder);
    setEditReminderOverlayOpen(true);
  };

  const handleTestSend = async (recipientEmails: string[], templateId: string, invoiceId: number) => {
    try {
      const response = await fetch("/api/reminders/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmails,
          templateId,
          invoiceId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Test email sent to: ${data.recipients.join(", ")}`);
      } else {
        alert("Failed to send test email");
      }
    } catch (error) {
      console.error("Error sending test email:", error);
      alert("Error sending test email");
    }
  };

  // Load Google Fonts
  useEffect(() => {
    const link1 = document.createElement("link");
    link1.href = "https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&display=swap";
    link1.rel = "stylesheet";
    document.head.appendChild(link1);
    
    const link2 = document.createElement("link");
    link2.href = "https://fonts.googleapis.com/css2?family=Arimo:wght@400;700&family=Fraunces:wght@700&display=swap";
    link2.rel = "stylesheet";
    document.head.appendChild(link2);
    
    return () => {
      document.head.removeChild(link1);
      document.head.removeChild(link2);
    };
  }, []);

  const fetchInvoices = async () => {
    try {
      const response = await fetch("/api/invoices/paypal");
      if (response.ok) {
        const data = await response.json();
        setInvoices(data.invoices || []);
      }
    } catch (error) {
      console.error("Error fetching invoices:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  const openInvoiceCount = invoices.filter(inv => inv.status !== "paid").length || 17;

  const filteredInvoices = invoices.filter(inv => 
    inv.invoice_number?.toLowerCase().includes(invoiceFilter.toLowerCase()) ||
    inv.client_name?.toLowerCase().includes(invoiceFilter.toLowerCase())
  );

  const filteredTemplates = savedTemplates.filter(t =>
    t.name.toLowerCase().includes(templateFilter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Session Expired Overlay */}
      {showSessionExpired && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center shadow-xl">
            <div className="w-16 h-16 bg-[#1e2a4a]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <RefreshCw className="w-8 h-8 text-[#1e2a4a]" />
            </div>
            <h2 className="text-xl font-semibold text-[#1e2a4a] mb-2">Session Expired</h2>
            <p className="text-gray-600 mb-6">
              Your session has expired or was cleared. Please log in again to continue.
            </p>
            <button
              onClick={() => navigate("/login")}
              className="bg-[#1e2a4a] hover:bg-[#2a3a5a] text-white px-6 py-3 rounded-full font-medium transition w-full"
            >
              Log In Again
            </button>
          </div>
        </div>
      )}
      <DashboardNav />

      <main className="flex-1 max-w-[900px] mx-auto px-6 py-8 w-full">
        {/* Greeting */}
        <h1 
          className="text-[#1e2a4a] mb-8"
          style={{ fontFamily: "'UnifrakturMaguntia', cursive", fontSize: '36px', fontWeight: 400 }}
        >
          {getGreeting()} Mike
        </h1>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-5 mb-10">
          <div 
            className="border border-[#1e2a4a]/30 rounded-2xl p-5"
            style={{ boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)' }}
          >
            <p className="text-sm mb-1" style={{ fontFamily: 'Arimo, sans-serif', fontWeight: 700, color: '#0A0750' }}>
              Open Invoices
            </p>
            <p className="text-5xl mb-2" style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, color: '#0037C2' }}>
              {openInvoiceCount}
            </p>
            <p className="text-sm" style={{ fontFamily: 'Arimo, sans-serif', fontWeight: 400, color: '#0A0750' }}>
              Across connected sources
            </p>
          </div>
          <div 
            className="border border-[#1e2a4a]/30 rounded-2xl p-5"
            style={{ boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)' }}
          >
            <p className="text-sm mb-1" style={{ fontFamily: 'Arimo, sans-serif', fontWeight: 700, color: '#0A0750' }}>
              Open Invoices
            </p>
            <p className="text-5xl mb-2" style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, color: '#0037C2' }}>
              {openInvoiceCount}
            </p>
            <p className="text-sm" style={{ fontFamily: 'Arimo, sans-serif', fontWeight: 400, color: '#0A0750' }}>
              Across connected sources
            </p>
          </div>
          <div 
            className="border border-[#1e2a4a]/30 rounded-2xl p-5"
            style={{ boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)' }}
          >
            <p className="text-sm mb-1" style={{ fontFamily: 'Arimo, sans-serif', fontWeight: 700, color: '#0A0750' }}>
              Open Invoices
            </p>
            <p className="text-5xl mb-2" style={{ fontFamily: 'Fraunces, serif', fontWeight: 700, color: '#0037C2' }}>
              {openInvoiceCount}
            </p>
            <p className="text-sm" style={{ fontFamily: 'Arimo, sans-serif', fontWeight: 400, color: '#0A0750' }}>
              Across connected sources
            </p>
          </div>
        </div>

        {/* Invoice Table Section - No card wrapper */}
        <div className="mb-10">
          <button 
            onClick={() => setBulkReminderOverlayOpen(true)}
            className="bg-[#1e2a4a] hover:bg-[#2a3a5a] text-white px-5 py-2.5 rounded-full text-sm font-medium inline-flex items-center gap-2 mb-6 transition"
          >
            <Plus className="w-4 h-4" /> Create New Bulk Reminder
          </button>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Filter for invoice ID or Client Name"
              value={invoiceFilter}
              onChange={(e) => setInvoiceFilter(e.target.value)}
              className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400"
            />
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-[#4a6cb3] border-b border-gray-200">
                  <th className="px-4 py-3 font-medium">Invoice #</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Last Sent Reminder</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading invoices...</td>
                  </tr>
                ) : filteredInvoices.length > 0 ? (
                  filteredInvoices.map((invoice) => {
                    const lastReminder = scheduledReminders.find(r => r.invoiceNumber === invoice.invoice_number);
                    return (
                      <tr key={invoice.id} className="border-b border-gray-100 last:border-b-0">
                        <td className="px-4 py-4 text-[#1e2a4a]">{invoice.invoice_number}</td>
                        <td className="px-4 py-4 text-[#4a6cb3]">{invoice.client_name || "Unknown"}</td>
                        <td className="px-4 py-4 text-[#1e2a4a]">${(invoice.amount || 0).toLocaleString()}</td>
                        <td className="px-4 py-4 text-[#1e2a4a]">
                          {lastReminder ? (
                            <>
                              <span>{new Date(lastReminder.scheduledDate).toLocaleDateString()}</span>
                            </>
                          ) : (
                            <span className="text-gray-400">No reminders</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <button 
                            onClick={() => {
                              const reminderInvoice = {
                                id: invoice.id,
                                invoiceNumber: invoice.invoice_number.replace('#', ''),
                                clientName: invoice.client_name || "Unknown",
                                amount: `$${(invoice.amount || 0).toLocaleString()}`,
                                email: invoice.client_email || undefined
                              };
                              setSelectedInvoiceForReminder(reminderInvoice);
                              setReminderOverlayOpen(true);
                            }}
                            className="bg-[#1e2a4a] hover:bg-[#2a3a5a] text-white px-4 py-2 rounded-full text-xs font-medium inline-flex items-center gap-1.5 transition"
                          >
                            <Plus className="w-3.5 h-3.5" /> Create New Reminder
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <>
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-4 text-[#1e2a4a]">#1842</td>
                      <td className="px-4 py-4 text-[#4a6cb3]">Taylor Studio</td>
                      <td className="px-4 py-4 text-[#1e2a4a]">$200</td>
                      <td className="px-4 py-4 text-[#1e2a4a]">
                        <span className="text-gray-400">No reminders</span>
                      </td>
                      <td className="px-4 py-4">
                        <button 
                          onClick={() => openReminderOverlay(9999, "1842", "Taylor Studio", "$200", "taystudio@gmail.com")}
                          className="bg-[#1e2a4a] hover:bg-[#2a3a5a] text-white px-4 py-2 rounded-full text-xs font-medium inline-flex items-center gap-1.5 transition"
                        >
                          <Plus className="w-3.5 h-3.5" /> Create New Reminder
                        </button>
                      </td>
                    </tr>
                    <tr className="border-b border-gray-100 last:border-b-0">
                      <td className="px-4 py-4 text-[#1e2a4a]">#1845</td>
                      <td className="px-4 py-4 text-[#4a6cb3]">Mike's Design Co</td>
                      <td className="px-4 py-4 text-[#1e2a4a]">$450</td>
                      <td className="px-4 py-4 text-[#1e2a4a]">
                        <span className="text-gray-400">No reminders</span>
                      </td>
                      <td className="px-4 py-4">
                        <button 
                          onClick={() => openReminderOverlay(9998, "1845", "Mike's Design Co", "$450", "mike@designco.com")}
                          className="bg-[#1e2a4a] hover:bg-[#2a3a5a] text-white px-4 py-2 rounded-full text-xs font-medium inline-flex items-center gap-1.5 transition"
                        >
                          <Plus className="w-3.5 h-3.5" /> Create New Reminder
                        </button>
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Two Column Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          {/* Reminder Queue */}
          <div className="border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[#1e2a4a]">Reminder Queue</h2>
              <div className="flex items-center gap-3">
                <button className="text-gray-400 hover:text-gray-600 transition">
                  <RefreshCw className="w-4 h-4" />
                </button>
                <span className="bg-[#1e2a4a] text-white text-xs font-medium px-3 py-1 rounded-full inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-white rounded-full"></span>
                  Live
                </span>
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Filter for invoice ID or Client Name"
                value={reminderFilter}
                onChange={(e) => setReminderFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400"
              />
            </div>

            {/* Reminders List */}
            {loadingReminders ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                Loading reminders...
              </div>
            ) : scheduledReminders.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                No scheduled reminders yet
              </div>
            ) : (
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {(() => {
                  const formatScheduledDate = (dateStr: string) => {
                    const date = new Date(dateStr);
                    const today = new Date();
                    const isToday = date.toDateString() === today.toDateString();
                    if (isToday) {
                      return `Today at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
                    }
                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
                  };

                  const formatCreatedDate = (dateStr: string) => {
                    const date = new Date(dateStr);
                    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
                  };

                  // Filter reminders
                  const filteredReminders = scheduledReminders.filter(r => 
                    r.invoiceNumber.toLowerCase().includes(reminderFilter.toLowerCase()) ||
                    r.clientName.toLowerCase().includes(reminderFilter.toLowerCase())
                  );

                  // Group bulk reminders by bulkGroupId
                  const groupedBulk: Record<string, GroupedReminder> = {};
                  const singleReminders: ReminderQueueItem[] = [];

                  filteredReminders.forEach(reminder => {
                    if (reminder.bulkGroupId) {
                      if (!groupedBulk[reminder.bulkGroupId]) {
                        groupedBulk[reminder.bulkGroupId] = {
                          bulkGroupId: reminder.bulkGroupId,
                          scheduledDate: reminder.scheduledDate,
                          daysOverdue: reminder.daysOverdue,
                          templateName: reminder.templateName,
                          createdAt: reminder.createdAt,
                          recipientEmails: reminder.recipientEmails,
                          reminders: []
                        };
                      }
                      groupedBulk[reminder.bulkGroupId].reminders.push(reminder);
                    } else {
                      singleReminders.push(reminder);
                    }
                  });

                  const bulkGroups = Object.values(groupedBulk);

                  return (
                    <>
                      {/* Bulk Reminder Groups */}
                      {bulkGroups.map((group) => (
                        <div 
                          key={group.bulkGroupId} 
                          className="rounded-xl p-4"
                          style={{ 
                            border: '1.5px solid #C5D3F4',
                            backgroundColor: '#fff'
                          }}
                        >
                          {/* Header */}
                          <p 
                            className="text-xs mb-1"
                            style={{ color: 'rgba(7, 25, 115, 0.86)' }}
                          >
                            Bulk Reminder In Queue for:
                          </p>
                          <p 
                            className="text-sm font-bold mb-3"
                            style={{ color: '#071973' }}
                          >
                            {formatScheduledDate(group.scheduledDate)} for {group.reminders.length} invoices
                          </p>

                          {/* Invoice Details Container - Multiple Invoices */}
                          <div 
                            className="rounded-lg p-3 space-y-2 max-h-[200px] overflow-y-auto"
                            style={{ backgroundColor: 'rgba(236, 242, 255, 0.23)' }}
                          >
                            {group.reminders.map((reminder, idx) => (
                              <div key={reminder.id} className={`flex items-center gap-2 min-w-0 ${idx > 0 ? 'pt-2 border-t border-[#C5D3F4]/50' : ''}`}>
                                {/* Invoice # */}
                                <div className="flex-shrink-0">
                                  <p className="text-[10px]" style={{ color: 'rgba(7, 25, 115, 0.86)' }}>Invoice #</p>
                                  <p className="text-xs font-bold" style={{ color: '#071973' }}>{reminder.invoiceNumber}</p>
                                </div>

                                <ArrowRight className="w-3 h-3 flex-shrink-0" style={{ color: '#071973' }} />

                                {/* Client Name */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px]" style={{ color: 'rgba(7, 25, 115, 0.86)' }}>Client</p>
                                  <p className="text-xs font-bold truncate" style={{ color: '#071973' }}>{reminder.clientName}</p>
                                </div>

                                {/* Divider */}
                                <div className="h-6 w-px bg-[#C5D3F4] flex-shrink-0"></div>

                                {/* Amount */}
                                <div className="flex-shrink-0">
                                  <p className="text-[10px]" style={{ color: 'rgba(7, 25, 115, 0.86)' }}>Amount</p>
                                  <p className="text-xs font-bold" style={{ color: '#071973' }}>${reminder.amount}</p>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Footer with Created On and Edit Button */}
                          <div className="flex items-center justify-between mt-2">
                            <p 
                              className="text-[10px]"
                              style={{ color: 'rgba(7, 25, 115, 0.86)' }}
                            >
                              Created on: {formatCreatedDate(group.createdAt || '2026-02-08')}
                            </p>
                            <button
                              onClick={() => openEditReminderOverlay(group.reminders[0])}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:opacity-80"
                              style={{
                                backgroundColor: '#0037C2',
                                color: '#fff',
                              }}
                            >
                              <Pencil className="w-3 h-3" />
                              Edit
                            </button>
                          </div>
                        </div>
                      ))}

                      {/* Single Reminders */}
                      {singleReminders.map((reminder) => (
                        <div 
                          key={reminder.id} 
                          className="rounded-xl p-4"
                          style={{ 
                            border: '1.5px solid #C5D3F4',
                            backgroundColor: '#fff'
                          }}
                        >
                          {/* Header */}
                          <p 
                            className="text-xs mb-1"
                            style={{ color: 'rgba(7, 25, 115, 0.86)' }}
                          >
                            Single Reminder In Queue for:
                          </p>
                          <p 
                            className="text-sm font-bold mb-3"
                            style={{ color: '#071973' }}
                          >
                            {formatScheduledDate(reminder.scheduledDate)} for invoice
                          </p>

                          {/* Invoice Details Container */}
                          <div 
                            className="rounded-lg p-3 overflow-x-auto"
                            style={{ backgroundColor: 'rgba(236, 242, 255, 0.23)' }}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {/* Invoice # */}
                              <div className="flex-shrink-0">
                                <p className="text-[10px]" style={{ color: 'rgba(7, 25, 115, 0.86)' }}>Invoice #</p>
                                <p className="text-xs font-bold" style={{ color: '#071973' }}>{reminder.invoiceNumber}</p>
                              </div>

                              <ArrowRight className="w-3 h-3 flex-shrink-0" style={{ color: '#071973' }} />

                              {/* Client Name */}
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px]" style={{ color: 'rgba(7, 25, 115, 0.86)' }}>Client</p>
                                <p className="text-xs font-bold truncate" style={{ color: '#071973' }}>{reminder.clientName}</p>
                              </div>

                              {/* Divider */}
                              <div className="h-6 w-px bg-[#C5D3F4] flex-shrink-0"></div>

                              {/* Amount */}
                              <div className="flex-shrink-0">
                                <p className="text-[10px]" style={{ color: 'rgba(7, 25, 115, 0.86)' }}>Amount</p>
                                <p className="text-xs font-bold" style={{ color: '#071973' }}>${reminder.amount}</p>
                              </div>
                            </div>
                          </div>

                          {/* Footer with Created On and Edit Button */}
                          <div className="flex items-center justify-between mt-2">
                            <p 
                              className="text-[10px]"
                              style={{ color: 'rgba(7, 25, 115, 0.86)' }}
                            >
                              Created on: {formatCreatedDate(reminder.createdAt || '2026-02-08')}
                            </p>
                            <button
                              onClick={() => openEditReminderOverlay(reminder)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:opacity-80"
                              style={{
                                backgroundColor: '#0037C2',
                                color: '#fff',
                              }}
                            >
                              <Pencil className="w-3 h-3" />
                              Edit
                            </button>
                          </div>
                        </div>
                      ))}
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Saved Email Templates */}
          <div className="border border-gray-200 rounded-xl p-5">
            <h2 className="text-base font-semibold text-[#1e2a4a] mb-4">Saved Email Templates</h2>

            <button 
              onClick={() => setTemplateOverlayOpen(true)}
              className="bg-[#1e2a4a] hover:bg-[#2a3a5a] text-white px-5 py-2.5 rounded-full text-sm font-medium inline-flex items-center gap-2 mb-4 transition"
            >
              <Plus className="w-4 h-4" /> Create New Email Template
            </button>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by template name or ID"
                value={templateFilter}
                onChange={(e) => setTemplateFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400"
              />
            </div>

            {/* Template List */}
            <div>
              {filteredTemplates.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No templates yet. Create your first template!</p>
              ) : (
                filteredTemplates.map((template, index) => (
                  <div 
                    key={template.id} 
                    className={`flex items-center justify-between py-4 ${index < filteredTemplates.length - 1 ? 'border-b border-gray-200' : ''}`}
                  >
                    <div>
                      <p className="font-semibold text-[#4a6cb3] text-sm">{template.name}</p>
                      <p className="text-xs text-gray-500">Last Modified: {template.lastModified}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleEditTemplate(template)}
                        className="px-5 py-1.5 border border-gray-300 rounded-full text-xs font-medium text-[#1e2a4a] hover:bg-gray-50 transition"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="px-5 py-1.5 border border-gray-300 rounded-full text-xs font-medium text-[#1e2a4a] hover:bg-gray-50 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* New Reminder Overlay */}
      {selectedInvoiceForReminder && (
        <NewReminderOverlay
          isOpen={reminderOverlayOpen}
          onClose={closeReminderOverlay}
          invoice={selectedInvoiceForReminder}
          templates={savedTemplates.map(t => ({ id: t.id, name: t.name, lastModified: t.lastModified }))}
          onCreateReminder={(schedules, recipientEmails) => {
            handleCreateReminder(selectedInvoiceForReminder.id, schedules, recipientEmails);
          }}
          onTestSend={(recipientEmails, templateId) => {
            handleTestSend(recipientEmails, templateId, selectedInvoiceForReminder.id);
          }}
        />
      )}

      {/* New Template Overlay */}
      <NewTemplateOverlay
        isOpen={templateOverlayOpen}
        onClose={() => setTemplateOverlayOpen(false)}
        onSelectTemplate={handleCreateTemplate}
      />

      {/* Edit Reminder Overlay */}
      {selectedReminderForEdit && (
        <EditReminderOverlay
          isOpen={editReminderOverlayOpen}
          onClose={() => {
            setEditReminderOverlayOpen(false);
            setSelectedReminderForEdit(null);
          }}
          reminder={selectedReminderForEdit}
          onSave={handleUpdateReminder}
          onDelete={handleDeleteReminder}
        />
      )}

      {/* Bulk Reminder Overlay */}
      <BulkReminderOverlay
        isOpen={bulkReminderOverlayOpen}
        onClose={() => setBulkReminderOverlayOpen(false)}
        invoices={
          filteredInvoices.length > 0 
            ? filteredInvoices.map((inv) => ({
                id: inv.id,
                invoiceNumber: inv.invoice_number.replace('#', ''),
                clientName: inv.client_name || "Unknown",
                amount: `$${(inv.amount || 0).toLocaleString()}`,
                email: inv.client_email,
              }))
            : [
                { id: 9999, invoiceNumber: "1234", clientName: "Taylor Studio", amount: "$200", email: "taystudio@gmail.com" },
                { id: 9998, invoiceNumber: "1234", clientName: "Taylor Studio", amount: "$200", email: "taystudio@gmail.com" },
                { id: 9997, invoiceNumber: "1234", clientName: "Taylor Studio", amount: "$200", email: "taystudio@gmail.com" },
                { id: 9996, invoiceNumber: "1234", clientName: "Taylor Studio", amount: "$200", email: "taystudio@gmail.com" },
                { id: 9995, invoiceNumber: "1234", clientName: "Taylor Studio", amount: "$200", email: "taystudio@gmail.com" },
              ]
        }
        templates={savedTemplates.map(t => ({ id: t.id, name: t.name, lastModified: t.lastModified }))}
        onCreateReminder={async (invoiceIds, schedules, recipientEmails) => {
          try {
            // Generate a unique bulk group ID for this batch of reminders
            const bulkGroupId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Create a reminder for each selected invoice with each enabled schedule
            for (const invoiceId of invoiceIds) {
              const response = await fetch("/api/reminders/scheduled", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  invoiceId,
                  schedules: schedules.map(s => ({
                    ...s,
                    enabled: true,
                  })),
                  recipientEmails,
                  bulkGroupId,
                }),
              });

              if (!response.ok) {
                console.error("Failed to create reminder for invoice", invoiceId);
              }
            }
            await fetchScheduledReminders();
            setBulkReminderOverlayOpen(false);
          } catch (error) {
            console.error("Error creating bulk reminders:", error);
            alert("Failed to create some reminders");
          }
        }}
      />

      {/* Footer */}
      <footer className="bg-[#1e2a4a] text-white py-10 mt-auto">
        <div className="max-w-[900px] mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <span className="text-xl font-bold italic">Timely</span>
              <div className="flex items-center gap-3 mt-4">
                <a href="#" className="text-white hover:text-gray-300 transition">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
                <a href="#" className="text-white hover:text-gray-300 transition">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
                <a href="#" className="text-white hover:text-gray-300 transition">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-center">Company</h4>
              <ul className="space-y-1.5 text-sm text-gray-300 text-center">
                <li><a href="#" className="hover:text-white transition">About Us</a></li>
                <li><a href="#" className="hover:text-white transition">Contact Us</a></li>
                <li><a href="#" className="hover:text-white transition">Referral Program</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-center">Resources</h4>
              <ul className="space-y-1.5 text-sm text-gray-300 text-center">
                <li><a href="#" className="hover:text-white transition">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition">Make Timely Better</a></li>
                <li><a href="#" className="hover:text-white transition">Templates</a></li>
              </ul>
            </div>
            <div></div>
          </div>

          <div className="border-t border-gray-600 pt-6">
            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-gray-400 mb-3">
              <a href="#" className="hover:text-white transition">Terms Of Service</a>
              <a href="#" className="hover:text-white transition">Privacy Policy</a>
              <a href="#" className="hover:text-white transition">Cookie Policy</a>
              <a href="#" className="hover:text-white transition">Do Not Sell My Information (CCPA)</a>
            </div>
            <p className="text-center text-xs text-gray-400">© Timely 2026. All Rights Reserved</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
