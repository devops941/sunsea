import React, { useState, useEffect } from "react";
import { Container, Row, Col, Table } from "react-bootstrap";
import { FaSave, FaTrash, FaPlus, FaTimes } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { createStockAdjustment, fetchStockAdjustmentById, updateStockAdjustment, clearCurrent } from "../../../features/stock-adjustments/stockAdjustmentSlice";
import { fetchRawMaterials } from "../../../features/raw-materials/rawMaterialSlice";
import { fetchProducts } from "../../../features/product/productSlice";
import { fetchStores } from "../../../features/stores/storeSlice";

import CustomButton from "../../../components/ui/Button/Button";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";

const StockAdjustmentForm: React.FC = () => {
  const { id } = useParams();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { currentAdjustment, loading } = useAppSelector((state) => state.stockAdjustments);
  const { data: rawMaterials } = useAppSelector((state) => state.rawMaterials);
  const { data: products } = useAppSelector((state) => state.products);
  const { data: stores } = useAppSelector((state) => state.stores);

  const [formData, setFormData] = useState<any>({
    adjustmentNumber: "",
    adjustmentDate: new Date().toISOString().split('T')[0],
    reason: "",
    status: "DRAFT",
    items: [],
  });

  useEffect(() => {
    dispatch(fetchRawMaterials());
    dispatch(fetchProducts());
    dispatch(fetchStores());
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
        })),
      });
    } else if (!isEditMode) {
      setFormData(prev => ({
        ...prev,
        adjustmentNumber: `ADJ-${Date.now().toString().slice(-6)}`
      }));
    }
  }, [currentAdjustment, isEditMode]);

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

    if (field === "rawMaterialId" && item.itemType === "RAW_MATERIAL") {
      const rm = rawMaterials.find(r => r.rawMaterialId === value);
      item.currentQty = rm ? Number(rm.onHandQty) : 0;
      item.adjustedQty = item.currentQty;
      item.difference = 0;
    }

    // Finished Goods stock would typically require store ID + Product ID to find current Qty.
    // For simplicity, we just set 0 if not easily available locally, or user enters manually.

    if (field === "adjustedQty") {
      item.difference = Number(value) - Number(item.currentQty);
    }
    if (field === "currentQty") {
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
    
    if (formData.items.length === 0) {
      toast.error("Please add at least one item to adjust");
      return;
    }

    for (const item of formData.items) {
      if (!item.storeId) {
        toast.error("Store is required for all items");
        return;
      }
      if (item.itemType === "RAW_MATERIAL" && !item.rawMaterialId) {
        toast.error("Raw Material selection is required");
        return;
      }
      if (item.itemType === "FINISHED_GOODS" && !item.productItemId) {
        toast.error("Product selection is required");
        return;
      }
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
    <div className="inner-container">
      <Container fluid>
        <div className="page-header">
          <Row className="align-items-center">
            <Col>
              <h2 className="page-title">{isEditMode ? "Edit Stock Adjustment" : "New Stock Adjustment"}</h2>
              <div className="page-breadcrumb">Inventory / Stock Adjustments / {isEditMode ? "Edit" : "Create"}</div>
            </Col>
            <Col className="text-end">
              <CustomButton text="Cancel" variant="secondary" icon={FaTimes} onClick={() => navigate("/inventory/stock-adjustments")} className="me-2" />
              <CustomButton text="Save Adjustment" icon={FaSave} onClick={handleSubmit} disabled={loading} />
            </Col>
          </Row>
        </div>

        <div className="page-content">
          <Row className="mb-4">
            <Col md={3}>
              <TextInput label="Adjustment No*" name="adjustmentNumber" value={formData.adjustmentNumber} onChange={e => setFormData({ ...formData, adjustmentNumber: e.target.value })} disabled={isEditMode} />
            </Col>
            <Col md={3}>
              <TextInput label="Adjustment Date*" name="adjustmentDate" type="date" value={formData.adjustmentDate} onChange={e => setFormData({ ...formData, adjustmentDate: e.target.value })} />
            </Col>
            <Col md={6}>
              <TextInput label="Reason" name="reason" value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} />
            </Col>
          </Row>

          <h5 className="mb-3">Adjustment Items</h5>
          <div className="table-responsive">
            <Table bordered hover>
              <thead>
                <tr>
                  <th>Item Type</th>
                  <th>Item Selection</th>
                  <th>Store</th>
                  <th>Current Qty</th>
                  <th>Adjusted Qty</th>
                  <th>Difference</th>
                  <th>Remarks</th>
                  <th style={{ width: "50px" }}></th>
                </tr>
              </thead>
              <tbody>
                {formData.items.map((item: any, index: number) => (
                  <tr key={index}>
                    <td>
                      <select className="form-select form-select-sm" value={item.itemType} onChange={e => handleItemChange(index, "itemType", e.target.value)}>
                        <option value="RAW_MATERIAL">Raw Material</option>
                        <option value="FINISHED_GOODS">Finished Goods</option>
                      </select>
                    </td>
                    <td>
                      {item.itemType === "RAW_MATERIAL" ? (
                        <select className="form-select form-select-sm" value={item.rawMaterialId} onChange={e => handleItemChange(index, "rawMaterialId", e.target.value)}>
                          <option value="">Select Material</option>
                          {rawMaterials.map(rm => (
                            <option key={rm.rawMaterialId} value={rm.rawMaterialId}>{rm.materialName} ({rm.rawMaterialId})</option>
                          ))}
                        </select>
                      ) : (
                        <select className="form-select form-select-sm" value={item.productItemId} onChange={e => handleItemChange(index, "productItemId", e.target.value)}>
                          <option value="">Select Product</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.productName} ({p.productCode})</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td>
                      <select className="form-select form-select-sm" value={item.storeId} onChange={e => handleItemChange(index, "storeId", e.target.value)}>
                        <option value="">Select Store</option>
                        {stores.map(s => (
                          <option key={s.storeId} value={s.storeId}>{s.storeName}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input type="number" className="form-control form-control-sm" value={item.currentQty} onChange={e => handleItemChange(index, "currentQty", Number(e.target.value))} />
                    </td>
                    <td>
                      <input type="number" className="form-control form-control-sm" value={item.adjustedQty} onChange={e => handleItemChange(index, "adjustedQty", Number(e.target.value))} />
                    </td>
                    <td className={item.difference > 0 ? "text-success fw-bold" : item.difference < 0 ? "text-danger fw-bold" : ""}>
                      {item.difference > 0 ? `+${item.difference}` : item.difference}
                    </td>
                    <td>
                      <input type="text" className="form-control form-control-sm" value={item.remarks} onChange={e => handleItemChange(index, "remarks", e.target.value)} />
                    </td>
                    <td>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => removeItem(index)}><FaTrash /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <CustomButton text="Add Item" variant="outline-primary" icon={FaPlus} onClick={addItem} />
        </div>
      </Container>
    </div>
  );
};

export default StockAdjustmentForm;
