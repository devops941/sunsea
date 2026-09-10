import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaSave, FaUndo, FaCheck, FaArrowLeft } from "react-icons/fa";
import { toast } from "react-toastify";
import { returnService } from "../../../../services/returnService";
import { customerService } from "../../../../services/customerService";
import { productService } from "../../../../services/productService";
import { salesProductService } from "../../../../services/salesProductService";
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

interface ReturnComponent {
  componentProductId: number;
  productName: string;
  perUnit: number;
  included: boolean;
  weightPerPiece: number;
}

interface ReturnLineItem {
  id: string;
  productId: string;
  productName: string;
  productCode?: string;
  productGroup?: string;
  quantity: number;
  unitPrice: number;
  weight: number;
  uom: string;
  baseUoms?: string;
  taxRate: number;
  reason?: string;
  components: ReturnComponent[];
  amount: number;
}

const emptyReturnLine = (): ReturnLineItem => ({
  id: crypto.randomUUID(),
  productId: "",
  productName: "",
  productCode: "",
  productGroup: "",
  quantity: 1,
  unitPrice: 0,
  weight: 0,
  uom: "kg",
  baseUoms: "kg, g, t",
  taxRate: 0,
  reason: "Sales Return",
  components: [],
  amount: 0,
});

export const SalesReturnCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEditMode = Boolean(id);

  const formRef = useRef<HTMLFormElement>(null);
  const itemsTableRef = useRef<HTMLDivElement>(null);
  const handleFormKeyDown = useFormKeyboardNav(formRef);

  const { data: company } = useAppSelector((state) => state.company);
  const [expandedLineId, setExpandedLineId] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState<boolean>(false);

  // Form states
  const [customerId, setCustomerId] = useState<string>("");
  const [customers, setCustomers] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [salesProductsList, setSalesProductsList] = useState<any[]>([]);
  const [narration, setNarration] = useState<string>("");
  const [lines, setLines] = useState<ReturnLineItem[]>([emptyReturnLine()]);
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
            const loadedLines: ReturnLineItem[] = ret.items.map((item: any) => {
              let uomCode = String(item.uom || "kg").toLowerCase();
              if (uomCode === "ton" || uomCode === "tonne" || uomCode === "tons") uomCode = "t";

              const prodObj = pList?.find((p: any) => Number(p.id) === Number(item.productId));
              const groupName = (prodObj as any)?.category?.name || (prodObj as any)?.category?.categoryName || "Sales Group";
              const rawBaseUom = (prodObj as any)?.baseUom || (prodObj as any)?.uom?.baseUom || (prodObj as any)?.weightUom || "kg, g, t";
              const q = Number(item.quantity || 0);
              const up = Number(item.unitPrice || 0);

              return {
                id: crypto.randomUUID(),
                productId: String(item.productId),
                productName: item.product?.productName || prodObj?.productName || `Product #${item.productId}`,
                productCode: prodObj?.productCode || "",
                productGroup: groupName,
                quantity: q,
                weight: Number(item.weight || 0),
                uom: uomCode,
                baseUoms: rawBaseUom,
                unitPrice: up,
                taxRate: Number(item.taxRate || 0),
                reason: item.reason || "Sales Return",
                components: [],
                amount: q * up,
              };
            });
            setLines(loadedLines);
          }
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to load master data for Sales Return");
    } finally {
      setLoading(false);
      focusFirstField();
    }
  }, [id, focusFirstField]);

  useEffect(() => {
    loadFormData();
  }, [loadFormData]);

  // Selected customer object and header info
  const selectedCustomer = useMemo(() => {
    return customers.find((c: any) => String(c.id) === String(customerId));
  }, [customers, customerId]);

  const customerHeaderInfo = useMemo(() => {
    if (!selectedCustomer) return null;
    const name = selectedCustomer.displayName || selectedCustomer.firmName || "";
    const group = selectedCustomer.customerType?.name || selectedCustomer.billingCity || selectedCustomer.city || "";
    const rawGrade = selectedCustomer.customerGrade?.name || selectedCustomer.grade || "";
    const grade = rawGrade ? rawGrade.replace(/grade\s*/i, "").trim() : "";
    const bal = Number(selectedCustomer.balanceAmount ?? selectedCustomer.netBalance ?? selectedCustomer.openingBalance ?? 0);
    const bType = (selectedCustomer.balanceType || selectedCustomer.openingBalanceType || "").toString().toUpperCase();
    const isDr = bType.startsWith("D");
    const balLabel = bal ? `₹${formatAmount(bal)} ${isDr ? "Dr" : "Cr"}` : "";

    return { name, group, grade: grade ? `${grade} Grade` : "", balLabel, isDr };
  }, [selectedCustomer]);

  const getGradeName = useCallback(() => {
    return selectedCustomer?.customerGrade?.name || selectedCustomer?.grade;
  }, [selectedCustomer]);

  // Sales Products list with grade-based pricing from component products
  const availableSalesProducts = useMemo(() => {
    const gradeName = getGradeName();

    return salesProductsList
      .filter((sp: any) => sp.isActive !== false)
      .map((sp: any) => {
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
  }, [getGradeName, allProducts, salesProductsList]);

  // Customer Autocomplete options
  const customerAutocompleteOptions: AutocompleteOption[] = useMemo(() => {
    return customers.map((c: any) => {
      const name = c.displayName || c.firmName || String(c.id);
      const group = c.customerType?.name || c.billingCity || c.city || "—";
      const rawGrade = c.customerGrade?.name || c.grade || "—";
      const grade = rawGrade ? rawGrade.replace(/grade\s*/i, "").trim() : "—";
      const bal = Number(c.balanceAmount ?? c.netBalance ?? c.openingBalance ?? 0);
      const bType = (c.balanceType || c.openingBalanceType || "").toString().toUpperCase();
      const isDr = bType.startsWith("D");
      const balLabel = bal ? `₹${formatAmount(bal)} ${isDr ? "Dr" : "Cr"}` : "";

      return {
        value: String(c.id),
        label: name,
        selectedLabel: `${name}${grade !== "—" ? ` · ${grade}` : ""}${balLabel ? ` · ${balLabel}` : ""}`,
        info: (
          <div className="flex items-center gap-3 text-[13px]">
            {group !== "—" && <span className="text-ink-subtle">{group}</span>}
            {grade !== "—" && <span className="text-ink-subtle">{grade}</span>}
            {balLabel && (
              <span className={`font-semibold ${isDr ? "text-rose-500" : "text-emerald-500"}`}>{balLabel}</span>
            )}
          </div>
        ),
      };
    });
  }, [customers]);

  // Product Autocomplete options for inline table
  const productAutocompleteOptions: AutocompleteOption[] = useMemo(() => {
    return availableSalesProducts.map((p) => ({
      value: String(p.productId),
      label: p.description,
      info: (
        <span className="text-[13px] text-ink-subtle font-mono">
          ₹{Number(p.unitPrice).toFixed(2)}
        </span>
      ),
    }));
  }, [availableSalesProducts]);

  const buildComponents = useCallback((sp: any): ReturnComponent[] => {
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
  }, [allProducts]);

  const recalcWeightAndPrice = useCallback((comps: ReturnComponent[], qty: number, gradeName?: string) => {
    const included = comps.filter((c) => c.included);
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
      weight: totalWeight * qty,
      unitPrice: totalPrice,
    };
  }, [allProducts]);

  // Update line helper
  const updateLine = useCallback((id: string, patch: Partial<ReturnLineItem>) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, ...patch };
        if (patch.quantity !== undefined || patch.unitPrice !== undefined) {
          updated.amount = (Number(updated.quantity) || 0) * (Number(updated.unitPrice) || 0);
        }
        return updated;
      })
    );
  }, []);

  // When Customer changes on CREATE mode, re-price items or initialize rows
  useEffect(() => {
    if (isEditMode) return;
    if (!customerId) {
      setLines([]);
      return;
    }
    if (lines.length === 0) {
      setLines([emptyReturnLine()]);
    } else {
      const gradeName = getGradeName();
      setLines((prev) =>
        prev.map((l) => {
          if (!l.productId) return l;
          const found = availableSalesProducts.find((p) => String(p.productId) === l.productId);
          if (found && l.components.length > 0) {
            const { weight, unitPrice } = recalcWeightAndPrice(l.components, l.quantity, gradeName);
            return {
              ...l,
              unitPrice,
              weight,
              amount: l.quantity * unitPrice,
            };
          }
          return l;
        })
      );
    }
  }, [customerId, isEditMode, availableSalesProducts, getGradeName, recalcWeightAndPrice]);

  const handleReset = useCallback(() => {
    setCustomerId("");
    setLines([emptyReturnLine()]);
    setNarration("");
    setErrors({});
    focusFirstField();
  }, [focusFirstField]);

  // ── Global F-Keys / Shortcuts Integration (F2 / F9 Save, F8 Clear, F5 Refresh) ──
  useFormShortcuts({
    onSave: () => {
      if (!submitting) {
        handleSubmit();
      }
    },
    onDelete: () => {
      if (!isEditMode) {
        handleReset();
      }
    },
  });

  // F5 Data Refresh
  useEffect(() => {
    const handleRefresh = async () => {
      if (isEditMode && id) {
        await loadFormData();
        toast.info("Sales return refreshed");
      } else if (!isEditMode) {
        handleReset();
        toast.info("Form reset");
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F5") {
        e.preventDefault();
        handleRefresh();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditMode, id, loadFormData, handleReset]);

  // Discard changes confirmation modal logic on Esc or Back
  const isFormDirty = Boolean(
    customerId ||
    lines.some((r) => r.productId && r.quantity > 0) ||
    narration
  );

  const handleBack = useCallback(() => {
    if (isFormDirty) {
      setSaveConfirmOpen(true);
    } else {
      navigate("/sales-returns");
    }
  }, [isFormDirty, navigate]);

  const handleDiscard = useCallback(() => {
    setSaveConfirmOpen(false);
    navigate("/sales-returns");
  }, [navigate]);

  const handleSaveFromModal = useCallback(() => {
    setSaveConfirmOpen(false);
    setTimeout(() => {
      handleSubmit();
    }, 150);
  }, []);

  const handleResume = useCallback(() => {
    setSaveConfirmOpen(false);
    focusFirstField();
  }, [focusFirstField]);

  // ── Return Columns for BusyItemsTable ──
  const returnColumns: BusyColumn<ReturnLineItem>[] = useMemo(() => {
    return [
      {
        key: "productId",
        header: "Product",
        width: "1fr",
        render: (row: ReturnLineItem, index: number) => {
          if (isEditMode && row.productName && !availableSalesProducts.some((p) => String(p.productId) === row.productId)) {
            return (
              <div tabIndex={0} className="flex items-center w-full px-2 text-[13px] text-ink font-medium">
                {row.productName}
              </div>
            );
          }
          return (
            <AutocompleteInput
              inline
              name={`item-${row.id}`}
              value={row.productId}
              options={productAutocompleteOptions}
              placeholder="Type to search product..."
              onChange={(val) => {
                const found = availableSalesProducts.find((p) => String(p.productId) === String(val));
                if (found) {
                  const comps = buildComponents(found);
                  const gradeName = getGradeName();
                  const qty = row.quantity > 0 ? row.quantity : 1;
                  const { weight, unitPrice } = recalcWeightAndPrice(comps, qty, gradeName);

                  updateLine(row.id, {
                    productId: String(found.productId),
                    productName: found.description,
                    productCode: found.productCode,
                    unitPrice,
                    weight,
                    uom: found.uom || "kg",
                    baseUoms: found.baseUoms || "kg, g, t",
                    taxRate: found.taxRate || 0,
                    components: comps,
                    quantity: qty,
                    amount: qty * unitPrice,
                  });
                } else {
                  updateLine(row.id, {
                    productId: "",
                    productName: "",
                    productCode: "",
                    unitPrice: 0,
                    weight: 0,
                    components: [],
                    amount: 0,
                  });
                }

                if (errors.lines) {
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.lines;
                    return next;
                  });
                }

                // Auto-focus next cell (Qty) immediately
                setTimeout(() => {
                  const qtyCell = itemsTableRef.current?.querySelector(`[data-r="${index}"][data-c="1"]`) as HTMLElement | null;
                  const qtyInput = qtyCell?.querySelector("input") as HTMLInputElement | null;
                  if (qtyInput) {
                    qtyInput.focus();
                    qtyInput.select?.();
                  }
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
        render: (row: ReturnLineItem) => (
          <div className="flex items-center justify-center w-full h-full relative">
            <input
              type="text"
              inputMode="numeric"
              value={row.quantity === 0 && !row.productId ? "" : row.quantity}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, "");
                const q = val === "" ? 0 : Number(val);
                const gradeName = getGradeName();
                let w = row.weight;
                if (row.components && row.components.length > 0) {
                  const calc = recalcWeightAndPrice(row.components, q, gradeName);
                  w = calc.weight;
                }
                updateLine(row.id, {
                  quantity: q,
                  weight: w,
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
        render: (row: ReturnLineItem) => (
          <input
            type="text"
            inputMode="decimal"
            value={row.unitPrice === 0 && !row.productId ? "" : row.unitPrice}
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
        key: "weight",
        header: "Weight (KG)",
        width: "100px",
        align: "center" as const,
        render: (row: ReturnLineItem) => (
          <input
            type="text"
            inputMode="decimal"
            value={row.weight === 0 && !row.productId ? "" : row.weight}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9.]/g, "");
              const w = val === "" ? 0 : Number(val);
              updateLine(row.id, { weight: w });
            }}
            className="w-full bg-transparent text-[13px] text-ink text-center outline-none border-none p-0 h-full"
            placeholder="0"
          />
        ),
      },
      {
        key: "amount",
        header: "Total",
        width: "120px",
        align: "right" as const,
        render: (row: ReturnLineItem) => {
          if (row.amount <= 0) return <span className="text-[13px] text-ink-subtle">—</span>;
          return (
            <div className="text-right pr-1">
              <span className="text-emerald-500 text-[13px] font-bold">₹{row.amount.toFixed(2)}</span>
            </div>
          );
        },
      },
    ];
  }, [availableSalesProducts, isEditMode, productAutocompleteOptions, buildComponents, getGradeName, recalcWeightAndPrice, updateLine, errors.lines]);

  // ── Expanded Component rows inside BusyItemsTable ──
  const renderExpandedComponents = useCallback(
    (row: ReturnLineItem, _index: number) => {
      if (!row.components || row.components.length === 0) return null;
      const gradeName = getGradeName();

      return (
        <div className="px-4 py-2">
          <div className="ml-6 rounded-md border border-line-soft overflow-hidden">
            <div className="grid grid-cols-[auto_1fr_auto_80px] gap-2 px-3 py-1.5 bg-card-2 border-b border-line-soft">
              <div className="w-4" />
              <span className="text-[13px] font-bold text-ink-subtle uppercase tracking-wider">Component</span>
              <span className="text-[13px] font-bold text-ink-subtle uppercase tracking-wider text-center w-12">Per Unit</span>
              <span className="text-[13px] font-bold text-ink-subtle uppercase tracking-wider text-center">Qty</span>
            </div>
            {row.components.map((comp, compIdx) => (
              <div
                key={comp.componentProductId}
                className={`grid grid-cols-[auto_1fr_auto_80px] gap-2 items-center px-3 py-1.5 border-b border-line-soft last:border-b-0 ${comp.included ? "bg-card" : "bg-card-2 opacity-60"}`}
              >
                <input
                  type="checkbox"
                  checked={comp.included}
                  onChange={() => {
                    const comps = [...row.components];
                    comps[compIdx] = { ...comps[compIdx], included: !comps[compIdx].included };
                    const { weight, unitPrice } = recalcWeightAndPrice(comps, row.quantity, gradeName);
                    updateLine(row.id, {
                      components: comps,
                      weight,
                      unitPrice,
                      amount: row.quantity * unitPrice,
                    });
                  }}
                  className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer"
                />
                <span className={`text-xs ${comp.included ? "text-ink font-medium" : "line-through text-ink-subtle"}`}>
                  {comp.productName}
                </span>
                <span className="text-[13px] text-ink-subtle text-center w-12">x{comp.perUnit}</span>
                <span className="text-xs text-ink font-medium text-center">
                  {comp.included ? comp.perUnit * row.quantity : 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    },
    [getGradeName, recalcWeightAndPrice, updateLine]
  );

  const expandedLineIndex = useMemo(() => {
    if (!expandedLineId) return null;
    const idx = lines.findIndex((l) => l.id === expandedLineId);
    return idx >= 0 ? idx : null;
  }, [expandedLineId, lines]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!customerId) {
      newErrors.customerId = "Please select a customer";
    }

    const activeItems = lines.filter((l) => l.productId && Number(l.quantity) > 0);
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
    if (!validateForm()) {
      return;
    }

    if (!company?.id) {
      toast.error("Company context is required");
      return;
    }

    const activeReturnItems = lines.filter((l) => l.productId && Number(l.quantity) > 0);

    setSubmitting(true);

    // Expand sales products into included component production products for backend
    const gradeName = getGradeName();
    const expandedItems: { productId: number; quantity: number; weight: number; uom: string; unitPrice: number; taxRate: number; reason: string }[] = [];

    activeReturnItems.forEach((r) => {
      const includedComps = (r.components || []).filter((c) => c.included);

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
            uom: r.uom || "kg",
            unitPrice: Math.round(compUnitPrice * 100) / 100,
            taxRate: r.taxRate || 0,
            reason: r.reason || "Sales Return",
          });
        });
      } else {
        // No components — use as-is
        expandedItems.push({
          productId: Number(r.productId),
          quantity: r.quantity,
          weight: r.weight,
          uom: r.uom || "kg",
          unitPrice: r.unitPrice,
          taxRate: r.taxRate || 0,
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

  const totalQty = lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
  const totalAmount = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);

  return (
    <div className="max-w-[1150px] xl:mr-auto">
      <div className="bg-card rounded-2xl shadow-sm border border-line overflow-visible">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-line">
          <h3 className="text-lg font-bold text-ink">
            {isEditMode ? `Edit Sales Return` : "New Sales Return (Credit Note)"}
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
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          noValidate
        >
          <div className="p-6 space-y-4">
            {/* Customer Select */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="w-full">
                <AutocompleteInput
                  label="Customer"
                  name="customerId"
                  required
                  value={customerId}
                  error={errors.customerId}
                  options={customerAutocompleteOptions}
                  placeholder="Type to search customer..."
                  onChange={(val) => {
                    setCustomerId(val);
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

            {/* Error message for line items */}
            {errors.lines && (
              <div className="text-red-500 text-xs mb-2 bg-red-500/10 p-2 rounded-md border border-red-500/20">
                {errors.lines}
              </div>
            )}

            {/* BusyItemsTable for Return Items matching Sales Invoice */}
            <div ref={itemsTableRef} className="w-full space-y-1.5">
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-ink">Invoice Items</span>
                  {customerHeaderInfo && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded bg-card-2 border border-line-soft font-semibold text-ink">
                        {customerHeaderInfo.name}
                      </span>
                      {customerHeaderInfo.group && (
                        <span className="text-ink-subtle text-[13px]">{customerHeaderInfo.group}</span>
                      )}
                      {customerHeaderInfo.grade && (
                        <span className="text-ink-subtle text-[13px]">{customerHeaderInfo.grade}</span>
                      )}
                      {customerHeaderInfo.balLabel && (
                        <span className={`text-[13px] font-semibold ${customerHeaderInfo.isDr ? "text-rose-500" : "text-emerald-500"}`}>
                          {customerHeaderInfo.balLabel}
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
                expandable
                canExpand={(row) => Boolean(row.components && row.components.length > 0)}
                expandedIndex={expandedLineIndex}
                onExpandToggle={(i) => {
                  const lineId = lines[i]?.id;
                  setExpandedLineId(expandedLineId === lineId ? null : lineId);
                }}
                renderExpandedRow={renderExpandedComponents}
                showTotals={[
                  { colKey: "quantity", value: totalQty },
                  { colKey: "amount", value: `₹${totalAmount.toFixed(2)}` },
                ]}
                visibleRows={10}
                getFieldBeforeTable={() => {
                  const cust = document.querySelector('input[name="customerId"]') as HTMLElement | null;
                  return cust;
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

      {/* Discard / Save Confirmation Modal on Esc or Back */}
      <CommonConfirmModal
        isOpen={saveConfirmOpen}
        onClose={handleResume}
        onCancel={handleDiscard}
        onConfirm={handleSaveFromModal}
        title="Discard Changes?"
        message="Are you sure you want to leave? Any unsaved sales return details will be lost."
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

export default SalesReturnCreatePage;

