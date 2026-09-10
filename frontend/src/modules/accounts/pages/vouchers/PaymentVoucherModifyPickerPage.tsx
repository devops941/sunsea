import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { voucherService, type Voucher } from "../../../../services/voucherService";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { useListCache } from "../../../../hooks/useListCache";
import { useFormShortcuts } from "../../../../hooks/useFormShortcuts";

// Busy-style "Select Voucher To Modify (Payment)" picker.
// Operator enters Voucher Number and/or Date → OK finds the voucher and
// navigates to the Modify page. If the voucher is already in the list
// cache (common case — user was just on the list), we pass it via router
// state so the edit page opens instantly with zero fetch.
const PaymentVoucherModifyPickerPage: React.FC = () => {
  const navigate = useNavigate();
  const todayIso = new Date().toISOString().split("T")[0];

  const [voucherSeries] = useState("Main");
  const [voucherNo, setVoucherNo] = useState("");
  const [voucherDate, setVoucherDate] = useState(todayIso);
  const [submitting, setSubmitting] = useState(false);

  // F2 = submit (auto-clicks the form's submit button) + auto-focus the
  // Voucher No field on mount (centralised via useFormShortcuts).
  useFormShortcuts({ autoFocusField: "voucherNo" });

  // Read the payment vouchers cache so we can look up locally first (no
  // network round-trip when the user already has the list warm).
  const fetcher = useCallback(async () => {
    const res = await voucherService.fetchVouchers({
      type: "PAYMENT",
      page: 1,
      limit: 10000,
    });
    return { data: res.vouchers || [], total: res.total || 0 };
  }, []);

  const { data: cachedVouchers } = useListCache<Voucher>({
    // Match the prefix used by the Payment list so we hit the same cache
    // entry when the user came from there.
    cacheKey: `accounts:payment-vouchers:modify-picker`,
    socketModule: "voucher",
    fetcher,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const vNoRaw = voucherNo.trim();
    const dateStr = voucherDate.trim();

    if (!vNoRaw && !dateStr) {
      toast.error("Enter Voucher Number OR Voucher Date");
      return;
    }

    setSubmitting(true);
    try {
      // ── Case A: Voucher No supplied → find that specific voucher ─────
      if (vNoRaw) {
        // Normalise "3" → "PAY-3" so operators can type the short display form.
        const normalized = /^\d+$/.test(vNoRaw)
          ? `PAY-${vNoRaw}`
          : vNoRaw.toUpperCase();

        const cacheHit = cachedVouchers.find((v) => v.voucherNo === normalized);
        if (cacheHit) {
          navigate(`/accounts/payment-voucher/edit/${cacheHit.id}`, {
            state: { voucher: cacheHit },
          });
          return;
        }

        const res = await voucherService.fetchVouchers({
          type: "PAYMENT",
          search: normalized,
          page: 1,
          limit: 10,
        });
        const found = (res.vouchers || []).find((v) => v.voucherNo === normalized);
        if (!found) {
          toast.error(`Voucher "${vNoRaw}" not found in Payment`);
          return;
        }
        navigate(`/accounts/payment-voucher/edit/${found.id}`, {
          state: { voucher: found },
        });
        return;
      }

      // ── Case B: No Voucher No → open a voucher on the selected date, or
      // fall back to the most recent voucher AT OR BEFORE that date.
      // Busy behaviour — operators expect to be able to key "today" as a
      // shortcut and land on the last saved voucher even if today is empty.
      const sortByDateDescIdDesc = (a: Voucher, b: Voucher) => {
        const dc = (b.date || "").localeCompare(a.date || "");
        return dc !== 0 ? dc : b.id - a.id;
      };
      const onOrBefore = (v: Voucher) => (v.date || "").slice(0, 10) <= dateStr;

      // Look in cache first — same day, else latest ≤ selected date.
      const sameDayCache = cachedVouchers.filter((v) =>
        (v.date || "").startsWith(dateStr)
      );
      let candidate = sameDayCache.slice().sort((a, b) => b.id - a.id)[0];

      if (!candidate) {
        const earlierCache = cachedVouchers.filter(onOrBefore).sort(sortByDateDescIdDesc);
        candidate = earlierCache[0];
      }

      if (!candidate) {
        // Cache empty — hit server for anything up to the selected date.
        const res = await voucherService.fetchVouchers({
          type: "PAYMENT",
          endDate: dateStr,
          page: 1,
          limit: 100,
        });
        const list = (res.vouchers || []).filter(onOrBefore).sort(sortByDateDescIdDesc);
        candidate = list[0];
      }

      if (!candidate) {
        toast.error(`No payment vouchers found on or before ${dateStr}`);
        return;
      }
      navigate(`/accounts/payment-voucher/edit/${candidate.id}`, {
        state: { voucher: candidate },
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to locate voucher");
    } finally {
      setSubmitting(false);
    }
  };

  // F2 = OK (Busy shortcut).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        (document.getElementById("modify-picker-form") as HTMLFormElement | null)
          ?.requestSubmit();
      } else if (e.key === "Escape") {
        navigate("/accounts/payment-voucher");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <div className="p-3">
      <div className="w-full lg:w-[420px]">
        <div className="bg-card border border-line rounded-md overflow-hidden shadow-sm">
          <div className="bg-red-600/90 text-white text-[13px] font-bold uppercase tracking-wide text-center py-1 border-b border-line">
            Select Voucher To Modify ( Payment )
          </div>
          <form id="modify-picker-form" onSubmit={handleSubmit} className="p-4 space-y-2.5 text-[13px]">
            <div className="grid grid-cols-12 gap-3 items-center">
              <label className="col-span-5 text-ink-subtle font-semibold">Voucher Series</label>
              <div className="col-span-7 text-ink font-semibold">{voucherSeries}</div>
            </div>

            <div className="grid grid-cols-12 gap-3 items-center">
              <label className="col-span-5 text-ink-subtle font-semibold">Voucher No.</label>
              <div className="col-span-7">
                <input
                  name="voucherNo"
                  type="text"
                  value={voucherNo}
                  onChange={(e) => setVoucherNo(e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                  placeholder="e.g. 3"
                  className="w-full px-2 py-1 border border-line bg-card rounded text-[13px] text-ink focus:ring-1 focus:ring-red-500/40 focus:border-red-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-12 gap-3 items-center">
              <label className="col-span-5 text-ink-subtle font-semibold">Voucher Date</label>
              <div className="col-span-7">
                <DatePickerCalendar
                  name="voucherDate"
                  value={voucherDate}
                  onChange={(e) => setVoucherDate(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-2 flex justify-center">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-1 bg-red-600 hover:bg-red-700 text-white rounded font-semibold text-[13px] transition cursor-pointer disabled:opacity-50"
              >
                {submitting ? "Locating…" : "OK (F2)"}
              </button>
            </div>
            <div className="text-center text-[13px] text-ink-subtle italic pt-1">
              <kbd className="px-1 border border-line rounded bg-card text-[13px]">Esc</kbd> to quit ·
              {" "}<kbd className="px-1 border border-line rounded bg-card text-[13px]">F2</kbd> to submit
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PaymentVoucherModifyPickerPage;
