import React, { useState, useEffect } from "react";
import { FaUserCheck, FaHistory, FaPlus, FaCogs, FaCheckCircle, FaExclamationCircle } from "react-icons/fa";
import { toast } from "react-toastify";
import CustomButton from "../../../components/ui/Button/Button";
import StatusBadge from "../../../components/ui/StatusBadge/Badge";
import DataTable from "../../../components/ui/table/DataTable";
import { formatDate } from "../../../utils/dateUtils";
import {
  machineOperationAssignmentService,
  type MachineOperationAssignment,
} from "../../../services/machineOperationAssignmentService";
import { MachineAssignmentFormModal } from "./MachineAssignmentFormModal";

interface Props {
  machineId: string;
  machineName?: string;
}

export const MachineAssignmentTab: React.FC<Props> = ({ machineId, machineName }) => {
  const [currentAssignment, setCurrentAssignment] = useState<MachineOperationAssignment | null>(null);
  const [history, setHistory] = useState<MachineOperationAssignment[]>([]);
  const [loading, setLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = async () => {
    if (!machineId) return;
    setLoading(true);
    try {
      const [currRes, histRes] = await Promise.all([
        machineOperationAssignmentService.getCurrentByMachine(machineId),
        machineOperationAssignmentService.getHistoryByMachine(machineId),
      ]);

      setCurrentAssignment(currRes.data || null);
      setHistory(histRes.data || []);
    } catch (err: any) {
      console.error("Failed to load machine assignment data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [machineId]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Action */}
      <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
            <FaCogs size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base">
              Machine Operation Assignments for {machineName || machineId}
            </h3>
            <p className="text-xs text-slate-500">
              Manage current week operator & incharge assignment and view assignment history
            </p>
          </div>
        </div>

        <CustomButton
          text="Assign Operator & Incharge"
          icon={FaPlus}
          variant="primary"
          onClick={() => setIsModalOpen(true)}
        />
      </div>

      {/* Current Active Assignment Card */}
      <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden bg-white">
        <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200">
          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <FaCheckCircle className="text-emerald-500" /> Current Active Assignment
          </h4>
          {currentAssignment && (
            <StatusBadge
              status={currentAssignment.isActive ? "Active" : "Closed"}
              customText={currentAssignment.isActive ? "Active Week" : "Closed"}
            />
          )}
        </div>

        <div className="p-5">
          {currentAssignment ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Operators */}
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentAssignment.operators && currentAssignment.operators.length > 0 ? (
                  currentAssignment.operators.map((op: any, index: number) => (
                    <div key={index} className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-indigo-500">
                        Assigned Operator {index + 1}
                      </span>
                      {op.employee ? (
                        <div className="mt-2">
                          <p className="font-bold text-slate-800 text-base">
                            {op.employee.fullName}
                          </p>
                          <p className="text-xs text-slate-500">
                            Code: {op.employee.empCode}
                          </p>
                          {op.role && (
                            <span className="inline-block mt-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-semibold">
                              Role: {op.role.name}
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400 mt-2 font-medium">— Unassigned —</p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl col-span-2">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-indigo-500">
                      Assigned Operators
                    </span>
                    <p className="text-sm text-slate-400 mt-2 font-medium">— No Operators Assigned —</p>
                  </div>
                )}
              </div>

              {/* Week & Details */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between">
                <div>
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                    Week Period & Shift
                  </span>
                  <p className="font-bold text-slate-800 text-sm mt-1">
                    {currentAssignment.weekStartDate
                      ? currentAssignment.weekStartDate.split("T")[0]
                      : ""}{" "}
                    to{" "}
                    {currentAssignment.weekEndDate
                      ? currentAssignment.weekEndDate.split("T")[0]
                      : ""}
                  </p>
                  {currentAssignment.shift && (
                    <p className="mt-1 text-xs font-semibold text-indigo-600 bg-indigo-50 inline-block px-2 py-0.5 rounded">
                      Shift: {currentAssignment.shift.shiftName}
                    </p>
                  )}
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  <span>Assigned By: {currentAssignment.assignedBy || "SYSTEM"}</span>
                  {currentAssignment.remarks && (
                    <p className="mt-1 text-slate-600 italic">"{currentAssignment.remarks}"</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl">
              <FaExclamationCircle className="mx-auto text-slate-400 mb-2" size={24} />
              <p className="text-sm font-semibold text-slate-600">
                No active assignment found for this machine for the current week.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Click "Assign Operator & Incharge" above to create an assignment.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Assignment History Table (Newest First) */}
      <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden bg-white">
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <FaHistory className="text-blue-600" /> Assignment History (Newest First)
          </h4>
          <span className="text-xs text-slate-500">{history.length} records</span>
        </div>

        <div className="p-5">
          <DataTable
            data={history}
            rowKey={(item: any) => item.id}
            isLoading={loading}
            columns={[
              {
                header: "WEEK & SHIFT",
                render: (item) => (
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-slate-800 text-sm">
                      {item.weekStartDate ? item.weekStartDate.split("T")[0] : ""} to{" "}
                      {item.weekEndDate ? item.weekEndDate.split("T")[0] : ""}
                    </span>
                    {item.shift ? (
                      <span className="text-xs text-indigo-600 font-medium">
                        {item.shift.shiftName}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">All Shifts</span>
                    )}
                  </div>
                ),
              },
              {
                header: "OPERATORS & ROLES",
                render: (item) => (
                  <div>
                    {item.operators && item.operators.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {item.operators.map((op: any, i: number) => (
                          <div key={i}>
                            <div className="font-semibold text-slate-800 text-sm">
                              {op.employee?.fullName}
                            </div>
                            <div className="text-xs text-slate-500">
                              {op.role?.name || "Operator"}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-sm">—</span>
                    )}
                  </div>
                ),
              },
              {
                header: "STATUS",
                render: (item) => (
                  <StatusBadge
                    status={item.isActive ? "Active" : "Closed"}
                    customText={item.isActive ? "Active" : "Closed"}
                  />
                ),
              },
              {
                header: "ASSIGNED BY",
                render: (item) => (
                  <span className="text-slate-600 text-xs">{item.assignedBy || "SYSTEM"}</span>
                ),
              },
              {
                header: "CREATED DATE",
                render: (item) => (
                  <span className="text-slate-500 text-xs">
                    {item.createdAt ? formatDate(item.createdAt) : "—"}
                  </span>
                ),
              },
              {
                header: "REMARKS",
                render: (item) => (
                  <span className="text-slate-500 text-xs italic">{item.remarks || "—"}</span>
                ),
              },
            ]}
          />
        </div>
      </div>

      {/* Modal */}
      <MachineAssignmentFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadData}
        initialData={{ machineId }}
      />
    </div>
  );
};
