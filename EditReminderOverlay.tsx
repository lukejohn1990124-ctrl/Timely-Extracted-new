import { useState, useEffect } from "react";
import { X, Save, Trash2 } from "lucide-react";

interface ReminderData {
  id: number;
  invoiceId: number;
  invoiceNumber: string;
  clientName: string;
  clientEmail?: string;
  clientId: string;
  amount: number;
  daysOverdue: number;
  scheduledDate: string;
  recipientEmails: string[];
  templateName: string;
  createdAt: string;
  scheduleType: string;
}

interface EditReminderOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  reminder: ReminderData;
  onSave: (reminderId: number, updates: { scheduledDate: string; recipientEmails: string[]; daysOverdue: number }) => void;
  onDelete: (reminderId: number) => void;
}

export default function EditReminderOverlay({
  isOpen,
  onClose,
  reminder,
  onSave,
  onDelete,
}: EditReminderOverlayProps) {
  const [scheduledDate, setScheduledDate] = useState(reminder.scheduledDate);
  const [daysOverdue, setDaysOverdue] = useState(String(reminder.daysOverdue));
  const [recipientEmails, setRecipientEmails] = useState<string[]>(reminder.recipientEmails);
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setScheduledDate(reminder.scheduledDate);
      setDaysOverdue(String(reminder.daysOverdue));
      setRecipientEmails([...reminder.recipientEmails]);
      setEmailInput("");
      setEmailError(null);
      setShowDeleteConfirm(false);
    }
  }, [isOpen, reminder]);

  if (!isOpen) return null;

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

  const handleDaysOverdueChange = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, "");
    setDaysOverdue(numericValue);
  };

  const handleSave = async () => {
    if (recipientEmails.length === 0) {
      setEmailError("At least one recipient email is required");
      return;
    }

    setIsSaving(true);
    try {
      await onSave(reminder.id, {
        scheduledDate,
        recipientEmails,
        daysOverdue: parseInt(daysOverdue, 10) || reminder.daysOverdue,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    onDelete(reminder.id);
    onClose();
  };

  const formatCreatedDate = (dateStr: string) => {
    if (!dateStr) return "02/08/26";
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div
        className="bg-white rounded-2xl w-full max-w-[580px] max-h-[90vh] overflow-y-auto"
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
              Edit Reminder
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Invoice Info Container */}
          <div
            className="rounded-xl p-4 mb-6"
            style={{
              border: "1.5px solid #C5D3F4",
              backgroundColor: "rgba(236, 242, 255, 0.23)",
            }}
          >
            <div className="flex items-center gap-4">
              {/* Invoice # */}
              <div className="min-w-[60px]">
                <p className="text-[10px]" style={{ color: 'rgba(7, 25, 115, 0.86)' }}>Invoice #</p>
                <p className="text-sm font-bold" style={{ color: '#071973' }}>{reminder.invoiceNumber}</p>
              </div>

              {/* Client Name */}
              <div className="min-w-[100px]">
                <p className="text-[10px]" style={{ color: 'rgba(7, 25, 115, 0.86)' }}>Client Name</p>
                <p className="text-sm font-bold" style={{ color: '#071973' }}>{reminder.clientName}</p>
              </div>

              {/* Divider */}
              <div className="h-8 w-px bg-[#C5D3F4]"></div>

              {/* Amount */}
              <div className="min-w-[50px]">
                <p className="text-[10px]" style={{ color: 'rgba(7, 25, 115, 0.86)' }}>Amount</p>
                <p className="text-sm font-bold" style={{ color: '#071973' }}>${reminder.amount}</p>
              </div>

              {/* Divider */}
              <div className="h-8 w-px bg-[#C5D3F4]"></div>

              {/* Client ID */}
              <div className="min-w-[80px]">
                <p className="text-[10px]" style={{ color: 'rgba(7, 25, 115, 0.86)' }}>Client ID</p>
                <p className="text-sm font-bold" style={{ color: '#071973' }}>{reminder.clientId}</p>
              </div>
            </div>

            <p 
              className="text-[10px] mt-3"
              style={{ color: 'rgba(7, 25, 115, 0.86)' }}
            >
              Created on: {formatCreatedDate(reminder.createdAt)}
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-[#C5D3F4] mb-6"></div>

          {/* Schedule Settings */}
          <div className="mb-6">
            <h3
              className="font-bold mb-1"
              style={{ fontSize: "16px", color: "#0A0750" }}
            >
              Schedule Settings
            </h3>
            <p
              className="text-sm mb-5"
              style={{ color: "#5A6B8A" }}
            >
              Adjust when the reminder will be sent
            </p>

            <div className="grid grid-cols-2 gap-4">
              {/* Days Overdue */}
              <div
                className="rounded-xl p-4"
                style={{
                  border: "1.5px solid #C5D3F4",
                  backgroundColor: "#F8FAFF",
                }}
              >
                <p className="text-xs mb-2" style={{ color: "#5A6B8A" }}>
                  Days Overdue
                </p>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm" style={{ color: "#0A0750" }}>Day</span>
                  <input
                    type="text"
                    value={daysOverdue}
                    onChange={(e) => handleDaysOverdueChange(e.target.value)}
                    className="w-16 px-2 py-1 text-sm font-bold rounded border text-center"
                    style={{
                      color: "#0A0750",
                      borderColor: "#C5D3F4",
                      backgroundColor: "#fff",
                    }}
                  />
                  <span className="font-bold text-sm" style={{ color: "#0A0750" }}>overdue</span>
                </div>
              </div>

              {/* Scheduled Date */}
              <div
                className="rounded-xl p-4"
                style={{
                  border: "1.5px solid #C5D3F4",
                  backgroundColor: "#F8FAFF",
                }}
              >
                <p className="text-xs mb-2" style={{ color: "#5A6B8A" }}>
                  Scheduled Date
                </p>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full px-2 py-1 text-sm font-semibold rounded border"
                  style={{
                    color: "#0A0750",
                    borderColor: "#C5D3F4",
                    backgroundColor: "#fff",
                  }}
                />
              </div>
            </div>

            {/* Template Info (read-only) */}
            <div
              className="rounded-xl p-4 mt-4"
              style={{
                border: "1.5px solid #C5D3F4",
                backgroundColor: "#F8FAFF",
              }}
            >
              <p className="text-xs mb-2" style={{ color: "#5A6B8A" }}>
                Email Template
              </p>
              <p className="text-sm font-semibold" style={{ color: "#0A0750" }}>
                {reminder.templateName || "No template selected"}
              </p>
            </div>
          </div>

          {/* Email Recipients */}
          <div className="mb-8">
            <h3
              className="font-bold mb-1"
              style={{ fontSize: "16px", color: "#0A0750" }}
            >
              Email Recipients
            </h3>
            <p
              className="text-sm mb-4"
              style={{ color: "#5A6B8A" }}
            >
              Manage who will receive this reminder
            </p>

            {/* Custom Email Input */}
            <div className="mb-4">
              <p
                className="text-xs mb-2 font-medium"
                style={{ color: "#0A0750" }}
              >
                Add Email
              </p>
              <div className="flex items-center gap-3">
                <div
                  className="flex-1 rounded-xl p-4"
                  style={{
                    border: emailError ? "1.5px solid #EF4444" : "1.5px solid #C5D3F4",
                    backgroundColor: "#F8FAFF",
                  }}
                >
                  <p className="text-xs mb-1" style={{ color: "#5A6B8A" }}>
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

            {/* Recipients List */}
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
              {recipientEmails.length === 0 ? (
                <p className="text-sm text-gray-400">No recipients added</p>
              ) : (
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
                      <span className="text-sm" style={{ color: "#0A0750" }}>
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
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            {/* Delete Button */}
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-5 py-3 rounded-full text-sm font-semibold transition-all flex items-center gap-2 hover:bg-red-50"
                style={{
                  color: "#EF4444",
                  border: "1.5px solid #EF4444",
                }}
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDelete}
                  className="px-5 py-3 rounded-full text-sm font-semibold transition-all hover:opacity-90"
                  style={{
                    backgroundColor: "#EF4444",
                    color: "#fff",
                  }}
                >
                  Confirm Delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-3 rounded-full text-sm font-semibold transition-all hover:bg-gray-100"
                  style={{ color: "#5A6B8A" }}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={isSaving || recipientEmails.length === 0}
              className="px-8 py-3 rounded-full font-semibold text-sm transition-all flex items-center gap-2 hover:opacity-90"
              style={{
                backgroundColor: recipientEmails.length > 0 ? "#0A0750" : "#C5D3F4",
                color: recipientEmails.length > 0 ? "#fff" : "#0A0750",
                cursor: recipientEmails.length > 0 ? "pointer" : "not-allowed",
                opacity: isSaving ? 0.7 : 1,
              }}
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? "Saving..." : "Save Changes"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
