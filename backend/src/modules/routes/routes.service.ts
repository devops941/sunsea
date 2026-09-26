import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";

// Using db helper to eliminate any TypeScript/IDE Prisma client caching issues with newly added models
const db = prisma as any;

export interface StopInput {
  sno?: number;
  week: string;
  day: string;
  customerId?: string | null;
  customerName: string;
  city: string;
  time?: string | null;
  remarks?: string | null;
}

class DeliveryRoutesService {
  /**
   * Fetch all active Sales Representatives and Delivery personnel from Employee records
   */
  async getSalesReps() {
    const employees = await prisma.employee.findMany({
      where: {
        status: "active",
      },
      select: {
        id: true,
        empCode: true,
        fullName: true,
        mobile: true,
        email: true,
        photoUrl: true,
        department: { select: { id: true, name: true } },
        role: { select: { id: true, name: true } },
      },
      orderBy: { empCode: "asc" },
    });

    if (employees.length > 0) {
      return employees.map((emp) => ({
        id: emp.id.toString(),
        empCode: emp.empCode,
        name: emp.fullName || `Employee ${emp.empCode}`,
        phone: (emp.mobile as string) || "-",
        email: emp.email || "-",
        avatar: emp.photoUrl || null,
        department: emp.department?.name || "Sales & Marketing",
        role: emp.role?.name || "Sales Representative",
      }));
    }

    // Return empty array if database has no employees
    return [];
  }

  /**
   * Get dynamic list of available cities extracted from customer addresses and route stops
   */
  async getAvailableCities(): Promise<string[]> {
    const customers = await prisma.customer.findMany({
      select: {
        addresses: {
          select: {
            address: true,
          },
        },
      },
    });

    const extractedCities = new Set<string>();
    for (const c of customers) {
      for (const a of c.addresses) {
        const addrObj = a.address as any;
        const city = addrObj?.city || addrObj?.town || addrObj?.district;
        if (city && typeof city === "string" && city.trim().length > 1) {
          extractedCities.add(city.trim().toUpperCase());
        }
      }
    }

    // Include cities from existing delivery route stops
    try {
      const stops = await db.deliveryRouteStop.findMany({
        select: { city: true },
        distinct: ["city"],
      });
      for (const s of stops) {
        if (s.city && s.city.trim().length > 1) {
          extractedCities.add(s.city.trim().toUpperCase());
        }
      }
    } catch {
      // Ignore if table not yet populated
    }

    if (extractedCities.size === 0) {
      extractedCities.add("MADURAI");
    }

    return Array.from(extractedCities).sort();
  }

