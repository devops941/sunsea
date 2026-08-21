import React, { useState, useEffect, useMemo, useCallback } from "react";
import { FaSave, FaPaperPlane, FaPlus, FaTrash, FaUser, FaMapMarkerAlt, FaBoxOpen, FaInfoCircle } from "react-icons/fa";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import CustomButton from "../../../../components/ui/Button/Button";
import CommonLoader from "../../../../components/ui/Loader/CommonLoader";

import TextInput from "../../../../components/form/TextInput/TextInput";
import SelectInput from "../../../../components/form/SelectInput/SelectInput";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";

import QuantityInput from "../../../../components/form/QuantityInput/QuantityInput";
import CityStateSelect from "../../../../components/ui/CityStateSelect/CityStateSelect";
import type { StateCityOption } from "../../../../components/ui/CityStateSelect/CityStateSelect";

import { validatePurchaseOrder } from "../validations/purchaseOrderValidation";
import type { PurchaseOrderFormData, PurchaseOrderItem } from "../../../../features/purchaseOrder/types";
import { useSuppliers } from "../../../../hooks/useSuppliers";
import { useUOMs } from "../../../../hooks/useUOMs";
import { rawMaterialService } from "../../../../services/rawMaterialService";
import type { RawMaterial } from "../../../../features/raw-materials/types";
import { usePurchaseOrders } from "../../../../hooks/usePurchaseOrder";
import { purchaseOrderService } from "../../../../services/purchaseOrderService";
import BackButton from "../../../../components/ui/BackButton/BackButton";
import DeleteButton from "../../../../components/ui/DeleteButton/DeleteButton";
import AddressForm from "../../../../components/form/AddressFrom/AddressFrom";
import { useAppDispatch, useAppSelector } from "../../../../hooks/reduxHooks";
import { fetchStores } from "../../../../features/stores/storeSlice";
import { useSocketSync } from "../../../../hooks/useSocketSync";


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

