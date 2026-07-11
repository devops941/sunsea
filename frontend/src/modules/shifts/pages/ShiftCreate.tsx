import React, { useState, useEffect } from "react";
import { Container, Row, Col } from "react-bootstrap";
import { FaSave, FaEraser, FaArrowLeft } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";

import TextInput from "../../../components/form/TextInput/TextInput";
import TimePickerInput from "../../../components/form/TimePickerInput/TimePickerInput";
import CustomButton from "../../../components/ui/Button/Button";
import { createShift, fetchShifts } from "../../../features/shifts/shiftSlice";
import { shiftService } from "../../../services/shiftService";
import type { RootState, AppDispatch } from "../../../app/store";

const initialFormState = {
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

// ---- Time / overlap helpers ----

const timeToMinutes = (time: string): number => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
};

// Normalizes a shift's start/end into minutes, pushing the end into
// the "next day" (adding 1440) if it crosses midnight (e.g. 22:00 -> 06:00).
const getShiftRange = (start: string, end: string) => {
    const s = timeToMinutes(start);
    let e = timeToMinutes(end);
    if (e <= s) e += 1440; // crosses midnight
    return { start: s, end: e };
};

const doRangesOverlap = (
    aStart: number,
    aEnd: number,
    bStart: number,
    bEnd: number
): boolean => {
    return aStart < bEnd && bStart < aEnd;
};

// Checks overlap between two shifts, accounting for shifts that cross midnight.
// Compares on the normal timeline plus +1440-shifted versions of each side
// to correctly catch wrap-around overlaps (e.g. 09:00-06:00 vs 10:00-07:00).
const shiftsOverlap = (
    start1: string,
    end1: string,
    start2: string,
    end2: string
): boolean => {
    const a = getShiftRange(start1, end1);
    const b = getShiftRange(start2, end2);

    if (doRangesOverlap(a.start, a.end, b.start, b.end)) return true;
    if (doRangesOverlap(a.start, a.end, b.start + 1440, b.end + 1440)) return true;
    if (doRangesOverlap(a.start + 1440, a.end + 1440, b.start, b.end)) return true;

    return false;
};

const ShiftCreate: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch<AppDispatch>();
    const { loading, data: existingShifts } = useSelector((state: RootState) => state.shifts);

    const [formData, setFormData] = useState(initialFormState);
    const [errors, setErrors] = useState<FormErrors>({});

    useEffect(() => {
        const getNextId = async () => {
            try {
                const nextId = await shiftService.fetchNextId();
                if (nextId) setFormData(prev => ({ ...prev, shiftCode: nextId }));
            } catch (err) {
                console.error("Failed to fetch next shift ID", err);
            }
        };
        getNextId();
        dispatch(fetchShifts()); // load existing shifts so we can check for time overlaps
    }, [dispatch]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name as keyof FormErrors]) {
            setErrors(prev => ({ ...prev, [name]: undefined }));
        }
    };

    const handleClear = () => {
        setFormData({
            ...initialFormState,
            shiftCode: formData.shiftCode,
        });
        setErrors({});
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

        if (formData.startTime && formData.endTime) {
            if (formData.startTime === formData.endTime) {
                newErrors.endTime = "Start time and end time cannot be the same";
            } else {
                // Check this new shift's time range against every existing shift.
                // Handles overnight ranges (e.g. 09:00-06:00) correctly via shiftsOverlap.
                const conflict = existingShifts.find(shift =>
                    shiftsOverlap(formData.startTime, formData.endTime, shift.startTime, shift.endTime)
                );
                if (conflict) {
                    newErrors.endTime = `Overlaps with "${conflict.shiftName}" (${conflict.startTime} - ${conflict.endTime})`;
                }
            }
        }

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
            ...formData,
            breakDuration: formData.breakDuration ? Number(formData.breakDuration) : null,
            gracePeriod: formData.gracePeriod ? Number(formData.gracePeriod) : null,
        };

        try {
            await dispatch(createShift(payload)).unwrap();
            toast.success("Shift created successfully!");
            navigate("/shifts");
        } catch (err: any) {
            toast.error(err || "Failed to create shift");
        }
    };

    return (
        <div className="inner-container">
            <Container fluid>
                <div className="page-header">
                    <Row className="align-items-center g-3">
                        <Col lg={6} md={12}>
                            <div className="page-header-info">
                                <h2 className="page-title">Create Shift</h2>
                                <div className="page-breadcrumb">Home / HR & Operations / Shift Management / Create</div>
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
                            text="Clear"
                            icon={FaEraser}
                            onClick={handleClear}
                            disabled={loading}
                        />
                        <div className="ms-2">
                            <CustomButton
                                text={loading ? "Saving..." : "Save Shift"}
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

export default ShiftCreate;
