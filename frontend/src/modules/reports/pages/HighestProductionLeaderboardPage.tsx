import React, { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "react-toastify";
import { FaRedo } from "react-icons/fa";
import { formatDate } from "../../../utils/dateUtils";

import ViewButton from "../../../components/ui/viewbutton/ViewButton";
import CommonViewModal from "../../../components/ui/CommonViewModal/CommonViewModal";
import CommonConfirmModal from "../../../components/ui/CommonConfirmModal/CommonConfirmModal";
import Button from "../../../components/ui/Button/Button";
import DataTable, { type DataTableColumn } from "../../../components/ui/table/DataTable";
import { productShiftRecordService } from "../../../services/productShiftRecordService";
import { useSocketSync } from "../../../hooks/useSocketSync";

interface HeldRecord {
  productShiftRecordId: string;
  productId: string;
  productName: string;
  productCode: string;
  machineId: string;
  machineName: string;
  achievedQty: number;
  targetQty: number;
  shiftId: string;
  recordedDate: string;
}

interface LeaderboardEntry {
  sNo: number;
  employeeId: string;
  empNo?: string;
  empCode?: string;
  name?: string;
  fullName?: string;
  total: number;
  records: HeldRecord[];
}

const HighestProductionLeaderboardPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [lastResetAt, setLastResetAt] = useState<string | null>(null);

  // View modal state
  const [selectedItem, setSelectedItem] = useState<LeaderboardEntry | null>(null);
  const [showViewModal, setShowViewModal] = useState<boolean>(false);

  // Reset confirm modal state
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productShiftRecordService.fetchLeaderboard();
      const data = res?.leaderboard || [];
      setLeaderboard(data);
      setTotalRecords(res?.totalActiveRecords || 0);
      setLastResetAt(res?.lastResetAt || null);
    } catch (err) {
      console.error("Failed to load highest production records:", err);
      toast.error("Failed to load highest production records");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleConfirmReset = async () => {
    setIsResetting(true);
    try {
      await productShiftRecordService.resetLeaderboardCounts();
      toast.success("Leaderboard count has been reset to 0. Highest records preserved.");
      setShowResetModal(false);
      fetchLeaderboard();
    } catch (err: any) {
      console.error("Failed to reset leaderboard counts:", err);
      toast.error(err?.response?.data?.message || "Failed to reset leaderboard count");
    } finally {
      setIsResetting(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Real-time socket sync when shifts submit new records
  useSocketSync("productShiftRecord", undefined, () => {
    fetchLeaderboard();
  });

  // Open view modal for operator
  const handleOpenViewItem = (item: LeaderboardEntry) => {
    setSelectedItem(item);
    setShowViewModal(true);
  };

  // Table Columns
  const columns = useMemo<DataTableColumn<LeaderboardEntry>[]>(() => [
    {
      header: "#",
      width: "70px",
      align: "center",
      render: (_row, index) => (
        <span className="text-xs font-semibold text-ink-subtle">{index + 1}</span>
      ),
    },
    {
      header: "EMP. NO",
      width: "140px",
      render: (row) => {
        const code = row.empNo || row.empCode || "—";
        return (
          <span className="font-mono font-bold text-ink text-xs sm:text-sm">
            {code}
          </span>
        );
      },
    },
    {
      header: "OPERATOR NAME",
      render: (row) => {
        const name = row.name || row.fullName || "Unnamed Operator";
        return (
          <span className="font-bold text-ink text-xs sm:text-sm">{name}</span>
        );
      },
    },
    {
      header: "TOTAL RECORDS",
      width: "150px",
      align: "center",
      render: (row) => (
        <span className="font-mono font-bold text-ink text-xs sm:text-sm">
          {row.total}
        </span>
      ),
    },
    {
      header: "ACTIONS",
      width: "100px",
      align: "center",
      render: (row) => (
        <div className="flex items-center justify-center">
          <ViewButton
            onClick={() => handleOpenViewItem(row)}
            title="View Held Records"
          />
        </div>
      ),
    },
  ], []);

  // Modal Section Information
  const modalSections = selectedItem
    ? [
        {
          title: "Operator Information",
          fields: [
            { label: "Employee Code", value: selectedItem.empNo || selectedItem.empCode || "—" },
            { label: "Operator Name", value: selectedItem.name || selectedItem.fullName || "—" },
            { label: "Total Records Held", value: `${selectedItem.total} Products` },
          ],
        },
      ]
    : [];

  // Modal Custom Content: Clean, professional table of held records (matching ProductionOrderList)
  const modalCustomContent = selectedItem ? (
    <div className="mt-2">
      <div className="text-xs font-bold text-ink uppercase tracking-wider mb-2.5">
        Product Records Held
      </div>
      <div className="w-full border border-line rounded-xl overflow-hidden mb-2">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-card-2 border-b border-line text-ink-muted">
            <tr>
              <th className="p-3 font-semibold">#</th>
              <th className="p-3 font-semibold">PRODUCT</th>
              <th className="p-3 font-semibold text-right">RECORD OUTPUT</th>
              <th className="p-3 font-semibold">MACHINE</th>
              <th className="p-3 font-semibold">SHIFT</th>
              <th className="p-3 font-semibold">DATE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-card">
            {selectedItem.records.map((rec, idx) => (
              <tr key={rec.productShiftRecordId || idx} className="hover:bg-card-2/50 transition-colors">
                <td className="p-3 text-ink-subtle">{idx + 1}</td>
                <td className="p-3 font-semibold text-ink">{rec.productName}</td>
                <td className="p-3 text-right font-bold text-ink font-mono">
                  {Number(rec.achievedQty).toLocaleString()} PCS
                </td>
                <td className="p-3 text-ink">
                  {rec.machineName} <span className="text-ink-subtle font-mono text-[11px]">({rec.machineId})</span>
                </td>
                <td className="p-3 text-ink-muted">{rec.shiftId} Shift</td>
                <td className="p-3 text-ink-muted font-mono">{rec.recordedDate ? formatDate(rec.recordedDate) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  ) : null;

  return (
    <div className="w-full flex-1 flex flex-col min-h-0 p-4 sm:p-5">
      <div className="w-full flex-1 flex flex-col bg-card rounded-2xl shadow-sm border border-line overflow-hidden min-h-[calc(100vh-140px)]">
        {/* Page Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-line">
          <div>
            <h2 className="text-base font-bold text-ink">Highest Production List</h2>
          </div>
          <div>
            <Button
              text="Reset Count"
              icon={FaRedo}
              variant="danger"
              size="sm"
              onClick={() => setShowResetModal(true)}
            />
          </div>
        </div>

        {/* Sub-header Stats Bar */}
        <div className="px-5 py-2.5 bg-card-2 border-b border-line flex items-center justify-between text-xs text-ink-muted">
          <div className="flex items-center gap-4">
            <span>
              Total Products Tracked: <strong className="font-bold text-ink">{totalRecords}</strong>
            </span>
            <span>
              Active Record Holders: <strong className="font-bold text-ink">{leaderboard.length}</strong>
            </span>
          </div>
          {lastResetAt && (
            <div className="text-ink-subtle">
              Count Reset On: <strong className="text-ink font-semibold">{formatDate(lastResetAt)}</strong>
            </div>
          )}
        </div>

        {/* DataTable */}
        <div className="flex-1 min-h-0 flex flex-col outline-none">
          <DataTable
            columns={columns}
            data={leaderboard}
            rowKey={(item) => item.employeeId}
            loading={loading}
            emptyMessage="No highest production records found."
            className="border-0 rounded-none shadow-none flex-1 flex flex-col min-h-0"
            minHeightClassName="min-h-0 flex-1"
            onRowClick={(item) => handleOpenViewItem(item)}
          />
        </div>
      </div>

      {/* Operator Record Details Modal (CommonViewModal) */}
      <CommonViewModal
        show={showViewModal}
        onHide={() => {
          setShowViewModal(false);
          setSelectedItem(null);
        }}
        modalTitle="Highest Production Record Details"
        headerTitle={selectedItem ? (selectedItem.name || selectedItem.fullName || "Operator") : ""}
        headerSubtitle={selectedItem ? `Employee Code: ${selectedItem.empNo || selectedItem.empCode || "—"}` : ""}
        sections={modalSections}
        customContent={modalCustomContent}
        size="xl"
      />

      {/* Reset Confirmation Modal */}
      <CommonConfirmModal
        show={showResetModal}
        onHide={() => setShowResetModal(false)}
        onConfirm={handleConfirmReset}
        title="Reset Leaderboard Counts"
        message="Are you sure you want to reset all operator record counts to 0? The counts will start fresh from 0 for any new records."
        warningText="All-time highest production records will NOT be deleted or reset; only the leaderboard count resets to 0."
        confirmText="Reset Count"
        confirmVariant="danger"
        isDangerous={true}
        isLoading={isResetting}
      />
    </div>
  );
};

export default HighestProductionLeaderboardPage;
