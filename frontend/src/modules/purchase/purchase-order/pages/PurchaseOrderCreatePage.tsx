import React, { useState, useEffect } from "react";
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

// ─── Report-style Section wrapper (matches QuotationForm) ──────────────────


const initialFormData = {
  poNumber: "",
  poDate: new Date().toISOString().split("T")[0],
  expectedDeliveryDate: "",
  supplierId: "",
  status: "DRAFT" as const,
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

  items: [] as PurchaseOrderItem[],

  subtotal: 0,
  totalDiscount: 0,
  totalTax: 0,
  netAmount: 0,
};

type PurchaseOrderFormData = typeof initialFormData;

const PurchaseOrderCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { addPurchaseOrder } = usePurchaseOrders();
  const user = useSelector((state: any) => state?.auth?.user);

  const [formData, setFormData] = useState<PurchaseOrderFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { suppliers, loadSuppliers } = useSuppliers();
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingForApproval, setIsSubmittingForApproval] = useState(false);

  // ============================================================
  // FETCH DATA
  // ============================================================
  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

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
  const recalculateTotals = (items: PurchaseOrderItem[]) => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    items.forEach((item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      const lineTotal = qty * price;
      const discountAmount = (lineTotal * (Number(item.discount) || 0)) / 100;
      const taxAmount = ((lineTotal - discountAmount) * (Number(item.tax) || 0)) / 100;

      subtotal += lineTotal;
      totalDiscount += discountAmount;
      totalTax += taxAmount;
    });

    return {
      subtotal,
      totalDiscount,
      totalTax,
      netAmount: subtotal - totalDiscount + totalTax,
    };
  };

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
        billingAddressLine1: selectedSup?.billingAddressLine1 || "",
        billingCity: selectedSup?.billingCity || "",
        billingState: selectedSup?.billingState || "",
        billingPincode: selectedSup?.billingPincode || "",
        items: [],
        subtotal: 0,
        totalDiscount: 0,
        totalTax: 0,
        netAmount: 0,
      }));
      if (errors.supplierId) {
        setErrors((prev) => ({ ...prev, supplierId: "" }));
      }
      return;
    }

    if (name === "sameAsBilling") {
      const checked = (e.target as HTMLInputElement).checked;

      setFormData((prev) => ({
        ...prev,
        sameAsBilling: checked,
        ...(checked
          ? {
            shippingAddressLine1: prev.billingAddressLine1,
            shippingCity: prev.billingCity,
            shippingState: prev.billingState,
            shippingPincode: prev.billingPincode,
          }
          : {
            shippingAddressLine1: "",
            shippingCity: "",
            shippingState: "",
            shippingPincode: "",
          }),
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
          const base = qty * parsedUnitPrice;
          const discountAmt = (base * (Number(item.discount) || 0)) / 100;
          const taxAmt = ((base - discountAmt) * (Number(item.tax) || 0)) / 100;

          return {
            ...item,
            unitPrice: parsedUnitPrice,
            lineTotal: base - discountAmt + taxAmt,
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
      const base = qty * price;
      const discountAmt = (base * (Number(item.discount) || 0)) / 100;
      const taxAmt = ((base - discountAmt) * (Number(item.tax) || 0)) / 100;
      items[index].lineTotal = base - discountAmt + taxAmt;

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

      const items = [...prev.items];
      items[index] = {
        ...items[index],
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
      };

      const qty = Number(items[index].quantity) || 0;
      const base = qty * parsedUnitPrice;
      const discountAmt = (base * (Number(items[index].discount) || 0)) / 100;
      const taxAmt = ((base - discountAmt) * (Number(items[index].tax) || 0)) / 100;
      items[index].lineTotal = base - discountAmt + taxAmt;

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

        sameAsBilling: formData.sameAsBilling,
        remarks: formData.remarks,

        items: formData.items.map((item) => ({
          productId: item.productId,
          uom: item.uom,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.quantity * item.unitPrice,
          discount: item.discount || 0,
          tax: item.tax || 0,
        })),

        subtotal: formData.subtotal,
        totalDiscount: formData.totalDiscount,
        totalTax: formData.totalTax,
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

  const selectedSupplier = (suppliers || []).find(
    (s) => String(s?.id) === String(formData.supplierId)
  );
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

              <Col lg={4} md={6}>
                <TextInput
                  label="Created by"
                  name="createdByOn"
                  value={formData.createdByOn}
                  onChange={handleChange}
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
                    {errors.billingPincode && (
                      <div className="text-danger mt-1">{errors.billingPincode}</div>
                    )}
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

            <div className="table-wrap" style={{ overflowX: "auto" }}>
              <table className="master-data-table" style={{ minWidth: "1100px" }}>
                <thead>
                  <tr>
                    <th style={{ width: "50px" }}>#</th>
                    <th style={{ minWidth: "220px" }}>RAW MATERIAL</th>
                    <th style={{ minWidth: "140px" }}>UOM</th>
                    <th style={{ minWidth: "130px" }}>QTY</th>
                    <th style={{ minWidth: "150px" }}>UNIT PRICE (₹)</th>
                    <th style={{ minWidth: "120px" }}>DISC %</th>
                    <th style={{ minWidth: "120px" }}>TAX %</th>
                    <th style={{ minWidth: "150px" }}>LINE TOTAL (₹)</th>
                    <th style={{ minWidth: "80px" }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items.map((item, index) => {
                    const qty = Number(item.quantity) || 0;
                    const price = Number(item.unitPrice) || 0;
                    const base = qty * price;
                    const discAmount = (base * (Number(item.discount) || 0)) / 100;
                    const taxAmount = ((base - discAmount) * (Number(item.tax) || 0)) / 100;
                    const lineTotal = base - discAmount + taxAmount;

                    return (
                      <tr key={index} className="master-data-row">
                        <td className="master-data-cell text-center fw-semibold">
                          {index + 1}
                        </td>

                        <td className="master-data-cell">
                          <div style={{ minWidth: "200px" }}>
                            <SelectInput
                              label=""
                              name={`items[${index}].productId`}
                              value={item.productId ? String(item.productId) : ""}
                              options={[{ value: "", label: "-- Select Material --" }, ...productOptions]}
                              onChange={(e) => handleItemProductChange(index, e.target.value)}
                              error={errors[`items.${index}.productId`]}
                            />
                          </div>
                        </td>

                        <td className="master-data-cell">
                          <TextInput
                            label=""
                            name={`items[${index}].uom`}
                            value={item.uom || ""}
                            onChange={() => { }}
                            disabled
                            placeholder="—"
                            style={{ minWidth: "120px" }}
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
                            style={{ minWidth: "110px" }}
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
                            style={{ minWidth: "130px" }}
                            disabled
                          />
                        </td>

                        <td className="master-data-cell">
                          <TextInput
                            label=""
                            name={`items[${index}].discount`}
                            type="number"
                            value={String(item.discount || 0)}
                            onChange={(e) => handleItemChange(index, "discount", Number(e.target.value))}
                            min={0}
                            max={100}
                            step={0.01}
                            placeholder="0"
                            style={{ minWidth: "100px" }}
                          />
                        </td>

                        <td className="master-data-cell">
                          <TextInput
                            label=""
                            name={`items[${index}].tax`}
                            type="number"
                            value={String(item.tax || 0)}
                            onChange={(e) => handleItemChange(index, "tax", Number(e.target.value))}
                            min={0}
                            max={100}
                            step={0.01}
                            placeholder="0"
                            style={{ minWidth: "100px" }}
                          />
                        </td>

                        <td className="master-data-cell text-end fw-semibold">
                          ₹{lineTotal.toFixed(2)}
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
                      <td colSpan={9} className="text-center text-muted py-4">
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
                  <div className="d-flex justify-content-between mb-2 text-danger">
                    <span>Total Discount:</span>
                    <span>-₹{formData.totalDiscount.toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-2 text-success">
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

export default PurchaseOrderCreatePage;