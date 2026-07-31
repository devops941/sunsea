import React, { useState, useEffect } from "react";
import { FaWhatsapp, FaSave, FaEraser, FaKey } from "react-icons/fa";
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
}

const WhatsappCreatePage: React.FC = () => {
    const initialFormData: WhatsappConfigForm = {
        phoneNumberId: "",
        wabaId: "",
        businessPhone: "",
        accessToken: "",
    };

    const [formData, setFormData] = useState<WhatsappConfigForm>(initialFormData);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const { can } = usePermission();
    const canEditWhatsapp = can("whatsapp.edit");

    // Fetch the existing configuration on mount
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const response = await apiClient.get("/whatsapp/config");
                if (response.data && response.data.success && response.data.data) {
                    const { phoneNumberId, wabaId, businessPhone, hasAccessToken } = response.data.data;
                    setFormData({
                        phoneNumberId: phoneNumberId || "",
                        wabaId: wabaId || "",
                        businessPhone: businessPhone || "",
                        accessToken: hasAccessToken ? "••••••••••••••••••••" : "",
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

    if (loading) return <CommonLoader text="Loading ..." fullScreen={false} />;

    return (
        <div className="w-full mx-auto">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                {/* Page Header */}
                <div className="px-6 py-4 border-b border-gray-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">
                                {isEditing ? "Edit WhatsApp Configuration" : "WhatsApp Business Configuration"}
                            </h2>
                        </div>

                    </div>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-4 space-y-6" noValidate>
                    {/* API Setup Credentials */}
                    <div>
                        <h6 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            {/* <FaWhatsapp className="text-green-500" />  */}
                            API Setup Credentials
                        </h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <TextInput
                                    label="Phone Number ID"
                                    name="phoneNumberId"
                                    value={formData.phoneNumberId}
                                    placeholder="e.g. 109876543212345"
                                    required
                                    onChange={handleChange as any}
                                    error={errors.phoneNumberId}
                                />
                            </div>
                            <div>
                                <TextInput
                                    label="WABA ID"
                                    name="wabaId"
                                    value={formData.wabaId}
                                    placeholder="e.g. 987654321098765"
                                    required
                                    onChange={handleChange as any}
                                    error={errors.wabaId}
                                />
                            </div>
                            <div>
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
                    </div>

                    {/* Security & Credentials */}
                    <div>
                        <h6 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            {/* <FaKey className="text-gray-500 text-sm" />  */}
                            Security & Credentials
                        </h6>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="lg:col-span-2 xl:col-span-1">
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
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-3 mt-8 pt-4 border-t border-gray-200">
                        {canEditWhatsapp && (
                            <>
                                <CustomButton text="Clear" icon={FaEraser} onClick={handleClear} type="button" />
                                <CustomButton
                                    text={saving ? "Saving..." : isEditing ? "Update Configuration" : "Save Configuration"}
                                    icon={FaSave}
                                    type="submit"
                                    disabled={saving}
                                />
                            </>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};

export default WhatsappCreatePage;