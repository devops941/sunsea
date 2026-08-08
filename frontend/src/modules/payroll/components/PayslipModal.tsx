import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { FiPrinter, FiDownload } from 'react-icons/fi';
import { payrollService } from '../../../services/payrollService';
import type { ApiPayslipData } from '../../../services/payrollService';
import PayslipDocument from './PayslipDocument';
import CustomButton from '../../../components/ui/custombutton/CustomButton';

interface PayslipModalProps {
  runId:    number;
  resultId: number;
  period:   string;
  type:     'MONTHLY' | 'WEEKLY';
  onClose:  () => void;
}

// ─── PDF filename ─────────────────────────────────────────────────────────────
function buildFilename(data: ApiPayslipData): string {
  const code = data.result.employeeCode.replace(/\s+/g, '');
  const { period, type } = data.run;
  if (type === 'MONTHLY' && /^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split('-');
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    return `PAYSLIP_${code}_${months[parseInt(m, 10) - 1]}_${y}.pdf`;
  }
  const wm = period.match(/^(\d{4})-W(\d{2})$/);
  if (wm) return `PAYSLIP_${code}_WEEK${wm[2]}_${wm[1]}.pdf`;
  return `PAYSLIP_${code}_${period}.pdf`;
}

// ─── Print in new window ──────────────────────────────────────────────────────
function printPayslip(el: HTMLDivElement, companyName: string) {
  const win = window.open('', '_blank', 'width=900,height=750');
  if (!win) return;
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Payslip — ${companyName}</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; width: 210mm; }
    @media print {
      html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>${el.outerHTML}</body>
</html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 500);
}

// ─── PDF download ─────────────────────────────────────────────────────────────
async function downloadPdf(el: HTMLDivElement, filename: string) {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf'),
  ]);
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    width: el.scrollWidth,
    height: el.scrollHeight,
  });
  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const pdf     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW   = pdf.internal.pageSize.getWidth();
  const pageH   = pdf.internal.pageSize.getHeight();
  const ratio   = pageW / canvas.width;
  const imgH    = canvas.height * ratio;
  let yPos = 0; let remaining = imgH;
  while (remaining > 0) {
    pdf.addImage(imgData, 'JPEG', 0, -yPos, pageW, imgH);
    remaining -= pageH; yPos += pageH;
    if (remaining > 0) pdf.addPage();
  }
  pdf.save(filename);
}

// ─── Component ────────────────────────────────────────────────────────────────
const PayslipModal: React.FC<PayslipModalProps> = ({ runId, resultId, onClose }) => {
  const [data,    setData]    = useState<ApiPayslipData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    payrollService.getPayslip(runId, resultId)
      .then(setData)
      .catch((e) => setError(e?.response?.data?.message ?? 'Failed to load payslip.'))
      .finally(() => setLoading(false));
  }, [runId, resultId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handlePrint = () => {
    if (!docRef.current || !data) return;
    printPayslip(docRef.current, data.company?.companyName ?? 'Company');
  };

  const handlePdf = async () => {
    if (!docRef.current || !data || pdfBusy) return;
    setPdfBusy(true);
    try { await downloadPdf(docRef.current, buildFilename(data)); }
    finally { setPdfBusy(false); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* ── Sticky top bar ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3.5 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <h2 className="text-base font-bold text-slate-800">Payslip Preview</h2>
        </div>
        <div className="flex items-center gap-2.5">
          {/* <button
            type="button"
            onClick={handlePrint}
            disabled={!data}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 text-xs font-semibold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <FiPrinter size={15} className="text-slate-500" />
            <span>Print</span>
          </button> */}

          <button
            type="button"
            onClick={handlePdf}
            disabled={!data || pdfBusy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 text-xs font-semibold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {pdfBusy ? <Loader2 size={15} className="animate-spin" /> : <FiDownload size={15} />}
            <span>{pdfBusy ? 'Generating…' : 'Download PDF'}</span>
          </button>

          <div className="w-px h-5 bg-slate-200 mx-1" />

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── Scrollable body — A4 centred ── */}
      <div className="flex-1 overflow-y-auto bg-gray-100 py-6 px-4">
        {loading && (
          <div className="flex items-center justify-center h-64 gap-3 text-gray-500">
            <Loader2 size={28} className="animate-spin" />
            <span className="text-sm font-medium">Loading payslip…</span>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-64 text-red-600 text-sm font-medium">
            {error}
          </div>
        )}

        {data && (
          /* A4 paper shadow — width matches the 210mm in PayslipDocument */
          <div
            className="mx-auto bg-white shadow-2xl"
            style={{ width: '210mm', minHeight: '297mm' }}
          >
            <PayslipDocument ref={docRef} data={data} />
          </div>
        )}
      </div>
    </div>
  );
};

export default PayslipModal;
