import React, { useState, useEffect } from "react";
import { Container, Row, Col, Table, Card, Form } from "react-bootstrap";
import { FaSave, FaTrash, FaPlus, FaTimes } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { z } from "zod";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { createStockAdjustment, fetchStockAdjustmentById, updateStockAdjustment, clearCurrent } from "../../../features/stock-adjustments/stockAdjustmentSlice";
import { fetchRawMaterials } from "../../../features/raw-materials/rawMaterialSlice";
import { fetchProducts } from "../../../features/product/productSlice";
import { fetchStores } from "../../../features/stores/storeSlice";
import { fetchFinishedGoodsStocks } from "../../../features/finished-goods-stock/finishedGoodsStockSlice";

import CustomButton from "../../../components/ui/custombutton/CustomButton";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";

// Validation Schemas
const adjustmentItemSchema = z.object({
  itemType: z.enum(["RAW_MATERIAL", "FINISHED_GOODS"]),
  rawMaterialId: z.string().nullable().optional(),
  productItemId: z.string().nullable().optional(),
  storeId: z.string().min(1, "Store is required"),
  currentQty: z.number({ message: "Current quantity must be a number" }),
  adjustedQty: z.number({ message: "Adjusted quantity must be a number" }).min(0, "Adjusted qty cannot be negative"),
  difference: z.number(),
  remarks: z.string().optional().nullable(),
}).refine(item => {
  if (item.itemType === "RAW_MATERIAL") return !!item.rawMaterialId;
  if (item.itemType === "FINISHED_GOODS") return !!item.productItemId;
  return true;
}, {
  message: "Selection is required based on type",
  path: ["itemSelection"]
});

const stockAdjustmentFormSchema = z.object({
  adjustmentNumber: z.string().min(1, "Adjustment Number is required"),
  adjustmentDate: z.string().min(1, "Date is required"),
  reason: z.string().min(1, "Reason is required").max(255, "Reason is too long"),
  items: z.array(adjustmentItemSchema).min(1, "At least one item is required for adjustment"),
});

