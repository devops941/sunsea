import React, { useState, useEffect, useCallback } from "react";
import { Container, Row, Col, Table, Spinner } from "react-bootstrap";
import { FaSave, FaPlus, FaTrash, FaInfoCircle, FaUser, FaMapMarkerAlt, FaBoxOpen, FaPaperPlane } from "react-icons/fa";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
//import { useSelector } from "react-redux";

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
      lineTotal: i.lineTotal ?? 0,
    })) ?? [],

    subtotal: po.subtotal ?? 0,
    totalDiscount: po.totalDiscount ?? 0,
    totalTax: po.totalTax ?? 0,
    netAmount: po.netAmount ?? 0,
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


  const [formData, setFormData] = useState<PurchaseOrderFormData>(initialFormData);
  const { users, loadUsers } = useUsers();
  const createdOn = users.find(
    (u: any) => u.userId === formData?.createdByOn
  )?.username; ``
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
  }, [loadSuppliers, loadUsers]);

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

        let subtotal = 0;
        let totalDiscount = 0;
        let totalTax = 0;

        updatedItems.forEach((item) => {
          const line = item.quantity * item.unitPrice;
          const discount = (line * (item.discount || 0)) / 100;
          const tax = ((line - discount) * (item.tax || 0)) / 100;

          subtotal += line;
          totalDiscount += discount;
          totalTax += tax;
        });

        return {
          ...prev,
          poDate: value,
          items: updatedItems,
          subtotal,
          totalDiscount,
          totalTax,
          netAmount: subtotal - totalDiscount + totalTax,
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

  // ============================================================
  // TOTALS
  // ============================================================
  const calculateTotals = useCallback(() => {
    setFormData((prev) => {
      let subtotal = 0;
      let totalDiscount = 0;
      let totalTax = 0;

      prev.items.forEach((item) => {
        const line = item.quantity * item.unitPrice;
        const discount = (line * (item.discount || 0)) / 100;
        const tax = ((line - discount) * (item.tax || 0)) / 100;

        subtotal += line;
        totalDiscount += discount;
        totalTax += tax;
      });

      return {
        ...prev,
        subtotal,
        totalDiscount,
        totalTax,
        netAmount: subtotal - totalDiscount + totalTax,
      };
    });
  }, []);

  // ============================================================
  // ITEM HANDLERS
  // ============================================================
  const handleItemChange = (index: number, field: keyof PurchaseOrderItem, value: any) => {
    setFormData((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
    calculateTotals();
  };

  const handleItemProductChange = (index: number, productId: string) => {
    const rawMaterial = rawMaterials.find((rm) => rm.rawMaterialId === productId);
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
          ? {
            id: rawMaterial.rawMaterialId,
            productCode: rawMaterial.rawMaterialId,
            productName: rawMaterial.materialName,
            unit: rawMaterial.baseUom,
            unitPrice: parsedUnitPrice,
          }
          : undefined,
        unitPrice: parsedUnitPrice,
      };
      return { ...prev, items };
    });
    calculateTotals();
  };

  const addItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { productId: "", quantity: 1, unitPrice: 0, discount: 0, tax: 0, lineTotal: 0, uom: "" },
      ],
    }));
  };

  const removeItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
    calculateTotals();
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
      await editPurchaseOrder(id, {
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
        items: formData.items.map((i) => ({
          productId: i.productId,
          uom: i.uom,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          discount: Number(i.discount || 0),
          tax: Number(i.tax || 0),
          subtotal: Number(i.lineTotal),
          discountAmount: Number(i.discount),
          taxAmount: Number(i.tax),
          netAmount: Number(i.lineTotal)
        })),
        status: formData.status,
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

  const selectedSupplier = (suppliers || []).find((s) => s?.id === formData.supplierId);
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

            <div className="table-responsive">
              <Table bordered hover>
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Discount %</th>
                    <th>Tax %</th>
                    <th>Line Total</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items.map((item, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td>
                        <SelectInput
                          label=""
                          name={`items[${index}].productId`}
                          value={item.productId || ""}
                          options={[{ value: "", label: "-- Select --" }, ...productOptions]}
                          onChange={(e) => handleItemProductChange(index, e.target.value)}
                          error={errors[`items.${index}.productId`]}
                          disabled={isLocked}
                        />
                      </td>
                      <td>
                        <TextInput
                          name={`items[${index}].quantity`}
                          type="number"
                          value={String(item.quantity)}
                          onChange={(e) => handleItemChange(index, "quantity", Number(e.target.value))}
                          error={errors[`items.${index}.quantity`]}
                          min={1}
                          disabled={isLocked}
                        />
                      </td>
                      <td>
                        <TextInput
                          name={`items[${index}].unitPrice`}
                          type="number"
                          value={String(item.unitPrice)}
                          onChange={(e) => handleItemChange(index, "unitPrice", Number(e.target.value))}
                          error={errors[`items.${index}.unitPrice`]}
                          min={0}
                          step={0.01}
                          disabled
                        />
                      </td>
                      <td>
                        <TextInput
                          name={`items[${index}].discount`}
                          type="number"
                          value={String(item.discount)}
                          onChange={(e) => handleItemChange(index, "discount", Number(e.target.value))}
                          min={0}
                          max={100}
                          disabled={isLocked}
                        />
                      </td>
                      <td>
                        <TextInput
                          name={`items[${index}].tax`}
                          type="number"
                          value={String(item.tax)}
                          onChange={(e) => handleItemChange(index, "tax", Number(e.target.value))}
                          min={0}
                          max={100}
                          disabled={isLocked}
                        />
                      </td>
                      <td>
                        ₹{(item.quantity * item.unitPrice - (item.quantity * item.unitPrice * (item.discount || 0)) / 100 + ((item.quantity * item.unitPrice - (item.quantity * item.unitPrice * (item.discount || 0)) / 100) * (item.tax || 0)) / 100).toFixed(2)}
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
                  ))}
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
                    <span>₹{formData.subtotal}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-2 text-danger">
                    <span>Total Discount:</span>
                    <span>-₹{formData.totalDiscount}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-2 text-success">
                    <span>Total Tax:</span>
                    <span>+₹{formData.totalTax}</span>
                  </div>
                  <hr />
                  <div className="d-flex justify-content-between fw-bold">
                    <span>Net Amount:</span>
                    <span>₹{formData.netAmount}</span>
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