import React from "react";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";

interface MachineViewModalProps {
    show: boolean;
    onHide: () => void;
    machine: any;
}

const MachineViewModal: React.FC<MachineViewModalProps> = ({ show, onHide, machine }) => {
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

    return (
        <CommonViewModal
            show={show}
            onHide={onHide}
            modalTitle="Machine Details"
            avatarText={machine.machineName ? machine.machineName.charAt(0).toUpperCase() : "M"}
            headerTitle={machine.machineName}
            headerSubtitle={`ID: ${machine.machineId}`}
            sections={sections}
        />
    );
};

export default MachineViewModal;
