import { formatDate } from "../../../utils/dateUtils";
import React from "react";
import { Card, Col, Row } from "react-bootstrap";
import { FaPlay } from "react-icons/fa";
import StatusBadge from "../StatusBadge/Badge";
import CustomButton from "../Button/Button";
import "./DayScheduleCard.css";

interface Program {
  weeklyProgramId: string;
  productionOrderId: string;
  productName: string;
  productCode?: string;
  priority: string;
  plannedQty: number;
  producedQty: number;
  remainingQty: number;
  status: string;
  machineName?: string;
}

interface Shift {
  shiftId: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  programs: Program[];
}

interface Day {
  dayOfWeek: number;
  dayName: string;
  date: string;
  shifts: Shift[];
}

interface DayScheduleCardProps {
  day: Day;
  machineName?: string;
  onHourlyProductionClick: (day: Day, shift: Shift, program: Program) => void;
  onStopProductionClick?: (day: Day, shift: Shift, program: Program) => void;
  onEditClick?: (day: Day, shift: Shift, program: Program) => void;
  onDeleteClick?: (day: Day, shift: Shift, program: Program) => void;
  onAddUrgentClick?: (day: Day, shift: Shift) => void;
  startedPrograms?: Set<string>;
  completedPrograms?: Set<string>;
}

