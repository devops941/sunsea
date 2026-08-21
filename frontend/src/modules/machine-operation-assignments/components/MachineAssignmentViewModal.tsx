import React from "react";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import { formatDate } from "../../../utils/dateUtils";

interface MachineAssignmentViewModalProps {
    show: boolean;
    onHide: () => void;
    assignment: any;
}

const MachineAssignmentViewModal: React.FC<MachineAssignmentViewModalProps> = ({ show, onHide, assignment }) => {
    if (!assignment) return null;

    const operatorsTable = (
        <div className="overflow-x-auto w-full mt-2 border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                        <th className="px-4 py-2 border-b border-slate-200 font-semibold">#</th>
                        <th className="px-4 py-2 border-b border-slate-200 font-semibold">Operator Name</th>
                        <th className="px-4 py-2 border-b border-slate-200 font-semibold">Role</th>
                    </tr>
                </thead>
                <tbody className="text-sm">
                    {assignment.operators && assignment.operators.length > 0 ? (
                        assignment.operators.map((op: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50">
                                <td className="px-4 py-2 border-b border-slate-100 text-slate-500">{i + 1}</td>
                                <td className="px-4 py-2 border-b border-slate-100 font-medium text-slate-800">
                                    {op.employee?.fullName} {op.employee?.empCode ? `(${op.employee.empCode})` : ""}
                                </td>
                                <td className="px-4 py-2 border-b border-slate-100 text-slate-600">{op.role?.name || "N/A"}</td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={3} className="px-4 py-3 text-center text-slate-400">No operators assigned</td>
                        </tr>
                    )}
                </tbody>
            </table>
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
