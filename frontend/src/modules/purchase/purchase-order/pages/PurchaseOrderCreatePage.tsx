import React, { useState, useEffect, useMemo } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaSave, FaPaperPlane, FaPlus, FaTrash, FaUser, FaMapMarkerAlt, FaBoxOpen, FaInfoCircle } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";

import TextInput from "../../../../components/form/TextInput/TextInput";
import SelectInput from "../../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../../components/ui/custombutton/CustomButton";
import CityStateSelect from "../../../../components/ui/CityStateSelect/CityStateSelect";
import type { StateCityOption } from "../../../../components/ui/CityStateSelect/CityStateSelect";

import { validatePurchaseOrder } from "../validations/purchaseOrderValidation";
import type { PurchaseOrderItem } from "../../../../features/purchaseOrder/types";
import { useSuppliers } from "../../../../hooks/useSuppliers";
import { rawMaterialService } from "../../../../services/rawMaterialService";
import type { RawMaterial } from "../../../../features/raw-materials/types";
import { usePurchaseOrders } from "../../../../hooks/usePurchaseOrder";
import { purchaseOrderService } from "../../../../services/purchaseOrderService";
import Section from "../../../../components/ui/Section/Section";
import { useAppDispatch, useAppSelector } from "../../../../hooks/reduxHooks";
import { fetchLocations } from "../../../../features/locations/locationSlice";
import { selectActiveGstTaxes, fetchGstTaxes } from "../../../../features/gst/gstSlice";
import { fetchStores } from "../../../../features/stores/storeSlice";

// ─── Report-style Section wrapper (matches QuotationForm) ──────────────────


