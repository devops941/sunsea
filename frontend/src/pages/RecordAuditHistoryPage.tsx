import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { formatDateTime } from "../utils/dateUtils";
import { ArrowLeft, History, User as UserIcon, Calendar } from "lucide-react";

export const RecordAuditHistoryPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as {
    editHistory?: Array<{ updatedBy?: string; updatedByName?: string; updatedAt?: string | Date }>;
    title?: string;
  };

  if (!state || !state.editHistory || state.editHistory.length === 0) {
    return (
      <div className="w-full min-w-0 my-3">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-6 cursor-pointer text-primary" onClick={() => navigate(-1)}>
            <ArrowLeft size={20} />
            <span className="font-medium">Go Back</span>
          </div>
          <p className="text-ink-subtle">No audit history found.</p>
        </div>
      </div>
    );
  }

  const { editHistory, title = "Record" } = state;

  return (
    <div className="p-6 max-w-5xl mx-auto h-[calc(100vh-10rem)] flex flex-col">
      <div className="flex items-center gap-4 mb-6 shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-lg hover:bg-card-2 text-ink-subtle hover:text-ink transition-colors cursor-pointer"
          title="Go Back"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <History size={24} className="text-primary" />
          <h1 className="text-2xl font-bold text-ink">{title} - Full Edit History</h1>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-line-soft shadow-sm overflow-hidden flex flex-col flex-1">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse relative">
            <thead className="sticky top-0 z-10 bg-card shadow-sm">
              <tr className="border-b border-line-soft bg-card-2/95 backdrop-blur text-ink-muted text-xs uppercase tracking-wider">
                <th className="py-3 px-4 font-semibold w-16">#</th>
                <th className="py-3 px-4 font-semibold w-32">Action</th>
                <th className="py-3 px-4 font-semibold">User</th>
                <th className="py-3 px-4 font-semibold">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {editHistory.map((edit, index) => {
                const isCreation = index === 0;
                const userName = (edit.updatedByName && !edit.updatedByName.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) ? edit.updatedByName : null) ||
                  (edit.updatedBy && !edit.updatedBy.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) ? edit.updatedBy : "Unknown User");

                return (
                  <tr key={index} className="hover:bg-card-2/30 transition-colors">
                    <td className="py-3 px-4 text-sm font-medium text-ink-subtle">
                      {index + 1}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded-md ${isCreation ? 'bg-primary/10 text-primary' : 'bg-ink-muted/10 text-ink-muted'}`}>
                        {isCreation ? 'Created' : 'Edited'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-ink">
                      {userName}
                    </td>
                    <td className="py-3 px-4 text-sm text-ink-subtle">
                      {edit.updatedAt ? formatDateTime(edit.updatedAt) : "N/A"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RecordAuditHistoryPage;
