import { formatDate } from "../../../utils/dateUtils";
import React from 'react';
import type { ApiPayslipData } from '../../../services/payrollService';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigit(n: number): string {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
}

function numberToWords(amount: number): string {
  const n = Math.floor(amount);
  if (n === 0) return 'Zero Rupees Only';
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thou = Math.floor((n % 100_000) / 1_000);
  const hund = Math.floor((n % 1_000) / 100);
  const rem = n % 100;
  const parts: string[] = [];
  if (crore) parts.push(twoDigit(crore) + ' Crore');
  if (lakh) parts.push(twoDigit(lakh) + ' Lakh');
  if (thou) parts.push(twoDigit(thou) + ' Thousand');
  if (hund) parts.push(ONES[hund] + ' Hundred');
  if (rem) parts.push(twoDigit(rem));
  return parts.join(' ') + ' Rupees Only';
}

function periodLabel(period: string, type: 'MONTHLY' | 'WEEKLY'): string {
  if (type === 'MONTHLY' && /^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split('-');
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[parseInt(m, 10) - 1]} ${y}`;
  }
  const wm = period.match(/^(\d{4})-W(\d{2})$/);
  if (wm) return `Week ${wm[2]}, ${wm[1]}`;
  return period;
}

function periodShort(period: string, type: 'MONTHLY' | 'WEEKLY'): string {
  if (type === 'MONTHLY' && /^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(m, 10) - 1]}-${y.slice(2)}`;
  }
  return period;
}

const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = (n: number) => n.toLocaleString('en-IN');

// ─── Inline styles (PDF/print safe — no Tailwind) ─────────────────────────────
const outer: React.CSSProperties = {
  width: '210mm',
  minHeight: '295mm',
  margin: '0 auto',
  fontFamily: 'Arial, sans-serif',
  fontSize: '10px',
  color: '#000',
  backgroundColor: '#fff',
  boxSizing: 'border-box',
  padding: '8mm 10mm',
};

// Outer wrapper — bold border
const border: React.CSSProperties = {
  border: '2px solid #000',
  width: '100%',
  boxSizing: 'border-box',
};

// Inner cells — thin, light dividers
const cell = (extra?: React.CSSProperties): React.CSSProperties => ({
  border: '0.5px solid #aaa',
  padding: '3px 6px',
  verticalAlign: 'top',
  ...extra,
});

// Outer table <td> — section-level dividers (visible but not heavy)
const sectionTd = (extra?: React.CSSProperties): React.CSSProperties => ({
  borderTop: '1px solid #555',
  borderBottom: '1px solid #555',
  borderLeft: 'none',
  borderRight: 'none',
  padding: '5px 8px',
  verticalAlign: 'top',
  ...extra,
});

const th = (extra?: React.CSSProperties): React.CSSProperties => ({
  border: '0.5px solid #888',
  padding: '4px 6px',
  backgroundColor: '#ebebeb',
  fontWeight: 700,
  textAlign: 'center',
  fontSize: '9px',
  ...extra,
});

// ─── Component ────────────────────────────────────────────────────────────────
interface PayslipDocumentProps { data: ApiPayslipData; id?: string; }

