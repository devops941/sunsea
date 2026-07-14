import React, { useEffect } from "react";
import { FaArrowLeft, FaUser, FaBriefcase, FaIdBadge, FaPhoneAlt } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import CustomButton from "../../components/ui/Button/Button";
import type { RootState, AppDispatch } from "../../app/store";
import { fetchProfile } from "../../features/profiles/profileSlice";
import { StatusBadge } from "../../components/ui/StatusBadge/Badge";


const formatDate = (date?: string | null) =>
    date ? new Date(date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : "N/A";

const getInitials = (name?: string | null) => {
    if (!name) return "—";
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
};

const ProfilePage: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch<AppDispatch>();
    const { employee, loading } = useSelector((state: RootState) => state.profile);

    useEffect(() => {
        dispatch(fetchProfile());
    }, [dispatch]);

    if (loading || !employee) {
        return <div className="text-center p-5 mt-5 fw-bold text-primary">Loading profile...</div>;
    }

    return (
        <div className="cp-wrapper">
            <div className="cp-card">
                {/* HEADER */}
                <div className="cp-header">
                    <div className="cp-header-left">
                        <div className="cp-logo">
                            {getInitials(employee.fullName)}
                        </div>
                        <div className="cp-company-title">
                            <h2 className="cp-company-name">{employee.fullName || "N/A"}</h2>
                            <span className="cp-company-type">
                                <FaIdBadge style={{ marginRight: '6px' }} />
                                {employee.department?.name || "Employee Profile"}
                            </span>
                        </div>
                    </div>
                    <div className="cp-header-right">
                        <div className="cp-code-status">
                            <span className="cp-company-code me-3">
                                <FaBriefcase style={{ marginRight: '6px' }} />
                                {employee.empCode || "-"}
                            </span>
                            <StatusBadge status={employee.status || "UNKNOWN"} />
                        </div>
                    </div>
                </div>

                {/* BODY */}
                <div className="cp-body">
                    {/* Professional Info */}
                    <div className="cp-section">
                        <div className="cp-section-title">
                            <FaBriefcase /> Professional Info
                        </div>
                        <div className="cp-grid">
                            <div className="cp-info-item">
                                <span className="cp-info-label">Employee Code</span>
                                <span className="cp-info-value">{employee.empCode || "N/A"}</span>
                            </div>
                            <div className="cp-info-item">
                                <span className="cp-info-label">Department</span>
                                <span className="cp-info-value">{employee.department?.name || "N/A"}</span>
                            </div>
                            <div className="cp-info-item">
                                <span className="cp-info-label">Date of Joining</span>
                                <span className="cp-info-value">{formatDate(employee.dateOfJoining)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Personal Info */}
                    <div className="cp-section">
                        <div className="cp-section-title">
                            <FaUser /> Personal Information
                        </div>
                        <div className="cp-grid">
                            <div className="cp-info-item">
                                <span className="cp-info-label">Full Name</span>
                                <span className="cp-info-value">{employee.fullName || "N/A"}</span>
                            </div>
                            <div className="cp-info-item">
                                <span className="cp-info-label">System Role</span>
                                <span className="cp-info-value">{employee.designation?.name || "Standard User"}</span>
                            </div>
                            <div className="cp-info-item">
                                <span className="cp-info-label">Account Created</span>
                                <span className="cp-info-value">{formatDate(employee.createdAt)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Contact Details */}
                    <div className="cp-section">
                        <div className="cp-section-title">
                            <FaPhoneAlt /> Contact Details
                        </div>
                        <div className="cp-grid">
                            <div className="cp-info-item">
                                <span className="cp-info-label">Mobile Number</span>
                                <span className="cp-info-value">{employee.mobile || "N/A"}</span>
                            </div>
                            <div className="cp-info-item">
                                <span className="cp-info-label">Email Address</span>
                                <span className="cp-info-value">{employee.email || "N/A"}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* FOOTER */}
                <div className="cp-footer">
                    <CustomButton text="Back" icon={FaArrowLeft} onClick={() => navigate(-1)} />
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
