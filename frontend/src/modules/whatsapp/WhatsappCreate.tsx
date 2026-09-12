import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { FaWhatsapp, FaSave, FaEraser } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import apiClient from "../../api/apiClient";
import TextInput from "../../components/form/TextInput/TextInput";
import CustomButton from "../../components/ui/Button/Button";
import IndiaPhoneInput from "../../components/ui/PhoneInput/PhoneInput";
import CommonLoader from "../../components/ui/Loader/CommonLoader";
import CommonConfirmModal from "../../components/ui/CommonConfirmModal/CommonConfirmModal";
import { usePermission } from "../../hooks/usePermission";
import { useDetailCache, invalidateDetailCache } from "../../hooks/useDetailCache";
import { useFormKeyboardNav } from "../../hooks/useFormKeyboardNav";
import { useFormShortcuts } from "../../hooks/useFormShortcuts";
import { useDirtyNavGuard } from "../../hooks/useDirtyNavGuard";

interface WhatsappConfigForm {
    phoneNumberId: string;
    wabaId: string;
    businessPhone: string;
    accessToken: string;
    webhookVerifyToken: string;
}

const WhatsappCreatePage: React.FC = () => {
    const navigate = useNavigate();
    const initialFormData: WhatsappConfigForm = {
        phoneNumberId: "",
        wabaId: "",
        businessPhone: "",
        accessToken: "",
        webhookVerifyToken: "",
    };

    const [formData, setFormData] = useState<WhatsappConfigForm>(initialFormData);
    const [originalFormData, setOriginalFormData] = useState<WhatsappConfigForm>(initialFormData);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
    const { can } = usePermission();
    const canEditWhatsapp = can("whatsapp.edit");

    const formRef = useRef<HTMLFormElement>(null);
    const handleFormKeyDown = useFormKeyboardNav(formRef);
    const lastFocusedElementRef = useRef<HTMLElement | null>(null);

    // Test message state
    const [testPhone, setTestPhone] = useState("");
    const [testMessage, setTestMessage] = useState("Hello from SUNSEA ERP! This is a test message.");
    const [sending, setSending] = useState(false);

    // Fetch config with cache (survives navigation, instant on return)
    const fetcher = useCallback(async (_signal: AbortSignal) => {
        const response = await apiClient.get("/whatsapp/config");
        if (response.data?.success && response.data.data) {
            return response.data.data;
        }
        return null;
    }, []);

    const { data: configData, loading } = useDetailCache<any>({
        cacheKey: "whatsapp:config",
        socketModule: "whatsapp",
        fetcher,
    });

    // Populate form when cached/fetched data arrives
    const populated = useRef(false);
    useEffect(() => {
        if (!configData || populated.current) return;
        populated.current = true;
        const { phoneNumberId, wabaId, businessPhone, hasAccessToken, webhookVerifyToken } = configData;
        const loadedData: WhatsappConfigForm = {
            phoneNumberId: phoneNumberId || "",
            wabaId: wabaId || "",
            businessPhone: businessPhone || "",
            accessToken: hasAccessToken ? "••••••••••••••••••••" : "",
            webhookVerifyToken: webhookVerifyToken || "",
        };
        setFormData(loadedData);
        setOriginalFormData(loadedData);
        setIsEditing(true);
    }, [configData]);

    // Auto-focus first input when loaded
    useEffect(() => {
        if (!loading) {
            const timer = setTimeout(() => {
                const firstInput = formRef.current?.querySelector<HTMLElement>(
                    'input[name="phoneNumberId"], input[data-nav]:not([disabled])'
                );
                firstInput?.focus();
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [loading]);

    const isDirty = useMemo(() => {
        return (
            formData.phoneNumberId.trim() !== originalFormData.phoneNumberId.trim() ||
            formData.wabaId.trim() !== originalFormData.wabaId.trim() ||
            formData.businessPhone.trim() !== originalFormData.businessPhone.trim() ||
            (formData.accessToken !== "••••••••••••••••••••" && formData.accessToken.trim() !== originalFormData.accessToken.trim()) ||
            formData.webhookVerifyToken.trim() !== originalFormData.webhookVerifyToken.trim()
        );
    }, [formData, originalFormData]);

    const isDirtyRef = useRef(isDirty);
    useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

    const saveConfirmOpenRef = useRef(saveConfirmOpen);
    useEffect(() => { saveConfirmOpenRef.current = saveConfirmOpen; }, [saveConfirmOpen]);

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
        setTimeout(() => {
            const firstInput = formRef.current?.querySelector<HTMLElement>('input[name="phoneNumberId"]');
            firstInput?.focus();
        }, 50);
    };

    const validate = useCallback((): boolean => {
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

        if (Object.keys(newErrors).length > 0) {
            const fieldOrder = ["phoneNumberId", "wabaId", "accessToken"];
            const firstError = fieldOrder.find((f) => newErrors[f]);
            if (firstError) {
                const el = formRef.current?.querySelector<HTMLElement>(`[name="${firstError}"]`);
                el?.focus();
            }
            return false;
        }
        return true;
    }, [formData]);

    const submitForm = useCallback(async () => {
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
                const updatedData: WhatsappConfigForm = {
                    phoneNumberId: formData.phoneNumberId.trim(),
                    wabaId: formData.wabaId.trim(),
                    businessPhone: formData.businessPhone.trim(),
                    accessToken: "••••••••••••••••••••",
                    webhookVerifyToken: formData.webhookVerifyToken.trim(),
                };
                setFormData(updatedData);
                setOriginalFormData(updatedData);
                setIsEditing(true);
                setErrors({});
                invalidateDetailCache("whatsapp:config");
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
    }, [validate, canEditWhatsapp, formData, isEditing]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await submitForm();
    };

    // Ref to remember blocker's proceed()/reset() from the current block-attempt
    // so the existing discard modal can drive them from its buttons.
    const proceedRef = useRef<(() => void) | null>(null);
    const resetRef = useRef<(() => void) | null>(null);
    useDirtyNavGuard(isDirty, (proceed, reset) => {
        proceedRef.current = proceed;
        resetRef.current = reset;
        setSaveConfirmOpen(true);
    });

    const handleResume = useCallback(() => {
        setSaveConfirmOpen(false);
        if (resetRef.current) {
            const r = resetRef.current;
            proceedRef.current = null;
            resetRef.current = null;
            r();
        }
        setTimeout(() => {
            if (lastFocusedElementRef.current && typeof lastFocusedElementRef.current.focus === "function") {
                lastFocusedElementRef.current.focus();
            } else {
                const firstInput = formRef.current?.querySelector<HTMLElement>(
                    'input[name="phoneNumberId"], input[data-nav]:not([disabled])'
                );
                firstInput?.focus();
            }
        }, 50);
    }, []);

    const handleDiscard = useCallback(() => {
        setSaveConfirmOpen(false);
        if (proceedRef.current) {
            const p = proceedRef.current;
            proceedRef.current = null;
            resetRef.current = null;
            p();
            return;
        }
        navigate(-1);
    }, [navigate]);

    const handleSaveFromModal = useCallback(() => {
        setSaveConfirmOpen(false);
        setTimeout(() => {
            if (!validate()) {
                toast.error("Please fill all required fields.");
                return;
            }
            submitForm();
        }, 150);
    }, [validate, submitForm]);

    // Global F2 / F9 save shortcut
    useFormShortcuts({
        onSave: () => {
            if (!saveConfirmOpen) {
                submitForm();
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
                submitForm();
            }
        };
        window.addEventListener("keydown", handleCtrlS, { capture: true });
        return () => window.removeEventListener("keydown", handleCtrlS, { capture: true });
    }, [saveConfirmOpen, submitForm]);

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
        <div className="max-w-[1024px] xl:mr-auto">
            <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} noValidate>
                <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">

                    {/* Page Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-line">
                        <h2 className="text-xl font-bold text-ink">WhatsApp Business Configuration</h2>
                    </div>

                    <div className="p-5 lg:p-6 space-y-6">
                        {/* Section: API Setup Credentials */}
                        <div>
                            <h6 className="text-xs font-bold text-ink uppercase tracking-[1.5px] mb-4">API Setup Credentials</h6>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 md:gap-x-10 lg:gap-x-16 xl:gap-x-24 gap-y-3 md:gap-y-4 lg:gap-y-5">
                                <TextInput
                                    label="Phone Number ID"
                                    name="phoneNumberId"
                                    value={formData.phoneNumberId}
                                    placeholder="e.g. 109876543212345"
                                    required
                                    horizontal
                                    onChange={handleChange as any}
                                    error={errors.phoneNumberId}
                                />
                                <TextInput
                                    label="WABA ID"
                                    name="wabaId"
                                    value={formData.wabaId}
                                    placeholder="e.g. 987654321098765"
                                    required
                                    horizontal
                                    onChange={handleChange as any}
                                    error={errors.wabaId}
                                />
                                <IndiaPhoneInput
                                    label="Business Phone"
                                    name="businessPhone"
                                    value={formData.businessPhone}
                                    placeholder="e.g. 919876543210"
                                    required
                                    horizontal
                                    onChange={handleChange as any}
                                    error={errors.businessPhone}
                                />
                            </div>
                        </div>

                        {/* Section: Security & Credentials */}
                        <div>
                            <h6 className="text-xs font-bold text-ink uppercase tracking-[1.5px] mb-4">Security & Credentials</h6>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 md:gap-x-10 lg:gap-x-16 xl:gap-x-24 gap-y-3 md:gap-y-4 lg:gap-y-5  ">
                                <TextInput
                                    label="Access Token"
                                    name="accessToken"
                                    value={formData.accessToken}
                                    placeholder="Paste your Access Token..."
                                    required
                                    horizontal
                                    onChange={handleChange as any}
                                    onFocus={handleTokenFocus}
                                    error={errors.accessToken}
                                />
                                <TextInput
                                    label="Webhook Token"
                                    name="webhookVerifyToken"
                                    value={formData.webhookVerifyToken}
                                    placeholder="e.g. my_secret_token_123"
                                    horizontal
                                    onChange={handleChange as any}
                                    error={errors.webhookVerifyToken}
                                />
                            </div>
                        </div>

                        {/* Section: Test Message (only when config exists) */}
                        {isEditing && (
                            <div>
                                <h6 className="text-xs font-bold text-ink uppercase tracking-[1.5px] mb-4">Send a Test Message</h6>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 md:gap-x-10 lg:gap-x-16 xl:gap-x-24 gap-y-3 md:gap-y-4 lg:gap-y-5">
                                    <IndiaPhoneInput
                                        label="Recipient Phone"
                                        name="testPhone"
                                        value={testPhone}
                                        placeholder="e.g. 919876543210"
                                        horizontal
                                        onChange={(e) => setTestPhone(e.target.value)}
                                    />
                                    <TextInput
                                        label="Test Message"
                                        name="testMessage"
                                        value={testMessage}
                                        placeholder="Enter your test message..."
                                        horizontal
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
                        <div className="px-5 py-4 border-t border-line flex justify-end gap-3">
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

            {/* Discard Changes Confirm Modal */}
            <CommonConfirmModal
                isOpen={saveConfirmOpen}
                onClose={handleResume}
                onCancel={handleDiscard}
                onConfirm={handleSaveFromModal}
                title="Discard Changes?"
                message="Are you sure you want to leave? Any unsaved WhatsApp configuration will be lost."
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

export default WhatsappCreatePage;
