import React, { useState, useEffect } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaWhatsapp, FaSave, FaEraser } from "react-icons/fa";
import { toast } from "react-toastify";
import apiClient from "../../api/apiClient";
import TextInput from "../../components/form/TextInput/TextInput";
import CustomButton from "../../components/ui/custombutton/CustomButton";
import IndiaPhoneInput from "../../components/ui/PhoneInput/PhoneInput";

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
    const [errors, setErrors] = useState<Record<string, string>>({});

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
            }
        };
        fetchConfig();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        // if (!formData.businessPhone.trim()) {
        //     newErrors.businessPhone = "Business phone number is required";
        // }
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

    return (
        <div className="inner-container">
            <Container fluid>
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">
                                    {isEditing ? "Edit WhatsApp Configuration" : "WhatsApp Business Configuration"}
                                </h2>
                                <div className="page-breadcrumb">
                                    {isEditing
                                        ? "Home / Settings / WhatsApp Config (Edit)"
                                        : "Home / Settings / WhatsApp Config (New)"}
                                </div>
                            </div>
                        </Col>
                    </Row>
                </div>

                <form onSubmit={handleSubmit} className="form-inner">
                    <Row className="mb-4">
                        <h2 className="form-title">
                            <FaWhatsapp className="me-2 text-success" /> API Setup Credentials
                        </h2>

                        <Col lg={4} md={6}>
                            <TextInput
                                label="Phone Number ID"
                                name="phoneNumberId"
                                value={formData.phoneNumberId}
                                placeholder="e.g. 109876543212345"
                                required
                                onChange={handleChange}
                                error={errors.phoneNumberId}
                            />
                        </Col>

                        <Col lg={4} md={6}>
                            <TextInput
                                label="WABA ID (WhatsApp Business Account ID)"
                                name="wabaId"
                                value={formData.wabaId}
                                placeholder="e.g. 987654321098765"
                                required
                                onChange={handleChange}
                                error={errors.wabaId}
                            />
                        </Col>

                        <Col lg={4} md={6}>
                            <IndiaPhoneInput
                                label="Business Phone Number"
                                name="businessPhone"
                                value={formData.businessPhone}
                                placeholder="e.g. 919876543210"
                                required
                                onChange={handleChange}
                                error={errors.businessPhone}
                            />
                        </Col>
                    </Row>

                    <Row className="mb-4">
                        <h2 className="form-title">Security & Credentials</h2>
                        <Col lg={8}>
                            <TextInput
                                label="Access Token"
                                name="accessToken"
                                value={formData.accessToken}
                                placeholder="Paste your Meta Permanent or Temporary Access Token here..."
                                required
                                onChange={handleChange}
                                onFocus={handleTokenFocus}
                                error={errors.accessToken}
                                as="textarea"
                                rows={4}
                            />
                            {/* <span className="text-muted mt-2 d-inline-block" style={{ fontSize: "0.85rem" }}>
                                Use a permanent token (System User token) for production. Temporary tokens expire in 24 hours.
                            </span> */}
                        </Col>
                    </Row>

                    <div className="form-actions d-flex justify-content-end gap-3 mt-4">
                        <CustomButton text="Clear" icon={FaEraser} onClick={handleClear} type="button" variant="outline" />
                        <CustomButton
                            text={saving ? "Saving..." : isEditing ? "Update Configuration" : "Save Configuration"}
                            icon={FaSave}
                            type="submit"
                            disabled={saving}
                        />
                    </div>
                </form>
            </Container>
        </div>
    );
};

export default WhatsappCreatePage;