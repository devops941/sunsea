import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaSave, FaUndo, FaCheck, FaArrowLeft } from "react-icons/fa";
import { toast } from "react-toastify";
import { returnService } from "../../../../services/returnService";
import { supplierService } from "../../../../services/supplierService";
import { rawMaterialService } from "../../../../services/rawMaterialService";
import { useAppSelector } from "../../../../hooks/reduxHooks";
import { useFormShortcuts } from "../../../../hooks/useFormShortcuts";
import { useFormKeyboardNav } from "../../../../hooks/useFormKeyboardNav";
import AutocompleteInput, { type AutocompleteOption } from "../../../../components/form/AutocompleteInput/AutocompleteInput";
import CommonLoader from "../../../../components/ui/Loader/CommonLoader";
import CommonConfirmModal from "../../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import CustomButton from "../../../../components/ui/Button/Button";
import TextArea from "../../../../components/form/TextArea/TextArea";
import BusyItemsTable, { type BusyColumn } from "../../../../components/form/OrderItemsTable/BusyItemsTable";
import { formatAmount } from "../../../../utils/pricingUtils";
import apiClient from "../../../../api/apiClient";

interface PurchaseReturnLineItem {
  id: string;
  rawMaterialId: string;
  rawMaterialName: string;
  rawMaterialCode?: string;
  quantity: number;
  unitPrice: number;
  uom: string;
  baseUoms?: string;
  reason?: string;
  amount: number;
}

const emptyReturnLine = (): PurchaseReturnLineItem => ({
  id: crypto.randomUUID(),
  rawMaterialId: "",
  rawMaterialName: "",
  rawMaterialCode: "",
  quantity: 1,
  unitPrice: 0,
  uom: "kg",
  baseUoms: "kg",
  reason: "Purchase Return",
  amount: 0,
});

