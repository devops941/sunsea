import React, { useState, useEffect } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaSave, FaEraser, FaArrowLeft } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";

import TextInput from "../../../components/form/TextInput/TextInput";
import TimePickerInput from "../../../components/form/TimePickerInput/TimePickerInput";
import CustomButton from "../../../components/ui/Button/Button";
import { updateShift } from "../../../features/shifts/shiftSlice";
import type { RootState, AppDispatch } from "../../../app/store";

const initialFormState = {
    id: 0,
    shiftCode: "",
    shiftName: "",
    startTime: "",
    endTime: "",
    breakDuration: "",
    gracePeriod: "",
};

interface FormErrors {
    shiftName?: string;
    startTime?: string;
    endTime?: string;
    breakDuration?: string;
    gracePeriod?: string;
}

const ShiftEdit: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useDispatch<AppDispatch>();
    const { loading } = useSelector((state: RootState) => state.shifts);

    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState<FormErrors>({});

    useEffect(() => {
        if (location.state) {
            setFormData({
                id: location.state.id || 0,
                shiftCode: location.state.shiftCode || "",
                shiftName: location.state.shiftName || "",
                startTime: location.state.startTime || "",
                endTime: location.state.endTime || "",
                breakDuration: location.state.breakDuration !== null && location.state.breakDuration !== undefined
                    ? String(location.state.breakDuration)
                    : "",
                gracePeriod: location.state.gracePeriod !== null && location.state.gracePeriod !== undefined
                    ? String(location.state.gracePeriod)
                    : "",
            });
        } else {
            toast.error("No shift data provided.");
            navigate("/shifts");
        }
    }, [location.state, navigate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name as keyof FormErrors]) {
            setErrors(prev => ({ ...prev, [name]: undefined }));
        }
    };

    const validate = (): boolean => {
        const newErrors: FormErrors = {};

        if (!formData.shiftName.trim()) {
            newErrors.shiftName = "Shift name is required";
        }

        if (!formData.startTime) {
            newErrors.startTime = "Start time is required";
        }

        if (!formData.endTime) {
            newErrors.endTime = "End time is required";
        }
        // else if (formData.startTime && formData.endTime <= formData.startTime) {
        // //     newErrors.endTime = "End time must be after start time";
        // // }

        if (formData.breakDuration && Number(formData.breakDuration) < 0) {
            newErrors.breakDuration = "Break duration cannot be negative";
        }

        if (formData.gracePeriod && Number(formData.gracePeriod) < 0) {
            newErrors.gracePeriod = "Grace period cannot be negative";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        const payload = {
            shiftCode: formData.shiftCode,
            shiftName: formData.shiftName,
            startTime: formData.startTime,
            endTime: formData.endTime,
            breakDuration: formData.breakDuration ? Number(formData.breakDuration) : null,
            gracePeriod: formData.gracePeriod ? Number(formData.gracePeriod) : null,
        };
        try {
            await dispatch(updateShift({ id: formData.id, data: payload })).unwrap();
            toast.success("Shift updated successfully!");
            navigate("/shifts");
        } catch (err: any) {
            toast.error(err || "Failed to update shift");
        }
    };

    return (
        <div className="inner-container">
            <Container fluid>
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Edit Shift</h2>
                                <div className="page-breadcrumb">Home / HR & Operations / Shift Management / Edit</div>
                            </div>
                        </Col>
                        <Col lg={6} md={12}>
                            <div className="page-header-actions">
                                <CustomButton
                                    text="Back to List"
                                    icon={FaArrowLeft}
                                    onClick={() => navigate("/shifts")}
                                />
                            </div>
                        </Col>
                    </Row>
                </div>

                <form onSubmit={handleSubmit} className="form-inner">
                    <Row className="g-3">
                        <Col md={6}>
                            <TextInput
                                label="Shift Code"
                                name="shiftCode"
                                value={formData.shiftCode}
                                placeholder="e.g. SHF-001"
                                required
                                onChange={handleChange}
                                disabled
                            />
                        </Col>
                        <Col md={6}>
                            <TextInput
                                label="Shift Name"
                                name="shiftName"
                                value={formData.shiftName}
                                placeholder="e.g. Morning Shift"
                                required
                                onChange={handleChange}
                                error={errors.shiftName}
                            />
                        </Col>
                        <Col md={6}>
                            <TimePickerInput
                                label="Start Time"
                                name="startTime"
                                value={formData.startTime}
                                required
                                onChange={(val) => {
                                    setFormData(prev => ({ ...prev, startTime: val }));
                                    if (errors.startTime) {
                                        setErrors(prev => ({ ...prev, startTime: undefined }));
                                    }
                                }}
                                error={errors.startTime}
                            />
                        </Col>
                        <Col md={6}>
                            <TimePickerInput
                                label="End Time"
                                name="endTime"
                                value={formData.endTime}
                                required
                                onChange={(val) => {
                                    setFormData(prev => ({ ...prev, endTime: val }));
                                    if (errors.endTime) {
                                        setErrors(prev => ({ ...prev, endTime: undefined }));
                                    }
                                }}
                                error={errors.endTime}
                            />
                        </Col>
                        <Col md={6}>
                            <TextInput
                                label="Break Duration (mins)"
                                name="breakDuration"
                                value={formData.breakDuration}
                                type="number"
                                placeholder="e.g. 30"
                                onChange={handleChange}
                                error={errors.breakDuration}
                            />
                        </Col>
                        <Col md={6}>
                            <TextInput
                                label="Grace Period (mins)"
                                name="gracePeriod"
                                value={formData.gracePeriod}
                                type="number"
                                placeholder="e.g. 15"
                                onChange={handleChange}
                                error={errors.gracePeriod}
                            />
                        </Col>
                    </Row>

                    <div className="form-actions d-flex justify-content-end gap-3 mt-4">
                        <CustomButton
                            text="Cancel"
                            icon={FaEraser}
                            onClick={() => navigate("/shifts")}
                            disabled={loading}
                        />
                        <div className="ms-2">
                            <CustomButton
                                text={loading ? "Saving..." : "Update Shift"}
                                icon={FaSave}
                                type="submit"
                                disabled={loading}
                            />
                        </div>
                    </div>
                </form>
            </Container>
        </div>
    );
};

export default ShiftEdit;
