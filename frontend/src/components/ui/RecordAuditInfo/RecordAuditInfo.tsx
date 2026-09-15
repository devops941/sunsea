import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { formatDateTime } from "../../../utils/dateUtils";
import { Eye } from "lucide-react";

export interface AuditData {
  createdBy?: string;
  createdAt?: string | Date;
  editHistory?: Array<{ updatedBy?: string; updatedByName?: string; updatedAt?: string | Date }> | null;
}

interface RecordAuditInfoProps {
  auditData: AuditData | null | undefined;
  title?: string;
}

const RecordAuditInfo: React.FC<RecordAuditInfoProps> = ({ auditData, title = "Record" }) => {
  const navigate = useNavigate();
  const location = useLocation();

  if (!auditData) return null;
  if (!auditData.createdAt && (!auditData.editHistory || auditData.editHistory.length === 0)) return null;

  const hasEdits = auditData.editHistory && auditData.editHistory.length > 1;
  const lastEdit = hasEdits ? auditData.editHistory![auditData.editHistory!.length - 1] : null;

  const handleViewHistory = () => {
    navigate("/audit-history", {
      state: {
        editHistory: auditData.editHistory,
        title,
        backUrl: location.pathname
      }
    });
  };

  return (
    <>
      <div className="mt-1 text-[10px] text-ink-subtle flex items-center space-x-4">
        {/* Created By Section */}
        <div className="flex items-center space-x-1.5">
          <span className="font-semibold uppercase tracking-wider text-[9px] text-ink-muted">Created By:</span>
          <span>
            {(auditData.createdBy && !auditData.createdBy.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) ? auditData.createdBy : "Unknown User")} on {auditData.createdAt ? formatDateTime(auditData.createdAt) : "N/A"}
          </span>
        </div>

        {/* Last Edited By Section (Inline) */}
        {hasEdits && lastEdit && (
          <div className="flex items-center space-x-1.5 border-l border-line-soft pl-4">
            <span className="font-semibold uppercase tracking-wider text-[9px] text-ink-muted">Last Edited By:</span>
            <span>
              {(lastEdit.updatedByName && !lastEdit.updatedByName.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) ? lastEdit.updatedByName : null) || 
               (lastEdit.updatedBy && !lastEdit.updatedBy.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) ? lastEdit.updatedBy : "Unknown User")} on {lastEdit.updatedAt ? formatDateTime(lastEdit.updatedAt) : "N/A"}
            </span>
            <button
              onClick={handleViewHistory}
              className="ml-2 flex items-center justify-center text-primary hover:text-primary-hover transition-colors p-1 rounded-md hover:bg-primary/10"
              title="View full edit history"
            >
              <Eye size={14} />
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default RecordAuditInfo;
