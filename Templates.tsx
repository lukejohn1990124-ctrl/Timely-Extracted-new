import { useState } from "react";
import SettingsLayout from "@/react-app/components/SettingsLayout";
import { Eye, Edit, Code } from "lucide-react";

interface EmailTemplate {
  id: string;
  name: string;
  tone: string;
  subject: string;
  preview: string;
}

const templates: EmailTemplate[] = [
  {
    id: "1",
    name: "Friendly",
    tone: "Casual and warm",
    subject: "Quick reminder about Invoice {invoice_number}",
    preview: "Hi {client_name}, Just wanted to send a friendly reminder that invoice {invoice_number} for ${amount} is now {days_overdue} days past due..."
  },
  {
    id: "2",
    name: "Professional",
    tone: "Formal and business-like",
    subject: "Payment Reminder: Invoice {invoice_number}",
    preview: "Dear {client_name}, This is a reminder that invoice {invoice_number} dated {invoice_date} for ${amount} is currently {days_overdue} days overdue..."
  },
  {
    id: "3",
    name: "Urgent",
    tone: "Direct and firm",
    subject: "Immediate Action Required: Invoice {invoice_number}",
    preview: "Attention {client_name}, Invoice {invoice_number} for ${amount} is significantly overdue by {days_overdue} days. Immediate payment is required..."
  },
];

export default function TemplatesPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);

  return (
    <SettingsLayout>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-5 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">Email Templates</h1>
          <p className="text-sm text-gray-600 mt-1">Customize reminder messages for different scenarios</p>
        </div>

        <div className="p-6">
          <div className="grid gap-4">
            {templates.map((template) => (
              <div
                key={template.id}
                className="border border-gray-200 rounded-lg p-5 hover:border-blue-300 transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{template.name}</h3>
                    <p className="text-sm text-gray-500">{template.tone}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedTemplate(template)}
                      className="text-gray-400 hover:text-blue-600 transition p-2"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button className="text-gray-400 hover:text-blue-600 transition p-2">
                      <Edit className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Subject</p>
                  <p className="text-sm text-gray-900 mb-3">{template.subject}</p>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Preview</p>
                  <p className="text-sm text-gray-700">{template.preview}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition cursor-pointer">
            <Code className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <h3 className="font-semibold text-gray-900 mb-1">Create Custom Template</h3>
            <p className="text-sm text-gray-600">Build your own HTML email template</p>
          </div>

          {selectedTemplate && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl max-w-2xl w-full p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900">{selectedTemplate.name} Template Preview</h3>
                  <button
                    onClick={() => setSelectedTemplate(null)}
                    className="text-gray-400 hover:text-gray-600 transition"
                  >
                    ✕
                  </button>
                </div>
                <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">From</p>
                    <p className="text-sm text-gray-900">you@yourbusiness.com</p>
                  </div>
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Subject</p>
                    <p className="text-sm text-gray-900">{selectedTemplate.subject}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Message</p>
                    <div className="bg-white border border-gray-200 rounded p-4 text-sm text-gray-700 leading-relaxed">
                      {selectedTemplate.preview}
                      <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500">
                        Available variables: {"{client_name}"}, {"{invoice_number}"}, {"{amount}"}, {"{invoice_date}"}, {"{days_overdue}"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </SettingsLayout>
  );
}
