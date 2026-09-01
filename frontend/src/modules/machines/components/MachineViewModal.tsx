import React, { useEffect, useState } from "react";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import { machineOperationAssignmentService } from "../../../services/machineOperationAssignmentService";
import DataTable from "../../../components/ui/table/DataTable";

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
            ]
        },
        {
            title: "Technical Specifications",
            fields: [
                { label: "Type", value: machine.machineType || "N/A" },
                { label: "Technology", value: machine.technologyType || "N/A" },
                { label: "Target Temp", value: machine.targetTemperature ? `${machine.targetTemperature} °C` : "N/A" },
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
                <DataTable
                    data={currentAssignment.operators ?? []}
                    rowKey={(op: any) => op?.employeeId ?? op?.id ?? Math.random()}
                    emptyMessage="No operators assigned"
                    minHeightClassName=""
                    density="compact"
                    columns={[
                        {
                            header: "S.No",
                            width: "60px",
                            align: "center",
                            render: (_op, index) => index + 1,
                        },
                        {
                            header: "Operator Name",
                            render: (op) =>
                                `${op.employee?.fullName ?? ""}${op.employee?.empCode ? ` (${op.employee.empCode})` : ""}`,
                        },
                        {
                            header: "Role",
                            width: "120px",
                            render: (op) => op.role?.name || "N/A",
                        },
                    ]}
                />
            </div>
        );

        sections.push({
            title: "Active Assignment (Current Week)",
            fields: [
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
