import React, { useState, useEffect, useMemo } from "react";
import { FaSave, FaPaperPlane, FaPlus, FaTrash, FaUser, FaMapMarkerAlt, FaBoxOpen, FaInfoCircle } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import CustomButton from "../../../../components/ui/Button/Button";

import TextInput from "../../../../components/form/TextInput/TextInput";
import SelectInput from "../../../../components/form/SelectInput/SelectInput";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";

import QuantityInput from "../../../../components/form/QuantityInput/QuantityInput";
import CityStateSelect from "../../../../components/ui/CityStateSelect/CityStateSelect";
import type { StateCityOption } from "../../../../components/ui/CityStateSelect/CityStateSelect";

import { validatePurchaseOrder } from "../validations/purchaseOrderValidation";
import type { PurchaseOrderItem } from "../../../../features/purchaseOrder/types";
import { useSuppliers } from "../../../../hooks/useSuppliers";
import { useUOMs } from "../../../../hooks/useUOMs";
import { rawMaterialService } from "../../../../services/rawMaterialService";
import type { RawMaterial } from "../../../../features/raw-materials/types";
import { usePurchaseOrders } from "../../../../hooks/usePurchaseOrder";
import { purchaseOrderService } from "../../../../services/purchaseOrderService";
import BackButton from "../../../../components/ui/BackButton/BackButton";
import AddressForm from "../../../../components/form/AddressFrom/AddressFrom";
import { useAppDispatch, useAppSelector } from "../../../../hooks/reduxHooks";
import { fetchLocations } from "../../../../features/locations/locationSlice";
import { selectActiveGstTaxes, fetchGstTaxes } from "../../../../features/gst/gstSlice";
import { fetchStores } from "../../../../features/stores/storeSlice";

const initialFormData = {
  poNumber: "",
  poDate: new Date().toISOString().split("T")[0],
  expectedDeliveryDate: "",
  supplierId: "",
  storeId: "",
  status: "DRAFT" as const,
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

  items: [] as PurchaseOrderItem[],

  subtotal: 0,
  discountType: "PERCENT" as "PERCENT" | "FLAT",
  discountValue: 0,
  totalDiscount: 0,
  totalTax: 0,
  totalCgst: 0,
  totalSgst: 0,
  totalIgst: 0,
  netAmount: 0,
};

type PurchaseOrderFormData = typeof initialFormData;

