import React from "react";
import type { Employee } from "../../../features/employee/types";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";

interface EmployeeViewModalProps {
    show: boolean;
    onHide: () => void;
    employee: Employee | null;
}

const EmployeeViewModal: React.FC<EmployeeViewModalProps> = ({
    show,
    onHide,
    employee,
}) => {
    if (!employee) return null;

    return (
        <CommonViewModal
            show={show}
            onHide={onHide}
            modalTitle="Employee Details"
            avatarText={employee.fullName.charAt(0).toUpperCase()}
            headerTitle={employee.fullName}
            headerSubtitle={`${employee.empCode} | ${employee.designation?.name || "N/A"}`}
            sections={[
                {
                    title: "Professional Info",
                    fields: [
                        { label: "Department", value: employee.department?.name || "N/A" },
                        { label: "Designation", value: employee.designation?.name || "N/A" },
                        { label: "Date of Joining", value: employee.dateOfJoining ? new Date(employee.dateOfJoining).toLocaleDateString() : "N/A" },
                        {
                            label: "Status",
                            value: <StatusBadge status={employee.status === "active" ? "ACTIVE" : "INACTIVE"} />
                        }
                    ]
                },
                {
                    title: "Contact Details",
                    fields: [
                        { label: "Mobile Number", value: employee.mobile || "N/A" },
                        { label: "Email Address", value: employee.email || "N/A" },
                        { label: "Employee ID", value: <span className="text-muted font-monospace small">{String(employee.id)}</span>, xs: 12 }
                    ]
                }
            ]}
        />
    );
};

export default EmployeeViewModal;