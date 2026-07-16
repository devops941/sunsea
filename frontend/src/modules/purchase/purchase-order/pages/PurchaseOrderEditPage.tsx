import React, { useState, useEffect, useMemo } from "react";
import { Container, Row, Col, Table } from "react-bootstrap";
import { FaSave, FaPlus, FaTrash, FaInfoCircle, FaUser, FaMapMarkerAlt, FaBoxOpen, FaPaperPlane } from "react-icons/fa";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import { useAppDispatch, useAppSelector } from "../../../../hooks/reduxHooks";
import { fetchLocations } from "../../../../features/locations/locationSlice";
import { selectActiveGstTaxes, fetchGstTaxes } from "../../../../features/gst/gstSlice";
import { fetchStores } from "../../../../features/stores/storeSlice";

import TextInput from "../../../../components/form/TextInput/TextInput";
import SelectInput from "../../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../../components/ui/Button/Button";
import QuantityInput from "../../../../components/form/QuantityInput/QuantityInput";
import CityStateSelect from "../../../../components/ui/CityStateSelect/CityStateSelect";
import type { StateCityOption } from "../../../../components/ui/CityStateSelect/CityStateSelect";
import { usePurchaseOrders } from "../../../../hooks/usePurchaseOrder";
import { purchaseOrderService } from "../../../../services/purchaseOrderService";
import { validatePurchaseOrder } from "../validations/purchaseOrderValidation";
import type { PurchaseOrderFormData, PurchaseOrderItem } from "../../../../features/purchaseOrder/types";
import { useSuppliers } from "../../../../hooks/useSuppliers";
import { useUOMs } from "../../../../hooks/useUOMs";
import { rawMaterialService } from "../../../../services/rawMaterialService";
import type { RawMaterial } from "../../../../features/raw-materials/types";
import BackButton from "../../../../components/ui/BackButton/BackButton";
import AddressForm from "../../../../components/form/AddressFrom/AddressFrom";
import { useUsers } from "../../../../hooks/useUsers";




const initialFormData: PurchaseOrderFormData = {
  poNumber: "",
  poDate: "",
  expectedDeliveryDate: "",
  supplierId: "",
  status: "DRAFT",
  createdByOn: "",

  billingAddressLine1: "",
  billingCity: "",
  billingState: "",
  billingPincode: "",

  sameAsBilling: false,
  storeId: "",

  shippingAddressLine1: "",
  shippingCity: "",
  shippingState: "",
  shippingPincode: "",

  remarks: "",

  items: [],
  subtotal: 0,
  totalDiscount: 0,
  totalTax: 0,
  totalCgst: 0,
  totalSgst: 0,
  totalIgst: 0,
  netAmount: 0,
};

