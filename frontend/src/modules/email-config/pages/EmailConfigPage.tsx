import React, { useState, useEffect } from "react";
import { FaSave, FaPaperPlane, FaEraser } from "react-icons/fa";
import { toast } from "react-toastify";
import { emailConfigService } from "../../../services/emailConfigService";
import TextInput from "../../../components/form/TextInput/TextInput";
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
    <div className="w-full mx-auto p-4 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800">Email Configuration</h2>
        <p className="text-sm text-gray-500">Configure SMTP settings for sending emails from your application.</p>
      </div>

      {/* SMTP Settings Box */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <form onSubmit={handleSaveConfig} className="px-6 py-6" noValidate>
          <h6 className="text-lg font-semibold text-gray-800 mb-6">SMTP Settings</h6>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
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
            <div className="flex flex-col mb-4 w-full">
              <label className="mb-2 text-sm font-medium text-gray-700">Encryption</label>
              <select
                name="encryption"
                value={configData.encryption}
                onChange={handleConfigChange}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="TLS">TLS</option>
                <option value="SSL">SSL</option>
                <option value="NONE">NONE</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end mt-6">
            {canEditEmail && (
              <CustomButton
                text={saving ? "Saving..." : "Save Configuration"}
                icon={FaSave}
                type="submit"
                disabled={saving}
                className="bg-black text-white hover:bg-gray-800"
              />
            )}
          </div>
        </form>
      </div>

      {/* Send Email Box */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <form onSubmit={handleSendEmail} className="px-6 py-6" noValidate>
          <h6 className="text-lg font-semibold text-gray-800 mb-6">Send Email</h6>
          <div className="grid grid-cols-1 gap-4">
            <TextInput
              label="Sender Email (Recipient)"
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
            <div className="flex flex-col mb-4 w-full">
              <label className="mb-2 text-sm font-medium text-gray-700">Message *</label>
              <textarea
                name="message"
                value={emailData.message}
                onChange={handleEmailChange as any}
                rows={3}
                className={`w-full px-3 py-2 bg-white border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${emailErrors.message ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="This is an email..."
                required
              />
              {emailErrors.message && (
                <p className="mt-1 text-sm text-red-500">{emailErrors.message}</p>
              )}
            </div>
          </div>
          <div className="flex justify-end mt-6 space-x-4">
            <CustomButton
              text={sending ? "Sending..." : "Send Email"}
              icon={FaPaperPlane}
              type="submit"
              disabled={sending || saving}
              className="bg-black text-white border border-gray-300 hover:bg-gray-800"
            />

          </div>
        </form>
      </div>
    </div>
  );
};

export default EmailConfigPage;
