import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { FaSave, FaPaperPlane } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { emailConfigService } from "../../../services/emailConfigService";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import CommonLoader from "../../../components/ui/Loader/CommonLoader";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { usePermission } from "../../../hooks/usePermission";
import { useDetailCache, invalidateDetailCache } from "../../../hooks/useDetailCache";
import { useFormKeyboardNav } from "../../../hooks/useFormKeyboardNav";
import { useFormShortcuts } from "../../../hooks/useFormShortcuts";

interface EmailConfigForm {
  smtpHost: string;
  smtpPort: string;
  smtpUsername: string;
  smtpPassword: string;
  fromEmail: string;
  fromName: string;
  encryption: string;
}

interface EmailForm {
  recipientEmail: string;
  subject: string;
  message: string;
}

const encryptionOptions = [
  { value: "TLS", label: "TLS" },
  { value: "SSL", label: "SSL" },
  { value: "NONE", label: "NONE" },
];

const EmailConfigPage: React.FC = () => {
  const navigate = useNavigate();
  const initialConfigData: EmailConfigForm = {
    smtpHost: "",
    smtpPort: "",
    smtpUsername: "",
    smtpPassword: "",
    fromEmail: "",
    fromName: "",
    encryption: "TLS",
  };

  const initialEmailData: EmailForm = {
    recipientEmail: "",
    subject: "Test Email",
    message: "This is an email from your application.",
  };

  const [configData, setConfigData] = useState<EmailConfigForm>(initialConfigData);
  const [originalConfigData, setOriginalConfigData] = useState<EmailConfigForm>(initialConfigData);
  const [emailData, setEmailData] = useState<EmailForm>(initialEmailData);

  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  const [configErrors, setConfigErrors] = useState<Record<string, string>>({});
  const [emailErrors, setEmailErrors] = useState<Record<string, string>>({});
  const { can } = usePermission();
  const canEditEmail = can("email-config.edit");

  const formRef = useRef<HTMLFormElement>(null);
  const handleFormKeyDown = useFormKeyboardNav(formRef);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);

  const fetcher = useCallback(async (_signal: AbortSignal) => {
    return await emailConfigService.getConfig();
  }, []);

  const { data: fetchedConfig, loading } = useDetailCache<any>({
    cacheKey: "emailConfig:smtp",
    socketModule: "emailConfig",
    fetcher,
  });

  const populated = useRef(false);
  useEffect(() => {
    if (!fetchedConfig || populated.current) return;
    populated.current = true;
    const loadedData: EmailConfigForm = {
      smtpHost: fetchedConfig.smtpHost || "",
      smtpPort: fetchedConfig.smtpPort ? String(fetchedConfig.smtpPort) : "",
      smtpUsername: fetchedConfig.smtpUsername || "",
      smtpPassword: fetchedConfig.smtpPassword ? "••••••••••••••••••••" : "",
      fromEmail: fetchedConfig.fromEmail || "",
      fromName: fetchedConfig.fromName || "",
      encryption: fetchedConfig.encryption || "TLS",
    };
    setConfigData(loadedData);
    setOriginalConfigData(loadedData);
  }, [fetchedConfig]);

  // Auto-focus first input when loaded
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        const firstInput = formRef.current?.querySelector<HTMLElement>(
          'input[name="smtpHost"], input[data-nav]:not([disabled])'
        );
        firstInput?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  const isDirty = useMemo(() => {
    return (
      configData.smtpHost.trim() !== originalConfigData.smtpHost.trim() ||
      configData.smtpPort.trim() !== originalConfigData.smtpPort.trim() ||
      configData.smtpUsername.trim() !== originalConfigData.smtpUsername.trim() ||
      (configData.smtpPassword !== "••••••••••••••••••••" && configData.smtpPassword.trim() !== originalConfigData.smtpPassword.trim()) ||
      configData.fromEmail.trim() !== originalConfigData.fromEmail.trim() ||
      configData.fromName.trim() !== originalConfigData.fromName.trim() ||
      configData.encryption !== originalConfigData.encryption
    );
  }, [configData, originalConfigData]);

  const isDirtyRef = useRef(isDirty);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

  const saveConfirmOpenRef = useRef(saveConfirmOpen);
  useEffect(() => { saveConfirmOpenRef.current = saveConfirmOpen; }, [saveConfirmOpen]);

  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setConfigData((prev) => ({ ...prev, [name]: value }));
    if (configErrors[name]) {
      setConfigErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEmailData((prev) => ({ ...prev, [name]: value }));
    if (emailErrors[name]) {
      setEmailErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handlePasswordFocus = () => {
    if (configData.smtpPassword === "••••••••••••••••••••") {
      setConfigData((prev) => ({ ...prev, smtpPassword: "" }));
    }
  };

  const validateConfig = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    if (!configData.smtpHost.trim()) errors.smtpHost = "SMTP Host is required";
    if (!configData.smtpPort.trim()) errors.smtpPort = "SMTP Port is required";
    if (!configData.smtpUsername.trim()) errors.smtpUsername = "SMTP Username is required";
    if (!configData.smtpPassword.trim()) errors.smtpPassword = "SMTP Password is required";
    if (!configData.fromEmail.trim()) errors.fromEmail = "From Email is required";
    if (!configData.fromName.trim()) errors.fromName = "From Name is required";

    setConfigErrors(errors);

    if (Object.keys(errors).length > 0) {
      const fieldOrder = ["smtpHost", "smtpPort", "smtpUsername", "smtpPassword", "fromEmail", "fromName"];
      const firstError = fieldOrder.find((f) => errors[f]);
      if (firstError) {
        const el = formRef.current?.querySelector<HTMLElement>(`[name="${firstError}"]`);
        el?.focus();
      }
      return false;
    }
    return true;
  }, [configData]);

  const validateEmail = (): boolean => {
    const errors: Record<string, string> = {};
    if (!emailData.recipientEmail.trim()) errors.recipientEmail = "Recipient Email is required";
    if (!emailData.subject.trim()) errors.subject = "Subject is required";
    if (!emailData.message.trim()) errors.message = "Message is required";

    setEmailErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveConfig = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canEditEmail) {
      toast.error("You do not have permission to edit email configuration.");
      return;
    }
    if (!validateConfig()) {
      toast.warn("Please fill all required SMTP fields.");
      return;
    }

    setSaving(true);
    try {
      await emailConfigService.saveConfig(configData);
      toast.success("Email configuration saved successfully!");
      const updatedData = { ...configData, smtpPassword: "••••••••••••••••••••" };
      setConfigData(updatedData);
      setOriginalConfigData(updatedData);
      invalidateDetailCache("emailConfig:smtp");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  }, [canEditEmail, validateConfig, configData]);

  const handleResume = useCallback(() => {
    setSaveConfirmOpen(false);
    setTimeout(() => {
      if (lastFocusedElementRef.current && typeof lastFocusedElementRef.current.focus === "function") {
        lastFocusedElementRef.current.focus();
      } else {
        const firstInput = formRef.current?.querySelector<HTMLElement>(
          'input[name="smtpHost"], input[data-nav]:not([disabled])'
        );
        firstInput?.focus();
      }
    }, 50);
  }, []);

  const handleDiscard = useCallback(() => {
    setSaveConfirmOpen(false);
    navigate(-1);
  }, [navigate]);

  const handleSaveFromModal = useCallback(() => {
    setSaveConfirmOpen(false);
    setTimeout(() => {
      if (!validateConfig()) {
        toast.error("please fill all required fields.");
        return;
      }
      handleSaveConfig();
    }, 150);
  }, [validateConfig, handleSaveConfig]);

  // Global F2/F9 save shortcut
  useFormShortcuts({
    onSave: () => {
      if (!saveConfirmOpen) {
        handleSaveConfig();
      }
    },
  });

  // Ctrl+S shortcut support
  useEffect(() => {
    if (saveConfirmOpen) return;
    const handleCtrlS = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        e.stopPropagation();
        handleSaveConfig();
      }
    };
    window.addEventListener("keydown", handleCtrlS, { capture: true });
    return () => window.removeEventListener("keydown", handleCtrlS, { capture: true });
  }, [saveConfirmOpen, handleSaveConfig]);

  // Esc key Discard confirmation
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector("[data-select-portal]")) return;

      e.preventDefault();
      e.stopPropagation();

      if (saveConfirmOpenRef.current) {
        handleResume();
      } else if (isDirtyRef.current) {
        lastFocusedElementRef.current = document.activeElement as HTMLElement | null;
        setSaveConfirmOpen(true);
      } else {
        navigate(-1);
      }
    };
    window.addEventListener("keydown", handleEsc, { capture: true });
    return () => window.removeEventListener("keydown", handleEsc, { capture: true });
  }, [handleResume, navigate]);

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail()) {
      toast.warn("Please fill all email fields.");
      return;
    }

    setSending(true);
    try {
      await emailConfigService.sendEmailDirect(emailData);
      toast.success("Email sent successfully!");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  if (loading) return <CommonLoader text="Loading..." fullScreen={false} />;

  return (
    <div className="max-w-[1024px] xl:mr-auto">
      <form ref={formRef} onSubmit={handleSaveConfig} onKeyDown={handleFormKeyDown} noValidate>
        <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">

          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-line">
            <h2 className="text-xl font-bold text-ink">Email Configuration</h2>
          </div>

          {/* Section 1: SMTP Settings */}
          <div className="p-5 lg:p-6 space-y-5">
            <h6 className="text-xs font-bold text-ink uppercase tracking-[1.5px]">SMTP Settings</h6>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 md:gap-x-10 lg:gap-x-16 xl:gap-x-24 gap-y-3 md:gap-y-4 lg:gap-y-5">
              <TextInput
                label="SMTP Host"
                name="smtpHost"
                value={configData.smtpHost}
                placeholder="smtp.gmail.com"
                required
                horizontal
                onChange={handleConfigChange as any}
                error={configErrors.smtpHost}
              />
              <TextInput
                label="SMTP Port"
                name="smtpPort"
                type="number"
                value={configData.smtpPort}
                placeholder="587"
                required
                horizontal
                onChange={handleConfigChange as any}
                error={configErrors.smtpPort}
              />
              <SelectInput
                label="Encryption"
                name="encryption"
                value={configData.encryption}
                options={encryptionOptions}
                onChange={handleConfigChange}
                searchable={false}
                horizontal
              />
              <TextInput
                label="SMTP Username"
                name="smtpUsername"
                value={configData.smtpUsername}
                placeholder="user@example.com"
                required
                horizontal
                onChange={handleConfigChange as any}
                error={configErrors.smtpUsername}
              />
              <TextInput
                label="SMTP Password"
                name="smtpPassword"
                type="password"
                value={configData.smtpPassword}
                placeholder="••••••••"
                required
                horizontal
                onFocus={handlePasswordFocus}
                onChange={handleConfigChange as any}
                error={configErrors.smtpPassword}
              />
              <TextInput
                label="From Email"
                name="fromEmail"
                type="email"
                value={configData.fromEmail}
                placeholder="noreply@example.com"
                required
                horizontal
                onChange={handleConfigChange as any}
                error={configErrors.fromEmail}
              />
              <TextInput
                label="From Name"
                name="fromName"
                value={configData.fromName}
                placeholder="Company Name"
                required
                horizontal
                onChange={handleConfigChange as any}
                error={configErrors.fromName}
              />
            </div>

            {/* Save Config Button */}
            {canEditEmail && (
              <div className="flex justify-end pt-2">
                <CustomButton
                  text={saving ? "Saving..." : "Save Configuration"}
                  icon={FaSave}
                  type="submit"
                  disabled={saving}
                />
              </div>
            )}
          </div>

          {/* Section 2: Send Test Email */}
          <div className="border-t border-line p-5 lg:p-6 space-y-5">
            <h6 className="text-xs font-bold text-ink uppercase tracking-[1.5px]">Send Test Email</h6>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 md:gap-x-10 lg:gap-x-16 xl:gap-x-24 gap-y-3 md:gap-y-4 lg:gap-y-5">
              <TextInput
                label="Recipient Email"
                name="recipientEmail"
                type="email"
                value={emailData.recipientEmail}
                placeholder="recipient@example.com"
                required
                horizontal
                onChange={handleEmailChange as any}
                error={emailErrors.recipientEmail}
              />
              <TextInput
                label="Subject"
                name="subject"
                value={emailData.subject}
                required
                horizontal
                onChange={handleEmailChange as any}
                error={emailErrors.subject}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-x-6 md:gap-x-10 lg:gap-x-16 xl:gap-x-24 gap-y-3 md:gap-y-4 items-end">
              <TextInput
                label="Message"
                name="message"
                value={emailData.message}
                placeholder="Write your email message here..."
                required
                horizontal
                onChange={handleEmailChange as any}
                error={emailErrors.message}
              />
              <CustomButton
                text={sending ? "Sending..." : "Send Email"}
                icon={FaPaperPlane}
                type="button"
                onClick={handleSendEmail}
                disabled={sending || saving}
              />
            </div>
          </div>

        </div>
      </form>

      {/* Discard Changes Confirm Modal */}
      <CommonConfirmModal
        isOpen={saveConfirmOpen}
        onClose={handleResume}
        onCancel={handleDiscard}
        onConfirm={handleSaveFromModal}
        title="Discard Changes?"
        message="Are you sure you want to leave? Any unsaved email configuration will be lost."
        warningText="Save to keep your changes, or Discard to leave."
        cancelText="Discard"
        cancelVariant="danger"
        confirmText="Save"
        confirmVariant="primary"
        confirmIcon={FaSave}
        isDangerous={false}
        defaultFocusCancel={false}
      />
    </div>
  );
};

export default EmailConfigPage;