export const PurchaseReturnCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEditMode = Boolean(id);

  const formRef = useRef<HTMLFormElement>(null);
  const itemsTableRef = useRef<HTMLDivElement>(null);
  const handleFormKeyDown = useFormKeyboardNav(formRef);

  const { data: company } = useAppSelector((state) => state.company);

  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState<boolean>(false);

  // Form states
  const [supplierId, setSupplierId] = useState<string>("");
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [storeId, setStoreId] = useState<string>("");
  const [narration, setNarration] = useState<string>("");
  const [lines, setLines] = useState<PurchaseReturnLineItem[]>([emptyReturnLine()]);
  const [originalReturnNo, setOriginalReturnNo] = useState<string>("");

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const focusFirstField = useCallback(() => {
    setTimeout(() => {
      const firstEl = formRef.current?.querySelector<HTMLElement>(
        "[data-nav]:not([disabled])"
      );
      firstEl?.focus();
    }, 100);
  }, []);

  const loadFormData = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, rmRes, stRes] = await Promise.all([
        supplierService.fetchAll({ page: 1, limit: 500 }),
        rawMaterialService.fetchAll({ limit: 1000 }),
        apiClient.get("/stores"),
      ]);
      const sList = Array.isArray(sRes) ? sRes : sRes?.suppliers || sRes?.data || [];
      setSuppliers(sList);
      const rmList = Array.isArray(rmRes) ? rmRes : rmRes?.rawMaterials || rmRes?.data || [];
      setRawMaterials(rmList);
      const stList = stRes?.data?.data || stRes?.data || [];
      setStores(Array.isArray(stList) ? stList.filter((s: any) => s.isActive) : []);

      // If edit mode, fetch the existing return
      if (id) {
        const ret = await returnService.fetchPurchaseReturnById(id);
        if (ret) {
          setSupplierId(String(ret.supplierId));
          setNarration(ret.narration || "");
          setOriginalReturnNo(ret.returnNo || "");

          if (ret.items && ret.items.length > 0) {
            const loadedLines: PurchaseReturnLineItem[] = ret.items.map((item: any) => {
              const rm = rmList.find((r: any) => String(r.rawMaterialId) === String(item.rawMaterialId));
              const q = Number(item.quantity || 0);
              const up = Number(item.unitPrice || 0);

              return {
                id: crypto.randomUUID(),
                rawMaterialId: String(item.rawMaterialId),
                rawMaterialName: rm?.name || rm?.materialName || item.rawMaterial?.name || item.rawMaterial?.materialName || `RM #${item.rawMaterialId}`,
                rawMaterialCode: rm?.rawMaterialId || "",
                quantity: q,
                unitPrice: up,
                uom: rm?.baseUom || "kg",
                baseUoms: rm?.baseUom || "kg",
                reason: item.reason || "Purchase Return",
                amount: q * up,
              };
            });
            setLines(loadedLines);
          }
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to load data for Purchase Return");
    } finally {
      setLoading(false);
      focusFirstField();
    }
  }, [id, focusFirstField]);

  useEffect(() => {
    loadFormData();
  }, [loadFormData]);

  // Selected supplier info
  const selectedSupplier = useMemo(() => {
    return suppliers.find((s: any) => String(s.id) === String(supplierId));
  }, [suppliers, supplierId]);

  const supplierHeaderInfo = useMemo(() => {
    if (!selectedSupplier) return null;
    const name = selectedSupplier.displayName || selectedSupplier.legalName || "";
    const city = selectedSupplier.billingCity || "";
    const bal = Number(selectedSupplier.balanceAmount ?? selectedSupplier.netBalance ?? selectedSupplier.openingBalance ?? 0);
    const bType = (selectedSupplier.balanceType || selectedSupplier.openingBalanceType || "").toString().toUpperCase();
    const isCr = bType.startsWith("C");
    const balLabel = bal ? `₹${formatAmount(bal)} ${isCr ? "Cr" : "Dr"}` : "";
    return { name, city, balLabel, isCr };
  }, [selectedSupplier]);

  // Supplier autocomplete options
  const supplierAutocompleteOptions: AutocompleteOption[] = useMemo(() => {
    return suppliers.map((s: any) => {
      const name = s.displayName || s.legalName || String(s.id);
      const city = s.billingCity || "—";
      const bal = Number(s.balanceAmount ?? s.netBalance ?? s.openingBalance ?? 0);
      const bType = (s.balanceType || s.openingBalanceType || "").toString().toUpperCase();
      const isCr = bType.startsWith("C");
      const balLabel = bal ? `₹${formatAmount(bal)} ${isCr ? "Cr" : "Dr"}` : "";

      return {
        value: String(s.id),
        label: name,
        selectedLabel: `${name}${balLabel ? ` · ${balLabel}` : ""}`,
        info: (
          <div className="flex items-center gap-3 text-[13px]">
            {city !== "—" && <span className="text-ink-subtle">{city}</span>}
            {balLabel && (
              <span className={`font-semibold ${isCr ? "text-emerald-500" : "text-rose-500"}`}>{balLabel}</span>
            )}
          </div>
        ),
      };
    });
  }, [suppliers]);

  // Raw material autocomplete options
  const materialAutocompleteOptions: AutocompleteOption[] = useMemo(() => {
    return rawMaterials.map((rm: any) => ({
      value: String(rm.rawMaterialId),
      label: rm.name || rm.materialName || rm.rawMaterialId,
      info: (
        <span className="text-[13px] text-ink-subtle font-mono">
          {rm.rawMaterialId}
        </span>
      ),
    }));
  }, [rawMaterials]);

  // Update line helper
  const updateLine = useCallback((lineId: string, patch: Partial<PurchaseReturnLineItem>) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const updated = { ...l, ...patch };
        if (patch.quantity !== undefined || patch.unitPrice !== undefined) {
          updated.amount = (Number(updated.quantity) || 0) * (Number(updated.unitPrice) || 0);
        }
        return updated;
      })
    );
  }, []);

  // When Supplier changes on CREATE mode
  useEffect(() => {
    if (isEditMode) return;
    if (!supplierId) {
      setLines([]);
      return;
    }
    if (lines.length === 0) {
      setLines([emptyReturnLine()]);
    }
  }, [supplierId, isEditMode]);

  const handleReset = useCallback(() => {
    setSupplierId("");
    setStoreId("");
    setLines([emptyReturnLine()]);
    setNarration("");
    setErrors({});
    focusFirstField();
  }, [focusFirstField]);

  // F-Key shortcuts
  useFormShortcuts({
    onSave: () => {
      if (!submitting) handleSubmit();
    },
    onDelete: () => {
      if (!isEditMode) handleReset();
    },
  });

  // F5 Data Refresh
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F5") {
        e.preventDefault();
        if (isEditMode && id) {
          loadFormData();
          toast.info("Purchase return refreshed");
        } else {
          handleReset();
          toast.info("Form reset");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditMode, id, loadFormData, handleReset]);

  // Discard changes confirmation
  const isFormDirty = Boolean(
    supplierId ||
    lines.some((r) => r.rawMaterialId && r.quantity > 0) ||
    narration
  );

  const handleBack = useCallback(() => {
    if (isFormDirty) {
      setSaveConfirmOpen(true);
    } else {
      navigate(-1);
    }
  }, [isFormDirty, navigate]);

  const handleDiscard = useCallback(() => {
    setSaveConfirmOpen(false);
    navigate(-1);
  }, [navigate]);

  const handleSaveFromModal = useCallback(() => {
    setSaveConfirmOpen(false);
    setTimeout(() => handleSubmit(), 150);
  }, []);

  const handleResume = useCallback(() => {
    setSaveConfirmOpen(false);
    focusFirstField();
  }, [focusFirstField]);

  // ── Return Columns for BusyItemsTable ──
  const returnColumns: BusyColumn<PurchaseReturnLineItem>[] = useMemo(() => {
    return [
      {
        key: "rawMaterialId",
        header: "Raw Material",
        width: "1fr",
        render: (row: PurchaseReturnLineItem, index: number) => {
          if (isEditMode && row.rawMaterialName && !materialAutocompleteOptions.some((o) => o.value === row.rawMaterialId)) {
            return (
              <div tabIndex={0} className="flex items-center w-full px-2 text-[13px] text-ink font-medium">
                {row.rawMaterialName}
              </div>
            );
          }
          return (
            <AutocompleteInput
              inline
              name={`item-${row.id}`}
              value={row.rawMaterialId}
              options={materialAutocompleteOptions}
              placeholder="Type to search material..."
              onChange={(val) => {
                const found = rawMaterials.find((rm: any) => String(rm.rawMaterialId) === String(val));
                if (found) {
                  updateLine(row.id, {
                    rawMaterialId: String(found.rawMaterialId),
                    rawMaterialName: found.name || found.materialName || found.rawMaterialId,
                    rawMaterialCode: found.rawMaterialId,
                    unitPrice: Number(found.lastPurchasePrice || found.rate || 0),
                    uom: found.baseUom || "kg",
                    baseUoms: found.baseUom || "kg",
                    quantity: row.quantity > 0 ? row.quantity : 1,
                    amount: (row.quantity > 0 ? row.quantity : 1) * Number(found.lastPurchasePrice || found.rate || 0),
                  });
                } else {
                  updateLine(row.id, {
                    rawMaterialId: "",
                    rawMaterialName: "",
                    rawMaterialCode: "",
                    unitPrice: 0,
                    amount: 0,
                  });
                }
                if (errors.lines) {
                  setErrors((prev) => { const next = { ...prev }; delete next.lines; return next; });
                }
                // Auto-focus Qty cell
                setTimeout(() => {
                  const qtyCell = itemsTableRef.current?.querySelector(`[data-r="${index}"][data-c="1"]`) as HTMLElement | null;
                  const qtyInput = qtyCell?.querySelector("input") as HTMLInputElement | null;
                  if (qtyInput) { qtyInput.focus(); qtyInput.select?.(); }
                }, 50);
              }}
            />
          );
        },
      },
      {
        key: "quantity",
        header: "Qty",
        width: "80px",
        align: "center" as const,
        render: (row: PurchaseReturnLineItem) => (
          <div className="flex items-center justify-center w-full h-full">
            <input
              type="text"
              inputMode="numeric"
              value={row.quantity === 0 && !row.rawMaterialId ? "" : row.quantity}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9.]/g, "");
                const q = val === "" ? 0 : Number(val);
                updateLine(row.id, {
                  quantity: q,
                  amount: q * row.unitPrice,
                });
              }}
              className="w-full bg-transparent text-[13px] text-ink text-center outline-none border-none p-0 h-full"
              placeholder="0"
            />
          </div>
        ),
      },
      {
        key: "unitPrice",
        header: "Unit Price",
        width: "110px",
        align: "right" as const,
        render: (row: PurchaseReturnLineItem) => (
          <input
            type="text"
            inputMode="decimal"
            value={row.unitPrice === 0 && !row.rawMaterialId ? "" : row.unitPrice}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9.]/g, "");
              const p = val === "" ? 0 : Number(val);
              updateLine(row.id, {
                unitPrice: p,
                amount: row.quantity * p,
              });
            }}
            className="w-full bg-transparent text-[13px] text-ink text-right outline-none border-none p-0 h-full"
            placeholder="0.00"
          />
        ),
      },
      {
        key: "amount",
        header: "Total",
        width: "120px",
        align: "right" as const,
        render: (row: PurchaseReturnLineItem) => {
          if (row.amount <= 0) return <span className="text-[13px] text-ink-subtle">—</span>;
          return (
            <div className="text-right pr-1">
              <span className="text-emerald-500 text-[13px] font-bold">₹{row.amount.toFixed(2)}</span>
            </div>
          );
        },
      },
    ];
  }, [isEditMode, materialAutocompleteOptions, rawMaterials, updateLine, errors.lines]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!supplierId) {
      newErrors.supplierId = "Please select a supplier";
    }

    const activeItems = lines.filter((l) => l.rawMaterialId && Number(l.quantity) > 0);
    if (activeItems.length === 0) {
      newErrors.lines = "At least one return line item with quantity > 0 is required";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      toast.error("Please fill all required fields correctly");
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    if (!company?.id) {
      toast.error("Company context is required");
      return;
    }

    const activeItems = lines.filter((l) => l.rawMaterialId && Number(l.quantity) > 0);

    setSubmitting(true);

    const payload = {
      supplierId: Number(supplierId),
      storeId: storeId || undefined,
      reason: "Purchase Return",
      narration,
      companyId: company.id,
      items: activeItems.map((r) => ({
        rawMaterialId: r.rawMaterialId,
        quantity: r.quantity,
        unitPrice: r.unitPrice,
        reason: r.reason || "Purchase Return",
      })),
    };

    try {
      if (isEditMode && id) {
        await returnService.updatePurchaseReturn(id, payload);
        toast.success("Purchase Return updated successfully!");
        navigate(-1);
      } else {
        await returnService.createPurchaseReturn(payload);
        toast.success("Saved");
        handleReset();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to save Purchase Return");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <CommonLoader text={isEditMode ? "Loading Purchase Return Details..." : "Loading Purchase Return Form..."} />
      </div>
    );
  }

  const totalQty = lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
  const totalAmount = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);

  return (
    <div className="max-w-[1150px] xl:mr-auto">
      <div className="bg-card rounded-2xl shadow-sm border border-line overflow-visible">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-line">
          <h3 className="text-lg font-bold text-ink">
            {isEditMode ? "Edit Purchase Return" : "New Purchase Return (Debit Note)"}
            {isEditMode && originalReturnNo && (
              <span className="text-purple-400 text-sm ml-1">*{originalReturnNo}</span>
            )}
          </h3>
          <CustomButton
            text="Back to List"
            icon={FaArrowLeft}
            variant="secondary"
            onClick={handleBack}
          />
        </div>

        <form
          ref={formRef}
          onKeyDown={handleFormKeyDown}
          data-escape-guarded
          onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
          noValidate
        >
          <div className="p-6 space-y-4">
            {/* Supplier + Store Select */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="w-full">
                <AutocompleteInput
                  label="Supplier"
                  name="supplierId"
                  required
                  value={supplierId}
                  error={errors.supplierId}
                  options={supplierAutocompleteOptions}
                  placeholder="Type to search supplier..."
                  onChange={(val) => {
                    setSupplierId(val);
                    if (errors.supplierId) {
                      setErrors((prev) => { const next = { ...prev }; delete next.supplierId; return next; });
                    }
                  }}
                />
              </div>
              <div className="w-full">
                <label className="block text-xs font-bold text-ink-muted uppercase tracking-wide mb-1">Store</label>
                <select
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
                  className="w-full px-3 py-2 bg-card border border-line rounded-lg text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                >
                  <option value="">-- Auto (from GRN) --</option>
                  {stores.map((s: any) => (
                    <option key={s.storeId || s.id} value={s.storeId || s.id}>{s.storeName}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Error for line items */}
            {errors.lines && (
              <div className="text-red-500 text-xs mb-2 bg-red-500/10 p-2 rounded-md border border-red-500/20">
                {errors.lines}
              </div>
            )}

            {/* BusyItemsTable */}
            <div ref={itemsTableRef} className="w-full space-y-1.5">
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-ink">Return Items</span>
                  {supplierHeaderInfo && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded bg-card-2 border border-line-soft font-semibold text-ink">
                        {supplierHeaderInfo.name}
                      </span>
                      {supplierHeaderInfo.city && (
                        <span className="text-ink-subtle text-[13px]">{supplierHeaderInfo.city}</span>
                      )}
                      {supplierHeaderInfo.balLabel && (
                        <span className={`text-[13px] font-semibold ${supplierHeaderInfo.isCr ? "text-emerald-500" : "text-rose-500"}`}>
                          {supplierHeaderInfo.balLabel}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <BusyItemsTable
                columns={returnColumns}
                rows={lines}
                onAdd={() => setLines((prev) => [...prev, emptyReturnLine()])}
                onRemove={(i) => setLines((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : prev))}
                editable={!isEditMode && lines.length > 1}
                showTotals={[
                  { colKey: "quantity", value: totalQty },
                  { colKey: "amount", value: `₹${totalAmount.toFixed(2)}` },
                ]}
                visibleRows={10}
                getFieldBeforeTable={() => {
                  return document.querySelector('input[name="supplierId"]') as HTMLElement | null;
                }}
                getFieldAfterTable={() => {
                  const notes = document.querySelector('textarea[name="narration"]') as HTMLElement | null;
                  if (notes && !notes.hasAttribute("disabled") && !(notes as any).disabled) return notes;
                  return document.querySelector('button[type="submit"]') as HTMLElement | null;
                }}
              />
            </div>

            {/* Narration */}
            <div className="w-full sm:w-1/2 mt-3">
              <TextArea
                label="Narration"
                name="narration"
                value={narration}
                placeholder="Enter narration..."
                rows={2}
                onChange={(e: any) => setNarration(e.target.value)}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-line">
            {!isEditMode && (
              <CustomButton
                text="Clear Form"
                type="button"
                variant="secondary"
                icon={FaUndo}
                onClick={handleReset}
                disabled={submitting}
              />
            )}
            <CustomButton
              text="Cancel"
              type="button"
              variant="secondary"
              onClick={handleBack}
              disabled={submitting}
            />
            <CustomButton
              text={submitting ? "Saving..." : isEditMode ? "Update Return" : "Confirm Return"}
              icon={FaSave}
              type="submit"
              disabled={submitting}
              variant="primary"
            />
          </div>
        </form>
      </div>

      {/* Discard / Save Confirmation Modal */}
      <CommonConfirmModal
        isOpen={saveConfirmOpen}
        onClose={handleResume}
        onCancel={handleDiscard}
        onConfirm={handleSaveFromModal}
        title="Discard Changes?"
        message="Are you sure you want to leave? Any unsaved purchase return details will be lost."
        warningText="Save to keep your changes, or Discard to leave."
        cancelText="Discard"
        cancelVariant="danger"
        confirmText="Save"
        confirmVariant="primary"
        confirmIcon={FaCheck}
        isDangerous={false}
        defaultFocusCancel={false}
      />
    </div>
  );
};

export default PurchaseReturnCreatePage;
