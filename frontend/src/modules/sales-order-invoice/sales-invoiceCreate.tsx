import React, { useState, useEffect, useMemo } from "react";
import { Row, Col, Form } from "react-bootstrap";
import { FaSave, FaHashtag, FaCalendarAlt, FaFileInvoice } from "react-icons/fa";
import { toast } from "react-toastify";

import TextInput from "../../components/form/TextInput/TextInput";
import CustomButton from "../../components/ui/custombutton/CustomButton";
import Section from "../../components/ui/Section/Section";
import { invoiceSettingsService, type InvoiceSettingDto } from "../../services/invoiceSettingsService";

// Month (0-indexed) your financial year starts in.
// 3 = April (India/UK), 0 = January (US), 6 = July (Australia). Adjust as needed.
const FY_START_MONTH = 3;

const SalesInvoiceCreate: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState<InvoiceSettingDto>({
        invoicePrefix: "INV",
        sequenceLength: 4,
        currentSequenceNumber: 1,
        financialYearStart: "",
        financialYearEnd: "",
        autoFinancialYear: true,
        formatTemplate: "{PREFIX}-{FY}-{SEQ}",
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    // ---- Financial Year helpers ----

    // Calculates FY start date based on today's date and FY_START_MONTH
    const getAutoFinancialYearStart = (): string => {
        const today = new Date();
        const currentYear = today.getFullYear();

        const fyStart =
            today.getMonth() >= FY_START_MONTH
                ? new Date(currentYear, FY_START_MONTH, 1)
                : new Date(currentYear - 1, FY_START_MONTH, 1);

        return fyStart.toISOString().split("T")[0];
    };

    // Given a start date string, calculates end date (1 day before next year's start)
    const calculateEndDate = (startStr: string): string => {
        const start = new Date(startStr);
        if (isNaN(start.getTime())) return "";
        const end = new Date(start);
        end.setFullYear(start.getFullYear() + 1);
        end.setDate(start.getDate() - 1);
        return end.toISOString().split("T")[0];
    };

    // ---- Load existing settings ----
    useEffect(() => {
        invoiceSettingsService
            .getConfig()
            .then((data) => {
                if (data) {
                    const isAuto = data.autoFinancialYear !== undefined ? data.autoFinancialYear : true;

                    // If Auto is ON, always recompute start date fresh (don't trust stale saved value,
                    // in case a year has rolled over since it was last saved)
                    const start = isAuto
                        ? getAutoFinancialYearStart()
                        : data.financialYearStart
                            ? new Date(data.financialYearStart).toISOString().split("T")[0]
                            : "";

                    const end = start ? calculateEndDate(start) : "";

                    setFormData({
                        id: data.id,
                        companyId: data.companyId,
                        invoicePrefix: data.invoicePrefix || "INV",
                        sequenceLength: data.sequenceLength || 4,
                        currentSequenceNumber: data.currentSequenceNumber || 1,
                        financialYearStart: start,
                        financialYearEnd: end,
                        autoFinancialYear: isAuto,
                        formatTemplate: data.formatTemplate || "{PREFIX}-{FY}-{SEQ}",
                    });
                } else {
                    initDefaultDates();
                }
            })
            .catch((err) => {
                console.error("Failed to load invoice settings:", err);
                initDefaultDates();
            })
            .finally(() => setLoading(false));
    }, []);

    // Recalculate End Date whenever Start Date changes
    useEffect(() => {
        if (formData.financialYearStart) {
            const endStr = calculateEndDate(formData.financialYearStart);
            if (endStr) {
                setFormData((prev) => ({ ...prev, financialYearEnd: endStr }));
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.financialYearStart]);

    const initDefaultDates = () => {
        const defaultStartStr = formData.autoFinancialYear
            ? getAutoFinancialYearStart()
            : `${new Date().getFullYear()}-04-01`;

        const defaultEndStr = calculateEndDate(defaultStartStr);

        setFormData((prev) => ({
            ...prev,
            financialYearStart: defaultStartStr,
            financialYearEnd: defaultEndStr,
        }));
    };

    // ---- Handlers ----

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        const val = type === "checkbox" ? checked : value;

        if (name === "autoFinancialYear") {
            setFormData((prev) => ({
                ...prev,
                autoFinancialYear: checked,
                // Switching to Auto -> recalc start date automatically.
                // Switching to Manual -> keep current value, let user edit it.
                financialYearStart: checked ? getAutoFinancialYearStart() : prev.financialYearStart,
            }));
        } else {
            setFormData((prev) => ({ ...prev, [name]: val }));
        }

        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: "" }));
        }
    };

    const validate = (): boolean => {
        const errs: Record<string, string> = {};
        if (!formData.invoicePrefix?.trim()) errs.invoicePrefix = "Invoice Prefix is required";
        if (!formData.sequenceLength || formData.sequenceLength <= 0)
            errs.sequenceLength = "Sequence Length must be greater than 0";
        if (!formData.financialYearStart) errs.financialYearStart = "Financial Year Start date is required";
        if (!formData.formatTemplate?.trim()) errs.formatTemplate = "Format Template is required";
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setSaving(true);
        try {
            await invoiceSettingsService.saveConfig(formData);
            toast.success("Invoice settings saved successfully!");
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to save invoice settings");
        } finally {
            setSaving(false);
        }
    };

    // ---- Live preview ----
    const livePreview = useMemo(() => {
        const fyVal = (() => {
            if (!formData.financialYearStart) return "YYYY-YY";
            const start = new Date(formData.financialYearStart);
            if (isNaN(start.getTime())) return "YYYY-YY";
            const end = new Date(start);
            end.setFullYear(start.getFullYear() + 1);
            end.setDate(start.getDate() - 1);
            const startYear = start.getFullYear();
            const endYearTwoDigits = String(end.getFullYear()).slice(-2);
            return `${startYear}-${endYearTwoDigits}`;
        })();

        const paddedSeq = String(formData.currentSequenceNumber).padStart(
            Number(formData.sequenceLength) || 4,
            "0"
        );

        let preview = formData.formatTemplate || "{PREFIX}-{FY}-{SEQ}";
        preview = preview.replace(/{PREFIX}/g, formData.invoicePrefix || "");
        preview = preview.replace(/{FY}/g, fyVal);
        preview = preview.replace(/{SEQ}/g, paddedSeq);
        return preview;
    }, [formData]);

    if (loading) {
        return <div className="text-center py-5">Loading settings...</div>;
    }

    return (
        <Form onSubmit={handleSubmit}>
            {/* 1. Invoice Numbering */}
            <Section title="Invoice Numbering" icon={<FaHashtag />}>
                <p className="text-muted small mb-4">Configure how invoice numbers are generated</p>
                <Row className="g-3">
                    <Col md={6}>
                        <TextInput
                            label="Invoice Prefix"
                            name="invoicePrefix"
                            value={formData.invoicePrefix}
                            onChange={handleChange}
                            required
                            error={errors.invoicePrefix}
                        />
                        <small className="text-muted">Prefix for all invoice numbers (e.g., INV, BILL)</small>
                    </Col>
                    <Col md={6}>
                        <TextInput
                            label="Sequence Length"
                            name="sequenceLength"
                            type="number"
                            min={1}
                            value={String(formData.sequenceLength)}
                            onChange={handleChange}
                            required
                            error={errors.sequenceLength}
                        />
                        <small className="text-muted">Number of digits in sequence (e.g., 4 = 0001)</small>
                    </Col>
                    <Col md={12}>
                        <TextInput
                            label="Current Sequence Number"
                            name="currentSequenceNumber"
                            type="number"
                            value={String(formData.currentSequenceNumber)}
                            onChange={handleChange}
                            disabled
                        />
                        <small className="text-muted">Auto-incremented with each invoice. Cannot be manually edited.</small>
                    </Col>
                </Row>
            </Section>

            {/* 2. Financial Year */}
            <Section title="Financial Year" icon={<FaCalendarAlt />}>
                <p className="text-muted small mb-4">Configure financial year for invoice numbering</p>
                <Row className="g-3">
                    {/* Auto/Manual toggle placed first so it's clear it controls the fields below */}
                    <Col md={12}>
                        <Form.Group className="d-flex align-items-center justify-content-between mb-2">
                            <div>
                                <Form.Label
                                    className="mb-0 fw-bold"
                                    style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)" }}
                                >
                                    Auto Financial Year
                                </Form.Label>
                                <div className="text-muted small">
                                    {formData.autoFinancialYear
                                        ? "System automatically determines the financial year based on today's date"
                                        : "Manually set your financial year start date"}
                                </div>
                            </div>
                            <Form.Check
                                type="switch"
                                id="autoFinancialYear"
                                name="autoFinancialYear"
                                checked={formData.autoFinancialYear}
                                onChange={handleChange}
                                style={{ scale: "1.2", cursor: "pointer" }}
                            />
                        </Form.Group>
                    </Col>

                    <Col md={6}>
                        <TextInput
                            label="Financial Year Start"
                            name="financialYearStart"
                            type="date"
                            value={formData.financialYearStart}
                            onChange={handleChange}
                            required
                            error={errors.financialYearStart}
                            disabled={formData.autoFinancialYear}
                        />
                        <small className="text-muted">
                            {formData.autoFinancialYear
                                ? "Auto-calculated — disabled while Auto Financial Year is on"
                                : "Start date of your financial year (full date with year)"}
                        </small>
                    </Col>
                    <Col md={6}>
                        <TextInput
                            label="Financial Year End"
                            name="financialYearEnd"
                            type="date"
                            value={formData.financialYearEnd}
                            onChange={handleChange}
                            disabled
                        />
                        <small className="text-muted">Auto-calculated as one day before start date (next year)</small>
                    </Col>
                </Row>
            </Section>

            {/* 3. Invoice Format */}
            <Section title="Invoice Format" icon={<FaFileInvoice />}>
                <p className="text-muted small mb-4">Auto-generated invoice number format based on your settings</p>
                <Row className="g-3">
                    <Col md={12}>
                        <TextInput
                            label="Format Template"
                            name="formatTemplate"
                            value={formData.formatTemplate}
                            onChange={handleChange}
                            required
                            error={errors.formatTemplate}
                        />
                        <small className="text-muted">
                            Variables: {"{PREFIX}"} - Invoice Prefix, {"{FY}"} - Financial Year, {"{SEQ}"} - Sequence Number
                        </small>
                    </Col>
                    <Col md={12} className="mt-4">
                        <label className="form-label fw-bold small text-muted">Preview</label>
                        <div
                            className="p-3 mb-2 rounded font-monospace text-center fs-4 border border-secondary-subtle"
                            style={{
                                background: "#f3f4f6",
                                color: "#1f2937",
                                letterSpacing: "1px",
                                fontWeight: 600,
                            }}
                        >
                            {livePreview}
                        </div>
                        <small className="text-muted">This is how your next invoice number will look</small>
                    </Col>
                </Row>
            </Section>

            {/* Submit Button */}
            <div className="d-flex justify-content-end mt-4 mb-3">
                <CustomButton text="Save Settings" icon={FaSave} type="submit" loading={saving} variant="primary" />
            </div>
        </Form>
    );
};

export default SalesInvoiceCreate;