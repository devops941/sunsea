import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronDown, ChevronUp } from "lucide-react";
import { FaPlus } from "react-icons/fa";
import { toast } from "react-toastify";
import { returnService } from "../../../../services/returnService";
import { customerService } from "../../../../services/customerService";
import { productService } from "../../../../services/productService";
import { salesProductService } from "../../../../services/salesProductService";
import { useAppSelector } from "../../../../hooks/reduxHooks";
import SelectInput from "../../../../components/form/SelectInput/SelectInput";
import QuantityInput from "../../../../components/form/QuantityInput/QuantityInput";
import CommonLoader from "../../../../components/ui/Loader/CommonLoader";
import CustomButton from "../../../../components/ui/Button/Button";
import BackButton from "../../../../components/ui/BackButton/BackButton";
import TextArea from "../../../../components/form/TextArea/TextArea";
import DeleteButton from "../../../../components/ui/DeleteButton/DeleteButton";
import TextInput from "../../../../components/form/TextInput/TextInput";

interface ReturnComponent {
  componentProductId: number;
  productName: string;
  perUnit: number;
  included: boolean;
  weightPerPiece: number;
}

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
  components: ReturnComponent[];
}

export const SalesReturnCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEditMode = Boolean(id);

  const { data: company } = useAppSelector((state) => state.company);
  const [expandedItemIndex, setExpandedItemIndex] = useState<number | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

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
                const groupName = (prodObj as any)?.category?.name || (prodObj as any)?.category?.categoryName || "Sales Group";
                const rawBaseUom = (prodObj as any)?.baseUom || (prodObj as any)?.uom?.baseUom || (prodObj as any)?.weightUom || "kg, g, t";

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
                  components: [],
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

  // Sales Products list with grade-based pricing from component products
  const availableSalesProducts = useMemo(() => {
    const selectedCustomer = customers.find((c: any) => String(c.id) === String(customerId));
    const gradeName = selectedCustomer?.customerGrade?.name || selectedCustomer?.grade;

    return salesProductsList
      .filter((sp: any) => sp.isActive !== false)
      .map((sp: any) => {
        // Calculate price from component products based on customer grade
        let totalPrice = 0;
        let defaultWeight = 0;
        const comps = sp.components || [];

        comps.forEach((comp: any) => {
          const prod = comp.componentProduct || allProducts.find((p: any) => String(p.id) === String(comp.componentProductId));
          if (prod) {
            let price = Number(prod.rate || 0);
            if (gradeName && prod.gradeRates && typeof prod.gradeRates === "object") {
              const gradePrice = prod.gradeRates[gradeName];
              if (gradePrice !== undefined && gradePrice !== null && !isNaN(Number(gradePrice))) {
                price = Number(gradePrice);
              }
            }
            totalPrice += price * Number(comp.quantity || 1);
          }
        });

        // Sum weight from all components
        comps.forEach((comp: any) => {
          const prod = comp.componentProduct || allProducts.find((p: any) => String(p.id) === String(comp.componentProductId));
          if (prod) {
            defaultWeight += Number(prod.weightPerPiece || 0) * Number(comp.quantity || 1);
          }
        });

        return {
          productId: Number(sp.id),
          productCode: sp.salesProductCode || "",
          productGroup: "",
          description: sp.salesProductName || sp.salesProductCode || `SP #${sp.id}`,
          baseUoms: "kg, g, t",
          weight: defaultWeight,
          uom: "kg",
          unitPrice: totalPrice,
          taxRate: 0,
          components: comps,
        };
      });
  }, [customerId, customers, allProducts, salesProductsList]);

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
    components: [],
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

  const buildComponents = (sp: any): ReturnComponent[] => {
    const comps = sp?.components || [];
    return comps.map((comp: any) => {
      const prod = comp.componentProduct || allProducts.find((p: any) => String(p.id) === String(comp.componentProductId));
      return {
        componentProductId: Number(comp.componentProductId),
        productName: prod?.productName || `Product #${comp.componentProductId}`,
        perUnit: Number(comp.quantity || 1),
        included: true,
        weightPerPiece: Number(prod?.weightPerPiece || 0),
      };
    });
  };

  const recalcWeightAndPrice = (row: FormReturnRow, gradeName?: string): FormReturnRow => {
    const included = row.components.filter((c) => c.included);
    let totalWeight = 0;
    let totalPrice = 0;

    included.forEach((comp) => {
      totalWeight += comp.weightPerPiece * comp.perUnit;
      const prod = allProducts.find((p: any) => Number(p.id) === comp.componentProductId);
      let price = Number(prod?.rate || 0);
      if (gradeName && prod?.gradeRates && typeof prod.gradeRates === "object") {
        const gradePrice = (prod.gradeRates as any)[gradeName];
        if (gradePrice !== undefined && gradePrice !== null && !isNaN(Number(gradePrice))) {
          price = Number(gradePrice);
        }
      }
      totalPrice += price * comp.perUnit;
    });

    return {
      ...row,
      weight: totalWeight * row.quantity,
      unitPrice: totalPrice,
    };
  };

  const getGradeName = () => {
    const selectedCustomer = customers.find((c: any) => String(c.id) === String(customerId));
    return selectedCustomer?.customerGrade?.name || selectedCustomer?.grade;
  };

  const handleProductSelect = (index: number, selectedProductIdStr: string) => {
    const prodId = Number(selectedProductIdStr);
    const found = availableSalesProducts.find((p) => p.productId === prodId);

    setReturnRows((prev) => {
      const updated = [...prev];
      if (found) {
        const qty = updated[index].quantity > 0 ? updated[index].quantity : 1;
        const components = buildComponents(found);
        let row: FormReturnRow = {
          ...updated[index],
          productId: found.productId,
          description: found.description,
          productCode: found.productCode,
          productGroup: found.productGroup,
          uom: found.uom || "kg",
          baseUoms: found.baseUoms || "kg, g, t",
          taxRate: found.taxRate,
          quantity: qty,
          components,
          weight: 0,
          unitPrice: 0,
        };
        row = recalcWeightAndPrice(row, getGradeName());
        updated[index] = row;
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
          components: [],
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

  const handleToggleComponent = (rowIndex: number, compIndex: number) => {
    setReturnRows((prev) => {
      const updated = [...prev];
      const row = { ...updated[rowIndex] };
      const comps = [...row.components];
      comps[compIndex] = { ...comps[compIndex], included: !comps[compIndex].included };
      row.components = comps;
      updated[rowIndex] = recalcWeightAndPrice(row, getGradeName());
      return updated;
    });
  };

  const handleRowFieldChange = (index: number, field: "quantity" | "weight" | "unitPrice", value: number) => {
    setReturnRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: Math.max(0, value) };

      // Auto-recalculate weight when quantity changes
      if (field === "quantity" && updated[index].components.length > 0) {
        updated[index] = recalcWeightAndPrice(updated[index], getGradeName());
      }

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

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    if (!company?.id) {
      toast.error("Company context is required");
      return;
    }

    const activeReturnItems = returnRows.filter((r) => r.productId > 0 && r.quantity > 0);

    setSubmitting(true);

    // Expand sales products into included component production products for backend
    const gradeName = getGradeName();
    const expandedItems: { productId: number; quantity: number; weight: number; uom: string; unitPrice: number; taxRate: number; reason: string }[] = [];

    activeReturnItems.forEach((r) => {
      const includedComps = r.components.filter((c) => c.included);

      if (includedComps.length > 0) {
        // Distribute user's entered unitPrice proportionally across components
        const autoTotal = includedComps.reduce((sum, comp) => {
          const prod = allProducts.find((p: any) => Number(p.id) === comp.componentProductId);
          let price = Number(prod?.rate || 0);
          if (gradeName && prod?.gradeRates && typeof prod.gradeRates === "object") {
            const gp = (prod.gradeRates as any)[gradeName];
            if (gp !== undefined && gp !== null && !isNaN(Number(gp))) price = Number(gp);
          }
          return sum + price * comp.perUnit;
        }, 0);

        includedComps.forEach((comp) => {
          const prod = allProducts.find((p: any) => Number(p.id) === comp.componentProductId);
          let basePrice = Number(prod?.rate || 0);
          if (gradeName && prod?.gradeRates && typeof prod.gradeRates === "object") {
            const gp = (prod.gradeRates as any)[gradeName];
            if (gp !== undefined && gp !== null && !isNaN(Number(gp))) basePrice = Number(gp);
          }

          // Proportional share of the user's entered price
          const share = autoTotal > 0 ? (basePrice * comp.perUnit) / autoTotal : 1 / includedComps.length;
          const compUnitPrice = (r.unitPrice * share) / comp.perUnit;

          expandedItems.push({
            productId: comp.componentProductId,
            quantity: r.quantity * comp.perUnit,
            weight: comp.weightPerPiece * comp.perUnit * r.quantity,
            uom: r.uom,
            unitPrice: Math.round(compUnitPrice * 100) / 100,
            taxRate: r.taxRate,
            reason: r.reason || "Sales Return",
          });
        });
      } else {
        // No components — use as-is
        expandedItems.push({
          productId: r.productId,
          quantity: r.quantity,
          weight: r.weight,
          uom: r.uom,
          unitPrice: r.unitPrice,
          taxRate: r.taxRate,
          reason: r.reason || "Sales Return",
        });
      }
    });

    const payload = {
      customerId,
      reason: "Sales Return",
      narration,
      companyId: company.id,
      items: expandedItems,
    };

    try {
      if (isEditMode && id) {
        await returnService.updateSalesReturn(id, payload);
        toast.success("Sales Return updated successfully!");
      } else {
        await returnService.createSalesReturn(payload);
        toast.success("Sales Return confirmed & auto-posted to inventory and accounts!");
      }

      navigate("/sales-returns");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to save Sales Return");
    } finally {
      setSubmitting(false);
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
    <div className="max-w-[1400px] xl:mr-auto">
      <div className="bg-card rounded-2xl shadow-sm border border-line overflow-visible">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-line">
          <h3 className="text-lg font-bold text-ink">
            {isEditMode ? `Edit Sales Return` : "New Sales Return (Credit Note)"}
            {isEditMode && originalReturnNo && (
              <span className="text-purple-400 text-sm ml-1">*{originalReturnNo}</span>
            )}
          </h3>
          <BackButton text="Back to List" to="/sales-returns" />
        </div>

        <div className="p-5 space-y-5">
          {/* Customer + Refund Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 md:gap-x-8 lg:gap-x-10 gap-y-3 md:gap-y-4">
            <div>
              <SelectInput
                label="Customer"
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

          </div>

          {/* Items Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-ink uppercase tracking-wide">
                Return Line Items <span className="text-red-500">*</span>
                <span className="text-ink-muted font-normal normal-case ml-1 text-xs">(Select sales products and specify quantities to return)</span>
              </h4>
              <CustomButton
                type="button"
                text="Add Item"
                icon={FaPlus}
                variant="secondary"
                onClick={handleAddRow}
              />
            </div>

            {errors.rows && (
              <p className="text-red-500 text-sm mb-2">{errors.rows}</p>
            )}

            <div className="border border-line-soft rounded-xl overflow-hidden bg-card">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-card-2 border-b border-line-soft">
                    <th className="py-2 pl-3 pr-1 text-left text-[11px] font-bold text-ink-muted uppercase tracking-wide w-8">#</th>
                    <th className="py-2 px-1 text-left text-[11px] font-bold text-ink-muted uppercase tracking-wide">Sales Product</th>
                    <th className="py-2 px-1 text-center text-[11px] font-bold text-ink-muted uppercase tracking-wide w-20">Qty</th>
                    <th className="py-2 px-1 text-center text-[11px] font-bold text-ink-muted uppercase tracking-wide w-40">Weight / UOM</th>
                    <th className="py-2 px-1 text-center text-[11px] font-bold text-ink-muted uppercase tracking-wide w-28">Unit Price</th>
                    <th className="py-2 px-1 text-right text-[11px] font-bold text-ink-muted uppercase tracking-wide w-28">Total</th>
                    <th className="py-2 px-1 text-center text-[11px] font-bold text-ink-muted uppercase tracking-wide w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {returnRows.map((row, idx) => {
                    const lineTot = row.quantity * row.unitPrice;
                    const hasComponents = row.components.length > 0;
                    const isExpanded = expandedItemIndex === idx;

                    return (
                      <React.Fragment key={idx}>
                        <tr className="border-b border-line-soft bg-card hover:bg-card-2/40">
                          <td className="py-2 pl-3 pr-1 text-ink-subtle font-medium">{idx + 1}</td>
                          <td className="py-1 px-1">
                            <div className="flex items-center gap-1">
                              {hasComponents && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedItemIndex(isExpanded ? null : idx)}
                                  className="p-0.5 rounded text-ink-subtle hover:text-primary hover:bg-primary/10 transition-colors flex-shrink-0"
                                >
                                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                              )}
                              <SelectInput
                                hideLabel
                                label=""
                                name={`product-${idx}`}
                                value={row.productId ? String(row.productId) : ""}
                                defaultOptionLabel="-- Select Product --"
                                searchable
                                error={errors[`product_${idx}`]}
                                options={availableSalesProducts.map((p) => {
                                  const usedByOther = returnRows.some((r, i) => i !== idx && r.productId === p.productId);
                                  return { label: p.description, value: String(p.productId), disabled: usedByOther };
                                })}
                                onChange={(e) => handleProductSelect(idx, e.target.value)}
                              />
                            </div>
                          </td>
                          <td className="py-1 px-1 w-20">
                            <TextInput
                              name={`qty-${idx}`}
                              type="number"
                              value={row.quantity ? String(row.quantity) : ""}
                              min="0"
                              preventNegative
                              onChange={(e: any) =>
                                handleRowFieldChange(idx, "quantity", parseFloat(e.target.value) || 0)
                              }
                              error={errors[`qty_${idx}`]}
                            />
                          </td>
                          <td className="py-1 px-1 w-40">
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
                          <td className="py-1 px-1 w-28">
                            <TextInput
                              name={`unitPrice-${idx}`}
                              type="number"
                              value={row.unitPrice ? String(row.unitPrice) : ""}
                              min="0"
                              step="0.01"
                              preventNegative
                              onChange={(e: any) =>
                                handleRowFieldChange(idx, "unitPrice", parseFloat(e.target.value) || 0)
                              }
                              placeholder="0"
                              error={errors[`unitPrice_${idx}`]}
                            />
                          </td>
                          <td className="py-2 px-1 text-right font-bold whitespace-nowrap">
                            {lineTot > 0 ? (
                              <span className="text-emerald-500 text-sm">₹{lineTot.toFixed(2)}</span>
                            ) : "—"}
                          </td>
                          <td className="py-1 px-1 w-10 text-center">
                            <DeleteButton onClick={() => handleRemoveRow(idx)} />
                          </td>
                        </tr>
                        {/* Component sub-rows */}
                        {hasComponents && isExpanded && (
                          <tr className="bg-card-2/50">
                            <td></td>
                            <td colSpan={6} className="px-3 py-2">
                              <div className="ml-6 rounded-md border border-line-soft overflow-hidden">
                                <div className="grid grid-cols-[auto_1fr_auto_80px] gap-2 px-3 py-1.5 bg-card-2 border-b border-line-soft">
                                  <div className="w-4" />
                                  <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider">Component</span>
                                  <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider text-center w-12">Per Unit</span>
                                  <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider text-center">Qty</span>
                                </div>
                                {row.components.map((comp, compIdx) => (
                                  <div
                                    key={comp.componentProductId}
                                    className={`grid grid-cols-[auto_1fr_auto_80px] gap-2 items-center px-3 py-1.5 border-b border-line-soft last:border-b-0 ${comp.included ? "bg-card" : "bg-card-2 opacity-60"}`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={comp.included}
                                      onChange={() => handleToggleComponent(idx, compIdx)}
                                      className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer"
                                    />
                                    <span className={`text-xs ${comp.included ? "text-ink font-medium" : "line-through text-ink-subtle"}`}>
                                      {comp.productName}
                                    </span>
                                    <span className="text-[11px] text-ink-subtle text-center w-12">x{comp.perUnit}</span>
                                    <span className="text-xs text-ink font-medium text-center">
                                      {comp.included ? comp.perUnit * row.quantity : 0}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-line">
          <CustomButton
            text="Clear"
            variant="danger"
            onClick={handleReset}
            disabled={submitting}
          />
          <CustomButton
            text={submitting ? "Saving..." : isEditMode ? "Update Return" : "Confirm Return"}
            onClick={handleSubmit}
            disabled={submitting}
          />
        </div>
      </div>
    </div>
  );
};

export default SalesReturnCreatePage;