const PurchaseOrderCreatePage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { addPurchaseOrder } = usePurchaseOrders();
  const user = useSelector((state: any) => state?.auth?.user);

  const [formData, setFormData] = useState<PurchaseOrderFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { suppliers, loadSuppliers } = useSuppliers();


  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const { data: company } = useSelector((state: any) => state.company);
  const { data: locations } = useAppSelector(state => state.locations);
  const { data: stores } = useAppSelector(state => state.stores);
  const { activeUOMs, loadActiveUOMs } = useUOMs();
  const companyState = company?.state
  const gstTaxes = useAppSelector(selectActiveGstTaxes);
  const gstLoading = useAppSelector((state) => state.gst.loading);

  const selectedSupplier = useMemo(() => (suppliers || []).find(
    (s) => String(s?.id) === String(formData.supplierId)
  ), [suppliers, formData.supplierId]);

  const [selectedShippingIndex, setSelectedShippingIndex] = useState<string>("");

  const shippingAddressOptions = useMemo(() => {
    if (!selectedSupplier?.addresses || !Array.isArray(selectedSupplier.addresses) || selectedSupplier.addresses.length === 0) return [];
    return selectedSupplier.addresses.map((addr: any, idx: number) => {
      const a = addr.address || addr;
      const addressParts = [a?.addressLine1, a?.addressLine2, a?.city, a?.state, a?.pincode].filter(Boolean);
      const fullAddressStr = addressParts.join(", ");
      return {
        label: fullAddressStr || (addr.label && addr.label !== `Address ${idx + 1}` ? addr.label : `Address ${idx + 1}`),
        value: String(idx),
      };
    });
  }, [selectedSupplier]);

  const handleShippingAddressSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idxStr = e.target.value;
    setSelectedShippingIndex(idxStr);
    if (!idxStr) {
      setFormData((prev) => ({
        ...prev,
        shippingAddressLine1: "",
        shippingCity: "",
        shippingState: "",
        shippingPincode: "",
      }));
      return;
    }
    if (!selectedSupplier?.addresses) return;
    const item = selectedSupplier.addresses[Number(idxStr)];
    const addrObj: any = (item as any)?.address || item;
    if (addrObj) {
      setFormData((prev) => ({
        ...prev,
        shippingAddressLine1: addrObj.addressLine1 || "",
        shippingCity: addrObj.city || "",
        shippingState: addrObj.state || "",
        shippingPincode: addrObj.pincode || "",
      }));
      setErrors((prev) => ({
        ...prev,
        shippingAddressLine1: "",
        shippingCity: "",
        shippingState: "",
        shippingPincode: "",
      }));
    }
  };

  // ============================================================
  // INTER-STATE CHECK
  // Rule requested: compare COMPANY state vs SHIPPING address state.
  // Same state  -> CGST + SGST
  // Diff state  -> IGST
  // ============================================================
  const isInterState = useMemo(() => {
    if (!companyState || !formData.shippingState) return false;
    return (
      companyState.toLowerCase().trim() !==
      formData.shippingState.toLowerCase().trim()
    );
  }, [companyState, formData.shippingState]);

  const gstRateBreakdown = useMemo(() => {
    const map = new Map<number, number>();
    (formData.items || []).forEach((item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      const taxable = qty * price;
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
  }, [formData.items]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingForApproval, setIsSubmittingForApproval] = useState(false);

  // ============================================================
  // FETCH DATA
  // ============================================================
  useEffect(() => {
    loadSuppliers();
    dispatch(fetchLocations(undefined));
    dispatch(fetchGstTaxes(undefined));
    dispatch(fetchStores(undefined));
    loadActiveUOMs();
  }, [loadSuppliers, dispatch, loadActiveUOMs]);

  useEffect(() => {
    const fetchRawMaterials = async () => {
      try {
        const materials = await rawMaterialService.fetchAll();
        setRawMaterials(materials);
      } catch {
        toast.error("Failed to load raw materials");
      }
    };
    fetchRawMaterials();
  }, []);

  useEffect(() => {
    const fetchNextCode = async () => {
      try {
        const nextCode = await purchaseOrderService.fetchNextCode();
        if (nextCode) {
          setFormData((prev) => ({ ...prev, poNumber: nextCode }));
        }
      } catch (err) {
        console.error("Error fetching next PO code:", err);
      }
    };
    fetchNextCode();
  }, []);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      createdByOn: user?.username || "",
    }));
  }, [user]);

  const [roundingSign, setRoundingSign] = useState<"+" | "-">("+");
  const [roundingValue, setRoundingValue] = useState<number>(0);

  // ============================================================
  // TOTALS RECALCULATION
  // ============================================================
  const recalculateTotals = (items: PurchaseOrderItem[], interState: boolean = isInterState, poDiscountType: "PERCENT" | "FLAT" = formData.discountType, poDiscountValue: number = formData.discountValue, rSign: "+" | "-" = roundingSign, rValue: number = roundingValue) => {
    let subtotal = 0;
    let totalTax = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    items.forEach((item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      const lineSubtotal = qty * price;

      // Taxable amount is exactly line subtotal
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

    let totalDiscount = 0;
    if (poDiscountType === "PERCENT") {
      totalDiscount = (subtotal * poDiscountValue) / 100;
    } else {
      totalDiscount = poDiscountValue;
    }
    if (totalDiscount > subtotal) {
      totalDiscount = subtotal;
    }

    const roundingAdjust = rSign === "+" ? rValue : -rValue;

    return {
      subtotal,
      totalDiscount,
      totalTax,
      totalCgst,
      totalSgst,
      totalIgst,
      netAmount: subtotal - totalDiscount + totalTax + roundingAdjust,
    };
  };

  // ============================================================
  // RECOMPUTE ITEM-LEVEL TAX SPLIT WHENEVER isInterState CHANGES
  // (e.g. shipping state edited after items were already added)
  // ============================================================
  useEffect(() => {
    setFormData((prev) => {
      if (prev.items.length === 0) return prev;

      const updatedItems = prev.items.map((item) => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.unitPrice) || 0;
        const lineSubtotal = qty * price;

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
          taxableAmount,
          cgstRate,
          cgstAmount,
          sgstRate,
          sgstAmount,
          igstRate,
          igstAmount,
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

  // ============================================================
  // HANDLE CHANGE
  // ============================================================
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    if (name === "sameAsBilling") {
      const checked = (e.target as HTMLInputElement).checked;
      if (checked) setSelectedShippingIndex("");
      setFormData((prev) => ({
        ...prev,
        sameAsBilling: checked,
        shippingAddressLine1: checked ? prev.billingAddressLine1 : "",
        shippingCity: checked ? prev.billingCity : "",
        shippingState: checked ? prev.billingState : "",
        shippingPincode: checked ? prev.billingPincode : "",
      }));
      return;
    }

    if (name === "supplierId") {
      setSelectedShippingIndex("");
      const selectedSup = suppliers.find((s) => String(s.id) === String(value));
      setFormData((prev) => ({
        ...prev,
        supplierId: value,
        billingAddressLine1: selectedSup?.billingAddressLine1 || "",
        billingCity: selectedSup?.billingCity || "",
        billingState: selectedSup?.billingState || "",
        billingPincode: selectedSup?.billingPincode || "",
        billingCountry: selectedSup?.billingCountry || "India",
        shippingAddressLine1: prev.sameAsBilling ? (selectedSup?.billingAddressLine1 || "") : "",
        shippingCity: prev.sameAsBilling ? (selectedSup?.billingCity || "") : "",
        shippingState: prev.sameAsBilling ? (selectedSup?.billingState || "") : "",
        shippingPincode: prev.sameAsBilling ? (selectedSup?.billingPincode || "") : "",
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
      const selectedStore = (stores || []).find((s: any) => String(s.storeId) === String(value));
      const selectedLoc = (locations || []).find((l: any) => String(l.locationId || l.id) === String(selectedStore?.locationId));
      setFormData((prev) => ({
        ...prev,
        storeId: value,
        billingAddressLine1: selectedLoc?.address || "",
        billingCity: selectedLoc?.city || "",
        billingState: selectedLoc?.state || "",
        billingPincode: "625017",
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
          const lineSubtotal = qty * parsedUnitPrice;

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
          items: updatedItems,
          ...recalculateTotals(updatedItems),
        };
      });
      if (errors.poDate) {
        setErrors((prev) => ({ ...prev, poDate: "" }));
      }
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

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

  useEffect(() => {
    if (formData.sameAsBilling) {
      setFormData((prev) => ({
        ...prev,
        shippingAddressLine1: prev.billingAddressLine1,
        shippingCity: prev.billingCity,
        shippingState: prev.billingState,
        shippingPincode: prev.billingPincode,
      }));
    }
  }, [
    formData.sameAsBilling,
    formData.billingAddressLine1,
    formData.billingCity,
    formData.billingState,
    formData.billingPincode,
  ]);

  // ============================================================
  // ITEM HANDLERS
  // ============================================================
  const handleItemChange = (index: number, field: keyof PurchaseOrderItem, value: any) => {
    setFormData((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };

      const item = items[index];
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      const lineSubtotal = qty * price;

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
        ...recalculateTotals(items),
      };
    });
  };

  const handleItemProductChange = (index: number, productId: string) => {
    const rawMaterial = rawMaterials.find(
      (rm) => String(rm.rawMaterialId) === String(productId)
    );

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

      const parsedUnitPrice = activePriceObj
        ? (typeof activePriceObj.price === "string" ? parseFloat(activePriceObj.price) : Number(activePriceObj.price))
        : (rawMaterial?.unitPrice
          ? (typeof rawMaterial.unitPrice === "string" ? parseFloat(rawMaterial.unitPrice) : Number(rawMaterial.unitPrice))
          : 0);

      const defaultTaxRateObj = gstTaxes?.find((t: any) => String(t.id) === String(rawMaterial?.gstTaxRateId));
      const defaultTaxRate = defaultTaxRateObj ? Number(defaultTaxRateObj.taxRate) : 0;

      const items = [...prev.items];
      const item = items[index];
      const qty = Number(item.quantity) || 0;
      const lineSubtotal = qty * parsedUnitPrice;

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
          ? ({
            id: rawMaterial.rawMaterialId as any,
            productCode: rawMaterial.rawMaterialId,
            productName: rawMaterial.materialName,
            unit: rawMaterial.baseUom,
            unitPrice: parsedUnitPrice,
          } as any)
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
        ...recalculateTotals(items),
      };
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
        ...recalculateTotals(items),
      };
    });
  };

  const removeItem = (index: number) => {
    setFormData((prev) => {
      const items = prev.items.filter((_, i) => i !== index);
      return {
        ...prev,
        items,
        ...recalculateTotals(items),
      };
    });
  };

  // ============================================================
  // SUBMIT
  // ============================================================
  const handleSubmit = async (
    e: React.FormEvent,
    submitStatus: "DRAFT" | "PENDING"
  ) => {
    e.preventDefault();

    const validationErrors = validatePurchaseOrder(formData);
    console.log(validationErrors, "kjklj")
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error("Please fill all required fields correctly.");
      return;
    }

    if (submitStatus === "DRAFT") setIsSubmitting(true);
    else setIsSubmittingForApproval(true);

    try {
      await addPurchaseOrder({
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
          unitPrice: item.unitPrice,
          tax: item.tax || 0,
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
        netAmount: formData.netAmount,

        status: submitStatus,
      });

      toast.success(
        submitStatus === "DRAFT"
          ? "Purchase Order saved as draft!"
          : "Purchase Order submitted for approval!"
      );
      navigate("/purchase-orders");
    } catch (error: any) {
      toast.error(error?.message || "Failed to create purchase order");
    } finally {
      setIsSubmitting(false);
      setIsSubmittingForApproval(false);
    }
  };

  // ============================================================
  // OPTIONS
  // ============================================================
  const supplierOptions = (suppliers || []).map((s) => ({
    value: s?.id ? String(s.id) : "",
    label: `${s?.supplierCode || ""} - ${s?.legalName || ""}`,
  }));

  const gstOptions = useMemo(() => [
    { value: "", label: gstLoading ? "Loading GST rates..." : "-- Select GST Rate --" },
    ...(gstTaxes || []).map((t: any) => ({
      value: String(t.taxRate),
      label: `${t.taxName} (${t.taxRate}%)`,
    })),
  ], [gstTaxes, gstLoading]);

  const uomOptions = useMemo(() => [
    { value: "", label: "-- Select UOM --" },
    ...(activeUOMs || []).map((uom: any) => ({
      value: uom.uomName,
      label: uom.uomName,
    })),
  ], [activeUOMs]);

  console.log(uomOptions, 'hkj')

  const supplierMaterialIds = selectedSupplier?.materialPrices
    ? selectedSupplier.materialPrices.map((mp: any) => String(mp.rawMaterialId))
    : [];

  const filteredRawMaterials = supplierMaterialIds.length > 0
    ? rawMaterials.filter((rm) => supplierMaterialIds.includes(String(rm.rawMaterialId)))
    : rawMaterials;

  const productOptions = filteredRawMaterials.map((rm) => ({
    value: String(rm.rawMaterialId || ""),
    label: `${rm.rawMaterialId || ""} - ${rm.materialName || ""}`,
  }));

  console.log(productOptions, "productOptions")

  // ============================================================
  // UI
  // ============================================================
  return (
    <div className="w-full mx-auto">
      <div className="bg-white  border border-gray-200">
        <div className="px-6 py-4 ">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div><h2 className="text-xl font-bold text-gray-800">Create Purchase Order</h2></div>
            <div><BackButton text="Back to List" /></div>
          </div>
        </div>
        <form className="px-6 py-3 space-y-4" noValidate>
          {/* Main Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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
                disabled
              />
            </div>
            <div>
              <DatePickerCalendar
                label="Expected Delivery Date"
                name="expectedDeliveryDate"
                value={formData.expectedDeliveryDate}
                onChange={(e) => handleChange(e as any)}
                required
                error={errors.expectedDeliveryDate}
              />
            </div>
            <div>
              <SelectInput label="Store" name="storeId" value={formData.storeId} options={[{ label: "-- Select Store --", value: "" }, ...(stores || []).filter((s: any) => s.isActive).map((s: any) => ({ label: s.storeName, value: s.storeId }))]} required error={errors.storeId} onChange={handleChange} />
            </div>
            <div>
              <SelectInput label="Supplier" name="supplierId" value={formData.supplierId} options={[{ value: "", label: "-- Select Supplier --" }, ...supplierOptions]} onChange={handleChange} required />
              {errors.supplierId && <div className="text-red-500 mt-1 text-sm">{errors.supplierId}</div>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <h6 className="text-lg font-semibold text-gray-800 mb-4">Billing</h6>
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
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-4">
                <h6 className="text-lg font-semibold text-gray-800 mb-0">Shipping</h6>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 mb-0">
                  <input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-gray-300" name="sameAsBilling" checked={formData.sameAsBilling} onChange={handleChange} />
                  <span>Same as billing</span>
                </label>
              </div>

              {!formData.sameAsBilling && (
                <div className="mb-4">
                  <SelectInput
                    label="Select Saved Address"
                    options={shippingAddressOptions}
                    value={selectedShippingIndex}
                    onChange={handleShippingAddressSelect}
                    defaultOptionLabel={shippingAddressOptions.length > 0 ? "-- Select saved address --" : "No additional addresses saved"}
                    disabled={shippingAddressOptions.length === 0}
                  />
                </div>
              )}
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
              />
            </div>
          </div>

          <div className="flex justify-between items-center mb-4 mt-6">
            <span className="text-lg font-semibold text-gray-800">Order Items</span>
            <CustomButton text="Add Item" icon={FaPlus} onClick={addItem} type="button" />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white [&_.mb-\[18px\]]:!mb-0 [&_.select-input-group]:!mb-0 overflow-visible">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-3 py-3 text-center text-[11px] font-bold text-slate-500 uppercase tracking-widest w-12 border-b border-slate-200">#</th>
                  <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">RAW MATERIAL</th>
                  <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 min-w-[200px]">QTY & UOM</th>
                  <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">UNIT PRICE (₹)</th>
                  <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">TAX %</th>
                  {/* <th className="px-3 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">GST (₹)</th> */}
                  <th className="px-3 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">TOTAL (₹)</th>
                  <th className="px-3 py-3 text-center text-[11px] font-bold text-slate-500 uppercase tracking-widest w-16 border-b border-slate-200"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {formData.items.map((item, index) => {
                  const qty = Number(item.quantity) || 0;
                  const price = Number(item.unitPrice) || 0;
                  const taxPercent = Number(item.tax) || 0;
                  const taxableAmount = qty * price;
                  const gstAmount = taxableAmount * (taxPercent / 100);
                  const lineTotal = taxableAmount + gstAmount;
                  const rawMaterial = rawMaterials.find(
                    (rm) => String(rm.rawMaterialId) === String(item.productId)
                  );
                  return (
                    <tr key={index} className="hover:bg-slate-50/50 transition-colors duration-200">
                      <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-slate-400 text-center">{index + 1}</td>
                      <td className="px-3 py-2 whitespace-nowrap"><SelectInput noMargin={true} name={`items[${index}].productId`} value={item.productId ? String(item.productId) : ""} options={[{ value: "", label: "-- Select Material --" }, ...productOptions]} onChange={(e) => handleItemProductChange(index, e.target.value)} error={errors[`items.${index}.productId`]} hideLabel /></td>
                      <td className="px-3 py-2 whitespace-nowrap ">
                        <QuantityInput
                          name={`items[${index}].quantity`}
                          value={item.quantity}
                          baseUoms={rawMaterial?.baseUom || item.uom || "KG"}
                          onChange={(e) => handleItemChange(index, "quantity", Number(e.target.value))}
                          error={errors[`items.${index}.quantity`]}
                          step="0.01"
                          hideLabel
                        />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap"><TextInput label="" name={`items[${index}].unitPrice`} type="number" value={String(item.unitPrice)} onChange={(e) => handleItemChange(index, "unitPrice", Number(e.target.value))} error={errors[`items.${index}.unitPrice`]} min={0} step={0.01} placeholder="0.00" disabled /></td>
                      <td className="px-3 py-2 whitespace-nowrap"><SelectInput label="" noMargin={true} name={`items[${index}].tax`} options={gstOptions} value={String(item.tax || 0)} onChange={(e) => handleItemChange(index, "tax", Number(e.target.value))} hideLabel /></td>
                      {/* <td className="px-3 py-2 whitespace-nowrap text-right font-medium text-slate-700">₹{gstAmount.toFixed(2)}</td> */}
                      <td className="px-3 py-2 whitespace-nowrap text-right font-medium text-slate-700">₹{lineTotal.toFixed(2)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-center">
                        <button
                          type="button"
                          className="text-rose-400 hover:text-rose-600 hover:bg-rose-100 p-2 rounded-md disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all duration-200 inline-flex items-center justify-center"
                          onClick={() => removeItem(index)}
                          title="Remove item"
                        >
                          <FaTrash size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {formData.items.length === 0 && <tr><td colSpan={8} className="px-3 py-4 text-center text-slate-400 font-medium">No items added — click "Add Item" to begin</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            <div className="col-span-2">
              <TextInput label="Remarks" name="remarks" value={formData.remarks} onChange={handleChange} />
            </div>
            <div>
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                <h6 className="mb-3 font-bold text-blue-600">Order Summary</h6>
                <div className="flex justify-between mb-2"><span>Subtotal:</span><span>₹{formData.subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between items-center mb-2 text-red-500 text-sm">
                  <span className="flex items-center gap-2">Discount:
                    <div className="w-24 [&_.mb-\[18px\]]:!mb-0 [&_.select-input-group]:!mb-0">
                      <SelectInput name="discountType" options={[{ value: "PERCENT", label: "%" }, { value: "FLAT", label: "Flat" }]} value={formData.discountType || "PERCENT"} onChange={(e) => { setFormData(prev => { const newTotals = recalculateTotals(prev.items, isInterState, e.target.value as any, prev.discountValue); return { ...prev, discountType: e.target.value as any, ...newTotals }; }); }} hideLabel />
                    </div>
                    <div className="w-24 [&_.mb-\[18px\]]:!mb-0">
                      <TextInput name="discountValue" type="number" min={0} step={0.01} value={String(formData.discountValue || 0)} onChange={(e) => { setFormData(prev => { const newTotals = recalculateTotals(prev.items, isInterState, prev.discountType, Number(e.target.value) || 0); return { ...prev, discountValue: Number(e.target.value) || 0, ...newTotals }; }); }} />
                    </div>
                  </span>
                  <span>-₹{formData.totalDiscount.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center mb-2 text-gray-600 text-sm">
                  <span className="flex items-center gap-2">Round Off:
                    <div className="flex items-center bg-white rounded border overflow-hidden h-[35px]">
                      <button type="button" onClick={() => { setRoundingSign("+"); setFormData(prev => ({ ...prev, ...recalculateTotals(prev.items, isInterState, prev.discountType, prev.discountValue, "+", roundingValue) })); }} className={`px-2 py-1 h-full font-bold ${roundingSign === "+" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"}`}>+</button>
                      <button type="button" onClick={() => { setRoundingSign("-"); setFormData(prev => ({ ...prev, ...recalculateTotals(prev.items, isInterState, prev.discountType, prev.discountValue, "-", roundingValue) })); }} className={`px-2 py-1 h-full font-bold ${roundingSign === "-" ? "bg-red-500 text-white" : "bg-gray-100 text-gray-600"}`}>-</button>
                    </div>
                    <div className="w-24 [&_.mb-\[18px\]]:!mb-0">
                      <TextInput name="roundingValue" type="number" min={0} step={0.01} value={String(roundingValue || 0)} onChange={(e) => { const val = Number(e.target.value) || 0; setRoundingValue(val); setFormData(prev => ({ ...prev, ...recalculateTotals(prev.items, isInterState, prev.discountType, prev.discountValue, roundingSign, val) })); }} />
                    </div>
                  </span>
                  <span>{roundingSign === "+" ? "+" : "-"}₹{(roundingValue || 0).toFixed(2)}</span>
                </div>
                {isInterState ? (
                  gstRateBreakdown.length === 0 ? (
                    <div className="flex justify-between mb-2 text-green-600 text-sm"><span>Total IGST:</span><span>+₹{formData.totalIgst.toFixed(2)}</span></div>
                  ) : (
                    gstRateBreakdown.map((group) => (
                      <div key={`igst-${group.gstRate}`} className="flex justify-between mb-2 text-green-600 text-sm">
                        <span>IGST {group.gstRate}%:</span>
                        <span>+₹{group.igstAmount.toFixed(2)}</span>
                      </div>
                    ))
                  )
                ) : (
                  gstRateBreakdown.length === 0 ? (
                    <>
                      <div className="flex justify-between mb-2 text-green-600 text-sm"><span>Total CGST:</span><span>+₹{formData.totalCgst.toFixed(2)}</span></div>
                      <div className="flex justify-between mb-2 text-green-600 text-sm"><span>Total SGST:</span><span>+₹{formData.totalSgst.toFixed(2)}</span></div>
                    </>
                  ) : (
                    gstRateBreakdown.map((group) => (
                      <React.Fragment key={`gst-${group.gstRate}`}>
                        <div className="flex justify-between mb-2 text-green-600 text-sm">
                          <span>CGST {group.cgstRate}%:</span>
                          <span>+₹{group.cgstAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between mb-2 text-green-600 text-sm">
                          <span>SGST {group.sgstRate}%:</span>
                          <span>+₹{group.sgstAmount.toFixed(2)}</span>
                        </div>
                      </React.Fragment>
                    ))
                  )
                )}
                <hr className="my-2 border-gray-300" />
                <div className="flex justify-between font-bold"><span>Net Amount:</span><span>₹{formData.netAmount.toFixed(2)}</span></div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3 mt-8 pt-4 border-t border-gray-200">
            <CustomButton text={isSubmitting ? "Saving..." : "Save as Draft"} icon={isSubmitting ? undefined : FaSave} onClick={(e: any) => handleSubmit(e, "DRAFT")} type="button" disabled={isSubmitting || isSubmittingForApproval} />
            <CustomButton text={isSubmittingForApproval ? "Submitting..." : "Submit for Approval"} icon={isSubmittingForApproval ? undefined : FaPaperPlane} onClick={(e: any) => handleSubmit(e, "PENDING")} type="button" disabled={isSubmitting || isSubmittingForApproval} />
          </div>
        </form>
      </div>
    </div>
  );
};

export default PurchaseOrderCreatePage;