import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaSave, FaPlus, FaEraser, FaCheckCircle } from "react-icons/fa";
import { toast } from "react-toastify";
import { returnService } from "../../../../services/returnService";
import { customerService } from "../../../../services/customerService";
import { productService } from "../../../../services/productService";
import { salesProductService } from "../../../../services/salesProductService";
import { useAppSelector } from "../../../../hooks/reduxHooks";
import BackButton from "../../../../components/ui/BackButton/BackButton";
import CustomButton from "../../../../components/ui/Button/Button";
import SelectInput from "../../../../components/form/SelectInput/SelectInput";
import TextInput from "../../../../components/form/TextInput/TextInput";
import QuantityInput from "../../../../components/form/QuantityInput/QuantityInput";
import DeleteButton from "../../../../components/ui/DeleteButton/DeleteButton";
import CommonLoader from "../../../../components/ui/Loader/CommonLoader";

interface FormReturnRow {
  productId: number;
  salesInvoiceItemId?: string;
  description: string;
  productCode?: string;
  productGroup?: string;
  quantity: number;
  weight: number;
  uom: string;
  baseUoms?: string;
  maxReturnable: number;
  unitPrice: number;
  taxRate: number;
  reason?: string;
}

export const SalesReturnCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEditMode = Boolean(id);

  const { data: company } = useAppSelector((state) => state.company);

  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitMode, setSubmitMode] = useState<"DRAFT" | "APPROVED" | null>(null);

  // Form states
  const [customerId, setCustomerId] = useState<string>("");
  const [customers, setCustomers] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [salesProductsList, setSalesProductsList] = useState<any[]>([]);
  const [narration, setNarration] = useState<string>("");
  const [returnRows, setReturnRows] = useState<FormReturnRow[]>([]);
  const [originalReturnNo, setOriginalReturnNo] = useState<string>("");

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadFormData = async () => {
      setLoading(true);
      try {
        const [cRes, pList, spList] = await Promise.all([
          customerService.fetchAll({ page: 1, limit: 500 }),
          productService.fetchAll(),
          salesProductService.fetchAll(),
        ]);
        const cList = Array.isArray(cRes) ? cRes : cRes?.customers || [];
        setCustomers(cList);
        setAllProducts(pList || []);
        setSalesProductsList(Array.isArray(spList) ? spList : []);

        // If edit mode, fetch the existing return
        if (id) {
          const ret = await returnService.fetchSalesReturnById(id);
          if (ret) {
            setCustomerId(ret.customerId);
            setNarration(ret.narration || "");
            setOriginalReturnNo(ret.returnNo || "");

            if (ret.items && ret.items.length > 0) {
              const rows: FormReturnRow[] = ret.items.map((item: any) => {
                let uomCode = String(item.uom || "kg").toLowerCase();
                if (uomCode === "ton" || uomCode === "tonne" || uomCode === "tons") uomCode = "t";

                const prodObj = pList?.find((p: any) => Number(p.id) === Number(item.productId));
                const groupName = prodObj?.category?.name || prodObj?.category?.categoryName || "Sales Group";
                const rawBaseUom = prodObj?.baseUom || prodObj?.uom?.baseUom || prodObj?.weightUom || "kg, g, t";

                return {
                  productId: Number(item.productId),
                  salesInvoiceItemId: item.salesInvoiceItemId || undefined,
                  description: item.product?.productName || prodObj?.productName || `Product #${item.productId}`,
                  productCode: prodObj?.productCode || "",
                  productGroup: groupName,
                  quantity: Number(item.quantity || 0),
                  weight: Number(item.weight || 0),
                  uom: uomCode,
                  baseUoms: rawBaseUom,
                  maxReturnable: 999999,
                  unitPrice: Number(item.unitPrice || 0),
                  taxRate: Number(item.taxRate || 0),
                  reason: item.reason || "Sales Return",
                };
              });
              setReturnRows(rows);
            }
          }
        }
      } catch (err: any) {
        toast.error(err?.message || "Failed to load master data for Sales Return");
      } finally {
        setLoading(false);
      }
    };

    loadFormData();
  }, [id]);

  // Filter Sales Products only
  const availableSalesProducts = useMemo(() => {
    const selectedCustomer = customers.find((c: any) => String(c.id) === String(customerId));
    const gradeName = selectedCustomer?.customerGrade?.name || selectedCustomer?.grade;

    const salesProductsOnly = allProducts.filter((p: any) => {
      if (p.isActive === false) return false;
      const pType = String(p.productType || "").toUpperCase();
      return pType === "SALES_PRODUCTION" || pType === "SALES";
    });

    return salesProductsOnly.map((p: any) => {
      let defaultPrice = Number(p.rate || 0);

      if (gradeName && p.gradeRates && typeof p.gradeRates === "object") {
        const gradePrice = p.gradeRates[gradeName];
        if (gradePrice !== undefined && gradePrice !== null && !isNaN(Number(gradePrice))) {
          defaultPrice = Number(gradePrice);
        }
      }

      let rawBaseUom = p.baseUom || p.uom?.baseUom || p.weightUom || "kg, g, t";
      let uomCode = String(p.uom?.code || p.uom?.uomCode || p.uom?.name || p.weightUom || "kg").toLowerCase();
      if (uomCode === "ton" || uomCode === "tonne" || uomCode === "tons") uomCode = "t";

      const groupName = p.category?.name || p.category?.categoryName || "Sales Group";

      return {
        productId: Number(p.id),
        productCode: p.productCode || "",
        productGroup: groupName,
        description: p.productName || p.displayName || `Product #${p.id}`,
        baseUoms: rawBaseUom,
        weight: 0,
        uom: uomCode || "kg",
        unitPrice: defaultPrice,
        taxRate: Number(p.gstRate || 0),
      };
    });
  }, [customerId, customers, allProducts]);

  const createEmptyRow = (): FormReturnRow => ({
    productId: 0,
    description: "",
    productCode: "",
    productGroup: "",
    quantity: 0,
    weight: 0,
    uom: "kg",
    baseUoms: "kg, g, t",
    maxReturnable: 999999,
    unitPrice: 0,
    taxRate: 0,
  });

  // When Customer changes on CREATE mode, initialize rows
  useEffect(() => {
    if (isEditMode) return;
    if (!customerId) {
      setReturnRows([]);
      return;
    }
    if (returnRows.length === 0) {
      setReturnRows([createEmptyRow()]);
    } else {
      setReturnRows((prev) =>
        prev.map((row) => {
          if (!row.productId) return row;
          const found = availableSalesProducts.find((p) => p.productId === row.productId);
          return found ? { ...row, unitPrice: found.unitPrice, baseUoms: found.baseUoms } : row;
        })
      );
    }
  }, [customerId, isEditMode]);

  const handleAddRow = () => {
    setReturnRows((prev) => [...prev, createEmptyRow()]);
    if (errors.rows) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.rows;
        return next;
      });
    }
  };

  const handleProductSelect = (index: number, selectedProductIdStr: string) => {
    const prodId = Number(selectedProductIdStr);
    const found = availableSalesProducts.find((p) => p.productId === prodId);

    setReturnRows((prev) => {
      const updated = [...prev];
      if (found) {
        updated[index] = {
          ...updated[index],
          productId: found.productId,
          description: found.description,
          productCode: found.productCode,
          productGroup: found.productGroup,
          weight: 0,
          uom: found.uom || "kg",
          baseUoms: found.baseUoms || "kg, g, t",
          unitPrice: found.unitPrice,
          taxRate: found.taxRate,
          quantity: updated[index].quantity > 0 ? updated[index].quantity : 1,
        };
      } else {
        updated[index] = {
          ...updated[index],
          productId: 0,
          description: "",
          productCode: "",
          productGroup: "",
          weight: 0,
          uom: "kg",
          baseUoms: "kg, g, t",
          unitPrice: 0,
        };
      }
      return updated;
    });

    if (errors[`product_${index}`]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[`product_${index}`];
        return next;
      });
    }
  };

  const handleRowFieldChange = (index: number, field: "quantity" | "weight" | "unitPrice", value: number) => {
    setReturnRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: Math.max(0, value) };
      return updated;
    });

    if (field === "quantity" && errors[`qty_${index}`]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[`qty_${index}`];
        return next;
      });
    }
    if (field === "weight" && errors[`weight_${index}`]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[`weight_${index}`];
        return next;
      });
    }
    if (field === "unitPrice" && errors[`unitPrice_${index}`]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[`unitPrice_${index}`];
        return next;
      });
    }
  };

  const handleRowUomChange = (index: number, uom: string) => {
    setReturnRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], uom };
      return updated;
    });
  };

  const handleRemoveRow = (index: number) => {
    setReturnRows((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.length === 0 ? [createEmptyRow()] : filtered;
    });
  };

  const handleReset = () => {
    setCustomerId("");
    setReturnRows([]);
    setNarration("");
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!customerId) {
      newErrors.customerId = "Please select a customer";
    }

    if (returnRows.length === 0) {
      newErrors.rows = "At least one line item is required";
    }

    returnRows.forEach((row, idx) => {
      if (!row.productId || row.productId === 0) {
        newErrors[`product_${idx}`] = "Please select a product";
      }
      if (!row.quantity || row.quantity <= 0) {
        newErrors[`qty_${idx}`] = "Qty must be > 0";
      }
      if (!row.weight || row.weight <= 0) {
        newErrors[`weight_${idx}`] = "Weight must be > 0";
      }
      if (row.unitPrice === undefined || row.unitPrice === null || row.unitPrice < 0) {
        newErrors[`unitPrice_${idx}`] = "Price required";
      }
    });

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      toast.error("Please fill all required fields correctly");
      return false;
    }

    return true;
  };

  // Calculate totals
  const subTotal = returnRows.reduce((sum, r) => sum + r.quantity * r.unitPrice, 0);
  const taxTotal = returnRows.reduce((sum, r) => sum + (r.quantity * r.unitPrice * r.taxRate) / 100, 0);
  const grandTotal = subTotal + taxTotal;

  const handleSubmit = async (status: "DRAFT" | "APPROVED") => {
    if (!validateForm()) {
      return;
    }

    if (!company?.id) {
      toast.error("Company context is required");
      return;
    }

    const activeReturnItems = returnRows.filter((r) => r.productId > 0 && r.quantity > 0);

    setSubmitting(true);
    setSubmitMode(status);

    const payload = {
      customerId,
      refundMode: "CREDIT_NOTE" as const,
      reason: "Sales Return",
      narration,
      companyId: company.id,
      status,
      items: activeReturnItems.map((r) => ({
        productId: r.productId,
        quantity: r.quantity,
        weight: r.weight,
        uom: r.uom,
        unitPrice: r.unitPrice,
        taxRate: r.taxRate,
        reason: r.reason || "Sales Return",
      })),
    };

    try {
      if (isEditMode && id) {
        await returnService.updateSalesReturn(id, payload);
        if (status === "DRAFT") {
          toast.success("Sales Return draft updated successfully!");
        } else {
          toast.success("Sales Return confirmed & auto-posted to inventory and accounts!");
        }
      } else {
        await returnService.createSalesReturn(payload);
        if (status === "DRAFT") {
          toast.success("Sales Return saved as Draft successfully!");
        } else {
          toast.success("Sales Return confirmed & auto-posted to inventory and accounts!");
        }
      }

      navigate("/sales-returns");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to save Sales Return");
    } finally {
      setSubmitting(false);
      setSubmitMode(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <CommonLoader text={isEditMode ? "Loading Sales Return Details..." : "Loading Sales Return Form..."} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-card rounded-2xl shadow-sm border border-line p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-ink">
              {isEditMode ? `Edit Sales Return (Draft ${originalReturnNo})` : "New Sales Return (Credit Note)"}
            </h1>
            <p className="text-xs text-ink-muted mt-0.5">
              {isEditMode
                ? "Update draft sales return details, or confirm to auto-post credit note and accounting entries."
                : "Record product returns from customer, generate credit note, and update inventory & accounts."}
            </p>
          </div>

          <BackButton to="/sales-returns" />
        </div>
      </div>

      {/* Main Form Content */}
      <div className="bg-card rounded-2xl shadow-sm border border-line p-6 space-y-6">
        {/* Customer Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <SelectInput
              label="CUSTOMER"
              name="customerId"
              value={customerId}
              required
              error={errors.customerId}
              defaultOptionLabel="Select Customer"
              searchable
              options={customers.map((c: any) => {
                const name = c.displayName || c.firmName;
                const rawGrade = c.customerGrade?.name || c.grade || "";
                const gradeShort = rawGrade ? rawGrade.replace(/grade\s*/i, "").trim() : "";
                const gradeTag = gradeShort ? `(${gradeShort})` : null;

                const location = c.billingCity || c.city || c.shippingCity || c.customerType?.name;
                const locationTag = location ? `(${location.toLowerCase()})` : null;

                const parts = [name, gradeTag, locationTag].filter(Boolean);
                return { label: parts.join(" - "), value: String(c.id) };
              })}
              onChange={(e) => {
                setCustomerId(e.target.value);
                if (errors.customerId) {
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.customerId;
                    return next;
                  });
                }
              }}
            />
          </div>

          <div>
            <TextInput
              label="REFUND MODE"
              name="refundMode"
              value="CREDIT_NOTE (Auto-Adjusted)"
              disabled
            />
          </div>
        </div>

        {/* Items Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-ink uppercase tracking-wider">
                Return Line Items <span className="text-red-500">*</span>
              </h2>
              <p className="text-xs text-ink-muted">Select sales products and specify quantities to return.</p>
            </div>
            <CustomButton
              text="Add Item"
              icon={FaPlus}
              onClick={handleAddRow}
              variant="primary"
              size="sm"
              type="button"
            />
          </div>

          {errors.rows && (
            <p className="text-xs text-red-500 font-medium">{errors.rows}</p>
          )}

          {returnRows.length === 0 ? (
            <div className="p-8 border border-dashed border-line rounded-xl text-center text-xs text-ink-subtle flex flex-col items-center gap-2 bg-card-2/50">
              <p className="font-medium">No line items added yet.</p>
              <button
                type="button"
                onClick={handleAddRow}
                className="text-primary hover:underline font-semibold cursor-pointer"
              >
                + Click here to add item
              </button>
            </div>
          ) : (
            <div className="border border-line rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs text-ink">
                <thead className="bg-head uppercase font-semibold text-ink-muted border-b border-line">
                  <tr>
                    <th className="px-4 py-3 min-w-[240px]">
                      Product & Group <span className="text-red-500">*</span>
                    </th>
                    <th className="px-4 py-3 w-28 text-center">
                      Qty <span className="text-red-500">*</span>
                    </th>
                    <th className="px-4 py-3 w-48 text-center">
                      Weight / UOM <span className="text-red-500">*</span>
                    </th>
                    <th className="px-4 py-3 w-36 text-center">
                      Unit Price (₹) <span className="text-red-500">*</span>
                    </th>
                    <th className="px-4 py-3 w-36 text-right">Total (₹)</th>
                    <th className="px-4 py-3 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft bg-card">
                  {returnRows.map((row, idx) => {
                    const lineTot = row.quantity * row.unitPrice;
                    const hasProductError = Boolean(errors[`product_${idx}`]);
                    const hasQtyError = Boolean(errors[`qty_${idx}`]);
                    const hasPriceError = Boolean(errors[`unitPrice_${idx}`]);

                    return (
                      <tr
                        key={idx}
                        className={`hover:bg-card-2 transition-colors ${
                          row.quantity > 0 ? "bg-primary/5" : ""
                        }`}
                      >
                        <td className="px-4 py-3 align-top min-w-[240px]">
                          <SelectInput
                            name={`product-${idx}`}
                            value={row.productId ? String(row.productId) : ""}
                            defaultOptionLabel="-- Select Product --"
                            searchable
                            noMargin
                            error={errors[`product_${idx}`]}
                            options={availableSalesProducts.map((p) => ({
                              label: p.productGroup ? `${p.description} — (${p.productGroup})` : p.description,
                              value: String(p.productId),
                            }))}
                            onChange={(e) => handleProductSelect(idx, e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-3 align-top text-center">
                          <div className="flex flex-col items-center">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={row.quantity || ""}
                              onChange={(e) =>
                                handleRowFieldChange(idx, "quantity", parseFloat(e.target.value) || 0)
                              }
                              className={`w-24 h-10 px-2 border rounded-md text-center font-bold focus:outline-none text-sm shadow-2xs ${
                                hasQtyError
                                  ? "border-red-500 bg-red-500/5 text-red-500 focus:border-red-500"
                                  : "border-line bg-card-2 text-ink focus:border-primary"
                              }`}
                              placeholder="0"
                            />
                            {hasQtyError && (
                              <span className="text-red-500 text-[11px] font-medium mt-1">
                                {errors[`qty_${idx}`]}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top text-center min-w-[180px]">
                          <QuantityInput
                            hideLabel
                            name={`weight-${idx}`}
                            value={row.weight === 0 ? "" : row.weight}
                            baseUoms={row.baseUoms || "kg, g, t"}
                            uom={row.uom || "kg"}
                            error={errors[`weight_${idx}`]}
                            onChange={(e: any) =>
                              handleRowFieldChange(idx, "weight", parseFloat(e.target.value) || 0)
                            }
                            onUomChange={(newUom: string) => handleRowUomChange(idx, newUom)}
                          />
                        </td>
                        <td className="px-4 py-3 align-top text-center">
                          <div className="flex flex-col items-center">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.unitPrice || ""}
                              onChange={(e) =>
                                handleRowFieldChange(idx, "unitPrice", parseFloat(e.target.value) || 0)
                              }
                              className={`w-32 h-10 px-3 border rounded-md text-center text-ink focus:outline-none text-sm font-medium shadow-2xs ${
                                hasPriceError
                                  ? "border-red-500 bg-red-500/5 text-red-500 focus:border-red-500"
                                  : "border-line bg-card-2 focus:border-primary"
                              }`}
                              placeholder="0.00"
                            />
                            {hasPriceError && (
                              <span className="text-red-500 text-[11px] font-medium mt-1">
                                {errors[`unitPrice_${idx}`]}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top text-right">
                          <div className="h-10 flex items-center justify-end font-mono font-bold text-ink text-sm">
                            {lineTot > 0 ? `₹${lineTot.toFixed(2)}` : "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top text-center">
                          <div className="h-10 flex items-center justify-center">
                            <DeleteButton onClick={() => handleRemoveRow(idx)} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Bottom Section: Narration and Financial Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4 border-t border-line-soft items-start">
          <div className="lg:col-span-2">
            <TextInput
              label="NARRATION / INTERNAL NOTES"
              name="narration"
              value={narration}
              as="textarea"
              rows={3}
              placeholder="Additional accounting or return notes..."
              onChange={(e) => setNarration(e.target.value)}
            />
          </div>

          <div className="bg-card-2 p-5 rounded-xl border border-line space-y-3">
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider border-b border-line pb-2">
              Financial Summary
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-ink-muted">
                <span>Sub Total:</span>
                <span className="font-mono text-ink font-semibold">₹{subTotal.toFixed(2)}</span>
              </div>
              {taxTotal > 0 && (
                <div className="flex justify-between text-ink-muted">
                  <span>GST Amount:</span>
                  <span className="font-mono text-ink font-semibold">₹{taxTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-ink pt-2 border-t border-line">
                <span>Grand Total:</span>
                <span className="font-mono text-primary text-base">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-6 border-t border-line-soft">
          <CustomButton
            text="Clear"
            icon={FaEraser}
            variant="secondary"
            onClick={handleReset}
            disabled={submitting}
            type="button"
          />
          <CustomButton
            type="button"
            text={submitting && submitMode === "DRAFT" ? "Saving Draft..." : isEditMode ? "Update Draft" : "Save as Draft"}
            icon={FaSave}
            variant="secondary"
            disabled={submitting}
            onClick={() => handleSubmit("DRAFT")}
          />
          <CustomButton
            type="button"
            text={submitting && submitMode === "APPROVED" ? "Confirming..." : "Confirm Return"}
            icon={FaCheckCircle}
            variant="primary"
            disabled={submitting}
            onClick={() => handleSubmit("APPROVED")}
          />
        </div>
      </div>
    </div>
  );
};

export default SalesReturnCreatePage;
