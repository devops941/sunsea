import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { routeService } from '../../../services/routeService';
import type { SalesRep, RouteStop } from '../types/route.types';
import BackButton from '../../../components/ui/BackButton/BackButton';
import CustomButton from '../../../components/ui/Button/Button';
import DatePickerCalendar from '../../../components/ui/DatePickerCalendar/DatePickerCalendar';
import {
  FiSave,
  FiPlus,
  FiTrash2,
  FiMapPin,
  FiFileText,
  FiTruck,
  FiChevronDown,
  FiCheck,
  FiClock,
  FiAlertCircle,
} from 'react-icons/fi';
import { FaSpinner, FaUserTie, FaMapMarkerAlt, FaFileInvoiceDollar } from 'react-icons/fa';

interface InvoiceItem {
  id: string;
  invoiceNo: string;
  dcNo?: string;
  invoiceDate?: string;
  grandTotal?: number;
  status?: string;
}

interface InvoicedCustomer {
  id: string;
  customerName: string;
  firmName?: string;
  displayName?: string;
  mobile?: any;
  city: string;
  address?: string;
  invoices: InvoiceItem[];
}

interface FormStopRow {
  id: string;
  sno: number;
  week: string;
  day: string;
  customerId: string;
  customerName: string;
  selectedInvoices: InvoiceItem[];
  city: string;
  plannedTime: string;
}

const formatCurrency = (val?: number | string) => {
  if (val === undefined || val === null || val === '') return '0.00';
  const num = Number(val);
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatTimeForInput = (timeStr?: string): string => {
  if (!timeStr || !timeStr.trim()) return '11:00';
  const hhmmMatch = timeStr.match(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])/);
  if (hhmmMatch) {
    let hour = parseInt(hhmmMatch[1], 10);
    const mm = hhmmMatch[2];
    const isPM = /pm/i.test(timeStr);
    const isAM = /am/i.test(timeStr);
    if (isPM && hour < 12) hour += 12;
    if (isAM && hour === 12) hour = 0;
    return `${hour.toString().padStart(2, '0')}:${mm}`;
  }
  return '11:00';
};

