import React, { useEffect, useState } from "react";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import { machineOperationAssignmentService } from "../../../services/machineOperationAssignmentService";

interface MachineViewModalProps {
    show: boolean;
    onHide: () => void;
    machine: any;
}

const MachineViewModal: React.FC<MachineViewModalProps> = ({ show, onHide, machine }) => {
    const [currentAssignment, setCurrentAssignment] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);

    const fetchCurrentAssignment = React.useCallback(async () => {
        setLoading(true);
        try {
            const res = await machineOperationAssignmentService.getCurrentByMachine(machine.machineId);
            setCurrentAssignment(res.data);
        } catch (error) {
            console.error("Failed to fetch current assignment", error);
            setCurrentAssignment(null);
        } finally {
            setLoading(false);
        }
    }, [machine?.machineId]);

    useEffect(() => {
        if (show && machine?.machineId) {
            fetchCurrentAssignment();
        } else {
            setCurrentAssignment(null);
        }
    }, [show, machine, fetchCurrentAssignment]);

    if (!machine) return null;

    const sections = [
        {
            title: "General Information",
            fields: [
                { label: "Status", value: <StatusBadge status={machine.isActive ? "ACTIVE" : "INACTIVE"} /> },
                { label: "Operating State", value: machine.machineStatus || "IDLE" }
            ]
        },
        {
            title: "Technical Specifications",
            fields: [
                { label: "Type", value: machine.machineType || "N/A" },
                { label: "Technology", value: machine.technologyType || "N/A" },
                { label: "Capacity", value: machine.capacity ? `${machine.capacity}` : "N/A" },
                { label: "Manufacturer", value: machine.manufacturer || "N/A" }
            ]
        },
        {
            title: "Additional Details",
            fields: [
                { label: "Model Number", value: machine.modelNumber || "N/A" },
                { label: "Target Temp", value: machine.targetTemperature ? `${machine.targetTemperature} °C` : "N/A" },
                { label: "Target Load", value: machine.targetLoadPercent ? `${machine.targetLoadPercent}%` : "N/A" },
                { label: "Cycle Time", value: machine.cycleTime ? `${machine.cycleTime} min` : "N/A" }
            ]
        },
        {
            title: "Description",
            fields: [
                { label: "Notes", value: machine.description || "N/A", xs: 12 }
            ]
        }
    ];

    if (loading) {
        sections.push({
            title: "Active Assignment (Current Week)",
            fields: [{ label: "", value: "Loading assignment details..." }]
        });
    } else if (currentAssignment) {
        const operatorsTable = (
            <div className="w-full mt-2">
                <table className="w-full text-left border-collapse text-sm">
                    <thead>
                        <tr className="bg-slate-50 border-y border-slate-200">
                            <th className="px-4 py-2 font-semibold text-slate-600">S.No</th>
                            <th className="px-4 py-2 font-semibold text-slate-600">Operator Name</th>
                            <th className="px-4 py-2 font-semibold text-slate-600">Role</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentAssignment.operators && currentAssignment.operators.length > 0 ? (
                            currentAssignment.operators.map((op: any, index: number) => (
                                <tr key={index} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-2 border-b border-slate-100 text-slate-500">{index + 1}</td>
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

        const inchargeName = currentAssignment.inchargeEmployee?.fullName || currentAssignment.machine?.operatorName || currentAssignment.machine?.operatorId || "N/A";
        const inchargeRole = currentAssignment.inchargeRole?.name || (inchargeName !== "N/A" ? "Machine Operator" : "N/A");

        sections.push({
            title: "Active Assignment (Current Week)",
            fields: [
                { label: "Incharge Name", value: inchargeName },
                { label: "Incharge Role", value: inchargeRole },
                { label: "Operators", value: operatorsTable }
            ]
        });
    } else {
        sections.push({
            title: "Active Assignment (Current Week)",
            fields: [{ label: "", value: "No active assignment for this week." }]
        });
    }

    return (
        <CommonViewModal
            show={show}
            onHide={onHide}
            modalTitle="Machine Details"
            avatarText={machine.machineName.charAt(0).toUpperCase()}
            headerTitle={machine.machineName}
            headerSubtitle={`ID: ${machine.machineId}`}
            sections={sections}
        />
    );
};

export default MachineViewModal;
