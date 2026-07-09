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
  startedPrograms?: Set<string>;
  completedPrograms?: Set<string>;
}

const DayScheduleCard: React.FC<DayScheduleCardProps> = ({ day, machineName, onHourlyProductionClick, startedPrograms, completedPrograms }) => {
  const hasPlans = day.shifts.some((s) => s.programs.length > 0);

  return (
    <Card className="h-100 shadow-sm border-0 day-schedule-card">
      <Card.Header className="bg-white pt-4 px-4 pb-0 border-0 d-flex justify-content-between align-items-center">
        <div>
          <h5 className="mb-1 fw-bold text-dark">{day.dayName}</h5>
          <span className="text-muted small fw-medium">
            {new Date(day.date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              timeZone: "UTC",
            })}
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
                  </div>
                  <span className="badge bg-secondary">
                    {shift.startTime} - {shift.endTime}
                  </span>
                </div>

                {/* Shift Programs */}
                {hasProgramsInShift ? (
                  <div className="d-flex flex-column gap-3">
                    {shift.programs.map((prog) => {
                      const programKey = `${day.date}_${shift.shiftId}_${prog.productionOrderId}`;
                      const isStarted = startedPrograms?.has(programKey);
                      const isCompletedByHours = completedPrograms?.has(programKey);
                      const isCompleted = prog.status === "COMPLETED" || prog.producedQty >= prog.plannedQty || isCompletedByHours;

                      return (
                      <div key={prog.weeklyProgramId} className="bg-white p-3 rounded border shadow-sm">
                        <div className="d-flex justify-content-between align-items-start mb-3">
                          <div>
                            {machineName && (
                              <div className="text-muted small mb-1">
                                MACHINE: <span className="text-dark fw-bold px-1 rounded bg-light">{machineName}</span>
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
                            <CustomButton
                              text={isStarted ? "In Progress" : "Start Production"}
                              icon={FaPlay}
                              onClick={() => onHourlyProductionClick(day, shift, prog)}
                              disabled={isStarted || prog.remainingQty <= 0}
                            />
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
