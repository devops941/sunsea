import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Container, Row, Col, Card, Spinner } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAppDispatch, useAppSelector } from "../../../hooks/reduxHooks";
import { fetchMachines } from "../../../features/machines/machineSlice";
import { weeklyProgramService } from "../../../services/weeklyProgramService";
import SelectInput from "../../../components/form/SelectInput/SelectInput";
import TextInput from "../../../components/form/TextInput/TextInput";
import DayScheduleCard from "../../../components/ui/DayScheduleCard/DayScheduleCard";
import apiClient from "../../../api/apiClient";
import config from "../../../api/config";

// Helper to get current week's Monday (UTC-safe)
const getMonday = (d: Date) => {
  const date = new Date(d);
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), diff));
  console.log("getMonday input:", d, "output (UTC):", monday);
  return monday;
};

// Formats a Date object as YYYY-MM-DD in UTC
const formatDateString = (d: Date) => {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Formats a Date object as YYYY-MM-DD in Local time
const formatLocalDateString = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const DailyMachinePlanning: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Redux state
  const { data: machines, loading: loadingMachines } = useAppSelector((state) => state.machines);

  // Local state
  const [selectedMachineId, setSelectedMachineId] = useState<string>("");
  const [currentWeekMonday, setCurrentWeekMonday] = useState<Date>(getMonday(new Date()));
  const [planningData, setPlanningData] = useState<any>(null);
  const [startedPrograms, setStartedPrograms] = useState<Set<string>>(new Set());
  const [completedPrograms, setCompletedPrograms] = useState<Set<string>>(new Set());
  const [loadingPlanning, setLoadingPlanning] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<string>(formatLocalDateString(new Date()));

  useEffect(() => {
    console.log("selectedDate effect triggered:", selectedDate, "currentWeekMonday:", currentWeekMonday);
    if (selectedDate) {
      const parsed = new Date(selectedDate);
      console.log("parsed selectedDate Date object:", parsed, "parsed.getTime():", parsed.getTime());
      if (!isNaN(parsed.getTime())) {
        const newMonday = getMonday(parsed);
        if (newMonday.getTime() !== currentWeekMonday.getTime()) {
          console.log("Setting currentWeekMonday to:", newMonday);
          setCurrentWeekMonday(newMonday);
        }
      }
    }
  }, [selectedDate, currentWeekMonday]);

  useEffect(() => {
    dispatch(fetchMachines());
  }, [dispatch]);

  // Set first machine as default when loaded
  useEffect(() => {
    if (machines && machines.length > 0 && !selectedMachineId) {
      setSelectedMachineId(machines[0].machineId);
    }
  }, [machines, selectedMachineId]);

  // Fetch daily planning data when machine or week changes
  const fetchPlanningData = useCallback(async () => {
    if (!selectedMachineId) return;
    console.log("fetchPlanningData calling with:", selectedMachineId, formatDateString(currentWeekMonday));
    setLoadingPlanning(true);
    try {
      const data = await weeklyProgramService.getDailyPlanningData({
        machineId: selectedMachineId,
        weekStartDate: formatDateString(currentWeekMonday),
      });
      console.log("Fetched planningData:", data);
      setPlanningData(data);

      const logsResp = await apiClient.get(config.hourlyProduction.base);
      const started = new Set<string>();
      const hourCounts: { [key: string]: number } = {};

      const logArray = Array.isArray(logsResp.data?.data) ? logsResp.data.data : (Array.isArray(logsResp.data) ? logsResp.data : []);
      
      logArray.forEach((log: any) => {
          if (log.machineId === selectedMachineId) {
              const d = log.productionDate ? log.productionDate.split("T")[0] : "";
              const key = `${d}_${log.shiftId}_${log.productionOrderId}`;
              started.add(key);
              if (log.remarks !== "SYSTEM_START") {
                  hourCounts[key] = (hourCounts[key] || 0) + 1;
              }
          }
      });

      const completed = new Set<string>();
      Object.entries(hourCounts).forEach(([key, count]) => {
          if (count >= 8) {
              completed.add(key);
          }
      });

      setStartedPrograms(started);
      setCompletedPrograms(completed);
    } catch (err: any) {
      toast.error(err || "Failed to fetch daily planning data");
    } finally {
      setLoadingPlanning(false);
    }
  }, [selectedMachineId, currentWeekMonday]);

  useEffect(() => {
    fetchPlanningData();
  }, [fetchPlanningData]);



  const handleEnterHourlyProduction = async (day: any, shift: any, program: any) => {
    if (day.date && shift.startTime) {
      const shiftStartDateStr = `${day.date}T${shift.startTime}`;
      const shiftStartDate = new Date(shiftStartDateStr);
      const now = new Date();
      
      if (now < shiftStartDate) {
        toast.error("Time has not arrived yet. Cannot start production for future shifts.");
        return;
      }
    }

    try {
      const payload = {
        productionOrderId: program.productionOrderId,
        productionDate: day.date,
        shiftId: shift.shiftId,
        machineId: selectedMachineId,
        hourIndex: 0,
        qtyProduced: 0,
        rejectQty: 0,
        scrapQty: 0,
        downtime: 0,
        remarks: "SYSTEM_START",
        operatorId: "SYSTEM"
      };

      await apiClient.post(config.hourlyProduction.base, payload);
      toast.success("Production started successfully!");
      navigate("/hourly-work-reports");
    } catch (err: any) {
      console.warn("Start production error:", err);
      if (err?.response?.status === 409) {
          toast.info("Production is already started for this shift");
          navigate("/hourly-work-reports");
      } else {
          toast.error(err?.response?.data?.message || err?.message || "Failed to start production");
      }
    }
  };

  const machineOptions = useMemo(() => {
    const opts = [{ label: "Select Machine", value: "" }];
    if (machines) {
      machines.forEach((m) => {
        opts.push({ label: `${m.machineName} (${m.machineId})`, value: m.machineId });
      });
    }
    return opts;
  }, [machines]);

  return (
    <div className="inner-container">
      <Container fluid>
        {/* Page Header */}
        <div className="page-header">
          <Row className="align-items-center g-3">
            <Col lg={4} md={12}>
              <div className="page-header-info">
                <h2 className="page-title">Daily Machine Planning</h2>
                <div className="page-breadcrumb">Home / Production / Daily Planning</div>
              </div>
            </Col>
            <Col lg={8} md={12}>
              <div className="page-header-actions" style={{ gap: '10px' }}>
                {/* Machine Selector */}
                <div style={{ minWidth: '300px' }}>
                  <SelectInput
                    label=""
                    hideLabel
                    value={selectedMachineId}
                    onChange={(e) => setSelectedMachineId(e.target.value)}
                    options={machineOptions}
                  />
                </div>

                {/* Date Selector input */}
                <div style={{ width: '150px' }}>
                  <TextInput
                    label=""
                    name="filterDate"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      console.log("Date input onChange fired with value:", e.target.value);
                      setSelectedDate(e.target.value);
                    }}
                  />
                </div>

               
              </div>
            </Col>
          </Row>
        </div>

        {/* Dynamic Day Cards */}
        {loadingPlanning || loadingMachines ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" />
            <p className="mt-3 text-muted">Generating day schedules...</p>
          </div>
        ) : planningData ? (
          <Row className="g-4 mt-1">
            {planningData.days.map((day: any) => {
              return (
                <Col xl={4} lg={6} md={12} key={day.dayOfWeek}>
                  <DayScheduleCard 
                    day={day} 
                    machineName={machines?.find((m: any) => m.machineId === selectedMachineId)?.machineName}
                    onHourlyProductionClick={handleEnterHourlyProduction} 
                    startedPrograms={startedPrograms}
                    completedPrograms={completedPrograms}
                  />
                </Col>
              );
            })}
          </Row>
        ) : (
          <Card className="border-0 shadow-sm text-center p-5 rounded">
            <Card.Body>
              <h5 className="text-muted">No machine planning data available.</h5>
              <p className="text-muted small">Please select a machine and week to load the schedule.</p>
            </Card.Body>
          </Card>
        )}
      </Container>
    </div>
  );
};

export default DailyMachinePlanning;