// ============================================================
// MAPPER
// ============================================================
const mapPOToFormData = (po: any): PurchaseOrderFormData => {
  if (!po) return initialFormData;

  return {
    poNumber: po.poNumber ?? "",
    poDate: po.poDate ? po.poDate.split("T")[0] : "",
    expectedDeliveryDate: po.expectedDeliveryDate ? po.expectedDeliveryDate.split("T")[0] : "",
    supplierId: po.supplierId ?? "",
    status: po.status ?? "DRAFT",
    createdByOn: po.createdBy ? String(po.createdBy) : "",

    billingAddressLine1: po.billingAddressLine1 ?? "",
    billingCity: po.billingCity ?? "",
    billingState: po.billingState ?? "",
    billingPincode: po.billingPincode ?? "",
    sameAsBilling: po.sameAsBilling ?? false,
    storeId: po.storeId ?? "",

    shippingAddressLine1: po.shippingAddressLine1 ?? "",
    shippingCity: po.shippingCity ?? "",
    shippingState: po.shippingState ?? "",
    shippingPincode: po.shippingPincode ?? "",
    remarks: po.remarks ?? "",

    items: po.items?.map((i: any) => ({
      id: i.id,
      productId: i.productId,
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

// ============================================================
// COMPONENT
// ============================================================
const PurchaseOrderEditPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { editPurchaseOrder } = usePurchaseOrders();
  const { suppliers, loadSuppliers } = useSuppliers();
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);

  const dispatch = useAppDispatch();
  const { data: company } = useSelector((state: any) => state.company);
  const { user } = useAppSelector((state: any) => state.auth);

  const isAdmin =
    user?.isSuperAdmin ||
    user?.roleId === "ROLE_ADMIN" ||
    user?.roleId === "SUPER_ADMIN" ||
    user?.roleId === "ADMIN" ||
    user?.roleId === "1";

  const companyState = company?.state;
  const gstTaxes = useAppSelector(selectActiveGstTaxes);
  const gstLoading = useAppSelector((state) => state.gst.loading);
  const { data: stores } = useAppSelector((state) => state.stores);
  const { data: locations } = useAppSelector((state) => state.locations);
  const { activeUOMs, loadActiveUOMs } = useUOMs();

  const [formData, setFormData] = useState<PurchaseOrderFormData>(initialFormData);

  const selectedSupplier = useMemo(() => (suppliers || []).find(
    (s) => String(s?.id) === String(formData.supplierId)
  ), [suppliers, formData.supplierId]);

  const isInterState = useMemo(() => {
    if (!companyState || !selectedSupplier?.billingState) return false;
    return companyState.toLowerCase().trim() !== selectedSupplier.billingState.toLowerCase().trim();
  }, [companyState, selectedSupplier]);

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

  const { users, loadUsers } = useUsers();
  const createdOn = useMemo(() => {
    if (!formData?.createdByOn) return "";
    const foundUser = (users || []).find((u: any) => u.userId === formData.createdByOn);
    if (foundUser) return foundUser.username;
    if (formData.createdByOn.startsWith("admin_")) return "admin";
    return formData.createdByOn; // fallback to raw string (could be username or uuid)
  }, [users, formData?.createdByOn]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [poNotFound, setPoNotFound] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingForApproval, setIsSubmittingForApproval] = useState(false);
  const [roundingSign, setRoundingSign] = useState<"+" | "-">("+");
  const [roundingValue, setRoundingValue] = useState<number>(0);
  // ============================================================
  // LOAD DATA
  // ============================================================
  useEffect(() => {
    loadSuppliers();
    loadUsers();
    dispatch(fetchLocations(undefined));
    dispatch(fetchGstTaxes(undefined));
    dispatch(fetchStores(undefined));
    loadActiveUOMs();
  }, [loadSuppliers, loadUsers, dispatch, loadActiveUOMs]);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      setFetchError(false);
      setPoNotFound(false);
      try {
        const materials = await rawMaterialService.fetchAll();

        if (!mounted) return;

        setRawMaterials(materials ?? []);

        if (id) {
          const po = await purchaseOrderService.fetchById(id);
          if (mounted) {
            if (!po) {
              setPoNotFound(true);
              return;
            }
            const poData = mapPOToFormData(po);
            setFormData(poData);
            const initialRounding = Number(poData.netAmount) - (Number(poData.subtotal) - Number(poData.totalDiscount) + Number(poData.totalTax));
            if (initialRounding < 0) {
              setRoundingSign("-");
              setRoundingValue(Math.abs(initialRounding));
            } else {
              setRoundingSign("+");
              setRoundingValue(initialRounding);
            }
          }
        } else {
          setPoNotFound(true);
        }
      } catch (err) {
        console.error("Failed to fetch purchase order:", err);
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
  }, [id]);

  // ============================================================
  // CALCULATE TOTALS
  // ============================================================
  const recalculateTotals = (items: PurchaseOrderItem[], poDiscountType: "PERCENT" | "FLAT" = formData.discountType || "PERCENT", poDiscountValue: number = formData.discountValue || 0, rSign: "+" | "-" = roundingSign, rValue: number = roundingValue) => {
    let subtotal = 0;
    let totalTax = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    items.forEach((item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      const lineSubtotal = qty * price;

      const taxableAmount = lineSubtotal;
      const totalGstRate = Number(item.tax) || 0;
      const totalGstAmount = (taxableAmount * totalGstRate) / 100;

      let cgstAmount = 0;
      let sgstAmount = 0;
      let igstAmount = 0;

      if (isInterState) {
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
  // HANDLE CHANGE
  // ============================================================
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === "sameAsBilling") {
      const checked = (e.target as HTMLInputElement).checked;
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

  // useEffect(() => {
  //   setFormData((prev) => ({
  //     ...prev,
  //     createdByOn: createdOn?.username,
  //   }));
  // }, [createdOn]);

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

    try {
      await editPurchaseOrder(id!, {
        poDate: formData.poDate,
        expectedDeliveryDate: formData.expectedDeliveryDate,
        supplierId: formData.supplierId,
        billingAddressLine1: formData.billingAddressLine1,
        billingCity: formData.billingCity,
        billingState: formData.billingState,
        billingPincode: formData.billingPincode,
        shippingAddressLine1: formData.shippingAddressLine1,
        shippingCity: formData.shippingCity,
        shippingState: formData.shippingState,
        shippingPincode: formData.shippingPincode,
        sameAsBilling: formData.sameAsBilling,
        storeId: formData.storeId,
        discountType: formData.discountType,
        discountValue: formData.discountValue,
        remarks: formData.remarks,
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
        netAmount: formData.netAmount,
        status: submitStatus,
      });

      toast.success("Purchase Order updated successfully!");
      navigate("/purchase-orders");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update purchase order");
    } finally {
      setIsSubmitting(false);
      setIsSubmittingForApproval(false);
    }
  };

  // ============================================================
  // LOADING & ERROR UI
  // ============================================================
  if (loading) {
    return (
      <div className="inner-container d-flex justify-content-center align-items-center" style={{ minHeight: "300px" }}>
        <div className="animate-spin rounded-full border-b-2 border-indigo-600 h-8 w-8"></div>
      </div>
    );
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

  // ============================================================
  // OPTIONS
  // ============================================================
  const supplierOptions = (suppliers || []).map((s) => ({
    value: String(s.id),
    label: `${s.supplierCode} - ${s.legalName || s.displayName || ""}`,
  }));
  const supplierMaterialIds = selectedSupplier?.materialPrices
    ? selectedSupplier.materialPrices.map((mp: any) => String(mp.rawMaterialId))
    : [];

  const filteredRawMaterials = supplierMaterialIds.length > 0
    ? rawMaterials.filter((rm) => supplierMaterialIds.includes(String(rm.rawMaterialId)) || formData.items.some((item) => item.productId === rm.rawMaterialId))
    : rawMaterials;

  const productOptions = filteredRawMaterials.map((rm) => ({
    value: rm.rawMaterialId || "",
    label: `${rm.rawMaterialId || ""} - ${rm.materialName || ""}`,
  }));

  const statusOptions = [
    { value: "DRAFT", label: "Draft" },
    { value: "PENDING", label: "Pending" },
    { value: "APPROVED", label: "Approved" },
    { value: "REJECTED", label: "Rejected" },
    { value: "COMPLETED", label: "Completed" },
    { value: "CANCELLED", label: "Cancelled" },
  ];

  const isLocked = formData.status !== "DRAFT";

  // ============================================================
  // UI
  // ============================================================
  return (
    <div className="w-full mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 ">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div><h2 className="text-xl font-bold text-gray-800">Edit Purchase Order</h2></div>
            <div><BackButton text="Back to List" /></div>
          </div>
        </div>
        <form className="px-6 py-3 space-y-4" noValidate>
          {isLocked && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg flex items-center gap-2 text-sm">
              <span className="font-semibold">View Only Mode:</span>
              This Purchase Order is in '{formData.status}' status and cannot be edited. Only Draft orders can be modified.
            </div>
          )}
          {/* Main Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            <div>
              <TextInput label="PO Number" name="poNumber" value={formData.poNumber} onChange={() => { }} disabled />
            </div>
            <div>
              <TextInput label="PO Date" name="poDate" type="date" value={formData.poDate} onChange={handleChange} required disabled={isLocked} />
              {errors.poDate && <div className="text-red-500 mt-1 text-sm">{errors.poDate}</div>}
            </div>
            <div>
              <TextInput label="Expected Delivery Date" name="expectedDeliveryDate" type="date" value={formData.expectedDeliveryDate} onChange={handleChange} required disabled={isLocked} />
              {errors.expectedDeliveryDate && <div className="text-red-500 mt-1 text-sm">{errors.expectedDeliveryDate}</div>}
            </div>
            <div>
              <SelectInput label="Status" name="status" value={formData.status} options={statusOptions} onChange={handleChange} disabled />
            </div>
            <div>
              <TextInput label="Created by-on" name="createdByOn" value={createdOn || ""} onChange={() => { }} disabled />
            </div>
            <div>
              <SelectInput label="Store" name="storeId" value={formData.storeId || ""} options={[{ label: "-- Select Store --", value: "" }, ...(stores || []).filter((s: any) => s.isActive).map((s: any) => ({ label: s.storeName, value: s.storeId }))]} required error={errors.storeId} onChange={handleChange} disabled={isLocked} />
            </div>
            <div>
              <SelectInput label="Supplier" name="supplierId" value={String(formData.supplierId || "")} options={[{ value: "", label: "-- Select Supplier --" }, ...supplierOptions]} onChange={handleChange} required disabled={isLocked} />
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
              <div className="flex items-center justify-between mb-4">
                <h6 className="text-lg font-semibold text-gray-800 mb-0">Shipping</h6>
              </div>
              <AddressForm
                addressValue={formData.shippingAddressLine1 || ""}
                onAddressChange={(val) => setFormData(prev => ({ ...prev, shippingAddressLine1: val }))}
                addressError={errors.shippingAddressLine1}
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
            <span className="text-lg font-semibold text-gray-800">Order Items</span>
            <CustomButton text="Add Item" icon={FaPlus} onClick={addItem} type="button" disabled={isLocked} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white [&_.mb-\[18px\]]:!mb-0 [&_.select-input-group]:!mb-0 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-3 py-3 text-center text-[11px] font-bold text-slate-500 uppercase tracking-widest w-12 border-b border-slate-200">#</th>
                  <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">RAW MATERIAL</th>
                  <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 min-w-[200px]">QTY & UOM</th>
                  <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">UNIT PRICE (â‚¹)</th>
                  <th className="px-3 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">TAX %</th>
                  <th className="px-3 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">TAXABLE (â‚¹)</th>
                  {!isLocked && (
                    <th className="px-3 py-3 text-center text-[11px] font-bold text-slate-500 uppercase tracking-widest w-16 border-b border-slate-200"></th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {formData.items.map((item, index) => {
                  const qty = Number(item.quantity) || 0;
                  const price = Number(item.unitPrice) || 0;
                  const taxableAmount = qty * price;
                  return (
                    <tr key={index} className="hover:bg-slate-50/50 transition-colors duration-200">
                      <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-slate-400 text-center">{index + 1}</td>
                      <td className="px-3 py-2 whitespace-nowrap"><SelectInput label="" name={`items[${index}].productId`} value={item.productId ? String(item.productId) : ""} options={[{ value: "", label: "-- Select Material --" }, ...productOptions]} onChange={(e) => handleItemProductChange(index, e.target.value)} error={errors[`items.${index}.productId`]} hideLabel disabled={isLocked} /></td>
                      <td className="px-3 py-2 whitespace-nowrap align-top">
                        <QuantityInput 
                          name={`items[${index}].quantity`} 
                          value={item.quantity} 
                          baseUoms={[item.uom || "KG", ...uomOptions.map(o => o.value).filter(v => v !== (item.uom || "KG"))].join(",")}
                          onChange={(e) => handleItemChange(index, "quantity", Number(e.target.value))} 
                          error={errors[`items.${index}.quantity`]} 
                          step="0.01" 
                          hideLabel 
                          disabled={isLocked}
                        />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap"><TextInput label="" name={`items[${index}].unitPrice`} type="number" value={String(item.unitPrice)} onChange={(e) => handleItemChange(index, "unitPrice", Number(e.target.value))} error={errors[`items.${index}.unitPrice`]} min={0} step={0.01} placeholder="0.00" disabled /></td>
                      <td className="px-3 py-2 whitespace-nowrap"><SelectInput label="" name={`items[${index}].tax`} options={gstOptions} value={String(item.tax || 0)} onChange={(e) => handleItemChange(index, "tax", Number(e.target.value))} hideLabel disabled={isLocked} /></td>
                      <td className="px-3 py-2 whitespace-nowrap text-right font-medium text-slate-700">â‚¹{taxableAmount.toFixed(2)}</td>
                      {!isLocked && (
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
                      )}
                    </tr>
                  );
                })}
                {formData.items.length === 0 && <tr><td colSpan={isLocked ? 6 : 7} className="px-3 py-4 text-center text-slate-400 font-medium">No items added</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            <div className="col-span-2">
              <TextInput label="Remarks" name="remarks" value={formData.remarks} onChange={handleChange} disabled={isLocked} />
            </div>
            <div>
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                <h6 className="mb-3 font-bold text-blue-600">Order Summary</h6>
                <div className="flex justify-between mb-2"><span>Subtotal:</span><span>â‚¹{formData.subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between items-center mb-2 text-red-500 text-sm">
                  <span className="flex items-center gap-2">Discount:
                    <div className="w-24 [&_.mb-\[18px\]]:!mb-0 [&_.select-input-group]:!mb-0">
                      <SelectInput label="" name="discountType" options={[{ value: "PERCENT", label: "%" }, { value: "FLAT", label: "Flat" }]} value={formData.discountType || "PERCENT"} onChange={(e) => { setFormData(prev => { const newTotals = recalculateTotals(prev.items, e.target.value as any, prev.discountValue); return { ...prev, discountType: e.target.value as any, ...newTotals }; }); }} disabled={isLocked} hideLabel />
                    </div>
                    <div className="w-24 [&_.mb-\[18px\]]:!mb-0">
                      <TextInput label="" name="discountValue" type="number" min={0} step={0.01} value={String(formData.discountValue || 0)} onChange={(e) => { setFormData(prev => { const newTotals = recalculateTotals(prev.items, prev.discountType, Number(e.target.value) || 0); return { ...prev, discountValue: Number(e.target.value) || 0, ...newTotals }; }); }} disabled={isLocked} />
                    </div>
                  </span>
                  <span>-â‚¹{(formData.totalDiscount || 0).toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center mb-2 text-green-600 text-sm"><span>Total Tax:</span><span>â‚¹{formData.totalTax.toFixed(2)}</span></div>

                <div className="flex justify-between items-center mb-2 text-gray-600 text-sm">
                  <span className="flex items-center gap-2">Round Off:
                    <div className="flex items-center bg-white rounded border overflow-hidden h-[35px]">
                      <button type="button" onClick={() => { if (isLocked) return; setRoundingSign("+"); setFormData(prev => ({ ...prev, ...recalculateTotals(prev.items, prev.discountType, prev.discountValue, "+", roundingValue) })); }} className={`px-2 py-1 h-full font-bold ${roundingSign === "+" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"}`} disabled={isLocked}>+</button>
                      <button type="button" onClick={() => { if (isLocked) return; setRoundingSign("-"); setFormData(prev => ({ ...prev, ...recalculateTotals(prev.items, prev.discountType, prev.discountValue, "-", roundingValue) })); }} className={`px-2 py-1 h-full font-bold ${roundingSign === "-" ? "bg-red-500 text-white" : "bg-gray-100 text-gray-600"}`} disabled={isLocked}>-</button>
                    </div>
                    <div className="w-24 [&_.mb-\[18px\]]:!mb-0">
                      <TextInput label="" name="roundingValue" type="number" min={0} step={0.01} value={String(roundingValue || 0)} onChange={(e) => { const val = Number(e.target.value) || 0; setRoundingValue(val); setFormData(prev => ({ ...prev, ...recalculateTotals(prev.items, prev.discountType, prev.discountValue, roundingSign, val) })); }} disabled={isLocked} />
                    </div>
                  </span>
                  <span>{roundingSign === "+" ? "+" : "-"}â‚¹{(roundingValue || 0).toFixed(2)}</span>
                </div>
                {isInterState ? (
                  <div className="flex justify-between mb-2 text-green-600 text-sm"><span>Total IGST:</span><span>+â‚¹{(formData.totalIgst ?? 0).toFixed(2)}</span></div>
                ) : (
                  <>
                    <div className="flex justify-between mb-2 text-green-600 text-sm"><span>Total CGST:</span><span>+â‚¹{(formData.totalCgst ?? 0).toFixed(2)}</span></div>
                    <div className="flex justify-between mb-2 text-green-600 text-sm"><span>Total SGST:</span><span>+â‚¹{(formData.totalSgst ?? 0).toFixed(2)}</span></div>
                  </>
                )}
                <hr className="my-2 border-gray-300" />
                <div className="flex justify-between font-bold"><span>Net Amount:</span><span>â‚¹{formData.netAmount.toFixed(2)}</span></div>
              </div>
            </div>
          </div>

          {!isLocked && (
            <div className="flex flex-wrap justify-end gap-3 mt-8 pt-4 border-t border-gray-200">
              <CustomButton text={isSubmitting ? "Saving..." : "Save as Draft"} icon={isSubmitting ? undefined : FaSave} onClick={(e: any) => handleSubmit(e, "DRAFT")} type="button" disabled={isSubmitting || isSubmittingForApproval} />
              <CustomButton text={isSubmittingForApproval ? "Submitting..." : "Submit for Approval"} icon={isSubmittingForApproval ? undefined : FaPaperPlane} onClick={(e: any) => handleSubmit(e, "PENDING")} type="button" disabled={isSubmitting || isSubmittingForApproval} className="btn-success" />
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default PurchaseOrderEditPage;