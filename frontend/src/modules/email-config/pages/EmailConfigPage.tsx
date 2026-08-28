import React, { useState, useEffect } from "react";
import { FaSave, FaPaperPlane } from "react-icons/fa";
import { toast } from "react-toastify";
import { emailConfigService } from "../../../services/emailConfigService";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/Button/Button";
import CommonLoader from "../../../components/ui/Loader/CommonLoader";
import { usePermission } from "../../../hooks/usePermission";

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
  const [emailData, setEmailData] = useState<EmailForm>(initialEmailData);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const [configErrors, setConfigErrors] = useState<Record<string, string>>({});
  const [emailErrors, setEmailErrors] = useState<Record<string, string>>({});
  const { can } = usePermission();
  const canEditEmail = can("email-config.edit");

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const data = await emailConfigService.getConfig();
        if (data) {
          setConfigData({
            smtpHost: data.smtpHost || "",
            smtpPort: data.smtpPort ? String(data.smtpPort) : "",
            smtpUsername: data.smtpUsername || "",
            smtpPassword: data.smtpPassword ? "••••••••••••••••••••" : "",
            fromEmail: data.fromEmail || "",
            fromName: data.fromName || "",
            encryption: data.encryption || "TLS",
          });
        }
      } catch (error) {
        console.error("Error fetching email config:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

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

  const validateConfig = (): boolean => {
    const errors: Record<string, string> = {};
    if (!configData.smtpHost) errors.smtpHost = "SMTP Host is required";
    if (!configData.smtpPort) errors.smtpPort = "SMTP Port is required";
    if (!configData.smtpUsername) errors.smtpUsername = "SMTP Username is required";
    if (!configData.smtpPassword) errors.smtpPassword = "SMTP Password is required";
    if (!configData.fromEmail) errors.fromEmail = "From Email is required";
    if (!configData.fromName) errors.fromName = "From Name is required";

    setConfigErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateEmail = (): boolean => {
    const errors: Record<string, string> = {};
    if (!emailData.recipientEmail) errors.recipientEmail = "Recipient Email is required";
    if (!emailData.subject) errors.subject = "Subject is required";
    if (!emailData.message) errors.message = "Message is required";

    setEmailErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setConfigData((prev) => ({ ...prev, smtpPassword: "••••••••••••••••••••" }));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

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
    <div className="w-full">
      {/* Page Header */}
      <div className="mb-4">
        <h2 className="text-lg font-bold text-ink">Email Configuration</h2>
      </div>

      <form onSubmit={handleSaveConfig} noValidate>
        <div className="bg-card rounded-xl border border-line-soft overflow-hidden min-h-[calc(100vh-240px)] flex flex-col">
          <div className="flex-1">
            {/* Section 1: SMTP Settings */}
            <div className="p-5 lg:p-6 space-y-5">
              <h6 className="text-xs font-bold text-ink uppercase tracking-[1.5px]">SMTP Settings</h6>

              {/* Row 1: Host, Port, Encryption */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <TextInput
                  label="SMTP Host"
                  name="smtpHost"
                  value={configData.smtpHost}
                  placeholder="smtp.gmail.com"
                  required
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
                />
              </div>

              {/* Row 2: Username, Password */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextInput
                  label="SMTP Username"
                  name="smtpUsername"
                  value={configData.smtpUsername}
                  placeholder="user@example.com"
                  required
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
                  onFocus={handlePasswordFocus}
                  onChange={handleConfigChange as any}
                  error={configErrors.smtpPassword}
                />
              </div>

              {/* Row 3: From Email, From Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextInput
                  label="From Email"
                  name="fromEmail"
                  type="email"
                  value={configData.fromEmail}
                  placeholder="noreply@example.com"
                  required
                  onChange={handleConfigChange as any}
                  error={configErrors.fromEmail}
                />
                <TextInput
                  label="From Name"
                  name="fromName"
                  value={configData.fromName}
                  placeholder="Company Name"
                  required
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
            <div className="border-t border-line-soft/50 p-5 lg:p-6 space-y-5">
              <h6 className="text-xs font-bold text-ink uppercase tracking-[1.5px]">Send Test Email</h6>

              {/* Row 1: Recipient, Subject */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextInput
                  label="Recipient Email"
                  name="recipientEmail"
                  type="email"
                  value={emailData.recipientEmail}
                  placeholder="recipient@example.com"
                  required
                  onChange={handleEmailChange as any}
                  error={emailErrors.recipientEmail}
                />
                <TextInput
                  label="Subject"
                  name="subject"
                  value={emailData.subject}
                  required
                  onChange={handleEmailChange as any}
                  error={emailErrors.subject}
                />
              </div>

              {/* Row 2: Message + Send Button */}
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
                <TextInput
                  label="Message"
                  name="message"
                  value={emailData.message}
                  placeholder="Write your email message here..."
                  required
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
        </div>
      </form>
    </div>
  );
};

export default EmailConfigPage;
