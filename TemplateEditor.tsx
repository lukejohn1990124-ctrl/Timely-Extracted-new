import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { GripVertical, Info, HelpCircle, Plus, X, Loader2, CheckCircle, AlertCircle, ExternalLink, FileText, Users } from "lucide-react";

interface Variable {
  id: string;
  label: string;
  value: string;
  placeholder: string;
}

interface SavedTemplate {
  id: string;
  name: string;
  type: string;
  subject: string;
  body: string;
  customHtml: string;
  lastModified: string;
  variables: Variable[];
}

interface InsertionPoint {
  x: number;
  y: number;
  height: number;
}

interface MailchimpAudience {
  id: string;
  name: string;
  memberCount: number;
}

export default function TemplateEditorPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const templateName = searchParams.get("name") || "Untitled Template";
  const templateType = searchParams.get("type") || "blank";
  const templateId = searchParams.get("id");
  const clientName = searchParams.get("clientName") || "Taylor Studio";
  const clientEmail = searchParams.get("clientEmail") || "client@example.com";
  const invoiceNumber = searchParams.get("invoiceNumber") || "1842";
  const amount = searchParams.get("amount") || "$200";
  
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [customHtml, setCustomHtml] = useState("");
  const [draggedVariable, setDraggedVariable] = useState<Variable | null>(null);
  const [insertionPoint, setInsertionPoint] = useState<InsertionPoint | null>(null);
  const [hasFocus, setHasFocus] = useState(false);
  
  // Provider status state
  const [providerStatus, setProviderStatus] = useState<Record<string, { configured: boolean; fromEmail?: string }>>({});
  
  
  // Mailchimp campaign state
  const [mailchimpConnected, setMailchimpConnected] = useState(false);
  const [mailchimpAccountName, setMailchimpAccountName] = useState<string | null>(null);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailAccountEmail, setGmailAccountEmail] = useState<string | null>(null);
  const [mailchimpAudiences, setMailchimpAudiences] = useState<MailchimpAudience[]>([]);
  const [selectedAudience, setSelectedAudience] = useState<string>("");
  const [isLoadingAudiences, setIsLoadingAudiences] = useState(false);
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [campaignResult, setCampaignResult] = useState<{ success: boolean; message: string; editUrl?: string } | null>(null);
  const [fromName, setFromName] = useState("");
  const [addClientToAudience, setAddClientToAudience] = useState(true);
  const [isAddingContact, setIsAddingContact] = useState(false);
  
  // Bottom section - direct email sending
  const [directEmails, setDirectEmails] = useState<string[]>([]);
  const [newDirectEmail, setNewDirectEmail] = useState("");
  const [directEmailError, setDirectEmailError] = useState<string | null>(null);
  const [isSendingDirect, setIsSendingDirect] = useState(false);
  const [directSendResult, setDirectSendResult] = useState<{ success: boolean; message: string } | null>(null);
  
  // Provider draft creation status
  const [providerDraftStatus, setProviderDraftStatus] = useState<Record<string, { loading: boolean; success: boolean; error?: string; editUrl?: string }>>({});
  
  const bodyRef = useRef<HTMLDivElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);

  const variables: Variable[] = [
    { id: "client_name", label: "Client Name", value: clientName, placeholder: "{{client_name}}" },
    { id: "client_email", label: "Client Email", value: clientEmail, placeholder: "{{client_email}}" },
    { id: "invoice_number", label: "Invoice Number", value: invoiceNumber, placeholder: "{{invoice_number}}" },
    { id: "amount", label: "Amount", value: amount, placeholder: "{{amount}}" },
    { id: "days_overdue", label: "Days Overdue", value: "Auto", placeholder: "{{days_overdue}}" },
    { id: "payment_link", label: "Payment Link", value: `https://pay.example.com/inv/${invoiceNumber}`, placeholder: "{{payment_link}}" },
    { id: "sender_name", label: "Sender Name", value: "Mina", placeholder: "{{sender_name}}" },
  ];

  // Load provider status
  useEffect(() => {
    const loadProviderStatus = async () => {
      try {
        const response = await fetch("/api/email-providers/status");
        if (response.ok) {
          const data = await response.json();
          setProviderStatus(data.providers || {});
        }
      } catch (error) {
        console.error("Failed to load provider status:", error);
      } finally {
        // Loading complete
      }
    };
    loadProviderStatus();
  }, []);

  // Load Mailchimp connection status
  useEffect(() => {
    const loadMailchimpStatus = async () => {
      try {
        const response = await fetch("/api/oauth/mailchimp/status");
        if (response.ok) {
          const data = await response.json();
          setMailchimpConnected(data.connected);
          setMailchimpAccountName(data.accountName || null);
        }
      } catch (error) {
        console.error("Failed to load Mailchimp status:", error);
      }
    };
    loadMailchimpStatus();
  }, []);

  // Load Gmail connection status
  useEffect(() => {
    const loadGmailStatus = async () => {
      try {
        const response = await fetch("/api/oauth/gmail/status");
        if (response.ok) {
          const data = await response.json();
          setGmailConnected(data.connected);
          setGmailAccountEmail(data.accountEmail || null);
        }
      } catch (error) {
        console.error("Failed to load Gmail status:", error);
      }
    };
    loadGmailStatus();
  }, []);

  // Load Mailchimp audiences when connected
  useEffect(() => {
    const loadAudiences = async () => {
      if (!mailchimpConnected) return;
      
      setIsLoadingAudiences(true);
      try {
        const response = await fetch("/api/oauth/mailchimp/audiences");
        if (response.ok) {
          const data = await response.json();
          setMailchimpAudiences(data.audiences || []);
          if (data.audiences?.length > 0) {
            setSelectedAudience(data.audiences[0].id);
          }
        }
      } catch (error) {
        console.error("Failed to load audiences:", error);
      } finally {
        setIsLoadingAudiences(false);
      }
    };
    loadAudiences();
  }, [mailchimpConnected]);

  // Load existing template if editing
  useEffect(() => {
    const loadTemplate = async () => {
      if (templateId) {
        try {
          const response = await fetch("/api/templates");
          if (response.ok) {
            const data = await response.json();
            const template = data.templates.find((t: SavedTemplate) => t.id === templateId);
            if (template) {
              setSubject(template.subject || "");
              setBody(template.body || "");
              setCustomHtml(template.customHtml || "");
            }
          }
        } catch (error) {
          console.error("Error loading template:", error);
        }
      }
    };
    loadTemplate();
  }, [templateId]);

  // Load Google Fonts
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Arimo:wght@400;500;600;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Create chip HTML for a variable
  const createChipHtml = (v: Variable) => {
    return `<span contenteditable="false" draggable="true" data-variable="${v.id}" class="variable-chip" style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; margin: 0 2px; border: 1.5px dashed #C5D3F4; border-radius: 6px; background: white; vertical-align: middle; cursor: grab; user-select: none;"><span style="color: #5A6B8A; font-size: 12px; pointer-events: none;">${v.label}</span><span style="color: #0A0750; font-weight: 700; font-size: 14px; pointer-events: none;">${v.value}</span></span>`;
  };

  // Convert body text with placeholders to HTML with styled variable chips
  const getBodyHtml = useCallback(() => {
    let html = body;
    
    // Escape HTML first
    html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    
    // Replace placeholders with styled chips
    variables.forEach((v) => {
      const escapedPlaceholder = v.placeholder.replace(/[{}]/g, "\\$&");
      const chipHtml = createChipHtml(v);
      html = html.replace(new RegExp(escapedPlaceholder, "g"), chipHtml);
    });
    
    // Convert newlines to <br>
    html = html.replace(/\n/g, "<br>");
    
    return html;
  }, [body, variables]);

  // Extract plain text with placeholders from contenteditable HTML
  const extractBodyFromHtml = useCallback((element: HTMLElement): string => {
    let result = "";
    
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent || "";
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        
        if (el.tagName === "BR") {
          result += "\n";
        } else if (el.dataset?.variable) {
          const variable = variables.find(v => v.id === el.dataset.variable);
          if (variable) {
            result += variable.placeholder;
          }
        } else if (el.tagName === "DIV" && result.length > 0 && !result.endsWith("\n")) {
          result += "\n";
          el.childNodes.forEach(walk);
        } else {
          el.childNodes.forEach(walk);
        }
      }
    };
    
    element.childNodes.forEach(walk);
    return result;
  }, [variables]);

  // Save current selection/cursor position
  const saveSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && bodyRef.current?.contains(selection.anchorNode)) {
      savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
      updateInsertionPointVisual();
    }
  }, []);

  // Update the visual insertion point indicator
  const updateInsertionPointVisual = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && bodyRef.current?.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const bodyRect = bodyRef.current.getBoundingClientRect();
      
      if (rect.height > 0 || (rect.x > 0 && rect.y > 0)) {
        setInsertionPoint({
          x: rect.x - bodyRect.x,
          y: rect.y - bodyRect.y,
          height: rect.height || 20
        });
      }
    }
  }, []);

  // Restore selection and insert at that position
  const restoreSelectionAndInsert = useCallback((variable: Variable) => {
    if (!bodyRef.current) return;
    
    bodyRef.current.focus();
    
    const selection = window.getSelection();
    if (!selection) return;
    
    // Try to restore saved selection, or use current selection
    let range: Range;
    if (savedSelectionRef.current && bodyRef.current.contains(savedSelectionRef.current.startContainer)) {
      range = savedSelectionRef.current.cloneRange();
      selection.removeAllRanges();
      selection.addRange(range);
    } else if (selection.rangeCount > 0 && bodyRef.current.contains(selection.anchorNode)) {
      range = selection.getRangeAt(0);
    } else {
      // No valid selection - insert at end
      range = document.createRange();
      range.selectNodeContents(bodyRef.current);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    
    // Create the variable chip element
    const chip = document.createElement("span");
    chip.contentEditable = "false";
    chip.draggable = true;
    chip.dataset.variable = variable.id;
    chip.className = "variable-chip";
    chip.style.cssText = "display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; margin: 0 2px; border: 1.5px dashed #C5D3F4; border-radius: 6px; background: white; vertical-align: middle; cursor: grab; user-select: none;";
    
    const labelSpan = document.createElement("span");
    labelSpan.style.cssText = "color: #5A6B8A; font-size: 12px; pointer-events: none;";
    labelSpan.textContent = variable.label;
    
    const valueSpan = document.createElement("span");
    valueSpan.style.cssText = "color: #0A0750; font-weight: 700; font-size: 14px; pointer-events: none;";
    valueSpan.textContent = variable.value;
    
    chip.appendChild(labelSpan);
    chip.appendChild(valueSpan);
    
    // Insert chip at cursor - don't delete any content
    range.collapse(true); // Collapse to start to avoid replacing selected text
    range.insertNode(chip);
    
    // Move cursor after the chip
    range.setStartAfter(chip);
    range.setEndAfter(chip);
    selection.removeAllRanges();
    selection.addRange(range);
    
    // Update body state
    const newBody = extractBodyFromHtml(bodyRef.current);
    setBody(newBody);
    lastBodyRef.current = newBody;
    
    // Update insertion point visual
    setTimeout(updateInsertionPointVisual, 0);
    
    // Setup drag listeners for the new chip
    setupChipDragListeners();
  }, [extractBodyFromHtml, updateInsertionPointVisual]);

  // Update body state when contenteditable changes
  const handleBodyInput = useCallback(() => {
    if (bodyRef.current) {
      const newBody = extractBodyFromHtml(bodyRef.current);
      setBody(newBody);
      saveSelection();
    }
  }, [extractBodyFromHtml, saveSelection]);

  // Track cursor position changes
  const handleSelectionChange = useCallback(() => {
    if (document.activeElement === bodyRef.current) {
      saveSelection();
    }
  }, [saveSelection]);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [handleSelectionChange]);

  // Sync contenteditable with body state
  const lastBodyRef = useRef(body);
  
  useEffect(() => {
    if (bodyRef.current && body !== lastBodyRef.current) {
      const selection = window.getSelection();
      const hadFocus = document.activeElement === bodyRef.current;
      
      bodyRef.current.innerHTML = getBodyHtml() || "";
      lastBodyRef.current = body;
      
      // Add drag listeners to chips inside body
      setupChipDragListeners();
      
      // Restore focus if needed
      if (hadFocus && selection) {
        bodyRef.current.focus();
        const range = document.createRange();
        range.selectNodeContents(bodyRef.current);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }, [body, getBodyHtml]);

  // Setup drag listeners for chips inside the body
  const setupChipDragListeners = useCallback(() => {
    if (!bodyRef.current) return;
    
    const chips = bodyRef.current.querySelectorAll('.variable-chip');
    chips.forEach((chip) => {
      const el = chip as HTMLElement;
      
      // Remove existing listeners to prevent duplicates
      el.ondragstart = (e: DragEvent) => {
        const varId = el.dataset.variable;
        const variable = variables.find(v => v.id === varId);
        if (variable && e.dataTransfer) {
          setDraggedVariable(variable);
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', variable.id);
          
          // Store reference to the element being dragged
          el.dataset.dragging = 'true';
          el.style.opacity = '0.4';
        }
      };
      
      el.ondragend = () => {
        el.dataset.dragging = 'false';
        el.style.opacity = '1';
        setDraggedVariable(null);
        setInsertionPoint(null);
      };
    });
  }, [variables]);

  // Initial setup of chip listeners
  useEffect(() => {
    if (bodyRef.current && body) {
      bodyRef.current.innerHTML = getBodyHtml() || "";
      setupChipDragListeners();
    }
  }, []);

  const handleSidebarDragStart = (e: React.DragEvent, variable: Variable) => {
    setDraggedVariable(variable);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', variable.id);
  };

  const handleDragEnd = () => {
    setDraggedVariable(null);
    setInsertionPoint(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    
    if (bodyRef.current) {
      // Get caret position from drag location and show insertion indicator
      const range = document.caretRangeFromPoint(e.clientX, e.clientY);
      if (range) {
        const rect = range.getBoundingClientRect();
        const bodyRect = bodyRef.current.getBoundingClientRect();
        
        setInsertionPoint({
          x: rect.x - bodyRect.x,
          y: rect.y - bodyRect.y,
          height: 20
        });
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    if (draggedVariable && bodyRef.current) {
      // Find and remove the dragged chip if it came from the body
      const draggedChip = bodyRef.current.querySelector('[data-dragging="true"]');
      if (draggedChip) {
        draggedChip.remove();
      }
      
      // Get caret position from drop location
      const range = document.caretRangeFromPoint(e.clientX, e.clientY);
      
      if (range) {
        // Create the variable chip element
        const chip = document.createElement("span");
        chip.contentEditable = "false";
        chip.draggable = true;
        chip.dataset.variable = draggedVariable.id;
        chip.className = "variable-chip";
        chip.style.cssText = "display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; margin: 0 2px; border: 1.5px dashed #C5D3F4; border-radius: 6px; background: white; vertical-align: middle; cursor: grab; user-select: none;";
        
        const labelSpan = document.createElement("span");
        labelSpan.style.cssText = "color: #5A6B8A; font-size: 12px; pointer-events: none;";
        labelSpan.textContent = draggedVariable.label;
        
        const valueSpan = document.createElement("span");
        valueSpan.style.cssText = "color: #0A0750; font-weight: 700; font-size: 14px; pointer-events: none;";
        valueSpan.textContent = draggedVariable.value;
        
        chip.appendChild(labelSpan);
        chip.appendChild(valueSpan);
        
        // Collapse range to insertion point
        range.collapse(true);
        
        // Insert at drop position
        range.insertNode(chip);
        
        // Move cursor after the chip
        range.setStartAfter(chip);
        range.setEndAfter(chip);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        
        // Update body state
        const newBody = extractBodyFromHtml(bodyRef.current);
        setBody(newBody);
        lastBodyRef.current = newBody;
        
        // Setup drag listeners for new chip
        setupChipDragListeners();
      }
    }
    
    handleDragEnd();
  };

  const handleBodyFocus = () => {
    setHasFocus(true);
  };

  const handleBodyBlur = () => {
    // Delay blur to allow click on variables
    setTimeout(() => {
      if (document.activeElement !== bodyRef.current) {
        setHasFocus(false);
      }
    }, 150);
  };

  const handleBodyClick = () => {
    saveSelection();
  };

  const handleBodyKeyUp = () => {
    saveSelection();
  };

  const insertVariable = (variable: Variable) => {
    restoreSelectionAndInsert(variable);
  };

  const getPreviewText = () => {
    let preview = body;
    variables.forEach((v) => {
      preview = preview.replace(new RegExp(v.placeholder.replace(/[{}]/g, "\\$&"), "g"), v.value);
    });
    return preview;
  };

  const getPreviewSubject = () => {
    let preview = subject;
    variables.forEach((v) => {
      preview = preview.replace(new RegExp(v.placeholder.replace(/[{}]/g, "\\$&"), "g"), v.value);
    });
    return preview;
  };

  const generateHtml = () => {
    let html = body;
    variables.forEach((v) => {
      html = html.replace(new RegExp(v.placeholder.replace(/[{}]/g, "\\$&"), "g"), `<span class="variable" data-var="${v.id}">${v.value}</span>`);
    });
    
    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .variable { font-weight: bold; }
  </style>
</head>
<body>
  <p>${html.replace(/\n/g, "</p><p>")}</p>
</body>
</html>`;
    
    setCustomHtml(fullHtml);
  };

  const saveTemplate = async () => {
    try {
      let response;
      
      if (templateId) {
        // Update existing template
        response = await fetch(`/api/templates/${templateId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: templateName,
            type: templateType,
            subject,
            bodyText: body,
          }),
        });
      } else {
        // Create new template
        response = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: templateName,
            type: templateType,
            subject,
            bodyText: body,
            customHtml,
          }),
        });
      }

      if (response.ok) {
        navigate("/dashboard");
      } else {
        const error = await response.json();
        alert(error.error || "Failed to save template");
      }
    } catch (error) {
      console.error("Error saving template:", error);
      alert("Failed to save template");
    }
  };

  const getTemplateTypeLabel = () => {
    const types: Record<string, string> = {
      blank: "Blank Template",
      friendly: "Friendly Template",
      professional: "Professional Template",
      urgent: "Urgent Template",
    };
    return types[templateType] || "Blank Template";
  };

  // Send test email for a specific provider (used by provider cards)


  // Create Mailchimp campaign
  const createMailchimpCampaign = async () => {
    if (!selectedAudience) {
      setCampaignResult({ success: false, message: "Please select an audience" });
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setCampaignResult({ success: false, message: "Please add a subject and body to your template first" });
      return;
    }

    setIsCreatingCampaign(true);
    setCampaignResult(null);

    try {
      // Step 1: Add client to audience if enabled
      if (addClientToAudience && clientEmail && clientEmail !== "client@example.com") {
        setIsAddingContact(true);
        const nameParts = clientName.split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";
        
        const addContactResponse = await fetch(`/api/oauth/mailchimp/audiences/${selectedAudience}/contacts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: clientEmail,
            firstName,
            lastName,
          }),
        });

        if (!addContactResponse.ok) {
          const errorData = await addContactResponse.json();
          setCampaignResult({
            success: false,
            message: `Failed to add ${clientEmail} to audience: ${errorData.error || "Unknown error"}`,
          });
          setIsAddingContact(false);
          setIsCreatingCampaign(false);
          return;
        }
        setIsAddingContact(false);
      }

      // Step 2: Generate HTML if not already done
      let htmlContent = customHtml;
      if (!htmlContent) {
        let html = body;
        variables.forEach((v) => {
          html = html.replace(new RegExp(v.placeholder.replace(/[{}]/g, "\\$&"), "g"), v.value);
        });
        htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
  </style>
</head>
<body>
  <p>${html.replace(/\n/g, "</p><p>")}</p>
</body>
</html>`;
      }

      // Step 3: Create the campaign
      const response = await fetch("/api/oauth/mailchimp/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audienceId: selectedAudience,
          subject: getPreviewSubject(),
          previewText: getPreviewText().substring(0, 150),
          fromName: fromName || "Timely",
          htmlContent,
          textContent: getPreviewText(),
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const addedMsg = addClientToAudience && clientEmail && clientEmail !== "client@example.com"
          ? ` ${clientEmail} was added to the audience.`
          : "";
        setCampaignResult({
          success: true,
          message: `Campaign draft created successfully!${addedMsg}`,
          editUrl: data.editUrl,
        });
      } else {
        setCampaignResult({
          success: false,
          message: data.error || "Failed to create campaign",
        });
      }
    } catch (error) {
      setCampaignResult({
        success: false,
        message: "Network error. Please try again.",
      });
    } finally {
      setIsCreatingCampaign(false);
      setIsAddingContact(false);
    }
  };

  // Validate email with detailed error messages
  const validateDirectEmail = (email: string): { valid: boolean; error?: string } => {
    const trimmed = email.trim();
    
    if (!trimmed) {
      return { valid: false, error: "Please enter an email address" };
    }
    
    if (trimmed.includes(" ")) {
      return { valid: false, error: "Email address cannot contain spaces" };
    }
    
    if (!trimmed.includes("@")) {
      return { valid: false, error: "Email address must contain '@' symbol" };
    }
    
    const parts = trimmed.split("@");
    if (parts.length !== 2) {
      return { valid: false, error: "Email address can only have one '@' symbol" };
    }
    
    const [localPart, domain] = parts;
    
    if (!localPart) {
      return { valid: false, error: "Email address must have a username before '@'" };
    }
    
    if (!domain) {
      return { valid: false, error: "Email address must have a domain after '@'" };
    }
    
    if (!domain.includes(".")) {
      return { valid: false, error: "Domain must include a '.' (e.g., gmail.com)" };
    }
    
    const domainParts = domain.split(".");
    const tld = domainParts[domainParts.length - 1];
    
    if (!tld || tld.length < 2) {
      return { valid: false, error: "Please enter a valid domain extension (e.g., .com, .org)" };
    }
    
    // Final regex check for any edge cases
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return { valid: false, error: "Please enter a valid email format" };
    }
    
    return { valid: true };
  };

  // Add direct email to list
  const addDirectEmail = () => {
    const trimmed = newDirectEmail.trim();
    const validation = validateDirectEmail(trimmed);
    
    if (!validation.valid) {
      setDirectEmailError(validation.error || "Invalid email");
      return;
    }
    
    if (directEmails.includes(trimmed)) {
      setDirectEmailError("This email is already in the list");
      return;
    }
    
    setDirectEmails([...directEmails, trimmed]);
    setNewDirectEmail("");
    setDirectEmailError(null);
    setDirectSendResult(null);
  };

  // Remove direct email from list
  const removeDirectEmail = (email: string) => {
    setDirectEmails(directEmails.filter(e => e !== email));
  };

  // Send email directly
  const sendDirectEmail = async () => {
    if (directEmails.length === 0) {
      setDirectEmailError("Please add at least one email address");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setDirectSendResult({ success: false, message: "Please add a subject and body to your template first" });
      return;
    }

    setIsSendingDirect(true);
    setDirectSendResult(null);

    try {
      const response = await fetch("/api/templates/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "mocha",
          emails: directEmails,
          subject: getPreviewSubject(),
          body: getPreviewText(),
          htmlBody: customHtml || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setDirectSendResult({ 
          success: true, 
          message: `Email${directEmails.length > 1 ? 's' : ''} sent successfully!` 
        });
      } else {
        setDirectSendResult({ 
          success: false, 
          message: data.error || "Failed to send email" 
        });
      }
    } catch (error) {
      setDirectSendResult({ 
        success: false, 
        message: "Network error. Please try again." 
      });
    } finally {
      setIsSendingDirect(false);
    }
  };

  // Create draft with email provider
  const createProviderDraft = async (provider: string) => {
    if (!subject.trim() || !body.trim()) {
      setProviderDraftStatus(prev => ({
        ...prev,
        [provider]: { loading: false, success: false, error: "Please add a subject and body first" }
      }));
      return;
    }

    // For Mailchimp, need to select audience
    if (provider === "mailchimp" && !selectedAudience) {
      setProviderDraftStatus(prev => ({
        ...prev,
        [provider]: { loading: false, success: false, error: "Please select an audience first" }
      }));
      return;
    }

    setProviderDraftStatus(prev => ({
      ...prev,
      [provider]: { loading: true, success: false }
    }));

    try {
      if (provider === "mailchimp") {
        // Use existing Mailchimp campaign creation
        let htmlContent = customHtml;
        if (!htmlContent) {
          let html = body;
          variables.forEach((v) => {
            html = html.replace(new RegExp(v.placeholder.replace(/[{}]/g, "\\$&"), "g"), v.value);
          });
          htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
  </style>
</head>
<body>
  <p>${html.replace(/\n/g, "</p><p>")}</p>
</body>
</html>`;
        }

        const response = await fetch("/api/oauth/mailchimp/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audienceId: selectedAudience,
            subject: getPreviewSubject(),
            previewText: getPreviewText().substring(0, 150),
            fromName: fromName || "Timely",
            htmlContent,
            textContent: getPreviewText(),
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setProviderDraftStatus(prev => ({
            ...prev,
            [provider]: { loading: false, success: true }
          }));
        } else {
          setProviderDraftStatus(prev => ({
            ...prev,
            [provider]: { loading: false, success: false, error: data.error || "Failed to create draft" }
          }));
        }
      } else if (provider === "sendinblue") {
        // Brevo campaign creation
        let htmlContent = customHtml;
        if (!htmlContent) {
          let html = body;
          variables.forEach((v) => {
            html = html.replace(new RegExp(v.placeholder.replace(/[{}]/g, "\\$&"), "g"), v.value);
          });
          htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
  </style>
</head>
<body>
  <p>${html.replace(/\n/g, "</p><p>")}</p>
</body>
</html>`;
        }

        const response = await fetch("/api/campaigns/brevo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: getPreviewSubject(),
            htmlContent,
            textContent: getPreviewText(),
            campaignName: templateName,
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setProviderDraftStatus(prev => ({
            ...prev,
            [provider]: { loading: false, success: true, editUrl: data.editUrl }
          }));
        } else {
          setProviderDraftStatus(prev => ({
            ...prev,
            [provider]: { loading: false, success: false, error: data.error || "Failed to create draft" }
          }));
        }
      } else if (provider === "sendgrid") {
        // SendGrid single send creation
        let htmlContent = customHtml;
        if (!htmlContent) {
          let html = body;
          variables.forEach((v) => {
            html = html.replace(new RegExp(v.placeholder.replace(/[{}]/g, "\\$&"), "g"), v.value);
          });
          htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
  </style>
</head>
<body>
  <p>${html.replace(/\n/g, "</p><p>")}</p>
</body>
</html>`;
        }

        const response = await fetch("/api/campaigns/sendgrid", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: getPreviewSubject(),
            htmlContent,
            textContent: getPreviewText(),
            campaignName: templateName,
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setProviderDraftStatus(prev => ({
            ...prev,
            [provider]: { loading: false, success: true, editUrl: data.editUrl }
          }));
        } else {
          setProviderDraftStatus(prev => ({
            ...prev,
            [provider]: { loading: false, success: false, error: data.error || "Failed to create draft" }
          }));
        }
      } else if (provider === "postmark") {
        // Postmark template creation
        let htmlContent = customHtml;
        if (!htmlContent) {
          let html = body;
          variables.forEach((v) => {
            html = html.replace(new RegExp(v.placeholder.replace(/[{}]/g, "\\$&"), "g"), v.value);
          });
          htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
  </style>
</head>
<body>
  <p>${html.replace(/\n/g, "</p><p>")}</p>
</body>
</html>`;
        }

        const response = await fetch("/api/campaigns/postmark", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: getPreviewSubject(),
            htmlContent,
            textContent: getPreviewText(),
            templateName: templateName,
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setProviderDraftStatus(prev => ({
            ...prev,
            [provider]: { loading: false, success: true, editUrl: data.editUrl }
          }));
        } else {
          setProviderDraftStatus(prev => ({
            ...prev,
            [provider]: { loading: false, success: false, error: data.error || "Failed to create template" }
          }));
        }
      } else if (provider === "gmail") {
        // Gmail draft creation
        let htmlContent = customHtml;
        if (!htmlContent) {
          let html = body;
          variables.forEach((v) => {
            html = html.replace(new RegExp(v.placeholder.replace(/[{}]/g, "\\$&"), "g"), v.value);
          });
          htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
  </style>
</head>
<body>
  <p>${html.replace(/\n/g, "</p><p>")}</p>
</body>
</html>`;
        }

        const response = await fetch("/api/campaigns/gmail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: getPreviewSubject(),
            htmlContent,
            textContent: getPreviewText(),
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setProviderDraftStatus(prev => ({
            ...prev,
            [provider]: { loading: false, success: true, editUrl: data.editUrl }
          }));
        } else {
          setProviderDraftStatus(prev => ({
            ...prev,
            [provider]: { loading: false, success: false, error: data.error || "Failed to create draft" }
          }));
        }
      } else {
        // Unknown provider
        setProviderDraftStatus(prev => ({
          ...prev,
          [provider]: { loading: false, success: false, error: "This provider does not support draft creation" }
        }));
      }
    } catch (error) {
      setProviderDraftStatus(prev => ({
        ...prev,
        [provider]: { loading: false, success: false, error: "Network error. Please try again." }
      }));
    }
  };

  const placeholderText = `Hello {{client_name}},

This is a reminder that invoice {{invoice_number}} is now {{days_overdue}} days overdue.

For convenience, you can complete payment here: {{payment_link}}

Thank you,
{{sender_name}}`;

  return (
    <div className="min-h-screen bg-white flex flex-col" style={{ fontFamily: "Arimo, sans-serif" }}>
      {/* Header */}
      <header className="bg-[#1e2a4a] rounded-b-2xl mx-4 mt-0">
        <div className="max-w-[1000px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <a href="/dashboard" className="text-xl font-bold italic text-white">Timely</a>
            <nav className="hidden md:flex gap-5">
              <a href="#" className="text-white/70 text-sm hover:text-white transition">Pricing</a>
              <a href="#" className="text-white/70 text-sm hover:text-white transition">Resources</a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <a href="#" className="text-sm text-white hover:text-gray-300 transition">Log In</a>
            <button className="bg-[#E53935] hover:bg-[#C62828] text-white px-4 py-1.5 rounded-full text-sm font-medium transition">
              Start Free Trial
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1000px] mx-auto px-6 py-8 w-full">
        {/* Template Name Header */}
        <div className="mb-6">
          <p className="text-sm" style={{ color: "#0037C2" }}>Template Name</p>
          <h1 className="text-2xl font-bold" style={{ color: "#0037C2" }}>{templateName}</h1>
        </div>

        <div className="flex gap-6">
          {/* Left Column - Editor */}
          <div className="flex-1">
            <div
              className="rounded-xl p-6"
              style={{ border: "1.5px solid #C5D3F4" }}
            >
              {/* Template Type */}
              <div className="mb-5">
                <span className="text-sm" style={{ color: "#5A6B8A" }}>Template Type </span>
                <span className="text-sm font-bold" style={{ color: "#0A0750" }}>{getTemplateTypeLabel()}</span>
              </div>

              {/* Subject */}
              <div className="mb-5">
                <label className="block text-sm mb-2" style={{ color: "#0037C2" }}>Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg text-sm outline-none"
                  style={{ border: "1px solid #E5E7EB", color: "#0A0750" }}
                  placeholder="Quick reminder — invoice {{invoice_number}}"
                />
              </div>

              {/* Body */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm" style={{ color: "#0037C2" }}>Body</label>
                  {hasFocus && (
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-600">
                      Click a variable to insert at cursor
                    </span>
                  )}
                </div>
                <div className="relative">
                  <div
                    ref={bodyRef}
                    contentEditable
                    onInput={handleBodyInput}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onFocus={handleBodyFocus}
                    onBlur={handleBodyBlur}
                    onClick={handleBodyClick}
                    onKeyUp={handleBodyKeyUp}
                    className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all"
                    style={{ 
                      border: hasFocus ? "2px solid #0037C2" : draggedVariable ? "2px dashed #C5D3F4" : "1px solid #E5E7EB", 
                      color: "#0A0750",
                      minHeight: "180px",
                      lineHeight: 1.8,
                      whiteSpace: "pre-wrap",
                      wordWrap: "break-word",
                      borderRadius: "12px",
                    }}
                    data-placeholder={placeholderText}
                    suppressContentEditableWarning
                  />
                  {!body && (
                    <div 
                      className="absolute top-3 left-4 text-sm pointer-events-none"
                      style={{ color: "#9CA3AF", lineHeight: 1.8, whiteSpace: "pre-wrap" }}
                    >
                      {placeholderText}
                    </div>
                  )}
                  
                  {/* Insertion point indicator during drag */}
                  {draggedVariable && insertionPoint && (
                    <div
                      className="absolute pointer-events-none"
                      style={{
                        left: insertionPoint.x,
                        top: insertionPoint.y,
                        width: '2px',
                        height: insertionPoint.height,
                        backgroundColor: '#0037C2',
                        animation: 'blink 1s infinite',
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Custom HTML */}
              <div>
                <label className="block text-sm mb-2" style={{ color: "#0037C2" }}>Custom HTML</label>
                <div
                  className="rounded-lg p-4 relative"
                  style={{ border: "1px solid #E5E7EB", minHeight: "160px" }}
                >
                  <textarea
                    value={customHtml}
                    onChange={(e) => setCustomHtml(e.target.value)}
                    className="w-full h-16 text-xs outline-none resize-none bg-transparent"
                    style={{ color: "#5A6B8A" }}
                    placeholder="HTML will appear here..."
                  />
                  <div className="flex justify-center mt-4">
                    <button
                      onClick={generateHtml}
                      className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
                      style={{ backgroundColor: "#0A0750" }}
                    >
                      Generate HTML From Body
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Email Preview */}
            <div className="mt-6">
              <label className="block text-sm mb-2" style={{ color: "#0037C2" }}>Email Preview</label>
              <div
                className="rounded-xl p-6"
                style={{ border: "1.5px solid #C5D3F4", minHeight: "180px" }}
              >
                {subject && (
                  <p className="font-bold mb-4" style={{ color: "#0A0750", fontSize: "16px" }}>
                    {getPreviewSubject()}
                  </p>
                )}
                <div style={{ color: "#0037C2", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                  {getPreviewText() || (
                    <span style={{ color: "#B8C4DC" }}>Preview will appear here as you type...</span>
                  )}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="mt-8 mb-6" style={{ borderTop: "1.5px solid #C5D3F4" }} />

            {/* Send email to specific addresses */}
            <div>
              <h3 className="font-bold mb-4" style={{ fontSize: "16px", color: "#0A0750" }}>
                Send email to specific addresses
              </h3>

              {/* Add Email Input */}
              <div className="mb-4">
                <label className="block text-sm mb-2" style={{ color: "#0A0750" }}>Add Email</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={newDirectEmail}
                    onChange={(e) => {
                      setNewDirectEmail(e.target.value);
                      setDirectEmailError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addDirectEmail();
                      }
                    }}
                    placeholder="email@example.com"
                    className="flex-1 px-4 py-3 rounded-full text-sm outline-none transition-all focus:ring-2 focus:ring-blue-200"
                    style={{ border: "1.5px solid #0A0750", color: "#0A0750" }}
                  />
                  <button
                    onClick={addDirectEmail}
                    className="px-6 py-3 rounded-full text-sm font-semibold text-white transition-all hover:opacity-90"
                    style={{ backgroundColor: "#0A0750" }}
                  >
                    Add Email
                  </button>
                </div>
                {directEmailError && (
                  <div className="flex items-center gap-2 mt-2 text-red-500 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>{directEmailError}</span>
                  </div>
                )}
              </div>

              {/* Email List */}
              {directEmails.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm mb-2" style={{ color: "#0A0750" }}>Email list</label>
                  <div
                    className="rounded-xl p-4 flex flex-wrap gap-2"
                    style={{ border: "1.5px solid #0A0750", minHeight: "60px" }}
                  >
                    {directEmails.map((email) => (
                      <div
                        key={email}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg"
                        style={{ border: "1.5px solid #0A0750" }}
                      >
                        <span className="text-sm" style={{ color: "#0A0750" }}>{email}</span>
                        <button
                          onClick={() => removeDirectEmail(email)}
                          className="hover:opacity-70 transition"
                        >
                          <X className="w-4 h-4" style={{ color: "#0A0750" }} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Send Button */}
              <div className="flex justify-center mb-4">
                <button
                  onClick={sendDirectEmail}
                  disabled={isSendingDirect || directEmails.length === 0}
                  className="px-12 py-3 rounded-full text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: directEmails.length > 0 ? "#0A0750" : "#9CA3AF" }}
                >
                  {isSendingDirect ? "Sending..." : "Send"}
                </button>
              </div>

              {/* Send Result */}
              {directSendResult && (
                <div className={`flex items-center justify-center gap-2 text-sm ${directSendResult.success ? "text-green-600" : "text-red-500"}`}>
                  {directSendResult.success ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                  <span>{directSendResult.message}</span>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="mt-8 mb-6" style={{ borderTop: "1.5px solid #C5D3F4" }} />

            {/* Create email draft by using your email provider */}
            <div>
              <h3 className="font-bold mb-2" style={{ fontSize: "16px", color: "#0A0750" }}>
                Create email draft by using your email provider
              </h3>
              <p className="text-sm mb-4" style={{ color: "#5A6B8A" }}>Enabled Providers</p>

              {/* Provider Cards Grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Mailchimp - Connected */}
                {providerStatus.mailchimp?.configured && (
                  <div
                    className="rounded-xl p-4 flex flex-col items-center"
                    style={{ border: "1.5px solid #C5D3F4" }}
                  >
                    <img
                      src="https://cdn.cdnlogo.com/logos/m/14/mailchimp.svg"
                      alt="Mailchimp"
                      className="w-16 h-16 mb-3 object-contain"
                    />
                    <button
                      onClick={() => createProviderDraft("mailchimp")}
                      disabled={providerDraftStatus.mailchimp?.loading || !selectedAudience}
                      className="px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: "#0A0750" }}
                    >
                      {providerDraftStatus.mailchimp?.loading ? "Creating..." : "Create Campaign Draft"}
                    </button>
                    {!selectedAudience && (
                      <p className="text-xs text-center mt-2" style={{ color: "#5A6B8A" }}>
                        Select an audience in the sidebar first
                      </p>
                    )}
                    {providerDraftStatus.mailchimp?.success && providerDraftStatus.mailchimp?.editUrl && (
                      <a
                        href={providerDraftStatus.mailchimp.editUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-green-600 text-xs mt-2 hover:underline"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Open in Mailchimp <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {providerDraftStatus.mailchimp?.error && (
                      <p className="text-xs text-red-500 mt-2 text-center">{providerDraftStatus.mailchimp.error}</p>
                    )}
                  </div>
                )}

                {/* Mailchimp - Not Connected */}
                {!providerStatus.mailchimp?.configured && (
                  <div
                    className="rounded-xl p-4 flex flex-col items-center opacity-60"
                    style={{ border: "1.5px solid #E5E7EB" }}
                  >
                    <img
                      src="https://cdn.cdnlogo.com/logos/m/14/mailchimp.svg"
                      alt="Mailchimp"
                      className="w-16 h-16 mb-3 object-contain grayscale"
                    />
                    <button
                      disabled
                      className="px-4 py-2 rounded-lg text-xs font-semibold text-white opacity-50"
                      style={{ backgroundColor: "#9CA3AF" }}
                    >
                      Create Campaign Draft
                    </button>
                    <a
                      href="/settings/email-providers"
                      className="text-xs mt-2 hover:underline"
                      style={{ color: "#0A0750" }}
                    >
                      Enable Provider →
                    </a>
                  </div>
                )}

                {/* SendGrid - Connected */}
                {providerStatus.sendgrid?.configured && (
                  <div
                    className="rounded-xl p-4 flex flex-col items-center"
                    style={{ border: "1.5px solid #C5D3F4" }}
                  >
                    <img
                      src="https://cdn.cdnlogo.com/logos/s/51/sendgrid.svg"
                      alt="SendGrid"
                      className="w-16 h-16 mb-3 object-contain"
                    />
                    {/* Create Draft Button */}
                    <button
                      onClick={() => createProviderDraft("sendgrid")}
                      disabled={providerDraftStatus.sendgrid?.loading}
                      className="w-full px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1"
                      style={{ backgroundColor: "#0A0750" }}
                    >
                      {providerDraftStatus.sendgrid?.loading ? (
                        <><Loader2 className="w-3 h-3 animate-spin" /> Creating...</>
                      ) : (
                        <><FileText className="w-3 h-3" /> Create Campaign Draft</>
                      )}
                    </button>
                    {providerDraftStatus.sendgrid?.success && providerDraftStatus.sendgrid?.editUrl && (
                      <a
                        href={providerDraftStatus.sendgrid.editUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-green-600 text-xs mt-2 hover:underline"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Open in SendGrid <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {providerDraftStatus.sendgrid?.error && (
                      <p className="text-xs text-red-500 mt-2 text-center">{providerDraftStatus.sendgrid.error}</p>
                    )}
                  </div>
                )}

                {/* SendGrid - Not Connected */}
                {!providerStatus.sendgrid?.configured && (
                  <div
                    className="rounded-xl p-4 flex flex-col items-center opacity-60"
                    style={{ border: "1.5px solid #E5E7EB" }}
                  >
                    <img
                      src="https://cdn.cdnlogo.com/logos/s/51/sendgrid.svg"
                      alt="SendGrid"
                      className="w-16 h-16 mb-3 object-contain grayscale"
                    />
                    <button
                      disabled
                      className="px-4 py-2 rounded-lg text-xs font-semibold text-white opacity-50"
                      style={{ backgroundColor: "#9CA3AF" }}
                    >
                      Create Campaign Draft
                    </button>
                    <a
                      href="/settings/email-providers"
                      className="text-xs mt-2 hover:underline"
                      style={{ color: "#0A0750" }}
                    >
                      Enable Provider →
                    </a>
                  </div>
                )}

                {/* Brevo - Connected */}
                {providerStatus.sendinblue?.configured && (
                  <div
                    className="rounded-xl p-4 flex flex-col items-center"
                    style={{ border: "1.5px solid #C5D3F4" }}
                  >
                    <img
                      src="https://cdn.cdnlogo.com/logos/b/39/brevo.svg"
                      alt="Brevo"
                      className="w-16 h-16 mb-3 object-contain"
                    />
                    {/* Create Draft Button */}
                    <button
                      onClick={() => createProviderDraft("sendinblue")}
                      disabled={providerDraftStatus.sendinblue?.loading}
                      className="w-full px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1 mb-2"
                      style={{ backgroundColor: "#0A0750" }}
                    >
                      {providerDraftStatus.sendinblue?.loading ? (
                        <><Loader2 className="w-3 h-3 animate-spin" /> Creating...</>
                      ) : (
                        <><FileText className="w-3 h-3" /> Create Campaign Draft</>
                      )}
                    </button>
                    {providerDraftStatus.sendinblue?.success && providerDraftStatus.sendinblue?.editUrl && (
                      <a
                        href={providerDraftStatus.sendinblue.editUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-green-600 text-xs mb-2 hover:underline"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Open in Brevo <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {providerDraftStatus.sendinblue?.error && (
                      <p className="text-xs text-red-500 mt-2 text-center">{providerDraftStatus.sendinblue.error}</p>
                    )}
                  </div>
                )}

                {/* Brevo - Not Connected */}
                {!providerStatus.sendinblue?.configured && (
                  <div
                    className="rounded-xl p-4 flex flex-col items-center opacity-60"
                    style={{ border: "1.5px solid #E5E7EB" }}
                  >
                    <img
                      src="https://cdn.cdnlogo.com/logos/b/39/brevo.svg"
                      alt="Brevo"
                      className="w-16 h-16 mb-3 object-contain grayscale"
                    />
                    <button
                      disabled
                      className="px-4 py-2 rounded-lg text-xs font-semibold text-white opacity-50"
                      style={{ backgroundColor: "#9CA3AF" }}
                    >
                      Create Campaign Draft
                    </button>
                    <a
                      href="/settings/email-providers"
                      className="text-xs mt-2 hover:underline"
                      style={{ color: "#0A0750" }}
                    >
                      Enable Provider →
                    </a>
                  </div>
                )}

                {/* Postmark - Connected */}
                {providerStatus.postmark?.configured && (
                  <div
                    className="rounded-xl p-4 flex flex-col items-center"
                    style={{ border: "1.5px solid #C5D3F4" }}
                  >
                    <img
                      src="https://cdn.cdnlogo.com/logos/p/26/postmark.svg"
                      alt="Postmark"
                      className="w-16 h-16 mb-3 object-contain"
                    />
                    {/* Create Draft Button */}
                    <button
                      onClick={() => createProviderDraft("postmark")}
                      disabled={providerDraftStatus.postmark?.loading}
                      className="w-full px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1"
                      style={{ backgroundColor: "#0A0750" }}
                    >
                      {providerDraftStatus.postmark?.loading ? (
                        <><Loader2 className="w-3 h-3 animate-spin" /> Creating...</>
                      ) : (
                        <><FileText className="w-3 h-3" /> Create Campaign Draft</>
                      )}
                    </button>
                    {providerDraftStatus.postmark?.success && providerDraftStatus.postmark?.editUrl && (
                      <a
                        href={providerDraftStatus.postmark.editUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-green-600 text-xs mb-2 hover:underline"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Open in Postmark <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {providerDraftStatus.postmark?.error && (
                      <p className="text-xs text-red-500 mt-2 text-center">{providerDraftStatus.postmark.error}</p>
                    )}
                  </div>
                )}

                {/* Postmark - Not Connected */}
                {!providerStatus.postmark?.configured && (
                  <div
                    className="rounded-xl p-4 flex flex-col items-center opacity-60"
                    style={{ border: "1.5px solid #E5E7EB" }}
                  >
                    <img
                      src="https://cdn.cdnlogo.com/logos/p/26/postmark.svg"
                      alt="Postmark"
                      className="w-16 h-16 mb-3 object-contain grayscale"
                    />
                    <button
                      disabled
                      className="px-4 py-2 rounded-lg text-xs font-semibold text-white opacity-50"
                      style={{ backgroundColor: "#9CA3AF" }}
                    >
                      Create Campaign Draft
                    </button>
                    <a
                      href="/settings/email-providers"
                      className="text-xs mt-2 hover:underline"
                      style={{ color: "#0A0750" }}
                    >
                      Enable Provider →
                    </a>
                  </div>
                )}

                {/* Gmail - Connected */}
                {gmailConnected && (
                  <div
                    className="rounded-xl p-4 flex flex-col items-center"
                    style={{ border: "1.5px solid #EA4335" }}
                  >
                    <img
                      src="https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg"
                      alt="Gmail"
                      className="w-16 h-16 mb-3 object-contain"
                    />
                    {gmailAccountEmail && (
                      <p className="text-xs text-gray-500 mb-2">{gmailAccountEmail}</p>
                    )}
                    {providerDraftStatus.gmail?.success ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-xs font-medium">Draft Created!</span>
                        </div>
                        {providerDraftStatus.gmail.editUrl && (
                          <a
                            href={providerDraftStatus.gmail.editUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs hover:underline flex items-center gap-1"
                            style={{ color: "#EA4335" }}
                          >
                            <ExternalLink className="w-3 h-3" />
                            Open in Gmail
                          </a>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => createProviderDraft("gmail")}
                        disabled={providerDraftStatus.gmail?.loading}
                        className="px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1"
                        style={{ backgroundColor: "#EA4335" }}
                      >
                        {providerDraftStatus.gmail?.loading ? (
                          <><Loader2 className="w-3 h-3 animate-spin" /> Creating...</>
                        ) : (
                          <><FileText className="w-3 h-3" /> Create Draft</>
                        )}
                      </button>
                    )}
                    {providerDraftStatus.gmail?.error && (
                      <p className="text-xs text-red-500 mt-2 text-center">{providerDraftStatus.gmail.error}</p>
                    )}
                  </div>
                )}

                {/* Gmail - Not Connected */}
                {!gmailConnected && (
                  <div
                    className="rounded-xl p-4 flex flex-col items-center opacity-60"
                    style={{ border: "1.5px solid #E5E7EB" }}
                  >
                    <img
                      src="https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg"
                      alt="Gmail"
                      className="w-16 h-16 mb-3 object-contain grayscale"
                    />
                    <button
                      disabled
                      className="px-4 py-2 rounded-lg text-xs font-semibold text-white opacity-50"
                      style={{ backgroundColor: "#9CA3AF" }}
                    >
                      Create Draft
                    </button>
                    <a
                      href="/settings/email-providers"
                      className="text-xs mt-2 hover:underline"
                      style={{ color: "#0A0750" }}
                    >
                      Connect Gmail →
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-center mt-8">
              <button
                onClick={saveTemplate}
                className="px-16 py-3.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ backgroundColor: "#0A0750" }}
              >
                Save Template
              </button>
            </div>
          </div>

          {/* Right Column - Variables & Actions */}
          <div className="w-[280px]">
            {/* Variables */}
            <div
              className="rounded-xl p-5"
              style={{ border: "1.5px solid #C5D3F4" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <h3 className="font-bold" style={{ fontSize: "16px", color: "#0037C2" }}>Variables</h3>
                <Info className="w-4 h-4" style={{ color: "#0037C2" }} />
              </div>
              
              <p className="text-xs mb-4" style={{ color: "#5A6B8A" }}>
                Click in the body, then click a variable to insert it. Or drag variables directly.
              </p>

              <div className="space-y-3">
                {variables.map((variable) => (
                  <div
                    key={variable.id}
                    draggable
                    onDragStart={(e) => handleSidebarDragStart(e, variable)}
                    onDragEnd={handleDragEnd}
                    onClick={() => insertVariable(variable)}
                    className="flex items-center gap-2 p-2 rounded-lg transition-all hover:bg-blue-50 hover:border-blue-300 group relative select-none"
                    style={{ 
                      border: "1.5px dashed #C5D3F4",
                      cursor: "pointer",
                      opacity: draggedVariable?.id === variable.id ? 0.5 : 1,
                    }}
                  >
                    <GripVertical className="w-4 h-4 flex-shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" style={{ color: "#0037C2" }} />
                    <span className="text-xs" style={{ color: "#5A6B8A" }}>{variable.label}</span>
                    <div className="flex items-center gap-1.5 ml-auto">
                      <span className="text-sm font-bold" style={{ color: "#0A0750" }}>{variable.value}</span>
                      {variable.id === "days_overdue" ? (
                        <div className="relative">
                          <HelpCircle 
                            className="w-3.5 h-3.5 cursor-help" 
                            style={{ color: "#0037C2" }}
                          />
                          <div className="absolute right-0 top-6 w-56 bg-[#0A0750] text-white text-xs rounded-lg p-3 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 shadow-lg">
                            This value is calculated automatically based on when each reminder is sent. It shows how many days past the invoice due date.
                            <div className="absolute -top-1 right-2 w-2 h-2 bg-[#0A0750] rotate-45"></div>
                          </div>
                        </div>
                      ) : (
                        <Plus className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#0037C2" }} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mailchimp Campaign Section */}
            <div
              className="rounded-xl p-5 mt-5"
              style={{ border: "1.5px solid #FFE082", background: "linear-gradient(135deg, #FFFDE7 0%, #FFF8E1 100%)" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-yellow-500 rounded flex items-center justify-center text-white font-bold text-xs">
                  MC
                </div>
                <h3 className="font-bold" style={{ fontSize: "16px", color: "#0037C2" }}>Mailchimp Campaign</h3>
              </div>

              {!mailchimpConnected ? (
                <div className="text-center py-4">
                  <p className="text-xs mb-3" style={{ color: "#5A6B8A" }}>
                    Connect your Mailchimp account to create campaign drafts directly from your templates.
                  </p>
                  <a
                    href="/settings/email-providers"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Connect Mailchimp
                  </a>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-4 text-xs" style={{ color: "#5A6B8A" }}>
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>Connected to <strong className="text-green-700">{mailchimpAccountName}</strong></span>
                  </div>

                  {/* Audience Selection */}
                  <div className="mb-4">
                    <label className="block text-xs font-medium mb-2" style={{ color: "#5A6B8A" }}>
                      <Users className="w-3.5 h-3.5 inline mr-1" />
                      Select Audience
                    </label>
                    {isLoadingAudiences ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading audiences...
                      </div>
                    ) : mailchimpAudiences.length === 0 ? (
                      <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
                        No audiences found. Create one in Mailchimp first.
                      </p>
                    ) : (
                      <select
                        value={selectedAudience}
                        onChange={(e) => setSelectedAudience(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-white"
                      >
                        {mailchimpAudiences.map(audience => (
                          <option key={audience.id} value={audience.id}>
                            {audience.name} ({audience.memberCount.toLocaleString()} members)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* From Name */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium mb-1" style={{ color: "#5A6B8A" }}>
                      From Name
                    </label>
                    <input
                      type="text"
                      value={fromName}
                      onChange={(e) => setFromName(e.target.value)}
                      placeholder="Your Name or Company"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                  </div>

                  {/* Add Client to Audience */}
                  {clientEmail && clientEmail !== "client@example.com" && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={addClientToAudience}
                          onChange={(e) => setAddClientToAudience(e.target.checked)}
                          className="mt-0.5 w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                        />
                        <div className="flex-1">
                          <span className="text-xs font-medium text-yellow-800">
                            Add client to audience
                          </span>
                          <p className="text-xs text-yellow-700 mt-0.5">
                            <strong>{clientEmail}</strong> ({clientName}) will be added to the selected audience before creating the campaign.
                          </p>
                        </div>
                      </label>
                    </div>
                  )}

                  {/* Create Campaign Button */}
                  <button
                    onClick={createMailchimpCampaign}
                    disabled={isCreatingCampaign || mailchimpAudiences.length === 0}
                    className="w-full py-2.5 rounded-lg font-semibold transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm bg-yellow-500 hover:bg-yellow-600 text-white"
                  >
                    {isCreatingCampaign ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {isAddingContact ? "Adding contact..." : "Creating campaign..."}
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4" />
                        Create Campaign Draft
                      </>
                    )}
                  </button>

                  {/* Campaign Result */}
                  {campaignResult && (
                    <div
                      className={`mt-3 p-3 rounded-lg ${
                        campaignResult.success 
                          ? "bg-green-50 border border-green-200 text-green-800" 
                          : "bg-red-50 border border-red-200 text-red-800"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {campaignResult.success ? (
                          <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <span className="text-xs">{campaignResult.message}</span>
                          {campaignResult.editUrl && (
                            <a
                              href={campaignResult.editUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-900"
                            >
                              Open in Mailchimp <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>


          </div>
        </div>
      </main>

      {/* CSS for blinking cursor */}
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>

      {/* Footer */}
      <footer className="bg-[#1e2a4a] text-white py-10 mt-auto">
        <div className="max-w-[1000px] mx-auto px-6">
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