export const RouteAssignFormPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const paramRepId = searchParams.get('repId') || (location.state as any)?.repId || '';
  const paramWeek = searchParams.get('week') || (location.state as any)?.week || '';
  const paramDay = searchParams.get('day') || (location.state as any)?.day || '';

  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [invoicedCustomers, setInvoicedCustomers] = useState<InvoicedCustomer[]>([]);

  // 2-Step wizard page state: Step 1 = Setup Configuration Page, Step 2 = Delivery Sheet Table Page
  const [step, setStep] = useState<1 | 2>(paramRepId ? 2 : 1);

  const [repId, setRepId] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [week, setWeek] = useState<string>(paramWeek ? paramWeek.toUpperCase() : '1ST WEEK');
  const [day, setDay] = useState<string>(paramDay ? paramDay.toUpperCase() : 'MONDAY');
  const [routeName, setRouteName] = useState<string>('');

  // Right-panel city filter
  const [cityFilter, setCityFilter] = useState<string>('ALL');

  // Rows of customer delivery stops (empty rows start with clean city & time)
  const [stops, setStops] = useState<FormStopRow[]>(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: `row-${i + 1}`,
      sno: i + 1,
      week: paramWeek ? paramWeek.toUpperCase() : '1ST WEEK',
      day: paramDay ? paramDay.toUpperCase() : 'MONDAY',
      customerId: '',
      customerName: '',
      selectedInvoices: [],
      city: '',
      plannedTime: '',
    }))
  );

  // Which row currently has its Invoice Multi-Select dropdown open (null = none)
  const [activeInvoiceDropdownIdx, setActiveInvoiceDropdownIdx] = useState<number | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveInvoiceDropdownIdx(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to populate stops for a rep, week, and day
  const populateStopsForRep = useCallback(
    (targetRep: SalesRep, targetWeek: string, targetDay: string, custs: InvoicedCustomer[]) => {
      const existingStops = targetRep.routes || [];
      const activeW = (targetWeek || '1ST WEEK').toUpperCase();
      const activeD = (targetDay || 'MONDAY').toUpperCase();

      const matchingStops = existingStops.filter(
        (s) =>
          (s.week || '1ST WEEK').toUpperCase() === activeW &&
          (s.day || 'MONDAY').toUpperCase() === activeD
      );

      if (matchingStops.length > 0) {
        const loadedRows: FormStopRow[] = matchingStops.map((s, idx) => {
          const matchedCust = custs.find(
            (c) =>
              c.id === s.customerId ||
              c.customerName.trim().toLowerCase() === s.customerName.trim().toLowerCase()
          );

          let selectedInvs: InvoiceItem[] = [];
          if (matchedCust) {
            if (s.invoiceNo) {
              const invList = s.invoiceNo.split(',').map((x) => x.trim().toLowerCase());
              selectedInvs = matchedCust.invoices.filter((inv) =>
                invList.includes(inv.invoiceNo.toLowerCase())
              );
            }
            if (selectedInvs.length === 0 && matchedCust.invoices.length > 0) {
              selectedInvs = [matchedCust.invoices[0]];
            }
          }

          return {
            id: s.id || `row-${idx + 1}`,
            sno: idx + 1,
            week: (s.week || activeW).toUpperCase(),
            day: (s.day || activeD).toUpperCase(),
            customerId: matchedCust?.id || s.customerId || '',
            customerName: s.customerName,
            selectedInvoices: selectedInvs,
            city: s.city || matchedCust?.city || 'MADURAI',
            plannedTime: s.plannedTime || '11:00',
          };
        });

        const totalCount = Math.max(12, loadedRows.length);
        const paddedRows: FormStopRow[] = Array.from({ length: totalCount }, (_, i) => {
          if (i < loadedRows.length) return loadedRows[i];
          return {
            id: `row-${i + 1}`,
            sno: i + 1,
            week: activeW,
            day: activeD,
            customerId: '',
            customerName: '',
            selectedInvoices: [],
            city: '',
            plannedTime: '',
          };
        });

        setStops(paddedRows);
      } else {
        setStops(
          Array.from({ length: 12 }, (_, i) => ({
            id: `row-${i + 1}`,
            sno: i + 1,
            week: activeW,
            day: activeD,
            customerId: '',
            customerName: '',
            selectedInvoices: [],
            city: '',
            plannedTime: '',
          }))
        );
      }
    },
    []
  );

  // Load Sales Representatives and Invoiced Customers
  useEffect(() => {
    const loadFormData = async () => {
      setIsLoading(true);
      try {
        const [reps, custs] = await Promise.all([
          routeService.fetchSalesReps(),
          routeService.fetchInvoicedCustomers(),
        ]);

        setSalesReps(reps);
        setInvoicedCustomers(custs);

        const initialW = paramWeek ? paramWeek.toUpperCase() : '1ST WEEK';
        const initialD = paramDay ? paramDay.toUpperCase() : 'MONDAY';
        setWeek(initialW);
        setDay(initialD);

        let targetRep = reps.find(
          (r) => r.id === paramRepId || r.employeeCode === paramRepId
        );
        if (!targetRep && reps.length > 0) {
          targetRep = reps[0];
        }

        if (targetRep) {
          setRepId(targetRep.id);
          setRouteName(targetRep.assignedRegion || `${targetRep.name} Delivery Route`);
          populateStopsForRep(targetRep, initialW, initialD, custs);
        }
      } catch (err) {
        console.error('Failed to load form data:', err);
        toast.error('Failed to initialize route assignment form.');
      } finally {
        setIsLoading(false);
      }
    };

    loadFormData();
  }, [paramRepId, paramWeek, paramDay, populateStopsForRep]);

  // Update stops when changing rep, week, or day
  const handleRepChange = (newRepId: string) => {
    setRepId(newRepId);
    const rep = salesReps.find((r) => r.id === newRepId);
    if (rep) {
      setRouteName(rep.assignedRegion || `${rep.name} Delivery Route`);
      populateStopsForRep(rep, week, day, invoicedCustomers);
    }
  };

  const handleWeekChange = (newWeek: string) => {
    setWeek(newWeek);
    const rep = salesReps.find((r) => r.id === repId);
    if (rep) {
      populateStopsForRep(rep, newWeek, day, invoicedCustomers);
    }
  };

  const handleDayChange = (newDay: string) => {
    setDay(newDay);
    const rep = salesReps.find((r) => r.id === repId);
    if (rep) {
      populateStopsForRep(rep, week, newDay, invoicedCustomers);
    }
  };

  const handleRowWeekChange = (index: number, newWeek: string) => {
    setStops((prev) =>
      prev.map((s, idx) => (idx === index ? { ...s, week: newWeek } : s))
    );
  };

  const handleRowDayChange = (index: number, newDay: string) => {
    setStops((prev) =>
      prev.map((s, idx) => (idx === index ? { ...s, day: newDay } : s))
    );
  };

  // Add a new empty stop row
  const handleAddStop = () => {
    setStops((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}`,
        sno: prev.length + 1,
        week,
        day,
        customerId: '',
        customerName: '',
        selectedInvoices: [],
        city: '',
        plannedTime: '',
      },
    ]);
  };

  // Add a customer from the right panel to the next empty row, or a new row
  const handleAddCustomerFromPanel = (cust: InvoicedCustomer) => {
    const alreadySelected = stops.some((s) => s.customerId === cust.id);
    if (alreadySelected) {
      toast.warn(`${cust.customerName} is already added to a stop.`);
      return;
    }

    const alreadySelectedInvoiceIds = new Set(stops.flatMap((s) => s.selectedInvoices.map((inv) => inv.id)));
    const availableInvoices = cust.invoices.filter((inv) => !alreadySelectedInvoiceIds.has(inv.id));
    const initialInvoice = availableInvoices.length > 0 ? [availableInvoices[0]] : [];

    // Find first empty row
    const emptyIdx = stops.findIndex((s) => !s.customerId);
    if (emptyIdx !== -1) {
      setStops((prev) =>
        prev.map((s, i) =>
          i === emptyIdx
            ? {
                ...s,
                week,
                day,
                customerId: cust.id,
                customerName: cust.customerName,
                city: cust.city || '',
                plannedTime: s.plannedTime || '11:00',
                selectedInvoices: initialInvoice,
              }
            : s
        )
      );
    } else {
      setStops((prev) => [
        ...prev,
        {
          id: `row-${Date.now()}`,
          sno: prev.length + 1,
          week,
          day,
          customerId: cust.id,
          customerName: cust.customerName,
          selectedInvoices: initialInvoice,
          city: cust.city || '',
          plannedTime: '11:00',
        },
      ]);
    }
  };

  // Remove a stop row
  const handleRemoveStop = (index: number) => {
    if (stops.length <= 1) {
      toast.warn('At least one stop is required in a route sheet.');
      return;
    }
    if (activeInvoiceDropdownIdx === index) {
      setActiveInvoiceDropdownIdx(null);
    }
    setStops((prev) =>
      prev
        .filter((_, idx) => idx !== index)
        .map((s, idx) => ({ ...s, sno: idx + 1 }))
    );
  };

  // When a customer is selected from the dropdown in a specific row
  const handleCustomerChange = (index: number, customerId: string) => {
    const selectedCust = invoicedCustomers.find((c) => c.id === customerId);

    if (!selectedCust) {
      setStops((prev) =>
        prev.map((s, idx) =>
          idx === index
            ? {
              ...s,
              customerId: '',
              customerName: '',
              selectedInvoices: [],
              city: '',
              plannedTime: '',
            }
            : s
        )
      );
      return;
    }

    const customerCity = selectedCust.city || '';
    const alreadySelectedInvoiceIds = new Set(
      stops
        .filter((_, i) => i !== index)
        .flatMap((s) => s.selectedInvoices.map((inv) => inv.id))
    );

    const availableInvoices = selectedCust.invoices.filter(
      (inv) => !alreadySelectedInvoiceIds.has(inv.id)
    );
    const initialInvoice = availableInvoices.length > 0 ? [availableInvoices[0]] : [];

    setStops((prev) =>
      prev.map((s, idx) =>
        idx === index
          ? {
            ...s,
            customerId: selectedCust.id,
            customerName: selectedCust.customerName,
            city: customerCity,
            plannedTime: s.plannedTime || '11:00',
            selectedInvoices: initialInvoice,
          }
          : s
      )
    );
  };

  // Toggle selection of an invoice for a row
  const handleToggleInvoice = (rowIndex: number, invoice: InvoiceItem) => {
    setStops((prev) =>
      prev.map((row, idx) => {
        if (idx !== rowIndex) return row;
        const exists = row.selectedInvoices.some((i) => i.id === invoice.id || i.invoiceNo === invoice.invoiceNo);
        const nextInvoices = exists
          ? row.selectedInvoices.filter((i) => i.id !== invoice.id && i.invoiceNo !== invoice.invoiceNo)
          : [...row.selectedInvoices, invoice];

        return {
          ...row,
          selectedInvoices: nextInvoices,
        };
      })
    );
  };

  // Check if an invoice is already assigned to ANOTHER row
  const getInvoiceAssignedRow = (invoiceId: string, currentRowIdx: number): number | null => {
    for (let i = 0; i < stops.length; i++) {
      if (i === currentRowIdx) continue;
      if (stops[i].selectedInvoices.some((inv) => inv.id === invoiceId)) {
        return i + 1;
      }
    }
    return null;
  };

  // Save the route sheet
  const handleSaveRoute = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!repId) {
      toast.error('Please select a Sales Representative.');
      return;
    }

    const validStops = stops.filter((s) => s.customerName.trim().length > 0);
    if (validStops.length === 0) {
      toast.error('Please add at least one customer delivery stop.');
      return;
    }

    const selectedRep = salesReps.find((r) => r.id === repId);
    const repCodeOrId = selectedRep?.employeeCode || repId;

    setIsSaving(true);
    try {
      const stopsPayload: RouteStop[] = validStops.map((s, idx) => {
        const invNos = s.selectedInvoices.map((i) => i.invoiceNo).join(', ');
        return {
          id: `stop-${idx + 1}`,
          sno: idx + 1,
          week: s.week || week,
          day: s.day || day,
          customerId: s.customerId || null,
          customerName: s.customerName.trim().toUpperCase(),
          invoiceNo: invNos || undefined,
          city: s.city.trim().toUpperCase() || 'MADURAI',
          plannedTime: s.plannedTime || '11:00 AM',
          remarks: 'ASSIGNED',
          status: 'ASSIGNED',
        };
      });

      await routeService.saveSalesRepRoutes(
        repCodeOrId,
        stopsPayload,
        routeName || `${selectedRep?.name || 'Delivery'} Route`
      );

      toast.success(`Route plan assigned successfully to ${selectedRep?.name || 'Representative'}!`);
      navigate('/routes');
    } catch (err: any) {
      console.error('Failed to save route plan:', err);
      toast.error(err?.response?.data?.message || 'Failed to save route plan');
    } finally {
      setIsSaving(false);
    }
  };

  // Unique cities for right-panel filter pills
  const uniqueCities = useMemo(() => {
    const cities = new Set(invoicedCustomers.map((c) => (c.city || '').toUpperCase().trim()).filter(Boolean));
    return Array.from(cities).sort();
  }, [invoicedCustomers]);

  // Filtered customers for right panel
  const panelCustomers = useMemo(() => {
    const filtered = cityFilter === 'ALL'
      ? invoicedCustomers
      : invoicedCustomers.filter((c) => (c.city || '').toUpperCase().trim() === cityFilter);
    return filtered;
  }, [invoicedCustomers, cityFilter]);

  const selectedRepObj = salesReps.find((r) => r.id === repId) || null;
  const validStopCount = stops.filter((s) => s.customerName.trim()).length;

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="w-full h-96 flex flex-col items-center justify-center space-y-3 bg-card rounded-2xl border border-line">
        <FaSpinner className="w-8 h-8 text-primary animate-spin" />
        <p className="text-xs font-bold text-ink-muted">Loading route setup data…</p>
      </div>
    );
  }

  return (
    <div
      className="w-full flex flex-col overflow-hidden bg-card rounded-2xl border border-line shadow-sm"
      style={{ height: 'calc(100vh - 130px)', minHeight: '560px' }}
    >
      {/* ══ HEADER ════════════════════════════════════════════════════════════ */}
      <div className="bg-card border-b border-line px-5 pt-3 pb-3 shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <FiTruck className="text-primary w-5 h-5 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[16px] font-bold text-ink leading-tight m-0">
                  Assign Route &amp; Customer Delivery Sheet
                </h1>

                {step === 2 && selectedRepObj && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {selectedRepObj.name} · {selectedRepObj.employeeCode}
                  </span>
                )}

                {/* Wizard step indicator badge */}
                <span className="text-[9.5px] font-black px-2 py-0.5 rounded-md bg-card-2 text-ink-subtle border border-line uppercase tracking-wider">
                  Step {step} of 2: {step === 1 ? 'Configure Setup' : 'Add Stops & Invoices'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-3 py-1 text-xs font-bold text-primary hover:bg-primary/10 border border-primary/20 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>← Edit Setup</span>
              </button>
            )}
            <BackButton onClick={() => navigate('/routes')} />
          </div>
        </div>
      </div>

      {/* ══ STEP 1: INITIAL ROUTE SETUP PAGE ══════════════════════════════════ */}
      {step === 1 && (
        <div className="flex-1 overflow-y-auto p-6 flex items-center justify-center bg-card-2/40">
          <div className="w-full max-w-2xl bg-card border border-line rounded-2xl shadow-lg overflow-hidden p-6 space-y-6">
            <div className="flex items-center gap-4 border-b border-line pb-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shrink-0">
                <FiTruck size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-ink m-0">Route Setup Configuration</h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  Select Sales Representative, Date, Week, and Day to prepare your route delivery sheet.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Sales Rep Selector */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-ink uppercase tracking-wider block flex items-center gap-1.5">
                  <FaUserTie className="text-primary" /> Sales Representative
                </label>
                <select
                  value={repId}
                  onChange={(e) => handleRepChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-card-2 border border-line rounded-xl text-xs font-bold text-ink focus:outline-none focus:border-primary cursor-pointer"
                >
                  {salesReps.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.employeeCode}) — {r.assignedRegion || 'General'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Delivery Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink uppercase tracking-wider block flex items-center gap-1.5">
                  <FiClock className="text-primary" /> Delivery Date
                </label>
                <DatePickerCalendar
                  name="setupDeliveryDate"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  required
                />
              </div>

              {/* Route Name Optional */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink uppercase tracking-wider block flex items-center gap-1.5">
                  <FiMapPin className="text-primary" /> Route / Area Name
                </label>
                <input
                  type="text"
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  placeholder="e.g. Madurai Central Route"
                  className="w-full px-3.5 py-2 bg-card-2 border border-line rounded-xl text-xs font-bold text-ink placeholder:font-normal focus:outline-none focus:border-primary"
                />
              </div>

              {/* Week Pills */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-ink uppercase tracking-wider block">Route Week</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {['1ST WEEK', '2ND WEEK', '3RD WEEK', '4TH WEEK', '5TH WEEK'].map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => handleWeekChange(w)}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                        week === w
                          ? 'bg-primary text-white shadow-xs'
                          : 'bg-card-2 text-ink-muted hover:text-ink border border-line hover:border-primary/40'
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              {/* Day Pills */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-ink uppercase tracking-wider block">Route Day</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => handleDayChange(d)}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                        day === d
                          ? 'bg-primary text-white shadow-xs'
                          : 'bg-card-2 text-ink-muted hover:text-ink border border-line hover:border-primary/40'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-line">
              <button
                type="button"
                onClick={() => navigate('/routes')}
                className="px-4 py-2 text-xs font-bold text-ink-muted hover:text-ink rounded-xl border border-line hover:bg-card-2 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-6 py-2.5 text-xs font-bold text-white bg-primary hover:bg-primary-hover rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                <span>Generate &amp; Open Delivery Sheet</span> →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ STEP 2: DELIVERY SHEET TABLE & INVOICED CUSTOMERS ═════════════════ */}
      {step === 2 && (
        <>
          {/* Main 2-column workspace */}
          <div className="flex-1 flex overflow-hidden min-h-0">
            {/* ── LEFT PANEL: DELIVERY STOPS TABLE ───────────────────────── */}
            <div className="flex-1 flex flex-col border-r border-line overflow-hidden min-w-0">
              {/* Context Summary Bar */}
              <div className="bg-card-2/60 border-b border-line px-4 py-2 flex items-center justify-between text-xs font-medium text-ink-muted shrink-0 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span>
                    <strong>Rep:</strong> {selectedRepObj ? `${selectedRepObj.name} (${selectedRepObj.employeeCode})` : '—'}
                  </span>
                  <span>|</span>
                  <span>
                    <strong>Week:</strong> <span className="text-primary font-bold">{week}</span>
                  </span>
                  <span>|</span>
                  <span>
                    <strong>Day:</strong> <span className="text-primary font-bold">{day}</span>
                  </span>
                  <span>|</span>
                  <span>
                    <strong>Date:</strong> {deliveryDate}
                  </span>
                </div>
                <div className="text-ink-subtle text-[11px]">
                  {validStopCount} assigned stop{validStopCount !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Table Container */}
              <div className="flex-1 overflow-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="sticky top-0 bg-card-2 border-b border-line z-20 shadow-xs">
                    <tr>
                      <th className="py-2.5 px-3 font-bold text-ink-muted text-center w-12 border-r border-line/60">
                        S.No
                      </th>
                      <th className="py-2.5 px-3 font-bold text-ink-muted w-28 border-r border-line/60">
                        Week
                      </th>
                      <th className="py-2.5 px-3 font-bold text-ink-muted w-28 border-r border-line/60">
                        Day
                      </th>
                      <th className="py-2.5 px-3 font-bold text-ink-muted min-w-[180px] border-r border-line/60">
                        Customer Name
                      </th>
                      <th className="py-2.5 px-3 font-bold text-ink-muted min-w-[200px] border-r border-line/60">
                        Invoice No &amp; DC No
                      </th>
                      <th className="py-2.5 px-3 font-bold text-ink-muted w-28 border-r border-line/60">
                        City
                      </th>
                      <th className="py-2.5 px-3 font-bold text-ink-muted w-28 border-r border-line/60">
                        Planned Time
                      </th>
                      <th className="py-2.5 px-2 font-bold text-ink-muted text-center w-10">
                        ×
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-line/60">
                    {stops.map((row, idx) => {
                      const matchedCust = invoicedCustomers.find((c) => c.id === row.customerId);
                      const availableInvoices = matchedCust ? matchedCust.invoices : [];
                      const isDropdownOpen = activeInvoiceDropdownIdx === idx;

                      return (
                        <tr
                          key={row.id}
                          className={`hover:bg-card-2/40 transition-colors ${
                            row.customerId ? 'bg-primary/[0.02]' : ''
                          }`}
                        >
                          {/* S.No */}
                          <td className="py-2 px-3 text-center font-bold text-ink-muted border-r border-line/60">
                            {row.sno}
                          </td>

                          {/* Week */}
                          <td className="py-2 px-2 border-r border-line/60">
                            <select
                              value={row.week}
                              onChange={(e) => handleRowWeekChange(idx, e.target.value)}
                              className="w-full py-1 px-1.5 bg-card-2 border border-line rounded-lg text-xs font-semibold text-ink focus:outline-none focus:border-primary cursor-pointer"
                            >
                              {['1ST WEEK', '2ND WEEK', '3RD WEEK', '4TH WEEK', '5TH WEEK'].map((w) => (
                                <option key={w} value={w}>
                                  {w}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Day */}
                          <td className="py-2 px-2 border-r border-line/60">
                            <select
                              value={row.day}
                              onChange={(e) => handleRowDayChange(idx, e.target.value)}
                              className="w-full py-1 px-1.5 bg-card-2 border border-line rounded-lg text-xs font-semibold text-ink focus:outline-none focus:border-primary cursor-pointer"
                            >
                              {['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'].map((d) => (
                                <option key={d} value={d}>
                                  {d}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Customer Name Select */}
                          <td className="py-2 px-2 border-r border-line/60">
                            <select
                              value={row.customerId}
                              onChange={(e) => handleCustomerChange(idx, e.target.value)}
                              className="w-full py-1 px-2 bg-card-2 border border-line rounded-lg text-xs font-bold text-ink focus:outline-none focus:border-primary cursor-pointer"
                            >
                              <option value="">-- Select Customer --</option>
                              {invoicedCustomers.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.customerName} ({c.city || 'N/A'})
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Invoice No & DC No Multi-Select Cell */}
                          <td className="py-2 px-2 border-r border-line/60 relative">
                            {row.customerId ? (
                              <div className="relative" ref={isDropdownOpen ? dropdownRef : undefined}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveInvoiceDropdownIdx(isDropdownOpen ? null : idx)
                                  }
                                  className="w-full py-1 px-2 bg-card-2 border border-line hover:border-primary/60 rounded-lg text-left text-xs font-medium text-ink flex items-center justify-between gap-1.5 cursor-pointer transition-colors"
                                >
                                  <span className="truncate">
                                    {row.selectedInvoices.length > 0 ? (
                                      <span className="font-bold text-primary">
                                        {row.selectedInvoices.map((i) => i.invoiceNo).join(', ')}
                                      </span>
                                    ) : (
                                      <span className="text-ink-subtle italic">Select Invoices…</span>
                                    )}
                                  </span>
                                  <FiChevronDown className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                                </button>

                                {/* Multi-select Dropdown Popover */}
                                {isDropdownOpen && (
                                  <div className="absolute left-0 top-full mt-1 w-64 bg-card border border-line rounded-xl shadow-xl z-50 p-2 space-y-1">
                                    <div className="text-[10.5px] font-bold text-ink-subtle uppercase px-2 py-1 border-b border-line flex justify-between items-center">
                                      <span>Select Pending Invoices</span>
                                      <span className="text-primary font-mono">
                                        {row.selectedInvoices.length} selected
                                      </span>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto divide-y divide-line/40">
                                      {availableInvoices.length > 0 ? (
                                        availableInvoices.map((inv) => {
                                          const isSelected = row.selectedInvoices.some(
                                            (i) => i.id === inv.id || i.invoiceNo === inv.invoiceNo
                                          );
                                          const assignedRow = getInvoiceAssignedRow(inv.id, idx);

                                          return (
                                            <button
                                              key={inv.id}
                                              type="button"
                                              onClick={() => handleToggleInvoice(idx, inv)}
                                              className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between text-xs cursor-pointer transition-colors ${
                                                isSelected
                                                  ? 'bg-primary/10 text-primary font-bold'
                                                  : 'hover:bg-card-2 text-ink'
                                              }`}
                                            >
                                              <div className="min-w-0 pr-2">
                                                <div className="font-mono">{inv.invoiceNo}</div>
                                                {inv.dcNo && (
                                                  <div className="text-[10px] text-ink-subtle">
                                                    DC: {inv.dcNo}
                                                  </div>
                                                )}
                                                {inv.grandTotal !== undefined && (
                                                  <div className="text-[10px] text-ink-muted font-medium">
                                                    ₹{formatCurrency(inv.grandTotal)}
                                                  </div>
                                                )}
                                              </div>

                                              <div className="flex items-center gap-1 shrink-0">
                                                {assignedRow !== null && (
                                                  <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-1 py-0.5 rounded">
                                                    Row #{assignedRow}
                                                  </span>
                                                )}
                                                {isSelected && <FiCheck className="text-primary w-4 h-4" />}
                                              </div>
                                            </button>
                                          );
                                        })
                                      ) : (
                                        <div className="p-3 text-center text-ink-subtle text-xs">
                                          No invoices available for this customer.
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-ink-subtle text-center block">—</span>
                            )}
                          </td>

                          {/* City */}
                          <td className="py-2 px-3 border-r border-line/60">
                            {row.customerId ? (
                              <input
                                type="text"
                                value={row.city}
                                onChange={(e) =>
                                  setStops((prev) =>
                                    prev.map((s, i) =>
                                      i === idx ? { ...s, city: e.target.value } : s
                                    )
                                  )
                                }
                                placeholder="City"
                                className="w-full py-1.5 px-3 bg-card-2 border border-line rounded-full text-xs font-semibold text-ink text-center focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 transition-all shadow-2xs"
                              />
                            ) : (
                              <span className="text-ink-subtle text-center block">—</span>
                            )}
                          </td>

                          {/* Planned Time */}
                          <td className="py-2 px-3 border-r border-line/60">
                            {row.customerId ? (
                              <input
                                type="time"
                                value={formatTimeForInput(row.plannedTime)}
                                onChange={(e) =>
                                  setStops((prev) =>
                                    prev.map((s, i) =>
                                      i === idx ? { ...s, plannedTime: e.target.value } : s
                                    )
                                  )
                                }
                                className="w-full py-1.5 px-3 bg-card-2 border border-line rounded-full text-xs font-semibold text-ink text-center focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 transition-all shadow-2xs cursor-pointer"
                              />
                            ) : (
                              <span className="text-ink-subtle text-center block">—</span>
                            )}
                          </td>

                          {/* Remove Stop Row */}
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveStop(idx)}
                              title="Delete row"
                              className="text-ink-subtle hover:text-red-500 p-1 rounded-md transition-colors cursor-pointer"
                            >
                              <FiTrash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Add Stop Button Bar */}
              <div className="p-3 bg-card-2/40 border-t border-line shrink-0 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleAddStop}
                  className="px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 border border-primary/20 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <FiPlus className="w-4 h-4" />
                  <span>Add Delivery Stop Row</span>
                </button>
                <div className="text-[11px] text-ink-subtle font-medium">
                  Click customer "+ Add" from right panel or select from dropdown above.
                </div>
              </div>
            </div>

            {/* ── RIGHT PANEL: INVOICED CUSTOMERS ───────────────────────── */}
            <div className="w-80 flex flex-col bg-card-2/30 shrink-0 overflow-hidden">
              {/* Right Panel Header & Filter */}
              <div className="p-3 border-b border-line bg-card shrink-0 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                    <FaFileInvoiceDollar className="text-primary" />
                    Invoiced Customers ({panelCustomers.length})
                  </h3>
                </div>

                {/* City filter pills */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setCityFilter('ALL')}
                    className={`px-2 py-0.5 text-[10.5px] font-bold rounded-lg transition-colors shrink-0 cursor-pointer ${
                      cityFilter === 'ALL'
                        ? 'bg-primary text-white'
                        : 'bg-card-2 text-ink-muted hover:text-ink border border-line'
                    }`}
                  >
                    ALL ({invoicedCustomers.length})
                  </button>
                  {uniqueCities.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCityFilter(c)}
                      className={`px-2 py-0.5 text-[10.5px] font-bold rounded-lg transition-colors shrink-0 cursor-pointer ${
                        cityFilter === c
                          ? 'bg-primary text-white'
                          : 'bg-card-2 text-ink-muted hover:text-ink border border-line'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customer List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {panelCustomers.length > 0 ? (
                  panelCustomers.map((cust) => {
                    const isAdded = stops.some((s) => s.customerId === cust.id);

                    return (
                      <div
                        key={cust.id}
                        className={`p-3 rounded-xl border transition-all ${
                          isAdded
                            ? 'bg-primary/5 border-primary/20 opacity-75'
                            : 'bg-card border-line hover:border-primary/40 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-ink truncate m-0">
                              {cust.customerName}
                            </h4>
                            {cust.firmName && (
                              <p className="text-[10.5px] text-ink-subtle truncate mt-0.5">
                                {cust.firmName}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1 text-[10.5px] text-ink-muted flex-wrap">
                              <span className="flex items-center gap-0.5 font-medium">
                                <FaMapMarkerAlt className="text-primary w-2.5 h-2.5" />
                                {cust.city || 'N/A'}
                              </span>
                              <span>·</span>
                              <span className="font-mono text-primary font-bold">
                                {cust.invoices.length} Inv
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={isAdded}
                            onClick={() => handleAddCustomerFromPanel(cust)}
                            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all shrink-0 cursor-pointer ${
                              isAdded
                                ? 'bg-card-2 text-ink-subtle cursor-not-allowed border border-line'
                                : 'bg-primary text-white hover:bg-primary-hover shadow-2xs'
                            }`}
                          >
                            {isAdded ? 'Added' : '+ Add'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-6 text-center text-ink-subtle text-xs">
                    No invoiced customers found for city: {cityFilter}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ══ FOOTER BAR ══════════════════════════════════════════════════════ */}
          <div className="bg-card border-t border-line px-5 py-3 shrink-0 flex items-center justify-between">
            <div className="text-xs font-medium text-ink-muted">
              Ready to assign <strong className="text-ink">{validStopCount} stops</strong> to{' '}
              <strong className="text-primary">{selectedRepObj?.name || 'Representative'}</strong>.
            </div>
            <div className="flex items-center gap-3">
              <CustomButton
                text="Cancel"
                onClick={() => navigate('/routes')}
                disabled={isSaving}
              />
              <CustomButton
                text={isSaving ? 'Saving…' : 'Save Route Sheet'}
                icon={isSaving ? undefined : FiSave}
                onClick={handleSaveRoute}
                disabled={isSaving || isLoading}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default RouteAssignFormPage;