  /**
   * Get all delivery routes with stop count and assigned reps
   */
  async getAllRoutes() {
    const routes = await db.deliveryRoute.findMany({
      where: { isActive: true },
      include: {
        stops: {
          orderBy: [{ week: "asc" }, { day: "asc" }, { sequence: "asc" }],
        },
        assignments: {
          include: {
            employee: {
              select: {
                id: true,
                empCode: true,
                fullName: true,
                department: { select: { name: true } },
                role: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { code: "asc" },
    });

    return routes.map((r: any) => {
      const uniqueCities = new Set(r.stops.map((s: any) => s.city.trim().toUpperCase()));
      return {
        id: r.id,
        code: r.code,
        name: r.name,
        originCity: r.originCity,
        destinationCity: r.destinationCity,
        description: r.description,
        totalStops: r.stops.length,
        totalCities: uniqueCities.size,
        stops: r.stops.map((s: any) => ({
          id: s.id,
          sno: s.sequence,
          week: s.week,
          day: s.day,
          customerId: s.customerId,
          customerName: s.customerName,
          city: s.city,
          plannedTime: s.plannedTime || "",
          remarks: s.remarks || "NORMAL",
        })),
        assignedEmployees: r.assignments.map((a: any) => ({
          id: a.employee.id.toString(),
          empCode: a.employee.empCode,
          name: a.employee.fullName,
          role: a.employee.role?.name || a.employee.department?.name || "Sales Rep",
        })),
      };
    });
  }

  /**
   * Get route plan for a specific representative (by employee ID or empCode)
   */
  async getRepRoutePlan(employeeIdentifier: string) {
    const isBigIntId = /^\d+$/.test(employeeIdentifier);

    // Try finding employee
    const employee = await prisma.employee.findFirst({
      where: isBigIntId
        ? { OR: [{ id: BigInt(employeeIdentifier) }, { empCode: employeeIdentifier }] }
        : { empCode: employeeIdentifier },
      select: {
        id: true,
        empCode: true,
        fullName: true,
        mobile: true,
        email: true,
        photoUrl: true,
        department: { select: { name: true } },
        role: { select: { name: true } },
      },
    });

    const empCode = employee?.empCode || employeeIdentifier;
    const empName = employee?.fullName || (empCode === "1089" ? "MUNIYASAMY" : "JAGATHISH L K");

    // 1. Check if an assignment exists
    if (employee) {
      const assignment = await db.routeAssignment.findFirst({
        where: { employeeId: employee.id },
        include: {
          route: {
            include: {
              stops: { orderBy: { sequence: "asc" } },
            },
          },
        },
      });

      if (assignment?.route && assignment.route.stops.length > 0) {
        const stops = assignment.route.stops.map((s: any) => ({
          id: s.id,
          sno: s.sequence,
          week: s.week,
          day: s.day,
          customerId: s.customerId,
          customerName: s.customerName,
          city: s.city,
          plannedTime: s.plannedTime || "",
          remarks: s.remarks || "NORMAL",
        }));
        const uniqueCities = new Set(stops.map((s: any) => s.city.trim().toUpperCase()));
        return {
          rep: {
            id: employee.id.toString(),
            employeeCode: employee.empCode,
            name: employee.fullName || `Employee ${employee.empCode}`,
            phone: (employee.mobile as string) || "-",
            email: employee.email || "-",
            avatar: employee.photoUrl || null,
            role: employee.role?.name || employee.department?.name || "Sales Representative",
            assignedRegion: assignment.route.name,
            totalStops: stops.length,
            totalCities: uniqueCities.size,
          },
          routeId: assignment.route.id,
          routeCode: assignment.route.code,
          routeName: assignment.route.name,
          stops,
        };
      }
    }

    // 2. Check if a route exists by code RT-<empCode>
    const routeCode = `RT-${empCode}`;
    const directRoute = await db.deliveryRoute.findUnique({
      where: { code: routeCode },
      include: {
        stops: { orderBy: { sequence: "asc" } },
      },
    });

    if (directRoute && directRoute.stops.length > 0) {
      const stops = directRoute.stops.map((s: any) => ({
        id: s.id,
        sno: s.sequence,
        week: s.week,
        day: s.day,
        customerId: s.customerId,
        customerName: s.customerName,
        city: s.city,
        plannedTime: s.plannedTime || "",
        remarks: s.remarks || "NORMAL",
      }));
      const uniqueCities = new Set(stops.map((s: any) => s.city.trim().toUpperCase()));
      return {
        rep: {
          id: employee ? employee.id.toString() : empCode,
          employeeCode: empCode,
          name: empName,
          phone: (employee?.mobile as string) || "-",
          email: employee?.email || "-",
          avatar: employee?.photoUrl || null,
          role: employee?.role?.name || "Sales Representative",
          assignedRegion: directRoute.name,
          totalStops: stops.length,
          totalCities: uniqueCities.size,
        },
        routeId: directRoute.id,
        routeCode: directRoute.code,
        routeName: directRoute.name,
        stops,
      };
    }

    return {
      rep: employee
        ? {
            id: employee.id.toString(),
            employeeCode: empCode,
            name: empName,
            phone: (employee?.mobile as string) || "-",
            email: employee?.email || "-",
            avatar: employee?.photoUrl || null,
            role: employee?.role?.name || "Sales Representative",
            assignedRegion: "Delivery Route",
            totalStops: 0,
            totalCities: 0,
          }
        : null,
      routeId: null,
      routeCode,
      routeName: "Delivery Route",
      stops: [],
    };
  }

  /**
   * Save/Update route stops for a representative directly in PostgreSQL
   */
  async saveRepRoutePlan(employeeIdentifier: string, data: { routeName?: string; stops: StopInput[] }) {
    const isBigIntId = /^\d+$/.test(employeeIdentifier);
    const employee = await prisma.employee.findFirst({
      where: isBigIntId
        ? { OR: [{ id: BigInt(employeeIdentifier) }, { empCode: employeeIdentifier }] }
        : { empCode: employeeIdentifier },
    });

    const empCode = employee?.empCode || employeeIdentifier;
    const routeCode = `RT-${empCode}`;
    const routeName = data.routeName || `${employee?.fullName || empCode} Delivery Route`;

    // Cache customers for auto customerId matching
    const allCustomers = await prisma.customer.findMany({
      select: { id: true, displayName: true, firmName: true },
    });
    const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const customerMap = new Map<string, string>();
    for (const c of allCustomers) {
      const name = c.displayName || c.firmName;
      if (name) {
        customerMap.set(clean(name), c.id);
      }
    }

    return await db.$transaction(async (tx: any) => {
      // 1. Upsert Route
      const route = await tx.deliveryRoute.upsert({
        where: { code: routeCode },
        update: {
          name: routeName,
          originCity: "MADURAI",
          isActive: true,
        },
        create: {
          code: routeCode,
          name: routeName,
          originCity: "MADURAI",
          isActive: true,
        },
      });

      // 2. Upsert Assignment if employee exists in DB
      if (employee) {
        await tx.routeAssignment.upsert({
          where: {
            routeId_employeeId: {
              routeId: route.id,
              employeeId: employee.id,
            },
          },
          update: { status: "ACTIVE" },
          create: {
            routeId: route.id,
            employeeId: employee.id,
            status: "ACTIVE",
          },
        });
      }

      // 3. Replace all stops
      await tx.deliveryRouteStop.deleteMany({
        where: { routeId: route.id },
      });

      const stopsToCreate = data.stops.map((s, idx) => {
        let matchedId = s.customerId || null;
        if (!matchedId && s.customerName) {
          matchedId = customerMap.get(clean(s.customerName)) || null;
        }

        return {
          routeId: route.id,
          sequence: s.sno ?? idx + 1,
          week: s.week,
          day: s.day,
          customerId: matchedId,
          customerName: s.customerName.trim().toUpperCase(),
          city: s.city.trim().toUpperCase() || "MADURAI",
          plannedTime: s.time || null,
          remarks: s.remarks ? s.remarks.toUpperCase() : "NORMAL",
        };
      });

      await tx.deliveryRouteStop.createMany({
        data: stopsToCreate,
      });

      return {
        routeId: route.id,
        routeCode: route.code,
        routeName: route.name,
        totalStops: stopsToCreate.length,
      };
    });
  }

  /**
   * Fetch only customers who have generated sales invoices along with their invoice numbers
   */
  async getInvoicedCustomers() {
    const invoices = await db.salesInvoice.findMany({
      select: {
        id: true,
        invoiceNo: true,
        dcNo: true,
        invoiceDate: true,
        grandTotal: true,
        status: true,
        shippingCity: true,
        customerId: true,
        customer: {
          select: {
            id: true,
            firmName: true,
            displayName: true,
            mobile: true,
            addresses: {
              select: {
                address: true,
              },
            },
          },
        },
      },
      orderBy: { invoiceDate: "desc" },
    });

    const customerMap = new Map<string, any>();
    for (const inv of invoices) {
      if (!inv.customer) continue;
      const c = inv.customer;
      const cId = c.id;
      if (!customerMap.has(cId)) {
        let defaultCity = "";
        if (Array.isArray(c.addresses) && c.addresses.length > 0) {
          const firstAddr = c.addresses[0];
          const raw = (firstAddr as any)?.address || firstAddr;
          defaultCity = raw?.city || raw?.town || raw?.district || "";
        }
        if (!defaultCity && inv.shippingCity) {
          defaultCity = inv.shippingCity;
        }
        if (!defaultCity) defaultCity = "MADURAI";

        customerMap.set(cId, {
          id: cId,
          customerName: c.displayName || c.firmName || "Customer",
          firmName: c.firmName,
          displayName: c.displayName,
          mobile: c.mobile,
          city: defaultCity,
          invoices: [],
        });
      }
      customerMap.get(cId).invoices.push({
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        dcNo: inv.dcNo || "-",
        invoiceDate: inv.invoiceDate,
        grandTotal: inv.grandTotal,
        status: inv.status,
      });
    }

    return Array.from(customerMap.values());
  }

  /**
   * Update the delivery/assignment status of a route stop
   */
  async updateStopStatus(stopId: string, status: string) {
    const updated = await db.deliveryRouteStop.update({
      where: { id: stopId },
      data: { remarks: status.toUpperCase() },
    });
    return updated;
  }
}

export const deliveryRoutesService = new DeliveryRoutesService();
