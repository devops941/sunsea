import React, { useState, useEffect, useMemo } from "react";
import { Container, Row, Col, Table, Spinner } from "react-bootstrap";
import { FaSave, FaPlus, FaTrash, FaInfoCircle, FaUser, FaMapMarkerAlt, FaBoxOpen, FaPaperPlane } from "react-icons/fa";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import { useAppDispatch, useAppSelector } from "../../../../hooks/reduxHooks";
import { fetchLocations } from "../../../../features/locations/locationSlice";
import { selectActiveGstTaxes, fetchGstTaxes } from "../../../../features/gst/gstSlice";

import TextInput from "../../../../components/form/TextInput/TextInput";
import SelectInput from "../../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../../components/ui/custombutton/CustomButton";
import CityStateSelect from "../../../../components/ui/CityStateSelect/CityStateSelect";
import type { StateCityOption } from "../../../../components/ui/CityStateSelect/CityStateSelect";
import { usePurchaseOrders } from "../../../../hooks/usePurchaseOrder";
import { purchaseOrderService } from "../../../../services/purchaseOrderService";
import { validatePurchaseOrder } from "../validations/purchaseOrderValidation";
import type { PurchaseOrderFormData, PurchaseOrderItem } from "../../../../features/purchaseOrder/types";
import { useSuppliers } from "../../../../hooks/useSuppliers";
import { rawMaterialService } from "../../../../services/rawMaterialService";
import type { RawMaterial } from "../../../../features/raw-materials/types";
import Section from "../../../../components/ui/Section/Section";
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
      quantity: i.quantity ?? 0,
      unitPrice: i.unitPrice ?? 0,
      discount: i.discount ?? 0,
      tax: i.tax ?? 0,
      discountType: i.discountType ?? "PERCENT",
      discountValue: i.discountValue ?? i.discount ?? 0,
      discountAmount: i.discountAmount ?? 0,
      taxableAmount: i.taxableAmount ?? 0,
      cgstRate: i.cgstRate ?? 0,
      cgstAmount: i.cgstAmount ?? 0,
      sgstRate: i.sgstRate ?? 0,
      sgstAmount: i.sgstAmount ?? 0,
      igstRate: i.igstRate ?? 0,
      igstAmount: i.igstAmount ?? 0,
      lineTotal: i.lineTotal ?? 0,
    })) ?? [],

    subtotal: Number(po.subtotal ?? 0),
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

  const companyState = company?.state;
  const gstTaxes = useAppSelector(selectActiveGstTaxes);
  const gstLoading = useAppSelector((state) => state.gst.loading);

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
  const { users, loadUsers } = useUsers();
  const createdOn = users.find(
    (u: any) => u.userId === formData?.createdByOn
  )?.username;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingForApproval, setIsSubmittingForApproval] = useState(false);


  // ============================================================
  // LOAD DATA
  // ============================================================
  useEffect(() => {
    loadSuppliers();
    loadUsers();
    dispatch(fetchLocations(undefined));
    dispatch(fetchGstTaxes(undefined));
  }, [loadSuppliers, loadUsers, dispatch]);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const materials = await rawMaterialService.fetchAll();

        if (!mounted) return;

        setRawMaterials(materials ?? []);

        if (location.state) {
          setFormData(mapPOToFormData(location.state));
        } else if (id) {
          const po = await purchaseOrderService.fetchById(id);
          if (mounted) setFormData(mapPOToFormData(po));
        }
      } catch {
        toast.error("Failed to load purchase order");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [id, location.state]);

  // ============================================================
  // CALCULATE TOTALS
  // ============================================================
  const recalculateTotals = (items: PurchaseOrderItem[]) => {
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

      if (isInterState) {
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
  // HANDLE CHANGE
  // ============================================================
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

    setFormData((prev) => ({ ...prev, [name]: value }));
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
          ? {
            id: rawMaterial.rawMaterialId,
            productCode: rawMaterial.rawMaterialId,
            productName: rawMaterial.materialName,
            unit: rawMaterial.baseUom,
            unitPrice: parsedUnitPrice,
          }
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
  // LOADING UI
  // ============================================================
  if (loading) {
    return (
      <div className="inner-container d-flex justify-content-center align-items-center" style={{ minHeight: "300px" }}>
        <Spinner animation="border" />
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


  const supplierMaterials = selectedSupplier?.category
    ? selectedSupplier.category.split(",").map((c: string) => c.trim().toLowerCase())
    : [];

  const filteredRawMaterials = rawMaterials.filter((rm) => {
    const isSupplierMaterial = rm?.materialName && supplierMaterials.includes(rm.materialName.toLowerCase());
    const isAlreadyInItems = formData.items.some((item) => item.productId === rm.rawMaterialId);
    return isSupplierMaterial || isAlreadyInItems;
  });

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



  const isLocked = formData.status !== "DRAFT" && formData.status !== "PENDING";

  // ============================================================
  // UI
  // ============================================================
  return (
    <div className="inner-container">
      <Container fluid>
        <div className="page-header">
          <Row className="align-items-center g-3">
            <Col lg={6} md={12}>
              <div className="page-header-info">
                <h2 className="page-title">Edit Purchase Order</h2>
                <div className="page-breadcrumb">Home / Purchase / Purchase Orders / Edit</div>
              </div>
            </Col>
          </Row>
        </div>

        <form>
          {/* ── Order Information ── */}
          <Section title="Order Information" icon={<FaInfoCircle />}>
            <Row>
              <Col lg={4} md={6}>
                <TextInput label="PO Number" name="poNumber" value={formData.poNumber} onChange={() => { }} disabled />
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

              <Col lg={4} md={6}>
                <SelectInput
                  label="Status"
                  name="status"
                  value={formData.status}
                  options={statusOptions}
                  onChange={handleChange}
                />
              </Col>

              <Col lg={4} md={6}>
                <TextInput
                  label="Created by-on"
                  name="createdByOn"
                  value={createdOn || ""}
                  onChange={() => { }}
                  disabled
                />
              </Col>
            </Row>
          </Section>

          {/* ── Supplier ── */}
          <Section title="Supplier" icon={<FaUser />}>
            <Row>
              <Col lg={6} md={12}>
                <SelectInput
                  label="Supplier"
                  name="supplierId"
                  value={String(formData.supplierId ?? "")}
                  options={[{ value: "", label: "-- Select Supplier --" }, ...supplierOptions]}
                  onChange={handleChange}
                  required
                  disabled={formData.status !== "DRAFT"}
                />
                {errors.supplierId && <div className="text-danger mt-1">{errors.supplierId}</div>}
              </Col>
            </Row>
          </Section>

          {/* ── Addresses ── */}
          <Section title="Billing & Shipping Address" icon={<FaMapMarkerAlt />}>
            <Row>
              <Col lg={6}>
                <h6 className="mb-3">Billing Address</h6>
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
                    {errors.billingPincode && <div className="text-danger mt-1">{errors.billingPincode}</div>}
                  </Col>
                </Row>
              </Col>

              <Col lg={6}>
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <h6 className="mb-0">Shipping Address</h6>
                  <div>
                    <input
                      type="checkbox"
                      name="sameAsBilling"
                      checked={formData.sameAsBilling}
                      onChange={handleChange}
                    />{" "}
                    Same as billing
                  </div>
                </div>
                <TextInput
                  label="Address Line"
                  name="shippingAddressLine1"
                  value={formData.shippingAddressLine1}
                  onChange={handleChange}
                  disabled={formData.sameAsBilling}
                  required={!formData.sameAsBilling}
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
                    required={!formData.sameAsBilling}
                    disabled={formData.sameAsBilling}
                  />
                  <Col md={4}>
                    <TextInput
                      label="Pincode"
                      name="shippingPincode"
                      value={formData.shippingPincode}
                      onChange={handleChange}
                      disabled={formData.sameAsBilling}
                      required={!formData.sameAsBilling}
                    />
                    {errors.shippingPincode && <div className="text-danger mt-1">{errors.shippingPincode}</div>}
                  </Col>
                </Row>
              </Col>
            </Row>
          </Section>

          {/* ── Items ── */}
          <Section title="Items" icon={<FaBoxOpen />}>
            <div className="d-flex justify-content-end mb-3">
              <CustomButton
                text="Add Item"
                icon={FaPlus}
                onClick={addItem}
                type="button"
                size="sm"
                disabled={isLocked}
              />
            </div>

            <div className="table-wrap" style={{ overflowX: "auto" }}>
              <Table bordered hover style={{ minWidth: "1200px" }}>
                <thead>
                  <tr>
                    <th style={{ width: "50px" }}>#</th>
                    <th style={{ minWidth: "220px" }}>RAW MATERIAL</th>
                    <th style={{ minWidth: "100px" }}>UOM</th>
                    <th style={{ minWidth: "100px" }}>QTY</th>
                    <th style={{ minWidth: "120px" }}>UNIT PRICE (₹)</th>
                    <th style={{ minWidth: "115px" }}>TAX %</th>
                    <th style={{ minWidth: "120px" }}>TAXABLE (₹)</th>
                    <th>Action</th>
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
                      <tr key={index}>
                        <td>{index + 1}</td>
                        <td>
                          <SelectInput
                            label=""
                            name={`items[${index}].productId`}
                            value={item.productId || ""}
                            options={[{ value: "", label: "-- Select Material --" }, ...productOptions]}
                            onChange={(e) => handleItemProductChange(index, e.target.value)}
                            error={errors[`items.${index}.productId`]}
                            disabled={isLocked}
                          />
                        </td>
                        <td>
                          <TextInput
                            label=""
                            name={`items[${index}].uom`}
                            value={item.uom || ""}
                            onChange={() => { }}
                            disabled
                            placeholder="—"
                          />
                        </td>
                        <td>
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
                            disabled={isLocked}
                          />
                        </td>
                        <td>
                          <TextInput
                            label=""
                            name={`items[${index}].unitPrice`}
                            type="number"
                            value={String(item.unitPrice)}
                            onChange={(e) => handleItemChange(index, "unitPrice", Number(e.target.value))}
                            error={errors[`items.${index}.unitPrice`]}
                            min={0}
                            step={0.01}
                            disabled
                            placeholder="0.00"
                          />
                        </td>

                        <td>
                          <SelectInput
                            label=""
                            name={`items[${index}].tax`}
                            options={gstOptions}
                            value={String(item.tax || 0)}
                            onChange={(e) => handleItemChange(index, "tax", Number(e.target.value))}
                            disabled={isLocked}
                          />
                        </td>
                        <td className="text-end">
                          ₹{taxableAmount.toFixed(2)}
                        </td>
                        <td>
                          <CustomButton
                            text=""
                            icon={FaTrash}
                            onClick={() => removeItem(index)}
                            type="button"
                            variant="danger"
                            size="sm"
                            disabled={isLocked}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {formData.items.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center">No items added</td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          </Section>

          {/* ── Notes & Summary ── */}
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
                      <span>+₹{(formData.totalIgst ?? 0).toFixed(2)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="d-flex justify-content-between mb-2 text-success small">
                        <span>Total CGST:</span>
                        <span>+₹{(formData.totalCgst ?? 0).toFixed(2)}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-2 text-success small">
                        <span>Total SGST:</span>
                        <span>+₹{(formData.totalSgst ?? 0).toFixed(2)}</span>
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
    </div>
  );
};

export default PurchaseOrderEditPage;