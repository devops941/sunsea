import apiClient from "../api/apiClient";
import config from "../api/config";
import { roleService } from "./roleService";
import { GetState, GetCity } from "react-country-state-city";
import type { SalesRep, RouteStop } from "../modules/routes/types/route.types";

const INDIA_COUNTRY_ID = 101;

/**
 * Dynamically fetch cities from already installed `react-country-state-city` package
 */
export const getPackageCities = async (): Promise<string[]> => {
  try {
    const states: any[] = await GetState(INDIA_COUNTRY_ID);
    const tn = states.find((s: any) => s.name?.toLowerCase().includes("tamil nadu"));
    if (tn) {
      const cities: any[] = await GetCity(INDIA_COUNTRY_ID, tn.id);
      return cities.map((c: any) => c.name.toUpperCase()).sort();
    }
    // If TN not found specifically, load first available state
    if (states.length > 0) {
      const cities: any[] = await GetCity(INDIA_COUNTRY_ID, states[0].id);
      return cities.map((c: any) => c.name.toUpperCase()).sort();
    }
  } catch (err) {
    console.warn("Failed to load cities from react-country-state-city package:", err);
  }
  return ["MADURAI"];
};

export const extractRoleName = (val: any): string => {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') return val.name || val.code || val.title || '';
  return String(val);
};