const StockAdjustmentForm: React.FC = () => {
  const { id } = useParams();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { currentAdjustment, loading } = useAppSelector((state) => state.stockAdjustments);
  const { data: rawMaterials } = useAppSelector((state) => state.rawMaterials);
  const { products } = useAppSelector((state) => state.products);
  const { data: stores } = useAppSelector((state) => state.stores);
  const { data: fgStocks = [] } = useAppSelector((state) => state.finishedGoodsStocks || {});

  const [formData, setFormData] = useState<any>({
    adjustmentNumber: "",
    adjustmentDate: new Date().toISOString().split('T')[0],
    reason: "",
    status: "DRAFT",
    items: [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    dispatch(fetchRawMaterials());
    dispatch(fetchProducts());
    dispatch(fetchStores());
    dispatch(fetchFinishedGoodsStocks({}));
    return () => { dispatch(clearCurrent()); }
  }, [dispatch]);

  useEffect(() => {
    if (isEditMode && id) {
      dispatch(fetchStockAdjustmentById(id));
    }
  }, [isEditMode, id, dispatch]);

  useEffect(() => {
    if (isEditMode && currentAdjustment) {
      setFormData({
        adjustmentNumber: currentAdjustment.adjustmentNumber,
        adjustmentDate: new Date(currentAdjustment.adjustmentDate).toISOString().split('T')[0],
        reason: currentAdjustment.reason || "",
        status: currentAdjustment.status,
        items: currentAdjustment.items.map((i: any) => ({
          ...i,
          productItemId: i.productItemId ? i.productItemId.toString() : "",
          rawMaterialId: i.rawMaterialId || "",
        })),
      });
    } else if (!isEditMode) {
      setFormData((prev: any) => ({
        ...prev,
        adjustmentNumber: `ADJ-${Date.now().toString().slice(-6)}`
      }));
    }
  }, [currentAdjustment, isEditMode]);

  // Recalculates quantities and differences dynamically
  const handleItemChange = (index: number, field: string, value: any) => {
    const updatedItems = [...formData.items];
    const item = { ...updatedItems[index], [field]: value };

    if (field === "itemType") {
      item.rawMaterialId = "";
      item.productItemId = "";
      item.currentQty = 0;
      item.adjustedQty = 0;
      item.difference = 0;
    }

    // Auto-calculate for Raw Materials
    if (item.itemType === "RAW_MATERIAL" && (field === "rawMaterialId" || field === "itemType")) {
      const selectedId = field === "rawMaterialId" ? value : item.rawMaterialId;
      const rm = rawMaterials.find(r => r.rawMaterialId === selectedId);
      item.currentQty = rm ? Number(rm.onHandQty || 0) : 0;
      item.adjustedQty = item.currentQty;
      item.difference = 0;
    }

    // Auto-calculate for Finished Goods if store & product are selected
    if (item.itemType === "FINISHED_GOODS" && (field === "productItemId" || field === "storeId" || field === "itemType")) {
      const pId = field === "productItemId" ? value : item.productItemId;
      const sId = field === "storeId" ? value : item.storeId;
      if (pId && sId) {
        const fg = fgStocks.find((f: any) => f.storeId === sId && f.productItemId?.toString() === pId.toString());
        item.currentQty = fg ? Number(fg.onHandQty || 0) : 0;
      } else {
        item.currentQty = 0;
      }
      item.adjustedQty = item.currentQty;
      item.difference = 0;
    }

    if (field === "adjustedQty") {
      item.adjustedQty = Number(value);
      item.difference = Number(value) - Number(item.currentQty);
    }

    if (field === "currentQty") {
      item.currentQty = Number(value);
      item.difference = Number(item.adjustedQty) - Number(value);
    }

    updatedItems[index] = item;
    setFormData({ ...formData, items: updatedItems });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          itemType: "RAW_MATERIAL",
          rawMaterialId: "",
          productItemId: "",
          storeId: "",
          currentQty: 0,
          adjustedQty: 0,
          difference: 0,
          remarks: "",
        },
      ],
    });
  };

  const removeItem = (index: number) => {
    const updatedItems = formData.items.filter((_: any, i: number) => i !== index);
    setFormData({ ...formData, items: updatedItems });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Reset validation errors
    setErrors({});

    // Validate using Zod
    const validation = stockAdjustmentFormSchema.safeParse(formData);
    if (!validation.success) {
      const newErrors: Record<string, string> = {};
      validation.error.issues.forEach((err: any) => {
        const path = err.path.join(".");
        newErrors[path] = err.message;
      });
      setErrors(newErrors);

      // Display the first validation message as a toast
      toast.error(validation.error.issues[0].message);
      return;
    }

    try {
      if (isEditMode && id) {
        await dispatch(updateStockAdjustment({ id, data: formData })).unwrap();
        toast.success("Stock Adjustment updated successfully");
      } else {
        await dispatch(createStockAdjustment(formData)).unwrap();
        toast.success("Stock Adjustment created successfully");
      }
      navigate("/inventory/stock-adjustments");
    } catch (err: any) {
      toast.error(err || "An error occurred");
    }
  };

  return (
    <div className="inner-container py-4">
      <Container fluid>
        {/* HEADER SECTION */}
        <div className="d-flex justify-content-between align-items-center mb-4 bg-white p-3 rounded shadow-sm border">
          <div>
            <h2 className="mb-1 text-primary fw-bold" style={{ fontSize: "1.6rem" }}>
              {isEditMode ? "Edit Stock Adjustment" : "New Stock Adjustment"}
            </h2>
            <div className="text-muted small">Inventory / Stock Adjustments / {isEditMode ? "Edit" : "Create"}</div>
          </div>
          <div className="d-flex gap-2">
            <CustomButton 
              text="Cancel" 
              variant="outline" 
              icon={FaTimes} 
              onClick={() => navigate("/inventory/stock-adjustments")} 
            />
            <CustomButton 
              text="Save Adjustment" 
              icon={FaSave} 
              onClick={handleSubmit} 
              disabled={loading} 
            />
          </div>
        </div>

        {/* METADATA CARD */}
        <Card className="mb-4 border-0 shadow-sm">
          <Card.Header className="bg-primary text-white py-3">
            <h5 className="mb-0 fw-bold">Adjustment Information</h5>
          </Card.Header>
          <Card.Body className="p-4">
            <Row className="g-3">
              <Col md={3}>
                <TextInput 
                  label="Adjustment Number*" 
                  name="adjustmentNumber" 
                  value={formData.adjustmentNumber} 
                  onChange={e => setFormData({ ...formData, adjustmentNumber: e.target.value })} 
                  disabled={isEditMode}
                  error={errors.adjustmentNumber}
                />
              </Col>
              <Col md={3}>
                <TextInput 
                  label="Adjustment Date*" 
                  name="adjustmentDate" 
                  type="date" 
                  value={formData.adjustmentDate} 
                  onChange={e => setFormData({ ...formData, adjustmentDate: e.target.value })} 
                  error={errors.adjustmentDate}
                />
              </Col>
              <Col md={6}>
                <TextInput 
                  label="Reason for Adjustment*" 
                  name="reason" 
                  placeholder="Provide a reason for this stock adjustment"
                  value={formData.reason} 
                  onChange={e => setFormData({ ...formData, reason: e.target.value })} 
                  error={errors.reason}
                />
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* ITEMS CARD */}
        <Card className="border-0 shadow-sm">
          <Card.Header className="bg-secondary text-white py-3 d-flex justify-content-between align-items-center">
            <h5 className="mb-0 fw-bold">Adjustment Items</h5>
            <CustomButton 
              text="Add Item" 
              variant="ghost" 
              icon={FaPlus} 
              onClick={addItem} 
              className="btn-sm text-primary"
            />
          </Card.Header>
          <Card.Body className="p-0">
            <div className="table-responsive">
              <Table hover responsive className="mb-0 align-middle">
                <thead className="table-light text-secondary">
                  <tr>
                    <th style={{ minWidth: "150px" }}>Item Type</th>
                    <th style={{ minWidth: "220px" }}>Item Selection</th>
                    <th style={{ minWidth: "180px" }}>Store</th>
                    <th style={{ width: "120px" }}>Current Qty</th>
                    <th style={{ width: "120px" }}>Adjusted Qty</th>
                    <th style={{ width: "120px" }}>Difference</th>
                    <th style={{ minWidth: "200px" }}>Remarks</th>
                    <th style={{ width: "50px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items.length > 0 ? (
                    formData.items.map((item: any, index: number) => {
                      const itemSelectionError = errors[`items.${index}.rawMaterialId`] || errors[`items.${index}.productItemId`] || errors[`items.${index}.itemSelection`];
                      const storeError = errors[`items.${index}.storeId`];
                      const adjustedQtyError = errors[`items.${index}.adjustedQty`];

                      return (
                        <tr key={index}>
                          <td>
                            <Form.Select 
                              size="sm" 
                              className="form-select-sm"
                              value={item.itemType} 
                              onChange={e => handleItemChange(index, "itemType", e.target.value)}
                            >
                              <option value="RAW_MATERIAL">Raw Material</option>
                              <option value="FINISHED_GOODS">Finished Goods</option>
                            </Form.Select>
                          </td>
                          <td>
                            {item.itemType === "RAW_MATERIAL" ? (
                              <Form.Select 
                                size="sm"
                                className={`form-select-sm ${itemSelectionError ? "is-invalid" : ""}`}
                                value={item.rawMaterialId || ""} 
                                onChange={e => handleItemChange(index, "rawMaterialId", e.target.value)}
                              >
                                <option value="">Select Material</option>
                                {rawMaterials.map(rm => (
                                  <option key={rm.rawMaterialId} value={rm.rawMaterialId}>
                                    {rm.materialName} ({rm.rawMaterialId})
                                  </option>
                                ))}
                              </Form.Select>
                            ) : (
                              <Form.Select 
                                size="sm"
                                className={`form-select-sm ${itemSelectionError ? "is-invalid" : ""}`}
                                value={item.productItemId || ""} 
                                onChange={e => handleItemChange(index, "productItemId", e.target.value)}
                              >
                                <option value="">Select Product</option>
                                {products.map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.productName} ({p.productCode})
                                  </option>
                                ))}
                              </Form.Select>
                            )}
                          </td>
                          <td>
                            <Form.Select 
                              size="sm"
                              className={`form-select-sm ${storeError ? "is-invalid" : ""}`}
                              value={item.storeId || ""} 
                              onChange={e => handleItemChange(index, "storeId", e.target.value)}
                            >
                              <option value="">Select Store</option>
                              {stores.map(s => (
                                <option key={s.storeId} value={s.storeId}>
                                  {s.storeName}
                                </option>
                              ))}
                            </Form.Select>
                          </td>
                          <td>
                            <Form.Control 
                              type="number"
                              size="sm"
                              disabled
                              value={item.currentQty} 
                              className="bg-light"
                            />
                          </td>
                          <td>
                            <Form.Control 
                              type="number"
                              size="sm"
                              className={adjustedQtyError ? "is-invalid" : ""}
                              value={item.adjustedQty} 
                              onChange={e => handleItemChange(index, "adjustedQty", e.target.value)}
                            />
                          </td>
                          <td className={`fw-bold text-center ${item.difference > 0 ? "text-success" : item.difference < 0 ? "text-danger" : "text-muted"}`}>
                            {item.difference > 0 ? `+${item.difference}` : item.difference}
                          </td>
                          <td>
                            <Form.Control 
                              type="text"
                              size="sm"
                              placeholder="Add item remarks..."
                              value={item.remarks || ""} 
                              onChange={e => handleItemChange(index, "remarks", e.target.value)}
                            />
                          </td>
                          <td className="text-center">
                            <button 
                              className="btn btn-sm btn-outline-danger border-0" 
                              onClick={() => removeItem(index)}
                              title="Delete Item"
                            >
                              <FaTrash />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="text-center py-5 text-muted">
                        <div className="mb-2">No adjustment items added.</div>
                        <CustomButton 
                          text="Add First Item" 
                          variant="outline" 
                          icon={FaPlus} 
                          onClick={addItem} 
                          className="btn-sm"
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>
      </Container>
    </div>
  );
};

export default StockAdjustmentForm;
