import { useState } from "react";
import { X, Plus, Check } from "lucide-react";

interface Invoice {
  id: number;
  invoiceNumber: string;
  clientName: string;
  amount: string;
  email?: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  lastModified: string;
}

interface ScheduleItem {
  id: string;
  day: number;
  label: string;
  description: string;
  enabled: boolean;
  template: EmailTemplate | null;
  isCustom?: boolean;
}

interface BulkReminderOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: Invoice[];
  templates: EmailTemplate[];
  onCreateReminder: (invoiceIds: number[], schedules: any[], recipientEmails: string[]) => void;
}

export default function BulkReminderOverlay({
  isOpen,
  onClose,
  invoices,
  templates,
  onCreateReminder,
}: BulkReminderOverlayProps) {
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<number>>(new Set());
  const [schedules, setSchedules] = useState<ScheduleItem[]>([
    { id: "day2", day: 2, label: "Day 2 overdue", description: "Will be sent when the invoice is overdue by 2 days.", enabled: false, template: null },
    { id: "day7", day: 7, label: "Day 7 overdue", description: "Will be sent when the invoice is overdue by 7 days.", enabled: false, template: null },
    { id: "day14", day: 14, label: "Day 14 overdue", description: "Will be sent when the invoice is overdue by 14 days.", enabled: false, template: null },
  ]);

  const [templateSelectorOpen, setTemplateSelectorOpen] = useState(false);
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);
  const [recipientEmails, setRecipientEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  if (!isOpen) return null;

  const allSelected = invoices.length > 0 && selectedInvoiceIds.size === invoices.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedInvoiceIds(new Set());
    } else {
      setSelectedInvoiceIds(new Set(invoices.map((inv) => inv.id)));
    }
  };

  const toggleInvoice = (invoiceId: number) => {
    const newSelected = new Set(selectedInvoiceIds);
    if (newSelected.has(invoiceId)) {
      newSelected.delete(invoiceId);
    } else {
      newSelected.add(invoiceId);
    }
    setSelectedInvoiceIds(newSelected);
  };

  const toggleSchedule = (id: string) => {
    setSchedules((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const openTemplateSelector = (scheduleId: string) => {
    setActiveScheduleId(scheduleId);
    setTemplateSelectorOpen(true);
  };

  const selectTemplate = (template: EmailTemplate) => {
    if (activeScheduleId) {
      setSchedules((prev) =>
        prev.map((s) => (s.id === activeScheduleId ? { ...s, template } : s))
      );
    }
    setTemplateSelectorOpen(false);
    setActiveScheduleId(null);
  };

  const removeTemplate = (scheduleId: string) => {
    setSchedules((prev) =>
      prev.map((s) => (s.id === scheduleId ? { ...s, template: null } : s))
    );
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const handleEmailInputChange = (value: string) => {
    setEmailInput(value);
    setEmailError(null);
  };

  const handleAddEmail = () => {
    const trimmedEmail = emailInput.trim();
    
    if (!trimmedEmail) {
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    if (recipientEmails.includes(trimmedEmail)) {
      setEmailError("This email has already been added");
      return;
    }

    setRecipientEmails((prev) => [...prev, trimmedEmail]);
    setEmailInput("");
    setEmailError(null);
  };

  const handleEmailInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddEmail();
    }
  };

  const removeEmail = (emailToRemove: string) => {
    setRecipientEmails((prev) => prev.filter((email) => email !== emailToRemove));
  };

  const handleAddInvoiceEmails = () => {
    const selectedInvoices = invoices.filter((inv) => selectedInvoiceIds.has(inv.id));
    const newEmails = selectedInvoices
      .map((inv) => inv.email)
      .filter((email): email is string => !!email && !recipientEmails.includes(email));
    
    if (newEmails.length > 0) {
      setRecipientEmails((prev) => [...prev, ...newEmails]);
    }
  };

  const hasValidSchedule = schedules.some((s) => s.enabled && s.template);
  const hasSelectedInvoices = selectedInvoiceIds.size > 0;
  const hasValidEmail = recipientEmails.length > 0;
  const canCreateReminder = hasValidSchedule && hasSelectedInvoices && hasValidEmail;

  const handleCreateReminder = () => {
    if (canCreateReminder) {
      const enabledSchedules = schedules.filter((s) => s.enabled && s.template);
      onCreateReminder(Array.from(selectedInvoiceIds), enabledSchedules, recipientEmails);
    }
  };

  return (
    <>
      {/* Main Overlay */}
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
        <div
          className="bg-white rounded-2xl w-full max-w-[620px] max-h-[90vh] overflow-y-auto"
          style={{
            fontFamily: "Arimo, sans-serif",
            border: "2px solid #C5D3F4",
          }}
        >
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2
                className="text-[#0037C2] font-bold"
                style={{ fontSize: "24px" }}
              >
                New Bulk Reminder
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Divider */}
            <div className="border-t border-[#C5D3F4] mb-6"></div>

            {/* Select Invoices Section */}
            <div className="mb-6">
              <h3
                className="font-bold mb-1"
                style={{ fontSize: "16px", color: "#0A0750" }}
              >
                Select Invoices
              </h3>
              <p
                className="text-sm mb-5"
                style={{ color: "#5A6B8A" }}
              >
                Choose when you would like the emails to be sent after an invoice becomes overdue.
              </p>

              {/* Select All Checkbox */}
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={toggleSelectAll}
                  className="w-6 h-6 rounded border-2 flex items-center justify-center transition-all"
                  style={{
                    borderColor: allSelected ? "#0037C2" : "#C5D3F4",
                    backgroundColor: allSelected ? "#0037C2" : "transparent",
                  }}
                >
                  {allSelected && <Check className="w-4 h-4 text-white" />}
                </button>
                <span
                  className="font-semibold text-sm"
                  style={{ color: "#0A0750" }}
                >
                  Select All
                </span>
              </div>

              {/* Invoice List */}
              <div className="space-y-2 max-h-[240px] overflow-y-auto">
                {invoices.map((invoice) => {
                  const isSelected = selectedInvoiceIds.has(invoice.id);
                  return (
                    <div
                      key={invoice.id}
                      className="flex items-center gap-4 rounded-xl p-3"
                      style={{
                        backgroundColor: "#F8FAFF",
                        border: isSelected ? "2px solid #0037C2" : "1.5px solid #C5D3F4",
                      }}
                    >
                      <button
                        onClick={() => toggleInvoice(invoice.id)}
                        className="w-6 h-6 rounded border-2 flex items-center justify-center transition-all flex-shrink-0"
                        style={{
                          borderColor: isSelected ? "#0037C2" : "#C5D3F4",
                          backgroundColor: isSelected ? "#0037C2" : "transparent",
                        }}
                      >
                        {isSelected && <Check className="w-4 h-4 text-white" />}
                      </button>

                      <div className="flex-1 grid grid-cols-6 gap-2 text-xs">
                        <div>
                          <p style={{ color: "#5A6B8A" }}>Invoice #</p>
                          <p className="font-bold" style={{ color: "#0A0750" }}>
                            #{invoice.invoiceNumber}
                          </p>
                        </div>
                        <div>
                          <p style={{ color: "#5A6B8A" }}>Client</p>
                          <p className="font-bold" style={{ color: "#0A0750" }}>
                            {invoice.clientName}
                          </p>
                        </div>
                        <div>
                          <p style={{ color: "#5A6B8A" }}>Amount</p>
                          <p className="font-bold" style={{ color: "#0A0750" }}>
                            {invoice.amount}
                          </p>
                        </div>
                        <div>
                          <p style={{ color: "#5A6B8A" }}>Field Name</p>
                          <p className="font-bold" style={{ color: "#0A0750" }}>
                            Value
                          </p>
                        </div>
                        <div>
                          <p style={{ color: "#5A6B8A" }}>Field Name</p>
                          <p className="font-bold" style={{ color: "#0A0750" }}>
                            Value
                          </p>
                        </div>
                        <div>
                          <p style={{ color: "#5A6B8A" }}>Field Name</p>
                          <p className="font-bold" style={{ color: "#0A0750" }}>
                            Value
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Create a Schedule Section */}
            <div className="mb-6">
              <h3
                className="font-bold mb-1"
                style={{ fontSize: "16px", color: "#0A0750" }}
              >
                Create a Schedule
              </h3>
              <p
                className="text-sm mb-5"
                style={{ color: "#5A6B8A" }}
              >
                Choose when you would like the emails to be sent after an invoice becomes overdue.
              </p>

              {/* Schedule Items */}
              <div className="space-y-4">
                {schedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="rounded-xl overflow-hidden"
                    style={{
                      border: schedule.enabled ? "2px solid #0037C2" : "1.5px solid #C5D3F4",
                      backgroundColor: "#F8FAFF",
                    }}
                  >
                    {/* Schedule Header */}
                    <div className="p-4 flex items-center gap-4">
                      {/* Info Section */}
                      <div className="flex-1">
                        <p
                          className="font-bold text-sm"
                          style={{ color: "#0A0750" }}
                        >
                          {schedule.label}
                        </p>
                        <p
                          className="text-xs"
                          style={{ color: "#5A6B8A" }}
                        >
                          {schedule.description}
                        </p>
                      </div>

                      {/* Toggle */}
                      <button
                        onClick={() => toggleSchedule(schedule.id)}
                        className="flex items-center justify-center rounded-full px-4 py-1.5 min-w-[72px] transition-all"
                        style={{
                          backgroundColor: "#0A0750",
                          color: "#fff",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}
                      >
                        {schedule.enabled ? "ON" : "OFF"}
                      </button>

                      {/* Choose Email Template Button */}
                      <button
                        onClick={() => schedule.enabled && openTemplateSelector(schedule.id)}
                        className="flex items-center gap-1.5 transition-all"
                        style={{
                          color: schedule.enabled ? "#0037C2" : "#B8C4DC",
                          fontSize: "13px",
                          fontWeight: 500,
                          cursor: schedule.enabled ? "pointer" : "default",
                        }}
                        disabled={!schedule.enabled}
                      >
                        <Plus className="w-4 h-4" />
                        <span>Choose Email Template</span>
                      </button>
                    </div>

                    {/* Expanded Template Section */}
                    {schedule.enabled && schedule.template && (
                      <div className="px-4 pb-4 flex items-center gap-3">
                        <div
                          className="flex-1 rounded-lg px-4 py-3"
                          style={{
                            backgroundColor: "#fff",
                            border: "1px solid #E5E7EB",
                          }}
                        >
                          <p
                            className="font-semibold text-sm"
                            style={{ color: "#0A0750" }}
                          >
                            {schedule.template.name}
                          </p>
                          <p
                            className="text-xs"
                            style={{ color: "#5A6B8A" }}
                          >
                            Last Modified: {schedule.template.lastModified}
                          </p>
                        </div>
                        <button
                          onClick={() => removeTemplate(schedule.id)}
                          className="text-[#0A0750] hover:text-red-500 transition"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Choose Email Recipients Section */}
            <div className="mb-8">
              <h3
                className="font-bold mb-1"
                style={{ fontSize: "16px", color: "#0A0750" }}
              >
                Choose Email Recipients
              </h3>
              <p
                className="text-sm mb-4"
                style={{ color: "#5A6B8A" }}
              >
                Add one or more email addresses to send these reminders to
              </p>

              {/* Add Emails from Selected Invoices */}
              {selectedInvoiceIds.size > 0 && (
                <div
                  className="rounded-xl p-4 mb-4"
                  style={{
                    border: "1.5px solid #C5D3F4",
                  }}
                >
                  <p
                    className="text-xs mb-3"
                    style={{ color: "#5A6B8A" }}
                  >
                    Add Emails from Selected Invoices
                  </p>
                  <button
                    onClick={handleAddInvoiceEmails}
                    className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 transition-all"
                    style={{
                      backgroundColor: "#F0F4FF",
                      border: "2px solid transparent",
                    }}
                  >
                    <span
                      className="text-sm font-semibold"
                      style={{ color: "#0A0750" }}
                    >
                      Add {selectedInvoiceIds.size} email{selectedInvoiceIds.size !== 1 ? "s" : ""} from selected invoices
                    </span>
                    <Plus className="w-4 h-4" style={{ color: "#0037C2" }} />
                  </button>
                </div>
              )}

              {/* Custom Email Input */}
              <div className="mb-4">
                <p
                  className="text-xs mb-2 font-medium"
                  style={{ color: "#0A0750" }}
                >
                  Add Custom Email
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className="flex-1 rounded-xl p-4"
                    style={{
                      border: emailError ? "1.5px solid #EF4444" : "1.5px solid #C5D3F4",
                      backgroundColor: "#F8FAFF",
                    }}
                  >
                    <p
                      className="text-xs mb-1"
                      style={{ color: "#5A6B8A" }}
                    >
                      Email Address
                    </p>
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => handleEmailInputChange(e.target.value)}
                      onKeyDown={handleEmailInputKeyDown}
                      placeholder="Enter email address"
                      className="w-full text-sm bg-transparent outline-none"
                      style={{ color: "#0A0750" }}
                    />
                  </div>
                  <button
                    onClick={handleAddEmail}
                    className="px-5 py-3 rounded-full text-sm font-semibold transition-all hover:opacity-90"
                    style={{
                      backgroundColor: "#0037C2",
                      color: "#fff",
                    }}
                  >
                    Add
                  </button>
                </div>
                {emailError && (
                  <p className="text-xs text-red-500 mt-1">{emailError}</p>
                )}
              </div>

              {/* Added Emails List */}
              {recipientEmails.length > 0 && (
                <div
                  className="rounded-xl p-4"
                  style={{
                    border: "1.5px solid #C5D3F4",
                    backgroundColor: "#F8FAFF",
                  }}
                >
                  <p
                    className="text-xs mb-3 font-medium"
                    style={{ color: "#0A0750" }}
                  >
                    Recipients ({recipientEmails.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {recipientEmails.map((email) => (
                      <div
                        key={email}
                        className="inline-flex items-center gap-2 rounded-full px-4 py-2"
                        style={{
                          backgroundColor: "#fff",
                          border: "1px solid #C5D3F4",
                        }}
                      >
                        <span
                          className="text-sm"
                          style={{ color: "#0A0750" }}
                        >
                          {email}
                        </span>
                        <button
                          onClick={() => removeEmail(email)}
                          className="text-[#5A6B8A] hover:text-red-500 transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Create Reminder Button */}
            <div className="flex justify-center">
              <button
                className="px-8 py-3 rounded-full font-semibold text-sm transition-all hover:opacity-90"
                style={{
                  backgroundColor: canCreateReminder ? "#0A0750" : "#C5D3F4",
                  color: canCreateReminder ? "#fff" : "#0A0750",
                  cursor: canCreateReminder ? "pointer" : "not-allowed",
                  opacity: canCreateReminder ? 1 : 0.7,
                }}
                disabled={!canCreateReminder}
                onClick={handleCreateReminder}
              >
                Create Reminder
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Template Selector Overlay */}
      {templateSelectorOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div
            className="bg-white rounded-2xl w-full max-w-[480px] max-h-[70vh] overflow-hidden"
            style={{
              fontFamily: "Arimo, sans-serif",
              border: "2px solid #C5D3F4",
            }}
          >
            <div className="p-5 border-b border-[#E5E7EB]">
              <div className="flex items-center justify-between">
                <h3
                  className="font-bold"
                  style={{ fontSize: "18px", color: "#0A0750" }}
                >
                  Choose Email Template
                </h3>
                <button
                  onClick={() => {
                    setTemplateSelectorOpen(false);
                    setActiveScheduleId(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto max-h-[calc(70vh-80px)]">
              {templates.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm" style={{ color: "#5A6B8A" }}>
                    No templates available. Please create a template first.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="rounded-xl p-4 flex items-center justify-between"
                      style={{
                        border: "1.5px solid #C5D3F4",
                        backgroundColor: "#F8FAFF",
                      }}
                    >
                      <div>
                        <p
                          className="font-semibold text-sm"
                          style={{ color: "#0A0750" }}
                        >
                          {template.name}
                        </p>
                        <p
                          className="text-xs"
                          style={{ color: "#5A6B8A" }}
                        >
                          Last Modified: {template.lastModified}
                        </p>
                      </div>
                      <button
                        onClick={() => selectTemplate(template)}
                        className="px-5 py-2 rounded-full text-xs font-semibold transition-all hover:opacity-90"
                        style={{
                          backgroundColor: "#0A0750",
                          color: "#fff",
                        }}
                      >
                        Use this
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