const PayslipDocument = React.forwardRef<HTMLDivElement, PayslipDocumentProps>(
  ({ data, id }, ref) => {
    const { company, run, employee, result } = data;
    const isMonthly = run.type === 'MONTHLY';
    const pc = employee.payrollConfig;

    // Proration ratio for monthly earnings breakdown
    const proration = (isMonthly && pc && pc.monthlySalary > 0)
      ? result.earnedSalary / pc.monthlySalary
      : 1;

    // Earnings rows
    const earnRows: { label: string; amount: number }[] = [];
    if (isMonthly && pc) {
      if (pc.basicSalary > 0) earnRows.push({ label: 'Basic Salary', amount: Math.round(pc.basicSalary * proration) });
      if (pc.hra > 0) earnRows.push({ label: 'House Rent Allowance (HRA)', amount: Math.round(pc.hra * proration) });
      if (pc.da > 0) earnRows.push({ label: 'Dearness Allowance (DA)', amount: Math.round(pc.da * proration) });
      if (pc.otherAllowance > 0) earnRows.push({ label: 'Other Allowance', amount: Math.round(pc.otherAllowance * proration) });
      if (result.otPay > 0) earnRows.push({ label: 'Overtime Pay', amount: result.otPay });
    } else {
      earnRows.push({ label: 'Daily Wages Earned', amount: result.earnedSalary });
      if (result.otPay > 0) earnRows.push({ label: 'Overtime Pay', amount: result.otPay });
      if (result.cashInHand > 0) earnRows.push({ label: 'Cash in Hand', amount: result.cashInHand });
    }

    // Deduction rows
    const dedRows: { label: string; amount: number }[] = [];
    const empPfPct = result.pfWage > 0 ? ((Number(result.employeePf) / Number(result.pfWage)) * 100).toFixed(2).replace(/\.?0+$/, '') : '12';
    const empEsiPct = (Number(result.earnedSalary) + Number(result.otPay)) > 0 ? ((Number(result.employeeEsi) / (Number(result.earnedSalary) + Number(result.otPay))) * 100).toFixed(2).replace(/\.?0+$/, '') : '0.75';
    if (result.employeePf > 0) dedRows.push({ label: `Provident Fund (Employee @ ${empPfPct}%)`, amount: result.employeePf });
    if (result.employeeEsi > 0) dedRows.push({ label: `ESI (Employee @ ${empEsiPct}%)`, amount: result.employeeEsi });
    if (result.professionalTax > 0) dedRows.push({ label: 'Professional Tax', amount: result.professionalTax });
    if (result.lateEntryDeduction > 0) dedRows.push({ label: 'Late Entry Deduction', amount: result.lateEntryDeduction });
    if (result.permissionDeduction > 0) dedRows.push({ label: 'Permission Deduction', amount: result.permissionDeduction });
    if (result.salaryAdvance > 0) dedRows.push({ label: 'Salary Advance Recovery', amount: result.salaryAdvance });
    if (result.loanRecovery > 0) dedRows.push({ label: 'Loan Recovery', amount: result.loanRecovery });
    if (result.otherDeductions > 0) dedRows.push({ label: 'Other Deductions', amount: result.otherDeductions });

    const grossEarnings = earnRows.reduce((s, r) => s + r.amount, 0);
    const totalDeductions = dedRows.reduce((s, r) => s + r.amount, 0);
    // PF employees: net salary excludes cash in hand (paid separately off payslip)
    const isPfWithCash = result.pfApplicable && Number(result.cashInHand || 0) > 0;
    const netSalaryPayable = isPfWithCash ? Number(result.bankTransfer ?? (grossEarnings - totalDeductions)) : result.netSalary;

    // Address for company
    const addr1 = [company?.addressLine1].filter(Boolean).join(', ');
    const addr2 = [company?.city, company?.state, company?.zipcode ? `- ${company.zipcode}` : ''].filter(Boolean).join(', ');

    const doj = employee.dateOfJoining
      ? formatDate(employee.dateOfJoining)
      : '—';

    // Right-side info grid rows
    const infoRows: [string, string][] = [
      ['Pay Period', periodLabel(run.period, run.type)],
      ['Slip No.', run.runCode],
      ['Dated', periodShort(run.period, run.type)],
      ['Payment Mode', result.paymentMode],
      ['PF Number', (employee.pfNumber && employee.pfNumber.trim()) ? employee.pfNumber.trim() : '—'],
      ['ESIC Number', (employee.esiNumber && employee.esiNumber.trim()) ? employee.esiNumber.trim() : '—'],
      ['UAN Number', (employee.uanNumber && employee.uanNumber.trim()) ? employee.uanNumber.trim() : '—'],
      ['PAN Number', (employee.panNumber && employee.panNumber.trim()) ? employee.panNumber.trim() : '—'],
    ];

    // Employer contributions note
    const showEmpCont = result.pfApplicable || result.esiApplicable;

    return (
      <div ref={ref} id={id} style={outer}>

        {/* ── Title ── */}
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '14px', marginBottom: '6px', letterSpacing: '1px' }}>
          Salary Slip
        </div>

        {/* ── Outer table ── */}
        <table style={{ ...border, borderCollapse: 'collapse' }}>
          <tbody>

            {/* ── Row 1: Company header | Info grid ── */}
            <tr>
              {/* Company */}
              <td style={{ ...sectionTd({ borderTop: 'none', borderLeft: 'none', width: '52%' }) }}>
                <div style={{ fontWeight: 700, fontSize: '12px', marginBottom: '3px' }}>
                  {company?.companyName ?? 'Company Name'}
                </div>
                {company?.legalName && company.legalName !== company.companyName && (
                  <div style={{ fontSize: '9px', marginBottom: '2px', fontStyle: 'italic' }}>{company.legalName}</div>
                )}
                {addr1 && <div style={{ fontSize: '9px', marginBottom: '1px' }}>{addr1}</div>}
                {addr2 && <div style={{ fontSize: '9px', marginBottom: '1px' }}>{addr2}</div>}
                {company?.gstin && (
                  <div style={{ fontSize: '9px', marginBottom: '1px' }}>GSTIN/UIN : {company.gstin}</div>
                )}
                {company?.phone && (
                  <div style={{ fontSize: '9px', marginBottom: '1px' }}>Contact : {company.phone}</div>
                )}
                {company?.email && (
                  <div style={{ fontSize: '9px' }}>E-Mail : {company.email}</div>
                )}
              </td>

              {/* Info grid (right side — two-column inner table) */}
              <td style={{ ...sectionTd({ borderTop: 'none', borderRight: 'none', width: '48%', padding: 0, borderLeft: '1px solid #555' }) }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
                  <tbody>
                    {infoRows.map(([label, value]) => (
                      <tr key={label}>
                        <td style={{ ...cell({ fontSize: '9px' }), width: '45%', fontWeight: 600 }}>{label}</td>
                        <td style={{ ...cell({ fontSize: '9px' }), fontWeight: 500 }}>{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
            </tr>

            {/* ── Row 2: "Payment to" — employee details ── */}
            <tr>
              <td colSpan={2} style={sectionTd({ borderLeft: 'none', borderRight: 'none' })}>
                <div style={{ fontSize: '9px', color: '#444', marginBottom: '2px' }}>Payment to (Employee)</div>
                <div style={{ fontWeight: 700, fontSize: '12px', marginBottom: '2px' }}>{employee.fullName}</div>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '9px' }}>
                  {employee.designation && (
                    <span>Designation : <strong>{employee.designation}</strong></span>
                  )}
                  <span>Department : <strong>{employee.department || '—'}</strong></span>
                  <span>Emp Code : <strong>{employee.empCode}</strong></span>
                  {employee.employeeType && (
                    <span>Type : <strong>{employee.employeeType}</strong></span>
                  )}
                  <span>Date of Joining : <strong>{doj}</strong></span>
                  {(employee.bankName || employee.accountNumber) && (
                    <span>Bank : <strong>{employee.bankName ?? '—'}</strong> | A/c: <strong>{employee.accountNumber ?? '—'}</strong>
                      {employee.ifscCode ? ` | IFSC: ${employee.ifscCode}` : ''}</span>
                  )}
                </div>
              </td>
            </tr>

            {/* ── Row 3: Attendance summary ── */}
            <tr>
              <td colSpan={2} style={sectionTd({ borderLeft: 'none', borderRight: 'none', padding: 0 })}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      {['Total Days', 'Present Days', 'Absent Days', 'Half Days', 'LOP Days'].map(h => (
                        <th key={h} style={{ ...cell(), fontWeight: 700, textAlign: 'center', padding: '3px 4px', fontSize: '8.5px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {[
                        result.totalDays,
                        result.presentDays,
                        result.absentDays,
                        result.halfDays,
                        result.lopDays,
                      ].map((v, i) => (
                        <td key={i} style={{ ...cell(), textAlign: 'center', padding: '3px 4px', fontWeight: 600 }}>{v}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>

            {/* ── Row 4: Earnings & Deductions Table ── */}
            <tr>
              <td colSpan={2} style={sectionTd({ borderLeft: 'none', borderRight: 'none', padding: 0 })}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      <th style={th({ width: '5%' })}>Sl.</th>
                      <th style={th({ textAlign: 'left', width: '55%' })}>Particulars</th>
                      <th style={th({ width: '12%' })}>Days / Hrs</th>
                      <th style={th({ width: '12%' })}>Rate (₹)</th>
                      <th style={th({ width: '16%', textAlign: 'right' })}>Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Earnings */}
                    <tr>
                      <td colSpan={5} style={{ ...cell({ padding: '2px 5px', backgroundColor: '#f8f8f8', fontWeight: 700, fontSize: '9px' }) }}>
                        EARNINGS
                      </td>
                    </tr>
                    {earnRows.map((e, i) => (
                      <tr key={i}>
                        <td style={{ ...cell(), textAlign: 'center' }}>{i + 1}</td>
                        <td style={{ ...cell() }}>{e.label}</td>
                        <td style={{ ...cell(), textAlign: 'center' }}>
                          {i === 0 ? `${result.presentDays} days` : ''}
                        </td>
                        <td style={{ ...cell(), textAlign: 'right' }}>
                          {i === 0 && isMonthly && pc ? fmt0(pc.monthlySalary) : ''}
                        </td>
                        <td style={{ ...cell(), textAlign: 'right' }}>{fmt(e.amount)}</td>
                      </tr>
                    ))}
                    {/* Gross total */}
                    <tr style={{ backgroundColor: '#f5f5f5' }}>
                      <td style={{ ...cell() }} />
                      <td style={{ ...cell({ fontWeight: 700 }) }}>Gross Earnings</td>
                      <td style={{ ...cell() }} />
                      <td style={{ ...cell() }} />
                      <td style={{ ...cell({ textAlign: 'right', fontWeight: 700 }) }}>{fmt(grossEarnings)}</td>
                    </tr>

                    {/* Deductions */}
                    {dedRows.length > 0 && (
                      <>
                        <tr>
                          <td colSpan={5} style={{ ...cell({ padding: '2px 5px', backgroundColor: '#f8f8f8', fontWeight: 700, fontSize: '9px' }) }}>
                            DEDUCTIONS
                          </td>
                        </tr>
                        {dedRows.map((d, i) => (
                          <tr key={i}>
                            <td style={{ ...cell(), textAlign: 'center' }}>{i + 1}</td>
                            <td style={{ ...cell() }}>{d.label}</td>
                            <td style={{ ...cell() }} />
                            <td style={{ ...cell() }} />
                            <td style={{ ...cell(), textAlign: 'right' }}>{fmt(d.amount)}</td>
                          </tr>
                        ))}
                        <tr style={{ backgroundColor: '#f5f5f5' }}>
                          <td style={{ ...cell() }} />
                          <td style={{ ...cell({ fontWeight: 700 }) }}>Total Deductions</td>
                          <td style={{ ...cell() }} />
                          <td style={{ ...cell() }} />
                          <td style={{ ...cell({ textAlign: 'right', fontWeight: 700 }) }}>{fmt(totalDeductions)}</td>
                        </tr>
                      </>
                    )}

                    {/* Employer contributions note rows (like CGST/SGST in invoice) */}
                    {showEmpCont && (
                      <>
                        {result.pfApplicable && (() => {
                          const emrPfPct = result.pfWage > 0 ? ((Number(result.employerPf) / Number(result.pfWage)) * 100).toFixed(2).replace(/\.?0+$/, '') : '12';
                          return (
                            <tr>
                              <td style={{ ...cell() }} />
                              <td style={{ ...cell({ fontStyle: 'italic', color: '#444' }) }}>
                                Employer PF Contribution @ {emrPfPct}% (Not deducted from salary)
                              </td>
                              <td style={{ ...cell({ textAlign: 'center' }) }}>{emrPfPct}%</td>
                              <td style={{ ...cell() }} />
                              <td style={{ ...cell({ textAlign: 'right', color: '#444' }) }}>{fmt(result.employerPf)}</td>
                            </tr>
                          );
                        })()}
                        {result.esiApplicable && (() => {
                          const emrEsiPct = result.earnedSalary > 0 ? ((Number(result.employerEsi) / (Number(result.earnedSalary) + Number(result.otPay))) * 100).toFixed(2).replace(/\.?0+$/, '') : '3.25';
                          return (
                            <tr>
                              <td style={{ ...cell() }} />
                              <td style={{ ...cell({ fontStyle: 'italic', color: '#444' }) }}>
                                Employer ESI Contribution @ {emrEsiPct}% (Not deducted from salary)
                              </td>
                              <td style={{ ...cell({ textAlign: 'center' }) }}>{emrEsiPct}%</td>
                              <td style={{ ...cell() }} />
                              <td style={{ ...cell({ textAlign: 'right', color: '#444' }) }}>{fmt(result.employerEsi)}</td>
                            </tr>
                          );
                        })()}
                      </>
                    )}

                    {/* Spacer rows to push net to bottom */}
                    {Array.from({ length: Math.max(0, 3 - earnRows.length - dedRows.length) }).map((_, i) => (
                      <tr key={`sp${i}`}>
                        <td style={{ ...cell(), height: '18px' }} />
                        <td style={{ ...cell() }} />
                        <td style={{ ...cell() }} />
                        <td style={{ ...cell() }} />
                        <td style={{ ...cell() }} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
            </tr>

            {/* ── Row 5: Net salary ── */}
            <tr>
              <td colSpan={2} style={sectionTd({ borderLeft: 'none', borderRight: 'none', padding: '6px 10px' })}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '9px', color: '#444' }}>Net Salary Payable (in words):</div>
                    <div style={{ fontStyle: 'italic', fontSize: '9.5px', fontWeight: 600, marginTop: '2px' }}>
                      {numberToWords(netSalaryPayable)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '9px', color: '#444' }}>Net Salary Payable</div>
                    <div style={{ fontWeight: 700, fontSize: '16px', marginTop: '1px' }}>
                      ₹ {fmt(netSalaryPayable)}
                    </div>
                  </div>
                </div>
              </td>
            </tr>

            {/* ── Row 6: Signatures ── */}
            <tr>
              <td style={sectionTd({ borderTop: '1px solid #555', borderBottom: 'none', borderLeft: 'none', borderRight: 'none', padding: '16px 10px 10px', textAlign: 'left', fontSize: '9px', color: '#333' })}>
                <div style={{ borderTop: '1px solid #000', width: '120px', marginTop: '20px', marginBottom: '3px' }} />
                <div>Employee Signature</div>
                <div style={{ fontWeight: 600, marginTop: '1px' }}>{employee.fullName}</div>
              </td>
              <td style={sectionTd({ borderTop: '1px solid #555', borderBottom: 'none', borderLeft: '1px solid #555', borderRight: 'none', padding: '16px 10px 10px', textAlign: 'right', fontSize: '9px', color: '#333' })}>
                <div style={{ borderTop: '1px solid #000', width: '120px', marginTop: '20px', marginBottom: '3px', marginLeft: 'auto' }} />
                <div>Authorised Signatory</div>
                <div style={{ fontWeight: 600, marginTop: '1px' }}>{company?.companyName ?? ''}</div>
              </td>
            </tr>

          </tbody>
        </table>

        {/* ── Footer (outside table, like invoice) ── */}
        <div style={{ textAlign: 'center', marginTop: '6px', fontSize: '8.5px', fontWeight: 600, letterSpacing: '0.5px' }}>
          {company?.city ? `SUBJECT TO ${company.city.toUpperCase()} JURISDICTION` : 'SUBJECT TO LOCAL JURISDICTION'}
        </div>
        <div style={{ textAlign: 'center', fontSize: '8px', marginTop: '2px', color: '#444' }}>
          This is a Computer Generated Payslip
        </div>

      </div>
    );
  }
);

PayslipDocument.displayName = 'PayslipDocument';
export default PayslipDocument;
