import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { GetDailyScheduleQueryInput } from "./daily-schedule.validation";

class DailyScheduleService {
  async getDailySchedule(query: GetDailyScheduleQueryInput) {
    const { machineId, weekStartDate, weekEndDate, dayOfWeek, shiftId, status } = query;

    // Verify machine exists
    const machine = await prisma.machine.findUnique({
      where: { machineId },
    });

    if (!machine) {
      throw new ApiError(404, `Machine with ID ${machineId} not found`);
    }

    // Parse weekStartDate YYYY-MM-DD precisely as UTC midnight to avoid local timezone shifts
    const [yyyy, mm, dd] = weekStartDate.split("-").map(Number);
    const startOfSelectedWeek = new Date(Date.UTC(yyyy, mm - 1, dd));

    let endOfSelectedWeek: Date;
    if (weekEndDate) {
      const [endYyyy, endMm, endDd] = weekEndDate.split("-").map(Number);
      endOfSelectedWeek = new Date(Date.UTC(endYyyy, endMm - 1, endDd, 23, 59, 59, 999));
    } else {
      endOfSelectedWeek = new Date(startOfSelectedWeek.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
    }

    const formattedWeekEndDate = weekEndDate || endOfSelectedWeek.toISOString().split("T")[0];

    // Fetch all programs for this machine and week
    const programs = await prisma.weeklyMachineProgram.findMany({
      where: {
        machineId,
        weekStartDate: {
          gte: startOfSelectedWeek,
          lte: endOfSelectedWeek,
        },
        ...(dayOfWeek !== undefined && { dayOfWeek: Number(dayOfWeek) }),
        ...(shiftId && { shiftId }),
        ...(status && { status }),
      },
      include: {
        machine: true,
        productionOrder: {
          include: {
            productItem: true,
          },
        },
        shift: true,
      },
    });

    // Map day numbers (1 = Monday, ..., 7 = Sunday) to Names
    const DAY_NAMES: Record<number, string> = {
      1: "Monday",
      2: "Tuesday",
      3: "Wednesday",
      4: "Thursday",
      5: "Friday",
      6: "Saturday",
      7: "Sunday",
    };

    // Grouping structure
    const scheduleMap = new Map<number, {
      dayOfWeek: number;
      dayName: string;
      shiftsMap: Map<string, {
        shiftId: string;
        shiftName: string;
        startTime: string;
        endTime: string;
        items: any[];
      }>;
    }>();

    for (const prog of programs) {
      const dayNum = prog.dayOfWeek;
      const dayName = DAY_NAMES[dayNum] || `Day ${dayNum}`;

      if (!scheduleMap.has(dayNum)) {
        scheduleMap.set(dayNum, {
          dayOfWeek: dayNum,
          dayName,
          shiftsMap: new Map(),
        });
      }

      const dayObj = scheduleMap.get(dayNum)!;
      const shiftCode = prog.shiftId;
      const shiftName = prog.shift.shiftName;
      const startTime = prog.shift.startTime;
      const endTime = prog.shift.endTime;

      if (!dayObj.shiftsMap.has(shiftCode)) {
        dayObj.shiftsMap.set(shiftCode, {
          shiftId: shiftCode,
          shiftName,
          startTime,
          endTime,
          items: [],
        });
      }

      const shiftObj = dayObj.shiftsMap.get(shiftCode)!;

      shiftObj.items.push({
        weeklyProgramId: prog.weeklyProgramId,
        productionOrderId: prog.productionOrderId,
        productName: prog.productionOrder?.productItem?.productName || "Unknown Product",
        plannedQty: Number(prog.plannedQty),
        plannedHours: prog.plannedHours !== null && prog.plannedHours !== undefined ? Number(prog.plannedHours) : null,
        priority: prog.priority,
        status: prog.status,
        machineId: machine.machineId,
        machineName: machine.machineName,
        shiftId: shiftCode,
        shiftName,
        shiftStartTime: startTime,
        shiftEndTime: endTime,
        sequenceNo: prog.sequenceNo,
        weekStartDate,
        weekEndDate: formattedWeekEndDate,
      });
    }

    // Format and sort the grouped schedule
    const sortedSchedule = Array.from(scheduleMap.values())
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
      .map((day) => {
        const sortedShifts = Array.from(day.shiftsMap.values())
          .sort((a, b) => a.startTime.localeCompare(b.startTime))
          .map((shift) => {
            const sortedItems = shift.items.sort((a, b) => a.sequenceNo - b.sequenceNo);
            return {
              shiftId: shift.shiftId,
              shiftName: shift.shiftName,
              startTime: shift.startTime,
              endTime: shift.endTime,
              items: sortedItems,
            };
          });

        return {
          dayOfWeek: day.dayOfWeek,
          dayName: day.dayName,
          shifts: sortedShifts,
        };
      });

    return {
      weekStartDate,
      weekEndDate: formattedWeekEndDate,
      machineId: machine.machineId,
      machineName: machine.machineName,
      schedule: sortedSchedule,
    };
  }
}

export default new DailyScheduleService();
