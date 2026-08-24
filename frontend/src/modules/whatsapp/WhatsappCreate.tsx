import React, { useState, useEffect } from "react";
import { FaWhatsapp, FaSave, FaEraser } from "react-icons/fa";
import { toast } from "react-toastify";
import apiClient from "../../api/apiClient";
import TextInput from "../../components/form/TextInput/TextInput";
import CustomButton from "../../components/ui/Button/Button";
import IndiaPhoneInput from "../../components/ui/PhoneInput/PhoneInput";
import CommonLoader from "../../components/ui/Loader/CommonLoader";
import { usePermission } from "../../hooks/usePermission";

interface WhatsappConfigForm {
    phoneNumberId: string;
    wabaId: string;
    businessPhone: string;
    accessToken: string;
    webhookVerifyToken: string;
}

const WhatsappCreatePage: React.FC = () => {
    const initialFormData: WhatsappConfigForm = {
        phoneNumberId: "",
        wabaId: "",
        businessPhone: "",
        accessToken: "",
        webhookVerifyToken: "",
    };

    const [formData, setFormData] = useState<WhatsappConfigForm>(initialFormData);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const { can } = usePermission();
    const canEditWhatsapp = can("whatsapp.edit");

    // Test message state
    const [testPhone, setTestPhone] = useState("");
    const [testMessage, setTestMessage] = useState("Hello from SUNSEA ERP! This is a test message.");
    const [sending, setSending] = useState(false);

    // Fetch the existing configuration on mount
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const response = await apiClient.get("/whatsapp/config");
                if (response.data && response.data.success && response.data.data) {
                    const { phoneNumberId, wabaId, businessPhone, hasAccessToken, webhookVerifyToken } = response.data.data;
                    setFormData({
                        phoneNumberId: phoneNumberId || "",
                        wabaId: wabaId || "",
                        businessPhone: businessPhone || "",
                        accessToken: hasAccessToken ? "••••••••••••••••••••" : "",
                        webhookVerifyToken: webhookVerifyToken || "",
                    });
                    setIsEditing(true);
                }
            } catch (error) {
                console.error("[WhatsApp Config] Error fetching:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchConfig();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: "" }));
        }
    };

    const handleTokenFocus = () => {
        if (formData.accessToken === "••••••••••••••••••••") {
            setFormData((prev) => ({ ...prev, accessToken: "" }));
        }
    };

    const handleClear = () => {
        setFormData(initialFormData);
        setIsEditing(false);
        setErrors({});
    };

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.phoneNumberId.trim()) {
            newErrors.phoneNumberId = "Phone Number ID is required";
        }
        if (!formData.wabaId.trim()) {
            newErrors.wabaId = "WABA ID is required";
        }
        if (!formData.accessToken.trim()) {
            newErrors.accessToken = "Access Token is required";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) {
            toast.warn("Please fill in all required fields correctly.");
            return;
        }

        if (!canEditWhatsapp) {
            toast.error("You do not have permission to edit WhatsApp configuration.");
            return;
        }

        setSaving(true);
        try {
            const response = await apiClient.post("/whatsapp/config", {
                phoneNumberId: formData.phoneNumberId.trim(),
                wabaId: formData.wabaId.trim(),
                businessPhone: formData.businessPhone.trim(),
                accessToken: formData.accessToken.trim(),
                webhookVerifyToken: formData.webhookVerifyToken.trim(),
            });

            if (response.data && response.data.success) {
                toast.success(
                    isEditing
                        ? "WhatsApp configuration updated successfully!"
                        : "WhatsApp configuration saved successfully!"
                );
                setFormData({
                    phoneNumberId: formData.phoneNumberId.trim(),
                    wabaId: formData.wabaId.trim(),
                    businessPhone: formData.businessPhone.trim(),
                    accessToken: "••••••••••••••••••••",
                    webhookVerifyToken: formData.webhookVerifyToken.trim(),
                });
                setIsEditing(true);
                setErrors({});
            } else {
                toast.error(response.data?.message || "Failed to save configuration");
            }
        } catch (error: any) {
            console.error("[WhatsApp Config] Error saving:", error);
            const errMsg = error.response?.data?.message || "Error connecting to server";
            toast.error(errMsg);
        } finally {
            setSaving(false);
        }
    };

    const handleSendTestMessage = async () => {
        if (!testPhone.trim() || !testMessage.trim()) {
            toast.warn("Please enter a test phone number and message.");
            return;
        }

        setSending(true);
        try {
            const formattedPhone = testPhone.replace(/\D/g, "");
            const response = await apiClient.post("/whatsapp/send", {
                to: formattedPhone,
                message: testMessage,
            });

            if (response.data && response.data.success) {
                toast.success("Test message sent successfully!");
            } else {
                toast.error(response.data?.message || "Failed to send test message");
            }
        } catch (error: any) {
            console.error("[WhatsApp Config] Error sending test message:", error);
            const errMsg = error.response?.data?.message || "Error connecting to server";
            toast.error(errMsg);
        } finally {
            setSending(false);
        }
    };

    if (loading) return <CommonLoader text="Loading ..." fullScreen={false} />;

    return (
        <div className="w-full">
            {/* Page Header */}
            <div className="mb-4">
                <h2 className="text-lg font-bold text-ink">
                    WhatsApp Business Configuration
                </h2>
            </div>

            <form onSubmit={handleSubmit} noValidate>
                <div className="bg-card rounded-xl border border-line-soft overflow-hidden min-h-[calc(100vh-180px)] flex flex-col">

                    <div className="flex-1 p-5 lg:p-6 space-y-6">
                        {/* Section: API Setup Credentials */}
                        <div>
                            <h6 className="text-xs font-bold text-ink uppercase tracking-[1.5px] mb-4">API Setup Credentials</h6>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <TextInput
                                    label="Phone Number ID"
                                    name="phoneNumberId"
                                    value={formData.phoneNumberId}
                                    placeholder="e.g. 109876543212345"
                                    required
                                    onChange={handleChange as any}
                                    error={errors.phoneNumberId}
                                />
                                <TextInput
                                    label="WABA ID"
                                    name="wabaId"
                                    value={formData.wabaId}
                                    placeholder="e.g. 987654321098765"
                                    required
                                    onChange={handleChange as any}
                                    error={errors.wabaId}
                                />
                                <IndiaPhoneInput
                                    label="Business Phone Number"
                                    name="businessPhone"
                                    value={formData.businessPhone}
                                    placeholder="e.g. 919876543210"
                                    required
                                    onChange={handleChange as any}
                                    error={errors.businessPhone}
                                />
                            </div>
                        </div>

                        {/* Section: Security & Credentials */}
                        <div>
                            <h6 className="text-xs font-bold text-ink uppercase tracking-[1.5px] mb-4">Security & Credentials</h6>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <TextInput
                                    label="Access Token"
                                    name="accessToken"
                                    value={formData.accessToken}
                                    placeholder="Paste your Meta Permanent or Temporary Access Token here..."
                                    required
                                    onChange={handleChange as any}
                                    onFocus={handleTokenFocus}
                                    error={errors.accessToken}
                                />
                                <TextInput
                                    label="Webhook Verify Token"
                                    name="webhookVerifyToken"
                                    value={formData.webhookVerifyToken}
                                    placeholder="e.g. my_secret_token_123"
                                    onChange={handleChange as any}
                                    error={errors.webhookVerifyToken}
                                />
                            </div>
                        </div>

                        {/* Section: Test Message (only when config exists) */}
                        {isEditing && (
                            <div>
                                <h6 className="text-xs font-bold text-ink uppercase tracking-[1.5px] mb-4">Send a Test Message</h6>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <IndiaPhoneInput
                                        label="Recipient Phone Number"
                                        name="testPhone"
                                        value={testPhone}
                                        placeholder="e.g. 919876543210"
                                        onChange={(e) => setTestPhone(e.target.value)}
                                    />
                                    <TextInput
                                        label="Test Message"
                                        name="testMessage"
                                        value={testMessage}
                                        placeholder="Enter your test message here..."
                                        onChange={(e) => setTestMessage(e.target.value)}
                                    />
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <CustomButton
                                        text={sending ? "Sending..." : "Send Test Message"}
                                        icon={FaWhatsapp}
                                        onClick={handleSendTestMessage}
                                        disabled={sending || !testPhone.trim() || !testMessage.trim()}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {canEditWhatsapp && (
                        <div className="px-5 py-4 border-t border-line-soft bg-card-2/30 flex justify-end gap-3 mt-auto">
                            <CustomButton text="Clear" icon={FaEraser} variant="secondary" onClick={handleClear} type="button" />
                            <CustomButton
                                text={saving ? "Saving..." : "Save Configuration"}
                                icon={FaSave}
                                type="submit"
                                disabled={saving}
                            />
                        </div>
                    )}

                </div>
            </form>
        </div>
    );
};

export default WhatsappCreatePage;