export const getUomMultiplier = (uom: string = "", baseUom: string = ""): number => {
  const u = (uom || "").trim().toLowerCase();
  const b = (baseUom || "").trim().toLowerCase();
  if (!u || u === b) return 1;
  if (u === "g" || u === "gram" || u === "grams") {
    if (b.includes("kg") || b === "kilogram" || b === "kilograms" || !b) return 0.001;
  }
  if (u === "kg" || u === "kilogram" || u === "kilograms") {
    if (b === "g" || b === "gram" || b === "grams") return 1000;
  }
  if (u === "mg") {
    if (b.includes("kg")) return 0.000001;
    if (b.includes("g")) return 0.001;
  }
  if (u === "ton" || u === "tonne" || u === "tonnes" || u === "tons") {
    if (b.includes("kg") || !b) return 1000;
  }
  if (u === "ml" && (b.includes("l") || !b)) return 0.001;
  if (u === "mm" && (b.includes("m") || !b)) return 0.001;
  if (u === "cm" && (b.includes("m") || !b)) return 0.01;
  return 1;
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
  const [poNotFound, setPoNotFound] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingForApproval, setIsSubmittingForApproval] = useState(false);


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
          discount: 0,
        };
      });

      return {
        ...prev,
        items: updatedItems,
        ...recalculateTotals(updatedItems, isInterState),
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
      const materials = Array.isArray(res) ? res : (res?.data ?? []);
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
    interState: boolean = isInterState
  ) => {
    let subtotal = 0;
    let totalTax = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    items.forEach((item) => {
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

      let cgstAmount = 0;
      let sgstAmount = 0;
      let igstAmount = 0;

      if (interState) {
        igstAmount = totalGstAmount;
      } else {
        cgstAmount = totalGstAmount / 2;
        sgstAmount = totalGstAmount / 2;
      }

      subtotal += lineSubtotal;
      totalTax += totalGstAmount;
      totalCgst += cgstAmount;
      totalSgst += sgstAmount;
      totalIgst += igstAmount;
    });

    return {
      subtotal,
      totalDiscount: 0,
      totalTax,
      totalCgst,
      totalSgst,
      totalIgst,
      netAmount: subtotal + totalTax,
    };
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
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
      setFormData((prev) => ({
        ...prev,
        storeId: value,
      }));
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
            : (rawMaterial?.unitPrice
              ? (typeof rawMaterial.unitPrice === "string" ? parseFloat(rawMaterial.unitPrice) : Number(rawMaterial.unitPrice))
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
          ...recalculateTotals(updatedItems, isInterState),
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
        ...recalculateTotals(items, isInterState),
      };
    });

    setErrors((prev) => {
      const next = { ...prev };
      delete next[`items.${index}.${field}`];
      return next;
    });
  };

  const handleItemProductChange = (index: number, productId: string) => {
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
        : (rawMaterial?.unitPrice
          ? (typeof rawMaterial.unitPrice === "string" ? parseFloat(rawMaterial.unitPrice) : Number(rawMaterial.unitPrice))
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
        ...recalculateTotals(items, isInterState),
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
        ...recalculateTotals(items, isInterState),
      };
    });
  };

  const removeItem = (index: number) => {
    setFormData((prev) => {
      const items = prev.items.filter((_, i) => i !== index);
      return {
        ...prev,
        items,
        ...recalculateTotals(items, isInterState),
      };
    });
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
      navigate("/purchase-orders");
    } catch (error: any) {
      toast.error(error?.message || `Failed to ${isEdit ? "update" : "create"} purchase order`);
    } finally {
      setIsSubmitting(false);
      setIsSubmittingForApproval(false);
    }
  };

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



  return (
    <div className="w-full mx-auto">
      <div className="bg-card rounded-2xl border border-line-soft shadow-xs">
        <div className="px-6 py-5 border-b border-line-soft">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold text-ink tracking-tight">
                {isEdit ? (isLocked ? "View Purchase Order" : "Edit Purchase Order") : "Create Purchase Order"}
              </h2>
            </div>
            <div><BackButton text="Back to List" /></div>
          </div>
        </div>
        <form className="px-6 py-6 space-y-6" noValidate>
          {isLocked && (
            <div className="mb-4 p-4 bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded-xl flex items-center gap-2 text-sm font-semibold">
              <span className="font-bold">View Only Mode:</span>
              This Purchase Order is in '{formData.status}' status and cannot be edited. Only Draft orders can be modified.
            </div>
          )}

          {/* Main Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div>
              <TextInput label="PO Number" name="poNumber" value={formData.poNumber} onChange={handleChange} disabled />
            </div>
            <div>
              <DatePickerCalendar
                label="PO Date"
                name="poDate"
                value={formData.poDate}
                onChange={(e) => handleChange(e as any)}
                required
                error={errors.poDate}
                disabled={isLocked || isEdit}
              />
            </div>

            <div>
              <SelectInput
                label="Supplier"
                name="supplierId"
                value={formData.supplierId}
                options={[{ value: "", label: "-- Select Supplier --" }, ...supplierOptions]}
                onChange={handleChange}
                required
                searchable
                disabled={isLocked || isEdit}
              />
              {errors.supplierId && <div className="text-red-400 mt-1 text-sm font-medium">{errors.supplierId}</div>}
            </div>
            <div>
              <SelectInput
                label="Store"
                name="storeId"
                value={formData.storeId || ""}
                options={[{ label: "-- Select Store --", value: "" }, ...(stores || []).filter((s: any) => s.isActive).map((s: any) => ({ label: s.storeName, value: s.storeId }))]}
                required
                onChange={handleChange}
                searchable
                disabled={isLocked}
              />
              {errors.storeId && <div className="text-red-400 mt-1 text-sm font-medium">{errors.storeId}</div>}
            </div>

          </div>

          <div className="grid grid-cols-1 gap-6">
            <div>
              <h6 className="text-lg font-bold text-ink mb-3">Billing</h6>
              <AddressForm
                addressValue={formData.billingAddressLine1 || ""}
                onAddressChange={(val) => setFormData(prev => ({ ...prev, billingAddressLine1: val }))}
                addressError={errors.billingAddressLine1}
                countryValue={formData.billingCountry || "India"}
                onCountryChange={(val) => setFormData(prev => ({ ...prev, billingCountry: val, ...(prev.sameAsBilling && { shippingCountry: val }) }))}
                countryError={errors.billingCountry}
                stateValue={formData.billingState || ""}
                onStateChange={handleBillingStateChange}
                stateError={errors.billingState}
                cityValue={formData.billingCity || ""}
                onCityChange={handleBillingCityChange}
                cityError={errors.billingCity}
                pincodeValue={formData.billingPincode || ""}
                onPincodeChange={(val) => setFormData(prev => ({ ...prev, billingPincode: val }))}
                pincodeError={errors.billingPincode}
                required
                disabled={isLocked}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <h6 className="text-lg font-bold text-ink mb-0">Shipping</h6>
              </div>

              <AddressForm
                addressValue={formData.shippingAddressLine1 || ""}
                onAddressChange={(val) => setFormData(prev => ({ ...prev, shippingAddressLine1: val }))}
                addressError={errors.shippingAddressLine1}
                countryValue={formData.shippingCountry || "India"}
                onCountryChange={(val) => setFormData(prev => ({ ...prev, shippingCountry: val }))}
                countryError={errors.shippingCountry}
                stateValue={formData.shippingState || ""}
                onStateChange={handleShippingStateChange}
                stateError={errors.shippingState}
                cityValue={formData.shippingCity || ""}
                onCityChange={handleShippingCityChange}
                cityError={errors.shippingCity}
                pincodeValue={formData.shippingPincode || ""}
                onPincodeChange={(val) => setFormData(prev => ({ ...prev, shippingPincode: val }))}
                pincodeError={errors.shippingPincode}
                disabled={isLocked}
              />
            </div>
          </div>

          <div className="flex justify-between items-center mb-4 mt-6">
            <span className="text-lg font-bold text-ink">Order Items</span>
            <CustomButton text="Add Item" icon={FaPlus} onClick={addItem} type="button" disabled={isLocked} />
          </div>

          <div className="rounded-xl border border-line-soft bg-card-2 [&_.mb-\[18px\]]:!mb-0 [&_.select-input-group]:!mb-0 overflow-visible">
            <table className="min-w-full divide-y divide-line-soft">
              <thead className="bg-card-2 border-b border-line-soft">
                <tr>
                  <th className="px-3 py-3 text-center text-[11px] font-extrabold text-ink-subtle uppercase tracking-wider w-12 border-b border-line-soft">#</th>
                  <th className="px-3 py-3 text-left text-[11px] font-extrabold text-ink-subtle uppercase tracking-wider border-b border-line-soft">RAW MATERIAL</th>
                  <th className="px-3 py-3 text-left text-[11px] font-extrabold text-ink-subtle uppercase tracking-wider border-b border-line-soft min-w-[200px]">QTY & UOM</th>
                  <th className="px-3 py-3 text-left text-[11px] font-extrabold text-ink-subtle uppercase tracking-wider border-b border-line-soft">UNIT PRICE (₹)</th>
                  <th className="px-3 py-3 text-left text-[11px] font-extrabold text-ink-subtle uppercase tracking-wider border-b border-line-soft">TAX %</th>
                  <th className="px-3 py-3 text-right text-[11px] font-extrabold text-ink-subtle uppercase tracking-wider border-b border-line-soft">TOTAL (₹)</th>
                  <th className="px-3 py-3 text-center text-[11px] font-extrabold text-ink-subtle uppercase tracking-wider w-16 border-b border-line-soft"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {formData.items.map((item, index) => {
                  const qty = Number(item.quantity) || 0;
                  const price = Number(item.unitPrice) || 0;
                  const taxPercent = Number(item.tax) || 0;
                  const rawMaterial = rawMaterials.find(
                    (rm) => String(rm.rawMaterialId) === String(item.productId)
                  );
                  const mult = getUomMultiplier(item.uom, rawMaterial?.baseUom);
                  const taxableAmount = qty * mult * price;
                  const gstAmount = taxableAmount * (taxPercent / 100);
                  const lineTotal = taxableAmount + gstAmount;
                  return (
                    <tr key={index} className="hover:bg-card/60 transition-colors duration-200">
                      <td className="px-3 py-2 whitespace-nowrap text-sm font-bold text-ink-subtle text-center">{index + 1}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <SelectInput
                          noMargin={true}
                          name={`items[${index}].productId`}
                          value={item.productId ? String(item.productId) : ""}
                          options={[{ value: "", label: "-- Select Material --" }, ...productOptions]}
                          onChange={(e) => handleItemProductChange(index, e.target.value)}
                          error={errors[`items.${index}.productId`]}
                          hideLabel
                          disabled={isLocked}
                        />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <QuantityInput
                          name={`items[${index}].quantity`}
                          value={item.quantity}
                          baseUoms={rawMaterial?.baseUom || item.uom || "KG"}
                          uom={item.uom}
                          onUomChange={(newUom) => handleItemChange(index, "uom", newUom)}
                          onChange={(e) => handleItemChange(index, "quantity", Number(e.target.value), e.target.uom)}
                          error={errors[`items.${index}.quantity`]}
                          step="0.01"
                          hideLabel
                          disabled={isLocked}
                        />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <TextInput
                          label=""
                          name={`items[${index}].unitPrice`}
                          type="number"
                          value={String(item.unitPrice)}
                          onChange={(e) => handleItemChange(index, "unitPrice", Number(e.target.value))}
                          error={errors[`items.${index}.unitPrice`]}
                          min={0}
                          step={0.01}
                          placeholder="0.00"
                          disabled={isLocked}
                        />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <TextInput
                          name={`items[${index}].tax`}
                          type="number"
                          value={String(item.tax || 0)}
                          onChange={(e) => handleItemChange(index, "tax", Number(e.target.value))}
                          min={0}
                          max={100}
                          step={0.01}
                          placeholder="0"
                          disabled={isLocked}
                        />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right font-extrabold text-ink">₹{lineTotal.toFixed(2)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-center">
                        <DeleteButton
                          onClick={() => removeItem(index)}
                          disabled={isLocked}
                        />
                      </td>
                    </tr>
                  );
                })}
                {formData.items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-ink-subtle font-bold">
                      No items added — click "Add Item" to begin
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            <div className="col-span-2">
              <TextInput label="Remarks" name="remarks" value={formData.remarks} onChange={handleChange} disabled={isLocked} />
            </div>
            <div>
              <div className="bg-card-2 rounded-xl border border-line-soft p-5 shadow-xs">
                <h6 className="mb-3 font-extrabold text-primary text-base">Order Summary</h6>
                <div className="flex justify-between mb-2 text-ink-subtle text-sm font-semibold"><span>Subtotal:</span><span className="text-ink font-extrabold">₹{formData.subtotal.toFixed(2)}</span></div>

                {isInterState ? (
                  gstRateBreakdown.length === 0 ? (
                    <div className="flex justify-between mb-2 text-emerald-400 font-semibold text-sm"><span>Total IGST:</span><span>+₹{formData.totalIgst.toFixed(2)}</span></div>
                  ) : (
                    gstRateBreakdown.map((group) => (
                      <div key={`igst-${group.gstRate}`} className="flex justify-between mb-2 text-emerald-400 font-semibold text-sm">
                        <span>IGST {group.gstRate}%:</span>
                        <span>+₹{group.igstAmount.toFixed(2)}</span>
                      </div>
                    ))
                  )
                ) : (
                  gstRateBreakdown.length === 0 ? (
                    <>
                      <div className="flex justify-between mb-2 text-emerald-400 font-semibold text-sm"><span>Total CGST:</span><span>+₹{formData.totalCgst.toFixed(2)}</span></div>
                      <div className="flex justify-between mb-2 text-emerald-400 font-semibold text-sm"><span>Total SGST:</span><span>+₹{formData.totalSgst.toFixed(2)}</span></div>
                    </>
                  ) : (
                    gstRateBreakdown.map((group) => (
                      <React.Fragment key={`gst-${group.gstRate}`}>
                        <div className="flex justify-between mb-2 text-emerald-400 font-semibold text-sm">
                          <span>CGST {group.cgstRate}%:</span>
                          <span>+₹{group.cgstAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between mb-2 text-emerald-400 font-semibold text-sm">
                          <span>SGST {group.sgstRate}%:</span>
                          <span>+₹{group.sgstAmount.toFixed(2)}</span>
                        </div>
                      </React.Fragment>
                    ))
                  )
                )}
                <hr className="my-3 border-line-soft" />
                <div className="flex justify-between text-base font-extrabold text-ink"><span>Net Amount:</span><span className="text-primary text-lg font-black">₹{formData.netAmount.toFixed(2)}</span></div>
              </div>
            </div>
          </div>

          {!isLocked && (
            <div className="flex flex-wrap justify-end gap-3 mt-8 pt-4 border-t border-line-soft">
              <CustomButton
                text={isSubmitting ? "Saving..." : "Save as Draft"}
                icon={isSubmitting ? undefined : FaSave}
                onClick={(e: any) => handleSubmit(e, "DRAFT")}
                type="button"
                disabled={isSubmitting || isSubmittingForApproval}
              />
              <CustomButton
                text={isSubmittingForApproval ? "Approving..." : "Approved"}
                icon={isSubmittingForApproval ? undefined : FaPaperPlane}
                onClick={(e: any) => handleSubmit(e, "APPROVED")}
                type="button"
                disabled={isSubmitting || isSubmittingForApproval}
              />
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default PurchaseOrderForm;
