import React, { useState, useEffect } from "react";
import { Container, Row, Col, Card, Form } from "react-bootstrap";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { createProductionWastage, updateProductionWastage } from "../../../features/production-wastage/productionWastageSlice";
import { fetchProductionOrders } from "../../../features/production-orders/productionOrderSlice";
import { fetchMachines } from "../../../features/machines/machineSlice";
import { fetchProducts } from "../../../features/product/productSlice";
import { fetchShifts } from "../../../features/shifts/shiftSlice";
import { fetchRawMaterials } from "../../../features/raw-materials/rawMaterialSlice";
import { fetchActiveUOMs } from "../../../features/uoms/uomSlice";
import TextInput from "../../../components/form/TextInput/TextInput";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import CustomButton from "../../../components/ui/custombutton/CustomButton";
import { z } from "zod";

const wastageSchema = z.object({
  wastageDate: z.string().min(1, "Wastage date is required"),
  productionOrderId: z.string().min(1, "Production Order reference is required"),
  wastageType: z.string().min(1, "Wastage Type is required"),
  machineId: z.string().min(1, "Machine reference is required"),
  shiftId: z.string().min(1, "Shift reference is required"),
  productId: z.string().min(1, "Product reference is required"),
  rawMaterialId: z.string().optional(),
  quantity: z.string()
    .min(1, "Wastage quantity is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Wastage quantity must be greater than 0",
    }),
  uom: z.string().min(1, "UOM is required"),
  estimatedValue: z.string().optional(),
  reason: z.string().optional(),
  correctiveAction: z.string().optional(),
  remarks: z.string().optional(),
});

const WASTAGE_TYPES = [
  { label: "Startup Waste", value: "STARTUP" },
  { label: "Machine Setup Waste", value: "MACHINE_SETUP" },
  { label: "Quality Rejection", value: "QUALITY_REJECTION" },
  { label: "Raw Material Waste", value: "RAW_MATERIAL_WASTE" },
  { label: "Scrap Material", value: "SCRAP" },
  { label: "Rework Waste", value: "REWORK" },
  { label: "Machine Breakdown Stoppage", value: "MACHINE_BREAKDOWN" },
  { label: "Power Failure Stoppage", value: "POWER_FAILURE" },
  { label: "Mould Change Waste", value: "MOULD_CHANGE" },
  { label: "Color Change Waste", value: "COLOR_CHANGE" },
  { label: "Other Waste", value: "OTHER" },
];

