
import React, { useState, useEffect, useMemo } from "react";
import { FaSave } from "react-icons/fa";
import { toast } from "react-toastify";

import TextInput from "../../components/form/TextInput/TextInput";
import CustomButton from "../../components/ui/Button/Button";
import CommonLoader from "../../components/ui/Loader/CommonLoader";
import { usePermission } from "../../hooks/usePermission";

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
    const { can } = usePermission();
    const canEditInvoice = can("invoice-settings.edit");

    // ---- Financial Year helpers ----

    const getAutoFinancialYearStart = (): string => {
        const today = new Date();
        const currentYear = today.getFullYear();
        const fyStart =
            today.getMonth() >= FY_START_MONTH
                ? new Date(currentYear, FY_START_MONTH, 1)
                : new Date(currentYear - 1, FY_START_MONTH, 1);
        return fyStart.toISOString().split("T")[0];
    };

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
        if (!canEditInvoice) {
            toast.error("You do not have permission to edit invoice settings.");
            return;
        }
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
        <div className="w-full">
            {/* Page Header */}
            <div className="mb-4">
                <h2 className="text-lg font-bold text-ink">Invoice Configuration</h2>
            </div>

            <form onSubmit={handleSubmit} noValidate>
                <div className="bg-card rounded-xl border border-line-soft overflow-hidden min-h-[calc(100vh-180px)] flex flex-col">
                    <div className="flex-1 p-5 lg:p-6 space-y-6">

                        {/* Section 1: Invoice Numbering */}
                        <div className="space-y-4">
                            <div>
                                <h6 className="text-xs font-bold text-ink uppercase tracking-[1.5px]">Invoice Numbering</h6>
                                <p className="text-[11px] text-ink-subtle mt-1">Configure how invoice numbers are generated</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                    <p className="text-[11px] text-ink-subtle mt-1">2-3 letter prefix (e.g., IN, INV)</p>
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
                                    <p className="text-[11px] text-ink-subtle mt-1">Number of digits (e.g., 4 = 0001)</p>
                                </div>
                                <div>
                                    <TextInput
                                        label="Current Sequence"
                                        name="currentSequenceNumber"
                                        type="number"
                                        value={String(formData.currentSequenceNumber)}
                                        onChange={handleChange as any}
                                        disabled
                                    />
                                    <p className="text-[11px] text-ink-subtle mt-1">Auto-incremented with each invoice</p>
                                </div>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-line-soft/50" />

                        {/* Section 2: Financial Year */}
                        <div className="space-y-4">
                            <div>
                                <h6 className="text-xs font-bold text-ink uppercase tracking-[1.5px]">Financial Year</h6>
                                <p className="text-[11px] text-ink-subtle mt-1">Configure financial year for invoice numbering</p>
                            </div>

                            {/* Auto Toggle */}
                            <div className="flex items-center justify-between bg-card-2 p-3.5 rounded-xl border border-line-soft">
                                <div>
                                    <div className="font-semibold text-sm text-ink">Auto Financial Year</div>
                                    <div className="text-[11px] text-ink-subtle">
                                        {formData.autoFinancialYear
                                            ? "System automatically determines the financial year based on today's date"
                                            : "Manually set your financial year start date"}
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" name="autoFinancialYear" className="sr-only peer" checked={formData.autoFinancialYear} onChange={handleChange as any} />
                                    <div className="w-11 h-6 bg-ink-subtle/40 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-line-soft after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                </label>
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
                                    <p className="text-[11px] text-ink-subtle mt-1">
                                        {formData.autoFinancialYear
                                            ? "Auto-calculated — disabled while Auto Financial Year is on"
                                            : "Start date of your financial year"}
                                    </p>
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
                                    <p className="text-[11px] text-ink-subtle mt-1">Auto-calculated as one day before start date (next year)</p>
                                </div>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-line-soft/50" />

                        {/* Section 3: Invoice Format */}
                        <div className="space-y-4">
                            <div>
                                <h6 className="text-xs font-bold text-ink uppercase tracking-[1.5px]">Invoice Format</h6>
                                <p className="text-[11px] text-ink-subtle mt-1">Auto-generated invoice number format based on your settings</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                                <div>
                                    <TextInput
                                        label="Format Template"
                                        name="formatTemplate"
                                        value={formData.formatTemplate}
                                        onChange={handleChange as any}
                                        required
                                        error={errors.formatTemplate}
                                    />
                                    <p className="text-[11px] text-ink-subtle mt-1">
                                        Variables: {"{PREFIX}"} - Prefix, {"{FY}"} - Financial Year, {"{SEQ}"} - Sequence
                                    </p>
                                </div>
                                <div>
                                    <label className="flex items-center gap-1.5 mb-2 text-xs font-extrabold uppercase tracking-[0.5px] text-ink">Preview</label>
                                    <div className="h-10 px-4 rounded-md border border-primary/30 bg-primary/5 flex items-center justify-center text-lg font-mono font-bold tracking-widest text-ink">
                                        {livePreview}
                                    </div>
                                    <p className="text-[11px] text-ink-subtle mt-1">This is how your next invoice number will look</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {canEditInvoice && (
                        <div className="px-5 py-4 border-t border-line-soft bg-card-2/30 flex justify-end mt-auto">
                            <CustomButton text={saving ? "Saving..." : "Save Settings"} icon={FaSave} type="submit" disabled={saving} />
                        </div>
                    )}
                </div>
            </form>
        </div>
    );
};

export default SalesInvoiceCreate;