export const routeService = {
  /**
   * Fetch all Sales Representatives dynamically from backend PostgreSQL
   */
  fetchSalesReps: async (): Promise<SalesRep[]> => {
    try {
      const response = await apiClient.get(`${config.routes.base}/reps`);
      const repsData = response.data?.data || response.data || [];

      if (Array.isArray(repsData) && repsData.length > 0) {
        // For each rep, fetch their assigned route plan or stops
        const repsWithPlans: SalesRep[] = await Promise.all(
          repsData.map(async (rep: any) => {
            try {
              const planRes = await apiClient.get(`${config.routes.base}/rep/${rep.empCode || rep.id}`);
              const planData = planRes.data?.data || planRes.data;
              const stops: RouteStop[] = (planData?.stops || []).map((s: any, idx: number) => {
                const rawRem = (s.remarks || 'NORMAL').toUpperCase();
                const isStatusVal = ['ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'PENDING'].includes(rawRem);
                return {
                  id: s.id || `stop-${idx + 1}`,
                  sno: s.sno ?? idx + 1,
                  week: s.week || '1ST WEEK',
                  day: s.day || 'MONDAY',
                  customerId: s.customerId || null,
                  customerName: s.customerName || '',
                  city: s.city || 'MADURAI',
                  plannedTime: s.plannedTime || '',
                  remarks: isStatusVal ? 'NORMAL' : rawRem,
                  status: isStatusVal ? rawRem : (s.status || 'ASSIGNED'),
                };
              });

              const uniqueCitiesCount = new Set(stops.map((s) => s.city.trim().toUpperCase())).size;

              return {
                id: String(rep.id),
                employeeCode: rep.empCode,
                name: (rep.name || `Employee ${rep.empCode}`).toUpperCase(),
                phone: rep.phone || '-',
                email: rep.email || '-',
                avatar: rep.avatar || undefined,
                department: rep.department || 'Sales',
                role: rep.role || 'Sales Representative',
                assignedRegion: planData?.routeName || `${rep.name} Delivery Route`,
                totalStops: stops.length,
                totalCities: uniqueCitiesCount,
                routes: stops,
              };
            } catch (err) {
              return {
                id: String(rep.id),
                employeeCode: rep.empCode,
                name: (rep.name || `Employee ${rep.empCode}`).toUpperCase(),
                phone: rep.phone || '-',
                email: rep.email || '-',
                avatar: rep.avatar || undefined,
                department: rep.department || 'Sales',
                role: rep.role || 'Sales Representative',
                assignedRegion: 'Delivery Route',
                totalStops: 0,
                totalCities: 0,
                routes: [],
              };
            }
          })
        );

        return repsWithPlans;
      }
    } catch (error) {
      console.error('Error fetching sales reps from backend API:', error);
    }

    return [];
  },

  /**
   * Fetch route plan for a specific rep
   */
  fetchRepPlan: async (repIdOrCode: string): Promise<{ rep: SalesRep; stops: RouteStop[]; routeName: string }> => {
    const response = await apiClient.get(`${config.routes.base}/rep/${repIdOrCode}`);
    const plan = response.data?.data || response.data;
    const stops: RouteStop[] = (plan?.stops || []).map((s: any, idx: number) => {
      const rawRem = (s.remarks || 'NORMAL').toUpperCase();
      const isStatusVal = ['ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'PENDING'].includes(rawRem);
      return {
        id: s.id || `stop-${idx + 1}`,
        sno: s.sno ?? idx + 1,
        week: s.week || '1ST WEEK',
        day: s.day || 'MONDAY',
        customerId: s.customerId || null,
        customerName: s.customerName || '',
        city: s.city || 'MADURAI',
        plannedTime: s.plannedTime || '',
        remarks: isStatusVal ? 'NORMAL' : rawRem,
        status: isStatusVal ? rawRem : (s.status || 'ASSIGNED'),
      };
    });

    const uniqueCitiesCount = new Set(stops.map((s) => s.city.trim().toUpperCase())).size;

    const rep: SalesRep = {
      id: String(plan.rep?.id || repIdOrCode),
      employeeCode: plan.rep?.employeeCode || repIdOrCode,
      name: (plan.rep?.name || 'Sales Representative').toUpperCase(),
      phone: plan.rep?.phone || '-',
      email: plan.rep?.email || '-',
      avatar: plan.rep?.avatar || undefined,
      role: plan.rep?.role || 'Sales Representative',
      assignedRegion: plan.routeName || 'Delivery Route',
      totalStops: stops.length,
      totalCities: uniqueCitiesCount,
      routes: stops,
    };

    return {
      rep,
      stops,
      routeName: plan.routeName || `${rep.name} Delivery Route`,
    };
  },

  /**
   * Save/Update Sales Rep Route Stops directly in PostgreSQL via Backend API
   */
  saveSalesRepRoutes: async (repIdOrCode: string, updatedRoutes: RouteStop[], routeName?: string): Promise<SalesRep[]> => {
    const payload = {
      routeName,
      stops: updatedRoutes.map((r, idx) => ({
        sno: r.sno ?? idx + 1,
        week: r.week,
        day: r.day,
        customerId: r.customerId || null,
        customerName: r.customerName,
        city: r.city,
        time: r.plannedTime,
        remarks: r.remarks,
      })),
    };

    await apiClient.post(`${config.routes.base}/rep/${repIdOrCode}`, payload);

    // Refresh and return all updated reps
    return await routeService.fetchSalesReps();
  },

  /**
   * Fetch all real Active Customers dynamically from PostgreSQL (/customers)
   */
  fetchRealCustomers: async (): Promise<any[]> => {
    try {
      const response = await apiClient.get(config.customer.base, {
        params: { limit: 1000, status: 'Active' },
      });
      return response.data?.data?.customers || response.data?.customers || response.data?.data || [];
    } catch (error) {
      console.warn('Backend API /customers request fallback:', error);
      return [];
    }
  },

  /**
   * Fetch real Sales Invoices from backend (/sales-invoices)
   */
  fetchRealSalesInvoices: async (): Promise<any[]> => {
    try {
      const response = await apiClient.get(config.salesInvoice.base, { params: { limit: 100 } });
      return response.data?.data || response.data || [];
    } catch (error) {
      console.warn('Backend API /sales-invoices request fallback:', error);
      return [];
    }
  },

  /**
   * Get list of available cities dynamically from backend API (/routes/cities) or react-country-state-city
   */
  fetchAvailableCities: async (): Promise<string[]> => {
    try {
      const response = await apiClient.get(`${config.routes.base}/cities`);
      const cities = response.data?.data || response.data;
      if (Array.isArray(cities) && cities.length > 0) {
        return cities;
      }
    } catch (error) {
      console.warn('Error fetching cities from backend /routes/cities:', error);
    }
    return await getPackageCities();
  },

  /**
   * Get list of available roles dynamically from backend /roles + employee roles
   */
  fetchAvailableRoles: async (): Promise<string[]> => {
    let apiRoleNames: string[] = [];
    try {
      const response = await roleService.fetchAll({ limit: 100 });
      if (response && Array.isArray(response.data)) {
        apiRoleNames = response.data.map((r: any) => extractRoleName(r)).filter(Boolean);
      }
    } catch (error) {
      console.warn('Backend API /roles request fallback:', error);
    }

    const salesReps = await routeService.fetchSalesReps();
    const repRoles = salesReps.map((r) => extractRoleName(r.role) || 'Sales Representative').filter(Boolean);
    const combined = Array.from(new Set([...apiRoleNames, ...repRoles]));
    return ['ALL ROLES', ...combined];
  },

  /**
   * Fetch only customers who have generated sales invoices along with their invoices
   */
  fetchInvoicedCustomers: async (): Promise<any[]> => {
    try {
      const response = await apiClient.get(`${config.routes.base}/invoiced-customers`);
      return response.data?.data || response.data || [];
    } catch (error) {
      console.warn('Backend API /routes/invoiced-customers request fallback:', error);
      return [];
    }
  },

  /**
   * Update delivery status of a specific stop
   */
  updateStopStatus: async (stopId: string, status: string): Promise<any> => {
    const response = await apiClient.patch(`${config.routes.base}/stop/${stopId}/status`, { status });
    return response.data?.data || response.data;
  },
};

export default routeService;
