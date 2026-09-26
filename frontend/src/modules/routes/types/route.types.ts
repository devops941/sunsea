export type AccountStatus = 'GOOD' | 'NORMAL' | 'VIP' | 'WARNING' | string;
export type StoreType = 'PLASTIC_RETAIL' | 'METAL_STEEL' | 'AGENCY' | 'BIG_BAZAAR' | 'WHOLESALE' | 'GENERAL_STORE' | string;

export interface RouteInvoice {
  id: string;
  invoiceNo: string;
  amount: number;
  dueDate: string;
  status: 'PENDING' | 'OVERDUE' | 'PAID' | 'PARTIAL' | string;
}

export interface RouteStop {
  id: string;
  sno: number;
  week: string;
  day: string;
  customerId?: string | null;
  customerName: string;
  storeType?: StoreType;
  city: string;
  district?: string;
  landmark?: string;
  plannedTime: string;
  expectedDuration?: string;
  remarks: AccountStatus;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstNo?: string;
  invoiceNo?: string;
  status?: 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED' | 'PENDING' | 'CANCELLED' | string;
  invoices?: RouteInvoice[];
  notes?: string;
}

export interface SalesRep {
  id: string;
  name: string;
  employeeCode: string;
  phone: string;
  email: string;
  avatar?: string;
  role?: string;
  department?: string;
  assignedRegion: string;
  totalStops: number;
  totalCities: number;
  routes: RouteStop[];
}

export interface RouteFilterState {
  searchQuery: string;
  selectedWeek: string;
  selectedDay: string;
  selectedCity: string;
  selectedStatus: string;
}