const WastageForm: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const dispatch = useAppDispatch();
  const isEdit = Boolean(id);

  // Redux state
  const { data: productionOrders } = useAppSelector((state) => state.productionOrders);
  const { data: machines } = useAppSelector((state) => state.machines);
  const { products } = useAppSelector((state: any) => state.products || { products: [] });
  const { data: shifts } = useAppSelector((state) => state.shifts);
  const { data: rawMaterials } = useAppSelector((state) => state.rawMaterials);
  const { activeData: activeUOMs = [] } = useAppSelector((state: any) => state.uoms || {});

  // Form local state
  const [formData, setFormData] = useState({
    wastageDate: new Date().toISOString().split("T")[0],
    productionOrderId: "",
    hourlyProductionId: null as number | null,
    machineId: "",
    shiftId: "",
    productId: "",
    rawMaterialId: "",
    wastageType: "SCRAP",
    quantity: "",
    uom: "KG",
    estimatedValue: "",
    reason: "",
    correctiveAction: "",
    remarks: "",
    isRecyclable: false,
    sentForRework: false,
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    dispatch(fetchProductionOrders());
    dispatch(fetchMachines());
    dispatch(fetchProducts(undefined));
    dispatch(fetchShifts());
    dispatch(fetchRawMaterials(undefined));
    dispatch(fetchActiveUOMs());
  }, [dispatch]);

  // Load existing log details if in edit mode
  useEffect(() => {
    if (isEdit && location.state) {
      const state = location.state;
      setFormData({
        wastageDate: new Date(state.wastageDate).toISOString().split("T")[0],
        productionOrderId: state.productionOrderId || "",
        hourlyProductionId: state.hourlyProductionId ? Number(state.hourlyProductionId) : null,
        machineId: state.machineId || "",
        shiftId: state.shiftId || "",
        productId: String(state.productId || ""),
        rawMaterialId: state.rawMaterialId || "",
        wastageType: state.wastageType || "SCRAP",
        quantity: String(state.quantity || ""),
        uom: state.uom || "PCS",
        estimatedValue: state.estimatedValue ? String(state.estimatedValue) : "",
        reason: state.reason || "",
        correctiveAction: state.correctiveAction || "",
        remarks: state.remarks || "",
        isRecyclable: Boolean(state.isRecyclable),
        sentForRework: Boolean(state.sentForRework),
      });
    }
  }, [isEdit, location.state]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  // Auto-populate shift, machine, and product when production order is selected
  useEffect(() => {
    if (formData.productionOrderId && !isEdit) {
      const selectedPO: any = productionOrders.find(
        (po: any) => po.productionOrderId === formData.productionOrderId
      );
      if (selectedPO) {
        setFormData((prev) => ({
          ...prev,
          productId: String(selectedPO.productItemId),
          uom: "KG",
          machineId: selectedPO.machineMachineId || selectedPO.machineId || prev.machineId,
          shiftId: selectedPO.shiftId ? String(selectedPO.shiftId) : prev.shiftId,
        }));
      }
    }
  }, [formData.productionOrderId, productionOrders, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = wastageSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          fieldErrors[issue.path[0] as string] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    const payload = {
      ...formData,
      productId: Number(formData.productId),
      quantity: Number(formData.quantity),
      estimatedValue: formData.estimatedValue ? Number(formData.estimatedValue) : null,
      rawMaterialId: formData.rawMaterialId || null,
      reason: formData.reason || null,
      correctiveAction: formData.correctiveAction || null,
      remarks: formData.remarks || null,
      status: "APPROVED",
    };

    setLoading(false);
    try {
      if (isEdit) {
        await dispatch(
          updateProductionWastage({ id: id!, data: payload })
        ).unwrap();
        toast.success("Production wastage log updated successfully");
      } else {
        await dispatch(createProductionWastage(payload)).unwrap();
        toast.success("Production wastage log logged successfully");
      }
      navigate("/production-wastages");
    } catch (err: any) {
      toast.error(err || "Failed to save wastage record");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inner-container">
      <Container fluid className="px-4 py-3">
        {/* Page Header */}
        <div className="page-header mb-4">
          <div className="page-header-info">
            <h2 className="page-title">{isEdit ? "Edit Wastage Audit Log" : "Log Production Wastage"}</h2>
            
          </div>
        </div>

        {/* Form Card */}
        <Card className="border-0 shadow-sm rounded-3 p-4">
          <Form onSubmit={handleSubmit} className="form-inner" noValidate>
            <Row className="g-3">
              {/* Section 1: Wastage Details */}
              <Col md={12}>
                <h6 className="section-title border-bottom-0">1. Wastage Details</h6>
                <div className="p-3 border rounded">
                  <Row className="g-3">
                    <Col lg={4} md={6}>
                      <TextInput
                        label="Wastage Logging Date"
                        name="wastageDate"
                        type="date"
                        value={formData.wastageDate}
                        onChange={handleChange}
                        required
                      />
                      {errors.wastageDate && <span className="text-danger small">{errors.wastageDate}</span>}
                    </Col>
                    <Col lg={4} md={6}>
                      <SelectInput
                        label="Production Order Reference"
                        name="productionOrderId"
                        value={formData.productionOrderId}
                        options={[
                          { label: "Select Production Order", value: "" },
                          ...productionOrders.map((po) => ({
                            label: `${po.productionOrderId} - ${po.productItem?.productName || "Product"}`,
                            value: po.productionOrderId ? String(po.productionOrderId) : "",
                          })),
                        ]}
                        onChange={handleChange}
                        required
                        disabled={isEdit}
                      />
                      {errors.productionOrderId && <span className="text-danger small">{errors.productionOrderId}</span>}
                    </Col>
                    <Col lg={4} md={6}>
                      <SelectInput
                        label="Wastage Type classification"
                        name="wastageType"
                        value={formData.wastageType}
                        options={WASTAGE_TYPES}
                        onChange={handleChange}
                        required
                      />
                      {errors.wastageType && <span className="text-danger small">{errors.wastageType}</span>}
                    </Col>
                    <Col lg={4} md={6}>
                      <SelectInput
                        label="Machine Location"
                        name="machineId"
                        value={formData.machineId}
                        options={[
                          { label: "Select Machine", value: "" },
                          ...machines.map((m) => ({
                            label: m.machineName,
                            value: m.machineId,
                          })),
                        ]}
                        onChange={handleChange}
                        required
                      />
                      {errors.machineId && <span className="text-danger small">{errors.machineId}</span>}
                    </Col>
                    <Col lg={4} md={6}>
                      <SelectInput
                        label="Shift Classification"
                        name="shiftId"
                        value={formData.shiftId}
                        options={[
                          { label: "Select Shift", value: "" },
                          ...shifts.map((s) => ({
                            label: s.shiftName,
                            value: s.shiftCode,
                          })),
                        ]}
                        onChange={handleChange}
                        required
                      />
                      {errors.shiftId && <span className="text-danger small">{errors.shiftId}</span>}
                    </Col>
                    <Col lg={4} md={6}>
                      <SelectInput
                        label="Product Item"
                        name="productId"
                        value={formData.productId}
                        options={[
                          { label: "Select Product", value: "" },
                          ...products.map((p: any) => ({
                            label: p.productName,
                            value: String(p.id),
                          })),
                        ]}
                        onChange={handleChange}
                        required
                        disabled={isEdit}
                      />
                      {errors.productId && <span className="text-danger small">{errors.productId}</span>}
                    </Col>
                    <Col lg={4} md={6}>
                      <SelectInput
                        label="Raw Material Component (Optional)"
                        name="rawMaterialId"
                        value={formData.rawMaterialId}
                        options={[
                          { label: "Select Raw Material if wasted", value: "" },
                          ...rawMaterials.map((rm) => ({
                            label: rm.materialName,
                            value: rm.rawMaterialId,
                          })),
                        ]}
                        onChange={handleChange}
                      />
                      {errors.rawMaterialId && <span className="text-danger small">{errors.rawMaterialId}</span>}
                    </Col>
                    <Col lg={4} md={6}>
                      <TextInput
                        label="Wastage Quantity"
                        name="quantity"
                        type="number"
                        step="0.001"
                        value={formData.quantity}
                        onChange={handleChange}
                        placeholder="e.g. 50"
                        required
                      />
                      {errors.quantity && <span className="text-danger small">{errors.quantity}</span>}
                    </Col>
                    <Col lg={2} md={6}>
                      <SelectInput
                        label="UOM"
                        name="uom"
                        value={formData.uom}
                        options={[
                          { label: "Select UOM", value: "" },
                          ...activeUOMs.map((uom: any) => ({
                            label: uom.uomCode,
                            value: uom.uomCode,
                          })),
                        ]}
                        onChange={handleChange}
                        required
                      />
                      {errors.uom && <span className="text-danger small">{errors.uom}</span>}
                    </Col>
                  </Row>
                </div>
              </Col>

              {/* Section 2: Explanation & Auditing Notes */}
              <Col md={12}>
                <h6 className="section-title border-bottom-0 mt-3">2. Explanation & Auditing Notes</h6>
                <div className="p-3 border rounded">
                  <Row className="g-3">
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label className="small fw-semibold text-secondary">Reason for Wastage</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={3}
                          name="reason"
                          value={formData.reason}
                          onChange={handleChange}
                          placeholder="Provide specific details about the breakdown, raw material defect, setup scrap, etc."
                        />
                        {errors.reason && <span className="text-danger small">{errors.reason}</span>}
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label className="small fw-semibold text-secondary">Corrective Action Taken</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={3}
                          name="correctiveAction"
                          value={formData.correctiveAction}
                          onChange={handleChange}
                          placeholder="Enter immediate corrective action taken to prevent recurrence..."
                        />
                        {errors.correctiveAction && <span className="text-danger small">{errors.correctiveAction}</span>}
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label className="small fw-semibold text-secondary">Remarks / General Audit Notes</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={3}
                          name="remarks"
                          value={formData.remarks}
                          onChange={handleChange}
                          placeholder="General auditing notes..."
                        />
                        {errors.remarks && <span className="text-danger small">{errors.remarks}</span>}
                      </Form.Group>
                    </Col>
                  </Row>
                </div>
              </Col>

              {/* Section 3: Action & Rework Audits */}
              <Col md={12}>
                <h6 className="section-title border-bottom-0 mt-3">3. Action & Rework Audits</h6>
                <div className="p-3 border rounded">
                  <Row className="g-3 align-items-center">
                    <Col md={6}>
                      <Form.Check
                        type="switch"
                        id="isRecyclable-switch"
                        label="This scrap is recyclable"
                        name="isRecyclable"
                        checked={formData.isRecyclable}
                        onChange={handleCheckboxChange}
                        className="fw-semibold text-secondary"
                      />
                    </Col>
                    <Col md={6}>
                      <Form.Check
                        type="switch"
                        id="sentForRework-switch"
                        label="This scrap has been sent for rework"
                        name="sentForRework"
                        checked={formData.sentForRework}
                        onChange={handleCheckboxChange}
                        className="fw-semibold text-secondary"
                      />
                    </Col>
                  </Row>
                </div>
              </Col>
            </Row>


            <div className="d-flex justify-content-end gap-3 mt-4 border-top pt-3">
              <CustomButton
                text="Cancel"
                variant="secondary"
                onClick={() => navigate("/production-wastages")}
              />
              <CustomButton
                text={loading ? "Saving..." : (isEdit ? "Update Log" : "Submit Log")}
                type="submit"
                variant="primary"
                disabled={loading}
              />
            </div>
          </Form>
        </Card>
      </Container>
    </div>
  );
};

export default WastageForm;
