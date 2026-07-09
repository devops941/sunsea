import React from "react";
import StatusBadge from "../StatusBadge/Badge";
import "./PlanningBoardGrid.css";

interface PlanningBoardGridProps {
    selectedMachine: any;
    weekStartDate?: string;
    DAY_OPTIONS: { label: string; value: number }[];
    shifts: any[];
    combinedPrograms: any[];
    SHIFT_CAPACITY_HOURS: number;
    handleDragOver: (e: React.DragEvent) => void;
    handleDrop: (e: React.DragEvent, dayValue: number, shiftId: string, machineId: string) => void;
    handleRemoveStaged: (id: string) => void;
}

const PlanningBoardGrid: React.FC<PlanningBoardGridProps> = ({
    selectedMachine,
    weekStartDate,
    DAY_OPTIONS,
    shifts,
    combinedPrograms,
    handleDragOver,
    handleDrop,
    handleRemoveStaged
}) => {
    return (
        <div className="planning-board-container">
            <div className="table-responsive">
                <table className="planning-board-table">
                    <thead>
                        <tr className="pb-header-row">
                            <th className="pb-machine-th">MACHINE</th>
                            {DAY_OPTIONS.map((d) => {
                                let displayDate = "";
                                if (weekStartDate) {
                                    const sd = new Date(weekStartDate);
                                    if (!isNaN(sd.getTime())) {
                                        sd.setDate(sd.getDate() + (d.value - 1));
                                        displayDate = sd.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                                    }
                                }
                                return (
                                    <th key={d.value} className="pb-day-th">
                                        <div className="pb-day-title">{d.label}</div>
                                        {displayDate && <div className="pb-date-subtitle">{displayDate}</div>}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="pb-machine-cell">
                                <div className="pb-machine-name">{selectedMachine?.machineName}</div>
                                <div className="pb-machine-id">{selectedMachine?.machineId}</div>
                                <StatusBadge status="ACTIVE" />
                            </td>
                            
                            {DAY_OPTIONS.map((day) => (
                                <td key={day.value} className="pb-day-cell">
                                    <div className="pb-shift-container">
                                        {shifts.map((shift: any) => {
                                            const activeShiftId = shift.shiftCode || shift.id;
                                            const cellPrograms = combinedPrograms.filter((wp: any) => 
                                                wp.dayOfWeek === day.value &&
                                                wp.shiftId === activeShiftId
                                            );
                                            
                                            const shiftCapacityQty = selectedMachine?.capacity ? Number(selectedMachine.capacity) : 0;
                                            
                                            const bookedQty = cellPrograms.reduce((sum, wp) => sum + Number(wp.plannedQty), 0);
                                            const remQty = Math.max(0, shiftCapacityQty - bookedQty);
                                            
                                            const isFull = shiftCapacityQty > 0 && remQty <= 0;
                                            const isPartial = shiftCapacityQty > 0 && remQty > 0 && remQty < shiftCapacityQty;

                                            let slotClass = "pb-slot-empty";
                                            if (isFull) slotClass = "pb-slot-full";
                                            else if (isPartial) slotClass = "pb-slot-partial";

                                            return (
                                                <div
                                                    key={activeShiftId}
                                                    onDragOver={handleDragOver}
                                                    onDrop={(e) => handleDrop(e, day.value, activeShiftId, selectedMachine.machineId)}
                                                    className={`pb-shift-slot ${slotClass}`}
                                                >
                                                    <div className="pb-slot-header">
                                                        <span className="pb-shift-name">
                                                            {shift.shiftName || activeShiftId}
                                                        </span>
                                                        <span className={`pb-rem-badge ${isFull ? 'danger' : 'success'}`}>
                                                            {remQty} PCS
                                                        </span>
                                                    </div>
                                                    
                                                    {cellPrograms.length > 0 ? (
                                                        <div className="pb-shift-programs">
                                                            {cellPrograms.map((wp: any, idx) => (
                                                                <div 
                                                                    key={idx} 
                                                                    className="pb-program-card"
                                                                    style={{ cursor: 'grab' }}
                                                                    draggable
                                                                    onDragStart={(e) => {
                                                                        e.dataTransfer.setData("application/json", JSON.stringify({
                                                                            isGridMove: true,
                                                                            productionOrderId: wp.productionOrderId
                                                                        }));
                                                                    }}
                                                                >
                                                                    <div className="pb-program-title">
                                                                        {wp.productionOrderId}
                                                                    </div>
                                                                    <div className="pb-program-details">
                                                                        {wp.plannedQty} PCS | {wp.plannedHours}h
                                                                    </div>
                                                                    {(wp.weeklyProgramId.startsWith("WP-TEMP-") || ['PLANNED', 'DRAFT'].includes(wp.status)) && (
                                                                        <span 
                                                                            className="pb-remove-btn"
                                                                            onClick={() => handleRemoveStaged(wp.weeklyProgramId)}
                                                                        >
                                                                            ×
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="pb-drop-placeholder">
                                                            Drop Here
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </td>
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PlanningBoardGrid;
