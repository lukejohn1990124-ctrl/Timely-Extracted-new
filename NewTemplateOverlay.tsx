import { useState, useEffect } from "react";
import { X, AlertCircle } from "lucide-react";

interface TemplateType {
  id: string;
  name: string;
  description: string;
}

const templateTypes: TemplateType[] = [
  { id: "blank", name: "Blank Template", description: "Create An Empty Template to Use Your Own Custom Formatting And Design" },
  { id: "friendly", name: "Friendly Template", description: "Warm and Upbeat-Great for First Reminders" },
  { id: "professional", name: "Professional Template", description: "Clear, Neutral and Direct" },
  { id: "urgent", name: "Urgent Template", description: "Firm and Time Bound-for Final Notices" },
];

interface NewTemplateOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (templateName: string, templateType: string) => void;
}

export default function NewTemplateOverlay({
  isOpen,
  onClose,
  onSelectTemplate,
}: NewTemplateOverlayProps) {
  const [templateName, setTemplateName] = useState("");
  const [existingNames, setExistingNames] = useState<string[]>([]);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch existing template names when overlay opens
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      fetch("/api/templates")
        .then(res => res.json())
        .then(data => {
          const names = (data.templates || []).map((t: { name: string }) => t.name.toLowerCase());
          setExistingNames(names);
          setIsLoading(false);
        })
        .catch(() => {
          setIsLoading(false);
        });
    } else {
      // Reset state when closed
      setTemplateName("");
      setNameError(null);
    }
  }, [isOpen]);

  // Validate name on change
  useEffect(() => {
    if (!templateName.trim()) {
      setNameError(null);
      return;
    }
    
    const trimmedName = templateName.trim().toLowerCase();
    if (existingNames.includes(trimmedName)) {
      setNameError("A template with this name already exists");
    } else if (!/^[a-zA-Z0-9\s\-_]{1,100}$/.test(templateName.trim())) {
      setNameError("Name can only contain letters, numbers, spaces, hyphens, and underscores");
    } else {
      setNameError(null);
    }
  }, [templateName, existingNames]);

  if (!isOpen) return null;

  const handleUseThis = (templateType: string) => {
    if (templateName.trim() && !nameError) {
      onSelectTemplate(templateName.trim(), templateType);
      setTemplateName("");
      setNameError(null);
    }
  };

  const isNameValid = templateName.trim().length > 0 && !nameError;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div
        className="bg-white rounded-2xl w-full max-w-[700px] max-h-[90vh] overflow-y-auto"
        style={{ fontFamily: "Arimo, sans-serif" }}
      >
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h2
              className="font-bold"
              style={{ fontSize: "22px", color: "#0037C2" }}
            >
              New Email Template
            </h2>
            <button
              onClick={onClose}
              className="text-[#0A0750] hover:text-gray-600 transition"
            >
              <X className="w-6 h-6" strokeWidth={2} />
            </button>
          </div>

          {/* Template Name Input */}
          <div className="mb-8">
            <label
              className="block mb-2 font-medium"
              style={{ fontSize: "14px", color: "#0037C2" }}
            >
              Template Name:
            </label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="TempTest123"
              className="w-full max-w-[350px] px-4 py-3 rounded-lg text-sm outline-none"
              style={{
                border: nameError ? "1.5px solid #DC2626" : "1.5px solid #0A0750",
                color: "#0A0750",
              }}
            />
            {nameError && (
              <div className="flex items-center gap-2 mt-2 text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{nameError}</span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 mb-8"></div>

          {/* Choose a Template */}
          <div>
            <h3
              className="font-bold mb-6"
              style={{ fontSize: "16px", color: "#0A0750" }}
            >
              Choose a Template
            </h3>

            {/* Template Grid */}
            <div className="grid grid-cols-2 gap-5">
              {templateTypes.map((template) => (
                <div
                  key={template.id}
                  className="rounded-xl p-6 flex flex-col items-center text-center"
                  style={{
                    border: "1.5px solid #C5D3F4",
                    minHeight: "180px",
                  }}
                >
                  <h4
                    className="font-bold mb-3"
                    style={{ fontSize: "15px", color: "#0037C2" }}
                  >
                    {template.name}
                  </h4>
                  <p
                    className="text-sm mb-auto"
                    style={{ color: "#5A6B8A", lineHeight: 1.5 }}
                  >
                    {template.description}
                  </p>
                  <button
                    onClick={() => handleUseThis(template.id)}
                    disabled={!isNameValid || isLoading}
                    className="mt-4 px-6 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: "#0A0750" }}
                  >
                    {isLoading ? "Loading..." : "Use This"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