const initialFormData = {
  poNumber: "",
  poDate: new Date().toISOString().split("T")[0],
  expectedDeliveryDate: "",
  supplierId: "",
  locationId: "",
  status: "DRAFT" as const,
  createdByOn: "",

  billingAddressLine1: "",
  billingCity: "",
  billingState: "",
  billingPincode: "",
  shippingAddressLine1: "",
  shippingCity: "",
  shippingState: "",
  shippingPincode: "",

  remarks: "",

  items: [] as PurchaseOrderItem[],

  subtotal: 0,
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
  const companyState = company?.state
  const gstTaxes = useAppSelector(selectActiveGstTaxes);
  const gstLoading = useAppSelector((state) => state.gst.loading);

  const selectedSupplier = useMemo(() => (suppliers || []).find(
    (s) => String(s?.id) === String(formData.supplierId)
  ), [suppliers, formData.supplierId]);

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
  }, [loadSuppliers, dispatch]);

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

  // ============================================================
  // CALCULATE TOTALS
  // ============================================================
  const recalculateTotals = (items: PurchaseOrderItem[], interState: boolean = isInterState) => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    items.forEach((item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      const lineSubtotal = qty * price;

      const discountType = item.discountType || "PERCENT";
      const discountValue = Number(item.discountValue ?? item.discount) || 0;
      let discountAmount = 0;
      if (discountType === "PERCENT") {
        discountAmount = (lineSubtotal * discountValue) / 100;
      } else {
        discountAmount = discountValue;
      }
      if (discountAmount > lineSubtotal) {
        discountAmount = lineSubtotal;
      }

      const taxableAmount = lineSubtotal - discountAmount;
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
      totalDiscount += discountAmount;
      totalTax += totalGstAmount;
      totalCgst += cgstAmount;
      totalSgst += sgstAmount;
      totalIgst += igstAmount;
    });

    return {
      subtotal,
      totalDiscount,
      totalTax,
      totalCgst,
      totalSgst,
      totalIgst,
      netAmount: subtotal - totalDiscount + totalTax,
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

        const discountType = item.discountType || "PERCENT";
        const discountValue = Number(item.discountValue ?? item.discount) || 0;
        let discountAmount = 0;
        if (discountType === "PERCENT") {
          discountAmount = (lineSubtotal * discountValue) / 100;
        } else {
          discountAmount = discountValue;
        }
        if (discountAmount > lineSubtotal) {
          discountAmount = lineSubtotal;
        }

        const taxableAmount = lineSubtotal - discountAmount;
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
          discountAmount,
          taxableAmount,
          cgstRate,
          cgstAmount,
          sgstRate,
          sgstAmount,
          igstRate,
          igstAmount,
          lineTotal: taxableAmount + totalGstAmount,
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
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === "supplierId") {
      const selectedSup = suppliers.find((s) => String(s.id) === String(value));
      setFormData((prev) => ({
        ...prev,
        supplierId: value,
        shippingAddressLine1: selectedSup?.billingAddressLine1 || "",
        shippingCity: selectedSup?.billingCity || "",
        shippingState: selectedSup?.billingState || "",
        shippingPincode: selectedSup?.billingPincode || "",
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

    if (name === "locationId") {
      const selectedStore = (stores || []).find((s) => String(s.storeId) === String(value));
      setFormData((prev) => ({
        ...prev,
        locationId: value,
        billingAddressLine1: selectedStore?.location?.address || "",
        billingCity: selectedStore?.location?.city || "",
        billingState: selectedStore?.location?.state || "",
        billingPincode: "625017",
      }));
      if (errors.locationId) {
        setErrors((prev) => ({ ...prev, locationId: "" }));
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

          const discountType = item.discountType || "PERCENT";
          const discountValue = Number(item.discountValue ?? item.discount) || 0;
          let discountAmount = 0;
          if (discountType === "PERCENT") {
            discountAmount = (lineSubtotal * discountValue) / 100;
          } else {
            discountAmount = discountValue;
          }
          if (discountAmount > lineSubtotal) {
            discountAmount = lineSubtotal;
          }

          const taxableAmount = lineSubtotal - discountAmount;
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
            discount: discountType === "PERCENT" ? discountValue : 0,
            discountAmount,
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

  const handleBillingStateChange = (stateData: StateCityOption) => {
    setFormData((prev) => ({
      ...prev,
      billingState: stateData.name,
      billingCity: "",
    }));
    setErrors((prev) => ({
      ...prev,
      billingState: "",
      billingCity: "",
    }));
  };

  const handleBillingCityChange = (cityData: StateCityOption) => {
    setFormData((prev) => ({ ...prev, billingCity: cityData.name }));
    setErrors((prev) => ({ ...prev, billingCity: "" }));
  };

  const handleShippingStateChange = (stateData: StateCityOption) => {
    setFormData((prev) => ({
      ...prev,
      shippingState: stateData.name,
      shippingCity: "",
    }));
    setErrors((prev) => ({
      ...prev,
      shippingState: "",
      shippingCity: "",
    }));
  };

  const handleShippingCityChange = (cityData: StateCityOption) => {
    setFormData((prev) => ({ ...prev, shippingCity: cityData.name }));
    setErrors((prev) => ({ ...prev, shippingCity: "" }));
  };

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

      const discountType = item.discountType || "PERCENT";
      const discountValue = Number(item.discountValue ?? item.discount) || 0;
      let discountAmount = 0;
      if (discountType === "PERCENT") {
        discountAmount = (lineSubtotal * discountValue) / 100;
      } else {
        discountAmount = discountValue;
      }
      if (discountAmount > lineSubtotal) {
        discountAmount = lineSubtotal;
      }

      const taxableAmount = lineSubtotal - discountAmount;
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
        discount: discountType === "PERCENT" ? discountValue : 0,
        discountAmount,
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

      const discountType = item.discountType || "PERCENT";
      const discountValue = Number(item.discountValue ?? item.discount) || 0;
      let discountAmount = 0;
      if (discountType === "PERCENT") {
        discountAmount = (lineSubtotal * discountValue) / 100;
      } else {
        discountAmount = discountValue;
      }
      if (discountAmount > lineSubtotal) {
        discountAmount = lineSubtotal;
      }

      const taxableAmount = lineSubtotal - discountAmount;
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
        uom: rawMaterial?.baseUom || "",
        tax: totalGstRate,
        discount: discountType === "PERCENT" ? discountValue : 0,
        discountAmount,
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
          discount: 0,
          tax: 0,
          discountType: "PERCENT" as const,
          discountValue: 0,
          discountAmount: 0,
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
        billingCity: formData.billingCity,
        billingState: formData.billingState,
        billingPincode: formData.billingPincode,
        shippingAddressLine1: formData.shippingAddressLine1,
        shippingCity: formData.shippingCity,
        shippingState: formData.shippingState,
        shippingPincode: formData.shippingPincode,
        remarks: formData.remarks,

        items: formData.items.map((item) => ({
          productId: item.productId,
          uom: item.uom,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount || 0,
          tax: item.tax || 0,
          discountType: item.discountType || "PERCENT",
          discountValue: Number(item.discountValue ?? item.discount) || 0,
          discountAmount: item.discountAmount || 0,
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

  const uomOptions = useMemo(() => {
    const allUoms = (rawMaterials || [])
      .map((rm) => rm.baseUom)
      .filter(Boolean)
      .flatMap((uom) => uom!.split(",").map((s) => s.trim()));

    const uniqueUoms = Array.from(new Set(allUoms));

    return [
      { value: "", label: "-- Select UOM --" },
      ...uniqueUoms.map((uom) => ({
        value: uom as string,
        label: uom as string,
      }))
    ];
  }, [rawMaterials]);

  const supplierMaterials = selectedSupplier?.category
    ? selectedSupplier.category.split(",").map((c: string) => c.trim().toLowerCase())
    : [];

  const filteredRawMaterials = rawMaterials.filter((rm) =>
    rm?.materialName && supplierMaterials.includes(rm.materialName.toLowerCase())
  );

  const productOptions = filteredRawMaterials.map((rm) => ({
    value: rm.rawMaterialId || "",
    label: `${rm.rawMaterialId || ""} - ${rm.materialName || ""}`,
  }));

  // ============================================================
  // UI
  // ============================================================
  return (
    <div className="inner-container">
      <Container fluid>
        {/* Page Header */}
        <div className="page-header">
          <Row className="align-items-center g-3">
            <Col lg={6} md={12}>
              <div className="page-header-info">
                <h2 className="page-title">Create Purchase Order</h2>
                <div className="page-breadcrumb">Home / Purchase / Purchase Orders / Create</div>
              </div>
            </Col>
          </Row>
        </div>

        <form className="form-inner" noValidate>
          {/* ── Order Information ── */}
          <Section title="Order Information" icon={<FaInfoCircle />}>
            <Row>
              <Col lg={4} md={6}>
                <TextInput
                  label="PO Number"
                  name="poNumber"
                  value={formData.poNumber}
                  onChange={handleChange}
                  disabled
                />
              </Col>

              <Col lg={4} md={6}>
                <TextInput
                  label="PO Date"
                  name="poDate"
                  type="date"
                  value={formData.poDate}
                  onChange={handleChange}
                  required
                />
                {errors.poDate && <div className="text-danger mt-1">{errors.poDate}</div>}
              </Col>

              <Col lg={4} md={6}>
                <TextInput
                  label="Expected Delivery Date"
                  name="expectedDeliveryDate"
                  type="date"
                  value={formData.expectedDeliveryDate}
                  onChange={handleChange}
                  required
                />
                {errors.expectedDeliveryDate && (
                  <div className="text-danger mt-1">{errors.expectedDeliveryDate}</div>
                )}
              </Col>
            </Row>
          </Section>

          {/* ── Supplier ── */}
          <Section title="Supplier" icon={<FaUser />}>
            <Row className="g-3">
              {/* Store */}
              <Col lg={6} md={12}>
                <SelectInput
                  label="Store"
                  name="locationId"
                  value={formData.locationId}
                  options={[
                    { label: "-- Select Store --", value: "" },
                    ...(stores || []).filter((s) => s.isActive).map((s) => ({
                      label: s.storeName,
                      value: s.storeId
                    }))
                  ]}
                  required
                  error={errors.locationId}
                  onChange={handleChange}
                />
              </Col>

              {/* Supplier */}
              <Col lg={6} md={12}>
                <SelectInput
                  label="Supplier"
                  name="supplierId"
                  value={formData.supplierId}
                  options={[{ value: "", label: "-- Select Supplier --" }, ...supplierOptions]}
                  onChange={handleChange}
                  required
                />
                {errors.supplierId && <div className="text-danger mt-1">{errors.supplierId}</div>}
              </Col>
            </Row>
          </Section>

          {/* ── Addresses ── */}
          <Section title="Delivery & Shipping Address" icon={<FaMapMarkerAlt />}>
            <Row>
              {/* Delivery Address — auto-populated from warehouse */}
              <Col lg={6}>
                <h6 className="mb-3">Delivery Address</h6>
                <TextInput
                  label="Address Line"
                  name="billingAddressLine1"
                  value={formData.billingAddressLine1}
                  onChange={handleChange}
                  required
                />
                {errors.billingAddressLine1 && (
                  <div className="text-danger mt-1">{errors.billingAddressLine1}</div>
                )}
                <Row>
                  <CityStateSelect
                    stateLabel="State"
                    cityLabel="City"
                    stateValue={formData.billingState}
                    cityValue={formData.billingCity}
                    onStateChange={handleBillingStateChange}
                    onCityChange={handleBillingCityChange}
                    stateError={errors.billingState}
                    cityError={errors.billingCity}
                    required
                  />
                  <Col md={4}>
                    <TextInput
                      label="Pincode"
                      name="billingPincode"
                      value={formData.billingPincode}
                      onChange={handleChange}
                      required
                    />
                    {errors.billingPincode && (
                      <div className="text-danger mt-1">{errors.billingPincode}</div>
                    )}
                  </Col>
                </Row>
              </Col>

              <Col lg={6}>
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <h6 className="mb-0">Shipping Address</h6>
                </div>
                <TextInput
                  label="Address Line"
                  name="shippingAddressLine1"
                  value={formData.shippingAddressLine1}
                  onChange={handleChange}
                />
                {errors.shippingAddressLine1 && (
                  <div className="text-danger mt-1">{errors.shippingAddressLine1}</div>
                )}
                <Row>
                  <CityStateSelect
                    stateLabel="State"
                    cityLabel="City"
                    stateValue={formData.shippingState}
                    cityValue={formData.shippingCity}
                    onStateChange={handleShippingStateChange}
                    onCityChange={handleShippingCityChange}
                    stateError={errors.shippingState}
                    cityError={errors.shippingCity}
                  />
                  <Col md={4}>
                    <TextInput
                      label="Pincode"
                      name="shippingPincode"
                      value={formData.shippingPincode}
                      onChange={handleChange}
                    />
                    {errors.shippingPincode && (
                      <div className="text-danger mt-1">{errors.shippingPincode}</div>
                    )}
                  </Col>
                </Row>
              </Col>
            </Row>
          </Section>

          {/* ── Items ── */}
          <Section title="Items" icon={<FaBoxOpen />}>
            <div className="d-flex justify-content-end mb-3">
              <CustomButton text="Add Item" icon={FaPlus} onClick={addItem} type="button" size="sm" />
            </div>

            {/*
              No horizontal scroll: table-layout fixed + percentage-based
              column widths that always add up to 100% of the container,
              and no forced min-widths on inner inputs.
            */}
            <div className="table-wrap" style={{ width: "100%", overflowX: "hidden" }}>
              <table
                className="master-data-table"
                style={{ width: "100%", tableLayout: "fixed" }}
              >
                <colgroup>
                  <col style={{ width: "4%" }} />
                  <col style={{ width: "26%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "8%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>RAW MATERIAL</th>
                    <th>UOM</th>
                    <th>QTY</th>
                    <th>UNIT PRICE (₹)</th>
                    <th>TAX %</th>
                    <th>TAXABLE (₹)</th>
                    <th>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items.map((item, index) => {
                    const qty = Number(item.quantity) || 0;
                    const price = Number(item.unitPrice) || 0;
                    const lineSubtotal = qty * price;

                    const discountType = item.discountType || "PERCENT";
                    const discountValue = Number(item.discountValue ?? item.discount) || 0;
                    let discountAmount = 0;
                    if (discountType === "PERCENT") {
                      discountAmount = (lineSubtotal * discountValue) / 100;
                    } else {
                      discountAmount = discountValue;
                    }
                    if (discountAmount > lineSubtotal) {
                      discountAmount = lineSubtotal;
                    }

                    const taxableAmount = lineSubtotal - discountAmount;

                    return (
                      <tr key={index} className="master-data-row">
                        <td className="master-data-cell text-center fw-semibold">
                          {index + 1}
                        </td>

                        <td className="master-data-cell">
                          <SelectInput
                            label=""
                            name={`items[${index}].productId`}
                            value={item.productId ? String(item.productId) : ""}
                            options={[{ value: "", label: "-- Select Material --" }, ...productOptions]}
                            onChange={(e) => handleItemProductChange(index, e.target.value)}
                            error={errors[`items.${index}.productId`]}
                          />
                        </td>

                        <td className="master-data-cell">
                          <SelectInput
                            label=""
                            name={`items[${index}].uom`}
                            options={uomOptions}
                            value={item.uom || ""}
                            onChange={(e) => handleItemChange(index, "uom", e.target.value)}
                            error={errors[`items.${index}.uom`]}
                          />
                        </td>

                        <td className="master-data-cell">
                          <TextInput
                            label=""
                            name={`items[${index}].quantity`}
                            type="number"
                            value={String(item.quantity)}
                            onChange={(e) => handleItemChange(index, "quantity", Number(e.target.value))}
                            error={errors[`items.${index}.quantity`]}
                            min={0.01}
                            step={0.01}
                            placeholder="0.00"
                          />
                        </td>

                        <td className="master-data-cell">
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
                            disabled
                          />
                        </td>

                        <td className="master-data-cell">
                          <SelectInput
                            label=""
                            name={`items[${index}].tax`}
                            options={gstOptions}
                            value={String(item.tax || 0)}
                            onChange={(e) => handleItemChange(index, "tax", Number(e.target.value))}
                          />
                        </td>

                        <td className="master-data-cell text-end">
                          ₹{taxableAmount.toFixed(2)}
                        </td>

                        <td className="master-data-cell text-center">
                          <CustomButton
                            text=""
                            icon={FaTrash}
                            onClick={() => removeItem(index)}
                            type="button"
                            variant="danger"
                            size="sm"
                          />
                        </td>
                      </tr>
                    );
                  })}

                  {formData.items.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center text-muted py-4">
                        No items added — click "Add Item" to begin
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          {/* ── Remarks + Summary ── */}
          <Section title="Notes & Summary">
            <Row>
              <Col lg={6}>
                <TextInput
                  label="Remarks"
                  name="remarks"
                  as="textarea"
                  rows={3}
                  value={formData.remarks}
                  onChange={handleChange}
                />
              </Col>
              <Col lg={{ span: 5, offset: 1 }}>
                <div
                  className="p-3"
                  style={{
                    background: "var(--color-bg, #f8f9fa)",
                    borderRadius: "var(--radius-md, 8px)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <h6 className="mb-3 fw-bold" style={{ color: "var(--color-primary)" }}>Order Summary</h6>
                  <div className="d-flex justify-content-between mb-2">
                    <span>Subtotal:</span>
                    <span>₹{formData.subtotal.toFixed(2)}</span>
                  </div>

                  {isInterState ? (
                    <div className="d-flex justify-content-between mb-2 text-success small">
                      <span>Total IGST:</span>
                      <span>+₹{formData.totalIgst.toFixed(2)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="d-flex justify-content-between mb-2 text-success small">
                        <span>Total CGST:</span>
                        <span>+₹{formData.totalCgst.toFixed(2)}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-2 text-success small">
                        <span>Total SGST:</span>
                        <span>+₹{formData.totalSgst.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  <div className="d-flex justify-content-between mb-2 text-success fw-bold">
                    <span>Total Tax:</span>
                    <span>+₹{formData.totalTax.toFixed(2)}</span>
                  </div>
                  <hr />
                  <div className="d-flex justify-content-between fw-bold">
                    <span>Net Amount:</span>
                    <span>₹{formData.netAmount.toFixed(2)}</span>
                  </div>
                </div>
              </Col>
            </Row>
          </Section>

          {/* ── Form Actions ── */}
          <div
            className="form-actions d-flex justify-content-end gap-3 mt-4"
            style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1.5rem" }}
          >
            <CustomButton
              text={isSubmitting ? "Saving..." : "Save as Draft"}
              icon={isSubmitting ? undefined : FaSave}
              onClick={(e: React.FormEvent) => handleSubmit(e, "DRAFT")}
              type="button"
              disabled={isSubmitting || isSubmittingForApproval}
            />
            <CustomButton
              text={isSubmittingForApproval ? "Submitting..." : "Submit for Approval"}
              icon={isSubmittingForApproval ? undefined : FaPaperPlane}
              onClick={(e: React.FormEvent) => handleSubmit(e, "PENDING")}
              type="button"
              disabled={isSubmitting || isSubmittingForApproval}
              className="btn-success"
            />
          </div>
        </form>
      </Container>
    </div >
  );
};

export default PurchaseOrderCreatePage;