import React from "react";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import { formatDate } from "../../../utils/dateUtils";
import DataTable from "../../../components/ui/table/DataTable";

interface MachineAssignmentViewModalProps {
    show: boolean;
    onHide: () => void;
    assignment: any;
}

const MachineAssignmentViewModal: React.FC<MachineAssignmentViewModalProps> = ({ show, onHide, assignment }) => {
    if (!assignment) return null;

    const operatorsTable = (
        <div className="w-full mt-2">
            <DataTable
                data={assignment.operators ?? []}
                rowKey={(_op: any, i: number) => i}
                emptyMessage="No operators assigned"
                minHeightClassName=""
                density="compact"
                columns={[
                    {
                        header: "#",
                        width: "60px",
                        align: "center",
                        render: (_op: any, i: number) => i + 1,
                    },
                    {
                        header: "Operator Name",
                        render: (op: any) =>
                            `${op.employee?.fullName ?? ""}${op.employee?.empCode ? ` (${op.employee.empCode})` : ""}`,
                    },
                    {
                        header: "Role",
                        width: "120px",
                        render: (op: any) => op.role?.name || "N/A",
                    },
                ]}
            />
        </div>
    );

    const sections = [
        {
            title: "General Information",
            fields: [
                { label: "Status", value: <StatusBadge status={assignment.isActive ? "ACTIVE" : "INACTIVE"} customText={assignment.isActive ? "Active Week" : "Closed / Expired"} /> },
                { label: "Machine Name", value: assignment.machine?.machineName || "N/A" },
                { label: "Machine ID", value: assignment.machineId || "N/A" },
                { label: "Shift", value: assignment.shift?.shiftName ? `${assignment.shift.shiftName} (${assignment.shift.startTime} - ${assignment.shift.endTime})` : assignment.shiftId || "N/A" }
            ]
        },
        {
            title: "Time Period",
            fields: [
                { label: "Week Start Date", value: assignment.weekStartDate ? assignment.weekStartDate.split("T")[0] : "N/A" },
                { label: "Week End Date", value: assignment.weekEndDate ? assignment.weekEndDate.split("T")[0] : "N/A" },
                { label: "Created At", value: assignment.createdAt ? formatDate(assignment.createdAt) : "N/A" },
                { label: "Assigned By", value: assignment.assignedBy || "SYSTEM" }
            ]
        },
        {
            title: "Assigned Personnel",
            fields: [
                { label: "Operators", value: operatorsTable, xs: 12 }
            ]
        },
        {
            title: "Additional Details",
            fields: [
                { label: "Remarks", value: assignment.remarks || "No remarks", xs: 12 }
            ]
        }
    ];

    return (
        <CommonViewModal
            show={show}
            onHide={onHide}
            modalTitle="Machine Assignment Details"
            avatarText={assignment.machine?.machineName?.charAt(0)?.toUpperCase() || 'M'}
            headerTitle={assignment.machine?.machineName || `Machine ${assignment.machineId}`}
            headerSubtitle={`Assignment ID: ${assignment.id}`}
            sections={sections}
        />
    );
};

export default MachineAssignmentViewModal;
