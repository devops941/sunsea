
import React, { useState, useEffect, useMemo } from "react";
import { FaSave, FaHashtag, FaCalendarAlt, FaFileInvoice } from "react-icons/fa";
import { toast } from "react-toastify";

import TextInput from "../../components/form/TextInput/TextInput";
import CustomButton from "../../components/ui/Button/Button";
import CommonLoader from "../../components/ui/Loader/CommonLoader";

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
        const initDefaultDatesLocal = () => {
            setFormData((prev) => {
                const defaultStartStr = prev.autoFinancialYear
                    ? getAutoFinancialYearStart()
                    : `${new Date().getFullYear()}-04-01`;
                const defaultEndStr = calculateEndDate(defaultStartStr);
                return {
                    ...prev,
                    financialYearStart: defaultStartStr,
                    financialYearEnd: defaultEndStr,
                };
            });
        };

        setLoading(true);
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
                    initDefaultDatesLocal();
                }
            })
            .catch((err) => {
                console.error("Failed to load invoice settings:", err);
                initDefaultDatesLocal();
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
    }, [formData.financialYearStart]);

    // ---- Handlers ----

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        const val = type === "checkbox" ? checked : value;

        if (name === "invoicePrefix") {
            const cleaned = String(val).toUpperCase().slice(0, 3);
            setFormData((prev) => ({ ...prev, invoicePrefix: cleaned }));
            if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
            return;
        }

        if (name === "autoFinancialYear") {
            setFormData((prev) => ({
                ...prev,
                autoFinancialYear: checked,
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
        const prefix = formData.invoicePrefix?.trim() || "";

        if (!prefix) {
            errs.invoicePrefix = "Invoice Prefix is required";
        } else if (prefix.length < 2 || prefix.length > 3) {
            errs.invoicePrefix = "Invoice Prefix must be 2 or 3 characters";
        } else if (!/^[A-Za-z]+$/.test(prefix)) {
            errs.invoicePrefix = "Invoice Prefix must contain only letters";
        }

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
        return <CommonLoader text="Loading settings..." fullScreen={false} />;
    }

    return (
        <div className="w-full mx-auto">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                {/* Page Header */}
                <div className="px-6 py-4 border-b border-gray-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">
                                Invoice Configuration
                            </h2>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-4 space-y-6" noValidate>
                    {/* 1. Invoice Numbering */}
                    <div>
                        <h6 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            {/* <FaHashtag className="text-blue-500" /> */}
                            Invoice Numbering
                        </h6>
                        <p className="text-sm text-gray-500 mb-4 -mt-2.5">Configure how invoice numbers are generated</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <TextInput
                                    label="Invoice Prefix"
                                    name="invoicePrefix"
                                    value={formData.invoicePrefix}
                                    onChange={handleChange as any}
                                    required
                                    error={errors.invoicePrefix}
                                    maxLength={3}
                                />
                                <small className="text-gray-400">2–3 letter prefix for invoice numbers (e.g., IN, INV)</small>
                            </div>
                            <div>
                                <TextInput
                                    label="Sequence Length"
                                    name="sequenceLength"
                                    type="number"
                                    min={1}
                                    value={String(formData.sequenceLength)}
                                    onChange={handleChange as any}
                                    required
                                    error={errors.sequenceLength}
                                />
                                <small className="text-gray-400">Number of digits in sequence (e.g., 4 = 0001)</small>
                            </div>
                            <div>
                                <TextInput
                                    label="Current Sequence Number"
                                    name="currentSequenceNumber"
                                    type="number"
                                    value={String(formData.currentSequenceNumber)}
                                    onChange={handleChange as any}
                                    disabled
                                />
                                <small className="text-gray-400">Auto-incremented with each invoice.</small>
                            </div>
                        </div>
                    </div>

                    {/* 2. Financial Year */}
                    <div>
                        <h6 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            {/* <FaCalendarAlt className="text-orange-500" /> */}
                            Financial Year
                        </h6>
                        <p className="text-sm text-gray-500 mb-4 -mt-2.5">Configure financial year for invoice numbering</p>

                        <div className="mb-4 flex items-center justify-between bg-gray-50 p-3 rounded-md border border-gray-100">
                            <div>
                                <div className="font-semibold text-sm text-gray-700">Auto Financial Year</div>
                                <div className="text-xs text-gray-500">
                                    {formData.autoFinancialYear
                                        ? "System automatically determines the financial year based on today's date"
                                        : "Manually set your financial year start date"}
                                </div>
                            </div>
                            <div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" name="autoFinancialYear" className="sr-only peer" checked={formData.autoFinancialYear} onChange={handleChange as any} />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <TextInput
                                    label="Financial Year Start"
                                    name="financialYearStart"
                                    type="date"
                                    value={formData.financialYearStart}
                                    onChange={handleChange as any}
                                    required
                                    error={errors.financialYearStart}
                                    disabled={formData.autoFinancialYear}
                                />
                                <small className="text-gray-400">
                                    {formData.autoFinancialYear
                                        ? "Auto-calculated — disabled while Auto Financial Year is on"
                                        : "Start date of your financial year"}
                                </small>
                            </div>
                            <div>
                                <TextInput
                                    label="Financial Year End"
                                    name="financialYearEnd"
                                    type="date"
                                    value={formData.financialYearEnd}
                                    onChange={handleChange as any}
                                    disabled
                                />
                                <small className="text-gray-400">Auto-calculated as one day before start date (next year)</small>
                            </div>
                        </div>
                    </div>

                    {/* 3. Invoice Format */}
                    <div>
                        <h6 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            {/* <FaFileInvoice className="text-purple-500" /> */}
                            Invoice Format
                        </h6>
                        <p className="text-sm text-gray-500 mb-4 -mt-2.5">Auto-generated invoice number format based on your settings</p>

                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <TextInput
                                    label="Format Template"
                                    name="formatTemplate"
                                    value={formData.formatTemplate}
                                    onChange={handleChange as any}
                                    required
                                    error={errors.formatTemplate}
                                />
                                <small className="text-gray-400">
                                    Variables: {"{PREFIX}"} - Invoice Prefix, {"{FY}"} - Financial Year, {"{SEQ}"} - Sequence Number
                                </small>
                            </div>

                            <div className="mt-2">
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Preview</label>
                                <div
                                    className="p-3 mb-1 rounded text-center text-xl border border-gray-200"
                                    style={{
                                        background: "#f8fafc",
                                        color: "#1e293b",
                                        letterSpacing: "2px",
                                        fontFamily: "monospace",
                                        fontWeight: 600,
                                    }}
                                >
                                    {livePreview}
                                </div>
                                <small className="text-gray-400">This is how your next invoice number will look</small>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-3 mt-8 pt-4 border-t border-gray-200">
                        <CustomButton text={saving ? "Saving..." : "Save Settings"} icon={FaSave} type="submit" disabled={saving} />
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SalesInvoiceCreate;