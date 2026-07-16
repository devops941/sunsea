import React from "react";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import CustomButton from "../../../components/ui/Button/Button";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";

interface WastageViewModalProps {
  show: boolean;
  onHide: () => void;
  wastage: any;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

const WastageViewModal: React.FC<WastageViewModalProps> = ({
  show,
  onHide,
  wastage,
  onApprove,
  onReject
}) => {
  if (!wastage) return null;

  const sections = [
    {
      title: "Basic Information",
      fields: [
        { label: "Machine", value: wastage.machine?.machineName || wastage.machineId },
        { label: "Shift", value: wastage.shift?.shiftName || wastage.shiftId },
        { label: "PO Ref", value: wastage.productionOrderId },
        { label: "Product", value: wastage.product?.productName || "Unknown" },
      ]
    },
    {
      title: "Wastage Metrics",
      fields: [
        { label: "Wastage Type", value: <StatusBadge status={wastage.wastageType} /> },
        { label: "Logged Quantity", value: `${wastage.quantity} ${wastage.uom}` },
        { label: "Estimated Value", value: `â‚¹${wastage.estimatedValue ? Number(wastage.estimatedValue).toFixed(2) : "0.00"}` },
        { label: "Raw Material Component", value: wastage.rawMaterial?.materialName || "N/A" },
      ]
    },
    {
      title: "Audit & Options",
      fields: [
        { label: "Recyclable Wastage", value: wastage.isRecyclable ? "Yes" : "No" },
        { label: "Sent for Rework", value: wastage.sentForRework ? "Yes" : "No" },
        { label: "Approved By", value: wastage.approvedBy || "Not Audited" },
      ]
    },
    {
      title: "Explanation Details",
      fields: [
        { label: "Reason for waste", value: wastage.reason || "No reason logged." },
        { label: "Corrective Action Taken", value: wastage.correctiveAction || "No corrective action recorded." },
        { label: "Remarks", value: wastage.remarks || "No remarks." },
      ]
    }
  ];

  const footerActions = wastage.status === "DRAFT" ? (
    <>
      <CustomButton
        text="Reject"
        variant="danger"
        onClick={() => onReject(String(wastage.id))}
      />
      <CustomButton
        text="Approve"
        variant="success"
        onClick={() => onApprove(String(wastage.id))}
      />
    </>
  ) : null;

  return (
    <CommonViewModal
      show={show}
      onHide={onHide}
      size="lg"
      modalTitle="Wastage Log Details"
      avatarText={wastage.wastageNo ? wastage.wastageNo.substring(0, 2) : "WA"}
      headerTitle={`Wastage No: ${wastage.wastageNo}`}
      headerSubtitle={`Date: ${new Date(wastage.wastageDate).toLocaleDateString()}`}
      statusNode={<StatusBadge status={wastage.status} />}
      sections={sections}
      footer={footerActions}
    />
  );
};

export default WastageViewModal;