const DayScheduleCard: React.FC<DayScheduleCardProps> = ({ 
  day, 
  machineName, 
  onHourlyProductionClick, 
  onStopProductionClick,
  onEditClick,
  onDeleteClick,
  onAddUrgentClick,
  startedPrograms: _startedPrograms, 
  completedPrograms 
}) => {
  const hasPlans = day.shifts.some((s) => s.programs.length > 0);

  return (
    <Card className="h-100 shadow-sm border-0 day-schedule-card">
      <Card.Header className="bg-white pt-4 px-4 pb-0 border-0 d-flex justify-content-between align-items-center">
        <div>
          <h5 className="mb-1 fw-bold text-dark">{day.dayName}</h5>
          <span className="text-muted small fw-medium">
            {formatDate(day.date)}
          </span>
        </div>
        <StatusBadge
          status={hasPlans ? "SCHEDULED" : "DRAFT"}
          customText={hasPlans ? "Scheduled" : "No Plan"}
          customColor={hasPlans ? undefined : { bg: "#f8f9fa", text: "#6c757d" }}
        />
      </Card.Header>

      <Card.Body className="px-4 py-3">
        <div className="d-flex flex-column gap-3">
          {day.shifts.map((shift) => {
            const hasProgramsInShift = shift.programs.length > 0;

            return (
              <div key={shift.shiftId} className="p-3 bg-light rounded border border-light">
                {/* Shift Sub-Header */}
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div className="d-flex align-items-center gap-2">
                    <span className="section-title border-bottom-0 mb-0">{shift.shiftName}</span>
                    {onAddUrgentClick && (
                      <button
                        type="button"
                        onClick={() => onAddUrgentClick(day, shift)}
                        className="btn btn-link p-0 ms-2 text-decoration-none fw-bold"
                        style={{ fontSize: "12px", color: "var(--color-primary, #4caf50)" }}
                      >
                        + Add Urgent Run
                      </button>
                    )}
                  </div>
                  <span className="badge bg-secondary">
                    {shift.startTime} - {shift.endTime}
                  </span>
                </div>

                {/* Shift Programs */}
                {hasProgramsInShift ? (
                  <div className="d-flex flex-column gap-3">
                    {shift.programs.map((prog) => {
                      const isStarted = prog.status === "IN_PROGRESS";
                      const programKey = prog.weeklyProgramId;
                      const isCompletedByHours = completedPrograms?.has(programKey);
                      const isCompleted = prog.status === "COMPLETED" || prog.producedQty >= prog.plannedQty || isCompletedByHours;

                      return (
                      <div key={prog.weeklyProgramId} className="bg-white p-3 rounded border shadow-sm">
                        <div className="d-flex justify-content-between align-items-start mb-3">
                          <div>
                            {(prog.machineName || machineName) && (
                              <div className="text-muted small mb-1">
                                MACHINE: <span className="text-dark fw-bold px-1 rounded bg-light">{prog.machineName || machineName}</span>
                              </div>
                            )}
                            <div className="text-muted small mb-2">
                                PO NO: <span className="color-primary fw-bold rounded" style={{ fontSize: "0.85rem" }}>{prog.productionOrderId}</span>
                            </div>
                            <div className="text-dark fw-bold fs-6">{prog.productName}</div>
                          </div>
                          <StatusBadge status={prog.status} />
                        </div>

                        {/* Quantities Grid */}
                        <Row className="g-2 my-3 text-center bg-light p-2 rounded border border-light">
                          <Col xs={4}>
                            <div className="text-muted fw-bold mb-1" style={{ fontSize: "10px", letterSpacing: "0.5px" }}>
                              PLANNED
                            </div>
                            <div className="fw-bold text-dark fs-5">{prog.plannedQty}</div>
                          </Col>
                          <Col xs={4}>
                            <div className="text-muted fw-bold mb-1" style={{ fontSize: "10px", letterSpacing: "0.5px" }}>
                              PRODUCED
                            </div>
                            <div className="fw-bold text-success fs-5">{prog.producedQty}</div>
                          </Col>
                          <Col xs={4}>
                            <div className="text-muted fw-bold mb-1" style={{ fontSize: "10px", letterSpacing: "0.5px" }}>
                              REMAINING
                            </div>
                            <div className="fw-bold text-warning fs-5">{prog.remainingQty}</div>
                          </Col>
                        </Row>

                        <div className="d-flex justify-content-between align-items-center mt-3 pt-3 border-top">
                          <StatusBadge status={prog.status} />

                          {isCompleted ? (
                            <div className="d-flex flex-column align-items-end">
                              <span className={`fw-bold ${prog.producedQty >= prog.plannedQty ? 'text-success' : 'text-danger'}`}>
                                Completed
                              </span>
                              {prog.producedQty < prog.plannedQty && (
                                <span className="text-danger small fw-bold" style={{ fontSize: '10px' }}>Target Not Reached ({prog.plannedQty - prog.producedQty} Short)</span>
                              )}
                            </div>
                          ) : (
                            <div className="d-flex gap-2 align-items-center">
                              {isStarted && onStopProductionClick && (
                                <button
                                  type="button"
                                  title="Stop & Complete Run"
                                  onClick={() => onStopProductionClick(day, shift, prog)}
                                  className="btn btn-outline-danger d-flex align-items-center justify-content-center p-0"
                                  style={{ width: "36px", height: "36px", borderRadius: "8px" }}
                                >
                                  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 448 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M400 32H48C21.5 32 0 53.5 0 80v352c0 26.5 21.5 48 48 48h352c0-26.5-21.5-48-48-48V80c0-26.5-21.5-48-48-48z"></path>
                                  </svg>
                                </button>
                              )}
                              {!isStarted && !isCompleted && onEditClick && (
                                <button
                                  type="button"
                                  title="Edit Run"
                                  onClick={() => onEditClick(day, shift, prog)}
                                  className="btn btn-outline-secondary d-flex align-items-center justify-content-center p-0"
                                  style={{ width: "36px", height: "36px", borderRadius: "8px" }}
                                >
                                  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 512 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M497.9 142.1l-46.1 46.1c-4.7 4.7-12.3 4.7-17 0l-111-111c-4.7-4.7-4.7-12.3 0-17l46.1-46.1c18.7-18.7 49.1-18.7 67.9 0l60.1 60.1c18.8 18.7 18.8 49.1 0 67.9zM284.2 99.8L21.6 362.4.4 483.9c-2.9 16.4 11.4 30.6 27.8 27.8l121.5-21.3 262.6-262.6c4.7-4.7 4.7-12.3 0-17l-111-111c-4.8-4.7-12.4-4.7-17.1 0zM124.1 339.9c-5.5-5.5-5.5-14.3 0-19.8l154-154c5.5-5.5 14.3-5.5 19.8 0s5.5 14.3 0 19.8l-154 154c-5.5 5.5-14.3 5.5-19.8 0zM88 424h48v36.3l-64.5 11.3-31.1-31.1L51.7 376H88v48z"></path>
                                  </svg>
                                </button>
                              )}
                              {!isStarted && !isCompleted && onDeleteClick && (
                                <button
                                  type="button"
                                  title="Delete Run"
                                  onClick={() => onDeleteClick(day, shift, prog)}
                                  className="btn btn-outline-danger d-flex align-items-center justify-content-center p-0"
                                  style={{ width: "36px", height: "36px", borderRadius: "8px" }}
                                >
                                  <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 448 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"></path>
                                  </svg>
                                </button>
                              )}
                              <CustomButton
                                text={isStarted ? "In Progress" : "Start Production"}
                                icon={FaPlay}
                                onClick={() => onHourlyProductionClick(day, shift, prog)}
                                disabled={isStarted || prog.remainingQty <= 0}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )})}
                  </div>
                ) : (
                  <div className="d-flex align-items-center justify-content-center py-4 rounded mt-2" style={{ border: '2px dashed #cbd5e0', backgroundColor: '#ffffff', minHeight: '100px' }}>
                    <span className="fw-bold" style={{ color: '#a0aec0', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      No Schedules Assigned
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card.Body>
    </Card>
  );
};

export default DayScheduleCard;
