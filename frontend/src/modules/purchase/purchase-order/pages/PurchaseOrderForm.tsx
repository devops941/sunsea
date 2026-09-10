import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useFormShortcuts } from "../../../../hooks/useFormShortcuts";
import { FaSave, FaPaperPlane, FaCheck } from "react-icons/fa";
import TextArea from "../../../../components/form/TextArea/TextArea";
import BusyItemsTable from "../../../../components/form/OrderItemsTable/BusyItemsTable";
import type { BusyColumn } from "../../../../components/form/OrderItemsTable/BusyItemsTable";
import AutocompleteInput from "../../../../components/form/AutocompleteInput/AutocompleteInput";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import CustomButton from "../../../../components/ui/Button/Button";
import CommonLoader from "../../../../components/ui/Loader/CommonLoader";
import CommonConfirmModal from "../../../../components/ui/CommonConfirmModal/CommonConfirmModal";

import SelectInput from "../../../../components/form/SelectInput/SelectInput";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";


import { validatePurchaseOrder } from "../validations/purchaseOrderValidation";
import type { PurchaseOrderFormData, PurchaseOrderItem } from "../../../../features/purchaseOrder/types";
import { getUomMultiplier } from "../utils/uomUtils";
import { useSuppliers } from "../../../../hooks/useSuppliers";
import { useUOMs } from "../../../../hooks/useUOMs";
import { rawMaterialService } from "../../../../services/rawMaterialService";
import type { RawMaterial } from "../../../../features/raw-materials/types";
import { usePurchaseOrders } from "../../../../hooks/usePurchaseOrder";
import { purchaseOrderService } from "../../../../services/purchaseOrderService";
import BackButton from "../../../../components/ui/BackButton/BackButton";
import { useAppDispatch, useAppSelector } from "../../../../hooks/reduxHooks";
import { fetchStores } from "../../../../features/stores/storeSlice";
import { useSocketSync } from "../../../../hooks/useSocketSync";
import { useFormKeyboardNav } from "../../../../hooks/useFormKeyboardNav";


const initialFormData: PurchaseOrderFormData = {
  poNumber: "",
  poDate: new Date().toISOString().split("T")[0],
  expectedDeliveryDate: new Date().toISOString().split("T")[0],
  supplierId: "",
  storeId: "",
  status: "DRAFT",
  createdByOn: "",

  billingAddressLine1: "",
  billingCountry: "India",
  billingCity: "",
  billingState: "",
  billingPincode: "",
  sameAsBilling: false,
  shippingAddressLine1: "",
  shippingCountry: "India",
  shippingCity: "",
  shippingState: "",
  shippingPincode: "",

  remarks: "",

  items: [],

  subtotal: 0,
  discountType: "PERCENT",
  discountValue: 0,
  totalDiscount: 0,
  totalTax: 0,
  totalCgst: 0,
  totalSgst: 0,
  totalIgst: 0,
  netAmount: 0,
};

const mapPOToFormData = (po: any): PurchaseOrderFormData => {
  if (!po) return initialFormData;

  return {
    poNumber: po.poNumber ?? "",
    poDate: po.poDate ? po.poDate.split("T")[0] : "",
    expectedDeliveryDate: po.expectedDeliveryDate ? po.expectedDeliveryDate.split("T")[0] : "",
    supplierId: po.supplierId ? String(po.supplierId) : "",
    status: po.status ?? "DRAFT",
    createdByOn: po.createdBy ? String(po.createdBy) : "",

    billingAddressLine1: po.billingAddressLine1 ?? "",
    billingCountry: po.billingCountry ?? "India",
    billingCity: po.billingCity ?? "",
    billingState: po.billingState ?? "",
    billingPincode: po.billingPincode ?? "",
    sameAsBilling: po.sameAsBilling ?? false,
    storeId: po.storeId ? String(po.storeId) : "",

    shippingAddressLine1: po.shippingAddressLine1 ?? "",
    shippingCountry: po.shippingCountry ?? "India",
    shippingCity: po.shippingCity ?? "",
    shippingState: po.shippingState ?? "",
    shippingPincode: po.shippingPincode ?? "",
    remarks: po.remarks ?? "",

    items: po.items?.map((i: any) => ({
      id: i.id,
      productId: i.productId ? String(i.productId) : "",
      product: i.product,
      uom: i.uom ?? "",
      quantity: Number(i.quantity ?? 0),
      unitPrice: Number(i.unitPrice ?? 0),
      tax: Number(i.tax ?? 0),
      taxableAmount: Number(i.taxableAmount ?? 0),
      cgstRate: Number(i.cgstRate ?? 0),
      cgstAmount: Number(i.cgstAmount ?? 0),
      sgstRate: Number(i.sgstRate ?? 0),
      sgstAmount: Number(i.sgstAmount ?? 0),
      igstRate: Number(i.igstRate ?? 0),
      igstAmount: Number(i.igstAmount ?? 0),
      lineTotal: Number(i.lineTotal ?? 0),
    })) ?? [],

    subtotal: Number(po.subtotal ?? 0),
    discountType: po.discountType ?? "PERCENT",
    discountValue: Number(po.discountValue ?? 0),
    totalDiscount: Number(po.totalDiscount ?? 0),
    totalTax: Number(po.totalTax ?? 0),
    totalCgst: Number(po.totalCgst ?? 0),
    totalSgst: Number(po.totalSgst ?? 0),
    totalIgst: Number(po.totalIgst ?? 0),
    netAmount: Number(po.netAmount ?? 0),
  };
};

const PurchaseOrderForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();

  const { addPurchaseOrder, editPurchaseOrder } = usePurchaseOrders();
  const user = useSelector((state: any) => state?.auth?.user);
  const { suppliers, loadSuppliers } = useSuppliers();


  const [formData, setFormData] = useState<PurchaseOrderFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const { data: company } = useSelector((state: any) => state.company);
  const { data: stores } = useAppSelector(state => state.stores);
  const { activeUOMs, loadActiveUOMs } = useUOMs();
  const companyState = company?.state;
  const [loading, setLoading] = useState(isEdit);
  const [shippingResetKey, setShippingResetKey] = useState(0);
  const [poNotFound, setPoNotFound] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingForApproval, setIsSubmittingForApproval] = useState(false);

  // ── Keyboard nav / Escape modal ─────────────────────────────────────────
  const [isDirty, setIsDirty] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const handleSaveRef = useRef<() => void>(() => {});
  const isDirtyRef = useRef(isDirty);
  const saveConfirmOpenRef = useRef(saveConfirmOpen);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);
  useEffect(() => { saveConfirmOpenRef.current = saveConfirmOpen; }, [saveConfirmOpen]);

  const focusFirstField = useCallback(() => {
    const first = formRef.current?.querySelector<HTMLElement>("[data-nav]:not([disabled])");
    first?.focus();
  }, []);

  // F8 — clear form (create mode only; isLocked is always false in create mode)
  const handleF8 = useCallback(() => {
    if (!isEdit) {
      setFormData({ ...initialFormData, poNumber: formData.poNumber, createdByOn: formData.createdByOn });
      setErrors({});
      setIsDirty(false);
      setTimeout(() => focusFirstField(), 100);
    }
  }, [isEdit, formData.poNumber, formData.createdByOn, focusFirstField]);

  useFormShortcuts({ onSave: () => handleSaveRef.current(), onDelete: handleF8 });

  const handleFormKeyDown = useFormKeyboardNav(formRef);

  // Auto-focus first field when loading finishes (edit mode: formRef is null during load)
  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => focusFirstField(), 250);
    return () => clearTimeout(timer);
  }, [loading, focusFirstField]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (saveConfirmOpenRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      if (isDirtyRef.current) {
        lastFocusedRef.current = document.activeElement as HTMLElement;
        setSaveConfirmOpen(true);
      } else {
        navigate("/purchase-orders");
      }
    };
    document.addEventListener("keydown", handleEscape, true);
    return () => document.removeEventListener("keydown", handleEscape, true);
  }, [navigate]);

  const selectedSupplier = useMemo(() => (suppliers || []).find(
    (s) => String(s?.id) === String(formData.supplierId)
  ), [suppliers, formData.supplierId]);

  const isLocked = useMemo(() => {
    if (!isEdit) return false;
    return formData.status !== "DRAFT";
  }, [isEdit, formData.status]);

  const isInterState = useMemo(() => {
    if (!companyState || !formData.billingState) return false;
    return (
      companyState.toLowerCase().trim() !==
      formData.billingState.toLowerCase().trim()
    );
  }, [companyState, formData.billingState]);

  // Re-run GST split (CGST/SGST ↔ IGST) whenever inter-state flag changes
  useEffect(() => {
    setFormData((prev) => {
      const updatedItems = (prev.items || []).map((item) => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.unitPrice) || 0;
        const rawMaterial = (rawMaterials || []).find(
          (rm: any) => String(rm.rawMaterialId) === String(item.productId)
        );
        const mult = getUomMultiplier(item.uom, rawMaterial?.baseUom);
        const lineSubtotal = qty * mult * price;
        const taxableAmount = lineSubtotal;
        const totalGstRate = Number(item.tax) || 0;
        const totalGstAmount = (taxableAmount * totalGstRate) / 100;

        let cgstRate = 0, cgstAmount = 0, sgstRate = 0, sgstAmount = 0, igstRate = 0, igstAmount = 0;
        if (isInterState) {
          igstRate = totalGstRate;
          igstAmount = totalGstAmount;
        } else {
          cgstRate = totalGstRate / 2;
          sgstRate = totalGstRate / 2;
          cgstAmount = totalGstAmount / 2;
          sgstAmount = totalGstAmount / 2;
        }

        return {
          ...item,
          taxableAmount,
          cgstRate, cgstAmount,
          sgstRate, sgstAmount,
          igstRate, igstAmount,
          lineTotal: taxableAmount + totalGstAmount,
        };
      });

      return {
        ...prev,
        items: updatedItems,
        ...recalculateTotals(updatedItems, isInterState)(prev),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInterState]);

  const gstRateBreakdown = useMemo(() => {
    const map = new Map<number, number>();
    (formData.items || []).forEach((item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      const rawMaterial = (rawMaterials || []).find(
        (rm: any) => String(rm.rawMaterialId) === String(item.productId)
      );
      const mult = getUomMultiplier(item.uom, rawMaterial?.baseUom);
      const taxable = qty * mult * price;
      const rate = Number(item.tax) || 0;
      map.set(rate, (map.get(rate) || 0) + taxable);
    });

    const sortedRates = Array.from(map.keys()).sort((a, b) => a - b);

    return sortedRates.map((rate) => {
      const taxableForRate = map.get(rate) || 0;
      const cgstRate = rate / 2;
      const sgstRate = rate / 2;
      const cgstAmount = taxableForRate * (cgstRate / 100);
      const sgstAmount = taxableForRate * (sgstRate / 100);
      const igstAmount = taxableForRate * (rate / 100);
      return {
        gstRate: rate,
        cgstRate,
        sgstRate,
        cgstAmount,
        sgstAmount,
        igstAmount,
      };
    });
  }, [formData.items, rawMaterials]);



  const refreshSuppliers = useCallback(() => {
    loadSuppliers({ limit: 1000 });
  }, [loadSuppliers]);

  const refreshRawMaterials = useCallback(async () => {
    try {
      const res = await rawMaterialService.fetchAll();
      const materials = Array.isArray(res) ? res : (res?.rawMaterials ?? []);
      setRawMaterials(materials);
    } catch {
      toast.error("Failed to load raw materials");
    }
  }, []);

  const refreshStores = useCallback(() => {
    dispatch(fetchStores({ storeCategory: "RAW_MATERIAL" }));
  }, [dispatch]);

  const fetchNextCode = useCallback(async () => {
    try {
      const nextCode = await purchaseOrderService.fetchNextCode();
      if (nextCode) {
        setFormData((prev) => ({ ...prev, poNumber: nextCode }));
      }
    } catch {
      // Silently fail - PO number will be generated server-side
    }
  }, []);

  // Real-time socket listeners
  useSocketSync("supplier", undefined, refreshSuppliers);
  useSocketSync("rawMaterial", undefined, refreshRawMaterials);
  useSocketSync("store", undefined, refreshStores);
  useSocketSync("purchaseOrder", undefined, fetchNextCode);

  useEffect(() => {
    refreshSuppliers();
    refreshStores();
    loadActiveUOMs();
    refreshRawMaterials();
    if (!isEdit) {
      fetchNextCode();
    }
  }, [refreshSuppliers, dispatch, refreshStores, loadActiveUOMs, refreshRawMaterials, fetchNextCode, isEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isEdit && user) {
      setFormData((prev) => ({
        ...prev,
        createdByOn: user?.username || "",
      }));
    }
  }, [user, isEdit]);

  // Auto-populate billing address from company profile (always company address)
  useEffect(() => {
    if (company && !isEdit) {
      setFormData((prev) => ({
        ...prev,
        billingAddressLine1: company.addressLine1 || "",
        billingCity: company.city || "",
        billingState: company.state || "",
        billingPincode: company.zipcode || "",
        billingCountry: company.country || "India",
      }));
    }
  }, [company, isEdit]);

  // Load PO data for Edit Mode
  useEffect(() => {
    if (!isEdit || !id) return;

    let mounted = true;
    const fetchData = async () => {
      setFetchError(false);
      setPoNotFound(false);
      setLoading(true);
      try {
        const po = await purchaseOrderService.fetchById(id);
        if (mounted) {
          if (!po) {
            setPoNotFound(true);
            return;
          }
          const poData = mapPOToFormData(po);
          setFormData(poData);

        }
      } catch {
        if (mounted) {
          setFetchError(true);
          toast.error("Failed to load purchase order");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => {
      mounted = false;
    };
  }, [id, isEdit]);

  const recalculateTotals = (
    items: PurchaseOrderItem[],
    _interState: boolean = isInterState
  ) => {
    let subtotal = 0;

    items.forEach((item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      const rawMaterial = (rawMaterials || []).find(
        (rm: any) => String(rm.rawMaterialId) === String(item.productId)
      );
      const mult = getUomMultiplier(item.uom, rawMaterial?.baseUom);
      subtotal += qty * mult * price;
    });

    return (prev: PurchaseOrderFormData) => ({
      subtotal,
      totalDiscount: 0,
      totalTax: prev.totalTax,
      totalCgst: prev.totalCgst,
      totalSgst: prev.totalSgst,
      totalIgst: prev.totalIgst,
      netAmount: subtotal + (prev.totalTax || 0),
    });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setIsDirty(true);
    const { name, value } = e.target;

    if (name === "supplierId") {
      const selectedSup = suppliers.find((s) => String(s.id) === String(value));
      setFormData((prev) => ({
        ...prev,
        supplierId: value,
        billingAddressLine1: company?.addressLine1 || "",
        billingCity: company?.city || "",
        billingState: company?.state || "",
        billingPincode: company?.zipcode || "",
        billingCountry: company?.country || "India",
        items: [],
        subtotal: 0,
        totalDiscount: 0,
        totalTax: 0,
        totalCgst: 0,
        totalSgst: 0,
        totalIgst: 0,
        netAmount: 0,
      }));
      if (errors.supplierId) {
        setErrors((prev) => ({ ...prev, supplierId: "" }));
      }
      return;
    }

    if (name === "storeId") {
      const selectedStore = stores.find((s: any) => s.storeId === value);
      // Store address is saved as JSON in locationDesc
      let addr: any = null;
      if (selectedStore?.locationDesc) {
        try { addr = JSON.parse(selectedStore.locationDesc); } catch { /* not JSON */ }
      }
      setFormData((prev) => ({
        ...prev,
        storeId: value,
        shippingAddressLine1: addr?.addressLine || company?.addressLine1 || "",
        shippingCity: addr?.city || company?.city || "",
        shippingState: addr?.state || company?.state || "",
        shippingCountry: addr?.country || company?.country || "India",
        shippingPincode: addr?.zipcode || company?.zipcode || "",
      }));
      setShippingResetKey((k) => k + 1);
      if (errors.storeId) {
        setErrors((prev) => ({ ...prev, storeId: "" }));
      }
      return;
    }

    if (name === "poDate") {
      setFormData((prev) => {
        const selectedSupObj = suppliers.find((s) => String(s.id) === String(prev.supplierId));
        const supplierPrices = selectedSupObj?.materialPrices || [];
        const dateToCheck = value || new Date().toISOString().split("T")[0];

        const updatedItems = prev.items.map((item) => {
          const rawMaterial = rawMaterials.find(
            (rm) => String(rm.rawMaterialId) === String(item.productId)
          );
          const mult = getUomMultiplier(item.uom, rawMaterial?.baseUom);

          const activePriceObj = supplierPrices.find((p: any) => {
            const validFromDate = p.validFrom ? p.validFrom.split("T")[0] : "";
            const validToDate = p.validTo ? p.validTo.split("T")[0] : "";
            return String(p.rawMaterialId) === String(item.productId) &&
              validFromDate <= dateToCheck &&
              (!validToDate || validToDate >= dateToCheck);
          });

          const parsedUnitPrice = activePriceObj
            ? (typeof activePriceObj.price === "string" ? parseFloat(activePriceObj.price) : Number(activePriceObj.price))
            : (rawMaterial?.rate
              ? (typeof rawMaterial.rate === "string" ? parseFloat(rawMaterial.rate) : Number(rawMaterial.rate))
              : 0);

          const qty = Number(item.quantity) || 0;
          const lineSubtotal = qty * mult * parsedUnitPrice;

          const taxableAmount = lineSubtotal;
          const totalGstRate = Number(item.tax) || 0;
          const totalGstAmount = (taxableAmount * totalGstRate) / 100;

          let cgstRate = 0;
          let cgstAmount = 0;
          let sgstRate = 0;
          let sgstAmount = 0;
          let igstRate = 0;
          let igstAmount = 0;

          if (isInterState) {
            igstRate = totalGstRate;
            igstAmount = totalGstAmount;
          } else {
            cgstRate = totalGstRate / 2;
            sgstRate = totalGstRate / 2;
            cgstAmount = totalGstAmount / 2;
            sgstAmount = totalGstAmount / 2;
          }

          return {
            ...item,
            unitPrice: parsedUnitPrice,
            taxableAmount,
            cgstRate,
            cgstAmount,
            sgstRate,
            sgstAmount,
            igstRate,
            igstAmount,
            lineTotal: taxableAmount + totalGstAmount,
            product: item.product
              ? {
                ...item.product,
                unitPrice: parsedUnitPrice,
              }
              : undefined,
          };
        });

        return {
          ...prev,
          poDate: value,
          expectedDeliveryDate: value,
          items: updatedItems,
          ...recalculateTotals(updatedItems, isInterState)(prev),
        };
      });
      if (errors.poDate) {
        setErrors((prev) => ({ ...prev, poDate: "" }));
      }
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleBillingStateChange = (stateName: string) => {
    setFormData((prev) => ({
      ...prev,
      billingState: stateName,
      billingCity: "",
    }));
    setErrors((prev) => ({
      ...prev,
      billingState: "",
      billingCity: "",
    }));
  };

  const handleBillingCityChange = (cityName: string) => {
    setFormData((prev) => ({ ...prev, billingCity: cityName }));
    setErrors((prev) => ({ ...prev, billingCity: "" }));
  };

  const handleShippingStateChange = (stateName: string) => {
    setFormData((prev) => ({
      ...prev,
      shippingState: stateName,
      shippingCity: "",
    }));
    setErrors((prev) => ({
      ...prev,
      shippingState: "",
      shippingCity: "",
    }));
  };

  const handleShippingCityChange = (cityName: string) => {
    setFormData((prev) => ({ ...prev, shippingCity: cityName }));
    setErrors((prev) => ({ ...prev, shippingCity: "" }));
  };



  const handleItemChange = (index: number, field: keyof PurchaseOrderItem | "uom", value: any, selectedUom?: string) => {
    setIsDirty(true);
    setFormData((prev) => {
      const items = [...prev.items];
      const updatedUom = selectedUom !== undefined ? selectedUom : (field === "uom" ? value : items[index].uom);
      items[index] = { ...items[index], [field]: value, uom: updatedUom };

      const item = items[index];
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      const rawMaterial = (rawMaterials || []).find((rm: any) => String(rm.rawMaterialId) === String(item.productId));
      const mult = getUomMultiplier(item.uom, rawMaterial?.baseUom);
      const lineSubtotal = qty * mult * price;

      const taxableAmount = lineSubtotal;
      const totalGstRate = Number(item.tax) || 0;
      const totalGstAmount = (taxableAmount * totalGstRate) / 100;

      let cgstRate = 0;
      let cgstAmount = 0;
      let sgstRate = 0;
      let sgstAmount = 0;
      let igstRate = 0;
      let igstAmount = 0;

      if (isInterState) {
        igstRate = totalGstRate;
        igstAmount = totalGstAmount;
      } else {
        cgstRate = totalGstRate / 2;
        sgstRate = totalGstRate / 2;
        cgstAmount = totalGstAmount / 2;
        sgstAmount = totalGstAmount / 2;
      }

      items[index] = {
        ...item,
        taxableAmount,
        cgstRate,
        cgstAmount,
        sgstRate,
        sgstAmount,
        igstRate,
        igstAmount,
        lineTotal: taxableAmount + totalGstAmount,
      };

      return {
        ...prev,
        items,
        ...recalculateTotals(items, isInterState)(prev),
      };
    });

    setErrors((prev) => {
      const next = { ...prev };
      delete next[`items.${index}.${field}`];
      return next;
    });
  };

  const handleItemProductChange = (index: number, productId: string) => {
    setIsDirty(true);
    const rawMaterial = rawMaterials.find(
      (rm) => String(rm.rawMaterialId) === String(productId)
    );

    let parsedUnitPrice = 0;
    setFormData((prev) => {
      const selectedSupObj = suppliers.find((s) => String(s.id) === String(prev.supplierId));
      const supplierPrices = selectedSupObj?.materialPrices || [];
      const dateToCheck = prev.poDate || new Date().toISOString().split("T")[0];
      const activePriceObj = supplierPrices.find((p: any) => {
        const validFromDate = p.validFrom ? p.validFrom.split("T")[0] : "";
        const validToDate = p.validTo ? p.validTo.split("T")[0] : "";
        return String(p.rawMaterialId) === String(productId) &&
          validFromDate <= dateToCheck &&
          (!validToDate || validToDate >= dateToCheck);
      });

      parsedUnitPrice = activePriceObj
        ? (typeof activePriceObj.price === "string" ? parseFloat(activePriceObj.price) : Number(activePriceObj.price))
        : (rawMaterial?.rate
          ? (typeof rawMaterial.rate === "string" ? parseFloat(rawMaterial.rate) : Number(rawMaterial.rate))
          : 0);

      const defaultTaxRate = 0;

      const defaultUom = rawMaterial?.baseUom ? rawMaterial.baseUom.split(",")[0].trim() : "";
      const mult = getUomMultiplier(defaultUom, rawMaterial?.baseUom);

      const items = [...prev.items];
      const item = items[index];
      const qty = Number(item.quantity) || 0;
      const lineSubtotal = qty * mult * parsedUnitPrice;

      const taxableAmount = lineSubtotal;
      const totalGstRate = defaultTaxRate;
      const totalGstAmount = (taxableAmount * totalGstRate) / 100;

      let cgstRate = 0;
      let cgstAmount = 0;
      let sgstRate = 0;
      let sgstAmount = 0;
      let igstRate = 0;
      let igstAmount = 0;

      if (isInterState) {
        igstRate = totalGstRate;
        igstAmount = totalGstAmount;
      } else {
        cgstRate = totalGstRate / 2;
        sgstRate = totalGstRate / 2;
        cgstAmount = totalGstAmount / 2;
        sgstAmount = totalGstAmount / 2;
      }

      items[index] = {
        ...item,
        productId,
        product: rawMaterial
          ? {
            id: rawMaterial.rawMaterialId,
            productCode: rawMaterial.rawMaterialId,
            productName: rawMaterial.materialName,
            unit: rawMaterial.baseUom,
            unitPrice: parsedUnitPrice,
          }
          : undefined,
        unitPrice: parsedUnitPrice,
        uom: rawMaterial?.baseUom ? rawMaterial.baseUom.split(",")[0].trim() : "",
        tax: totalGstRate,
        taxableAmount,
        cgstRate,
        cgstAmount,
        sgstRate,
        sgstAmount,
        igstRate,
        igstAmount,
        lineTotal: taxableAmount + totalGstAmount,
      };

      return {
        ...prev,
        items,
        ...recalculateTotals(items, isInterState)(prev),
      };
    });

    setErrors((prev) => {
      const next = { ...prev };
      delete next[`items.${index}.productId`];
      if (parsedUnitPrice > 0) {
        delete next[`items.${index}.unitPrice`];
      }
      return next;
    });
  };

  const addItem = () => {
    setIsDirty(true);
    setFormData((prev) => {
      const items = [
        ...prev.items,
        {
          productId: "",
          uom: "",
          quantity: 1,
          unitPrice: 0,
          tax: 0,
          taxableAmount: 0,
          cgstRate: 0,
          cgstAmount: 0,
          sgstRate: 0,
          sgstAmount: 0,
          igstRate: 0,
          igstAmount: 0,
          lineTotal: 0,
        },
      ];
      return {
        ...prev,
        items,
        ...recalculateTotals(items, isInterState)(prev),
      };
    });
  };

  const removeItem = (index: number) => {
    setIsDirty(true);
    setFormData((prev) => {
      const items = prev.items.filter((_, i) => i !== index);
      return {
        ...prev,
        items,
        ...recalculateTotals(items, isInterState)(prev),
      };
    });
  };

  const handleClear = () => {
    if (isEdit) {
      // In edit mode, reload the saved PO data
      const fetchData = async () => {
        try {
          const po = await purchaseOrderService.fetchById(id!);
          if (po) setFormData(mapPOToFormData(po));
        } catch {
          // ignore
        }
      };
      fetchData();
    } else {
      // In create mode, reset to initial with preserved poNumber
      setFormData((prev) => ({
        ...initialFormData,
        poNumber: prev.poNumber,
        createdByOn: prev.createdByOn,
        billingAddressLine1: prev.billingAddressLine1,
        billingCity: prev.billingCity,
        billingState: prev.billingState,
        billingPincode: prev.billingPincode,
        billingCountry: prev.billingCountry,
      }));
    }
    setErrors({});
  };

  const handleSubmit = async (
    e: React.FormEvent,
    submitStatus: "DRAFT" | "APPROVED"
  ) => {
    e.preventDefault();

    if (isLocked) {
      toast.error("This Purchase Order is in a read-only state and cannot be updated.");
      return;
    }

    const validationErrors = validatePurchaseOrder(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error("Please fill all required fields correctly.");
      return;
    }

    if (submitStatus === "DRAFT") setIsSubmitting(true);
    else setIsSubmittingForApproval(true);

    const payload = {
      poDate: formData.poDate,
      expectedDeliveryDate: formData.expectedDeliveryDate,
      supplierId: formData.supplierId,

      billingAddressLine1: formData.billingAddressLine1,
      billingCountry: formData.billingCountry || "India",
      billingCity: formData.billingCity,
      billingState: formData.billingState,
      billingPincode: formData.billingPincode,
      shippingAddressLine1: formData.shippingAddressLine1,
      shippingCountry: formData.shippingCountry || "India",
      shippingCity: formData.shippingCity,
      shippingState: formData.shippingState,
      shippingPincode: formData.shippingPincode,
      remarks: formData.remarks,
      storeId: formData.storeId,
      discountType: formData.discountType,
      discountValue: formData.discountValue,

      items: formData.items.map((item) => ({
        productId: item.productId,
        uom: item.uom,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice) || 0,
        tax: Number(item.tax) || 0,
        taxableAmount: item.taxableAmount || 0,
        cgstRate: item.cgstRate || 0,
        cgstAmount: item.cgstAmount || 0,
        sgstRate: item.sgstRate || 0,
        sgstAmount: item.sgstAmount || 0,
        igstRate: item.igstRate || 0,
        igstAmount: item.igstAmount || 0,
      })),

      totalDiscount: formData.totalDiscount,
      totalTax: formData.totalTax,
      totalCgst: formData.totalCgst,
      totalSgst: formData.totalSgst,
      totalIgst: formData.totalIgst,
      roundingAdjust: 0,
      netAmount: formData.netAmount,

      status: submitStatus,
    };

    try {
      if (isEdit) {
        await editPurchaseOrder(id!, payload);
        toast.success("Purchase Order updated successfully!");
      } else {
        await addPurchaseOrder(payload);
        toast.success(
          submitStatus === "DRAFT"
            ? "Purchase Order saved as draft!"
            : "Purchase Order approved successfully!"
        );
      }
      setIsDirty(false);
      navigate("/purchase-orders");
    } catch (error: any) {
      toast.error(error?.message || `Failed to ${isEdit ? "update" : "create"} purchase order`);
    } finally {
      setIsSubmitting(false);
      setIsSubmittingForApproval(false);
    }
  };

  // Wire save ref — calls "Save as Draft" (the primary save action)
  handleSaveRef.current = () => {
    if (!isSubmitting && !isSubmittingForApproval && !isLocked) {
      const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
      handleSubmit(fakeEvent, "DRAFT");
    }
  };

  const supplierOptions = (suppliers || []).map((s) => ({
    value: s?.id ? String(s.id) : "",
    label: s?.displayName || s?.legalName || "",
  }));

  const uomOptions = [
    { value: "", label: "-- Select UOM --" },
    ...(activeUOMs || []).map((uom: any) => ({
      value: uom.uomName,
      label: uom.uomName,
    })),
  ];

  const supplierMaterialIds = selectedSupplier?.materialPrices
    ? selectedSupplier.materialPrices.map((mp: any) => String(mp.rawMaterialId))
    : [];

  const safeRawMaterials = Array.isArray(rawMaterials) ? rawMaterials : [];
  const filteredRawMaterials = supplierMaterialIds.length > 0
    ? safeRawMaterials.filter((rm) => supplierMaterialIds.includes(String(rm.rawMaterialId)) || formData.items.some((item) => item.productId === rm.rawMaterialId))
    : safeRawMaterials;

  const productOptions = filteredRawMaterials.map((rm) => ({
    value: String(rm.rawMaterialId || ""),
    label: `${rm.rawMaterialId || ""} - ${rm.materialName || ""}`,
  }));

  // ─── Order item columns for BusyItemsTable ────────────────────
  const orderItemColumns: BusyColumn<PurchaseOrderItem>[] = useMemo(() => [
    {
      key: "productId",
      header: "Raw Material",
      width: "1fr",
      render: (_row: PurchaseOrderItem, index: number) => {
        const item = formData.items[index];
        if (!item) return null;
        const selectedInOther = new Set(
          formData.items.filter((_, i) => i !== index).map(it => String(it.productId)).filter(Boolean)
        );
        const opts = productOptions.map(o => ({
          ...o,
          disabled: selectedInOther.has(o.value),
        }));
        return (
          <AutocompleteInput
            inline
            name={`items[${index}].productId`}
            value={item.productId ? String(item.productId) : ""}
            options={opts}
            placeholder="Type to search..."
            error={errors[`items.${index}.productId`]}
            onChange={(val) => {
              handleItemProductChange(index, val);
              setTimeout(() => {
                const qtyCell = document.querySelector(`[data-r="${index}"][data-c="1"]`) as HTMLElement | null;
                const qtyInput = qtyCell?.querySelector("input") as HTMLInputElement | null;
                if (qtyInput) { qtyInput.focus(); qtyInput.select(); }
              }, 50);
            }}
            disabled={isLocked}
          />
        );
      },
    },
    {
      key: "quantity",
      header: "Qty & UOM",
      width: "180px",
      align: "center" as const,
      render: (_row: PurchaseOrderItem, index: number) => {
        const item = formData.items[index];
        if (!item) return null;
        const rawMaterial = rawMaterials.find(rm => String(rm.rawMaterialId) === String(item.productId));
        const baseUoms = rawMaterial?.baseUom || item.uom || "kg";
        const rawList = baseUoms.split(",").map((u: string) => u.trim()).filter(Boolean);
        const uomList = rawList.length > 0 ? rawList : [item.uom || "kg"];
        return (
          <div className="flex items-center w-full h-full gap-0">
            <input
              type="number"
              value={item.quantity || ""}
              onChange={(e) => handleItemChange(index, "quantity", Number(e.target.value))}
              placeholder="0"
              step="0.01"
              disabled={isLocked}
              className="flex-1 min-w-0 bg-transparent text-[13px] text-ink outline-none border-none p-0 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            {uomList.length > 1 ? (
              <select
                value={item.uom || uomList[0]}
                onChange={(e) => handleItemChange(index, "uom", e.target.value)}
                disabled={isLocked}
                className="bg-transparent text-[11px] font-medium text-ink-subtle border-none outline-none cursor-pointer px-0.5 w-[46px] flex-shrink-0"
              >
                {uomList.map((u: string) => <option key={u} value={u}>{u}</option>)}
              </select>
            ) : (
              <span className="text-[11px] font-medium text-ink-subtle flex-shrink-0 px-0.5">{item.uom || uomList[0]}</span>
            )}
          </div>
        );
      },
    },
    {
      key: "unitPrice",
      header: "Unit Price (₹)",
      width: "120px",
      align: "right" as const,
      render: (_row: PurchaseOrderItem, index: number) => {
        const item = formData.items[index];
        if (!item) return null;
        return (
          <input
            type="number"
            value={item.unitPrice || ""}
            onChange={(e) => handleItemChange(index, "unitPrice", Number(e.target.value))}
            placeholder="0.00"
            step="0.01"
            min={0}
            disabled={isLocked}
            className="w-full bg-transparent text-[13px] text-ink text-right outline-none border-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        );
      },
    },
    {
      key: "total",
      header: "Total (₹)",
      width: "110px",
      align: "right" as const,
      render: (_row: PurchaseOrderItem, index: number) => {
        const item = formData.items[index];
        if (!item) return null;
        const qty = Number(item.quantity) || 0;
        const price = Number(item.unitPrice) || 0;
        const rawMaterial = rawMaterials.find(rm => String(rm.rawMaterialId) === String(item.productId));
        const mult = getUomMultiplier(item.uom, rawMaterial?.baseUom);
        const lineTotal = qty * mult * price;
        return (
          <span className="text-[13px] font-bold text-ink">₹{(lineTotal || 0).toFixed(2)}</span>
        );
      },
    },
  ], [formData.items, productOptions, rawMaterials, errors, isLocked, handleItemChange, handleItemProductChange, isInterState]);

  if (loading) {
    return <CommonLoader text="Loading Purchase Order..." fullScreen={false} />;
  }

  if (poNotFound) {
    return (
      <div className="w-full mx-auto p-6 bg-white rounded-lg shadow-sm border border-gray-200 text-center my-8 max-w-lg">
        <h2 className="text-xl font-bold text-red-600 mb-2">Purchase Order Not Found</h2>
        <p className="text-gray-600 mb-6">The purchase order you are trying to edit does not exist or has been deleted.</p>
        <BackButton text="Back to Purchase Orders" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="w-full mx-auto p-6 bg-white rounded-lg shadow-sm border border-gray-200 text-center my-8 max-w-lg">
        <h2 className="text-xl font-bold text-red-600 mb-2">Failed to Load Purchase Order</h2>
        <p className="text-gray-600 mb-6">Something went wrong while retrieving the purchase order data.</p>
        <div className="flex justify-center gap-4">
          <BackButton text="Back" />
          <CustomButton text="Retry" onClick={() => window.location.reload()} />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] xl:mr-auto">
      <div className="bg-card rounded-2xl shadow-sm border border-line overflow-visible">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-3 border-b border-line">
          <h2 className="text-lg font-bold text-ink flex items-start">
            {isEdit ? (isLocked ? " Purchase Order" : " Purchase Order") : " Purchase Order"}
            {formData.poNumber && <span className="text-purple-400 text-sm ml-1 mt-0.5 leading-none">*{formData.poNumber}</span>}
          </h2>
          <BackButton text="Back to List" />
        </div>

        {isLocked && (
          <div className="px-5 py-1.5 bg-amber-500/15 border-b border-amber-500/30 text-amber-300 flex items-center gap-2 text-[11px] font-semibold">
            <span className="font-bold">View Only:</span>
            This PO is in '{formData.status}' status. Only Draft orders can be modified.
          </div>
        )}

        <form ref={formRef} onKeyDown={handleFormKeyDown} data-escape-guarded className="px-5 py-3 space-y-3" noValidate>

            {/* ── PO Details ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
              <DatePickerCalendar label="PO Date" name="poDate" value={formData.poDate} onChange={(e) => handleChange(e as any)} required error={errors.poDate} disabled={isLocked || isEdit} horizontal />
              <SelectInput label="Supplier" name="supplierId" value={formData.supplierId} options={[{ value: "", label: "-- Select Supplier --" }, ...supplierOptions]} onChange={handleChange} required searchable error={errors.supplierId} disabled={isLocked || isEdit} horizontal />
              <SelectInput label="Store" name="storeId" value={formData.storeId || ""} options={[{ label: "-- Select Store --", value: "" }, ...(stores || []).filter((s: any) => s.isActive).map((s: any) => ({ label: s.storeName, value: s.storeId }))]} required onChange={handleChange} searchable error={errors.storeId} disabled={isLocked} horizontal />
            </div>

            {/* ── Addresses ── */}
            {(formData.billingAddressLine1 || formData.billingCity) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-2 border border-line-soft rounded-lg bg-card">
                  <span className="text-[10px] font-bold text-ink uppercase tracking-wide">Billing Address</span>
                  <p className="text-xs text-ink-subtle mt-1">
                    {[formData.billingAddressLine1, formData.billingCity, formData.billingState, formData.billingCountry, formData.billingPincode].filter(Boolean).join(", ")}
                  </p>
                </div>
                <div className="p-2 border border-line-soft rounded-lg bg-card">
                  <span className="text-[10px] font-bold text-ink uppercase tracking-wide">Shipping Address</span>
                  <p className="text-xs text-ink-subtle mt-1">
                    {[formData.shippingAddressLine1, formData.shippingCity, formData.shippingState, formData.shippingCountry, formData.shippingPincode].filter(Boolean).join(", ") || "Select a store to see address"}
                  </p>
                </div>
              </div>
            )}

            {/* ── Order Items ── */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-semibold text-ink">Order Items</span>
              </div>

              <BusyItemsTable
                columns={orderItemColumns}
                rows={formData.items}
                onAdd={addItem}
                onRemove={(i) => removeItem(i)}
                editable={!isLocked}
                visibleRows={10}
                showTotals={[
                  { colKey: "total", value: `₹${(formData.subtotal ?? 0).toFixed(2)}` },
                ]}
              />
            </div>

            {/* ── Narration ── */}
            <div className="w-full sm:w-1/2">
              <TextArea label="Narration" name="remarks" value={formData.remarks} placeholder="Enter narration..." rows={2} onChange={handleChange} disabled={isLocked} />
            </div>

        </form>

        {/* ── Actions ── */}
        {!isLocked && (
          <div className="flex justify-end gap-3 px-5 py-3 border-t border-line">
            <CustomButton text="Clear" variant="danger" onClick={handleClear} disabled={isSubmitting || isSubmittingForApproval} />
            <CustomButton variant="secondary" text={isSubmitting ? "Saving..." : "Save as Draft"} type="button" onClick={(e: any) => handleSubmit(e, "DRAFT")} disabled={isSubmitting || isSubmittingForApproval} />
            <CustomButton text={isSubmitting ? "Saving..." : "Save Order"} type="button" onClick={(e: any) => handleSubmit(e, "APPROVED")} disabled={isSubmitting || isSubmittingForApproval} />
          </div>
        )}
      </div>

      <CommonConfirmModal
        show={saveConfirmOpen}
        onHide={() => { setSaveConfirmOpen(false); setTimeout(() => lastFocusedRef.current?.focus(), 50); }}
        onConfirm={() => { setSaveConfirmOpen(false); handleSaveRef.current(); }}
        onCancel={() => { setSaveConfirmOpen(false); navigate("/purchase-orders"); }}
        title="Discard Changes?"
        message="Are you sure you want to leave? Any unsaved purchase order details will be lost."
        warningText="Save to keep your changes, or Discard to leave."
        cancelText="Discard"
        cancelVariant="danger"
        confirmText="Save"
        confirmVariant="primary"
        confirmIcon={FaCheck}
        isDangerous={false}
      />
    </div>
  );
};

export default PurchaseOrderForm;
