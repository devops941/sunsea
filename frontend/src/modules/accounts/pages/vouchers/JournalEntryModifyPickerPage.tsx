import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { voucherService, type Voucher } from "../../../../services/voucherService";
import DatePickerCalendar from "../../../../components/ui/DatePickerCalendar/DatePickerCalendar";
import { useListCache } from "../../../../hooks/useListCache";
import { useFormShortcuts } from "../../../../hooks/useFormShortcuts";

// Busy-style "Select Voucher To Modify (Journal)" picker.
// Operator enters Voucher Number and/or Date -> OK finds the voucher and
// navigates to the Modify page. Cache lookup keeps the trip zero-fetch when
// the operator was just on the list.
const JournalEntryModifyPickerPage: React.FC = () => {
  const navigate = useNavigate();
  const todayIso = new Date().toISOString().split("T")[0];

  const [voucherSeries] = useState("Main");
  const [voucherNo, setVoucherNo] = useState("");
  const [voucherDate, setVoucherDate] = useState(todayIso);
  const [submitting, setSubmitting] = useState(false);

  // F2 = submit + auto-focus Voucher No on mount (centralised).
  useFormShortcuts({ autoFocusField: "voucherNo" });

  const fetcher = useCallback(async () => {
    const res = await voucherService.fetchVouchers({
      type: "JOURNAL",
      page: 1,
      limit: 10000,
    });
    return { data: res.vouchers || [], total: res.total || 0 };
  }, []);

  const { data: cachedVouchers } = useListCache<Voucher>({
    cacheKey: `accounts:journal-vouchers:modify-picker`,
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
      if (vNoRaw) {
        // Normalise "3" or "J-3" -> "JRN-3" so operators can type short forms.
        let normalized = vNoRaw.toUpperCase();
        if (/^\d+$/.test(vNoRaw)) {
          normalized = `JRN-${vNoRaw}`;
        } else if (/^J-\d+$/.test(normalized)) {
          normalized = normalized.replace(/^J-/, "JRN-");
        }

        const cacheHit = cachedVouchers.find((v) => v.voucherNo === normalized);
        if (cacheHit) {
          navigate(`/accounts/journal-entry/edit/${cacheHit.id}`, {
            state: { voucher: cacheHit },
          });
          return;
        }

        const res = await voucherService.fetchVouchers({
          type: "JOURNAL",
          search: normalized,
          page: 1,
          limit: 10,
        });
        const found = (res.vouchers || []).find((v) => v.voucherNo === normalized);
        if (!found) {
          toast.error(`Voucher "${vNoRaw}" not found in Journal`);
          return;
        }
        navigate(`/accounts/journal-entry/edit/${found.id}`, {
          state: { voucher: found },
        });
        return;
      }

      // No Voucher No -> open a voucher on the selected date, or fall back
      // to the most recent voucher AT OR BEFORE that date (Busy behaviour).
      const sortByDateDescIdDesc = (a: Voucher, b: Voucher) => {
        const dc = (b.date || "").localeCompare(a.date || "");
        return dc !== 0 ? dc : b.id - a.id;
      };
      const onOrBefore = (v: Voucher) => (v.date || "").slice(0, 10) <= dateStr;

      const sameDayCache = cachedVouchers.filter((v) =>
        (v.date || "").startsWith(dateStr)
      );
      let candidate = sameDayCache.slice().sort((a, b) => b.id - a.id)[0];

      if (!candidate) {
        const earlierCache = cachedVouchers.filter(onOrBefore).sort(sortByDateDescIdDesc);
        candidate = earlierCache[0];
      }

      if (!candidate) {
        const res = await voucherService.fetchVouchers({
          type: "JOURNAL",
          endDate: dateStr,
          page: 1,
          limit: 100,
        });
        const list = (res.vouchers || []).filter(onOrBefore).sort(sortByDateDescIdDesc);
        candidate = list[0];
      }

      if (!candidate) {
        toast.error(`No journal vouchers found on or before ${dateStr}`);
        return;
      }
      navigate(`/accounts/journal-entry/edit/${candidate.id}`, {
        state: { voucher: candidate },
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to locate voucher");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        (document.getElementById("modify-picker-form") as HTMLFormElement | null)
          ?.requestSubmit();
      } else if (e.key === "Escape") {
        navigate("/accounts/journal-entry");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <div className="p-3">
      <div className="w-full lg:w-[420px]">
        <div className="bg-card border border-line rounded-md overflow-hidden shadow-sm">
          <div className="bg-purple-600/90 text-white text-[11px] font-bold uppercase tracking-wide text-center py-1 border-b border-line">
            Select Voucher To Modify ( Journal )
          </div>
          <form id="modify-picker-form" onSubmit={handleSubmit} className="p-4 space-y-2.5 text-[11px]">
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
                  className="w-full px-2 py-1 border border-line bg-slate-900 text-white rounded text-[11px] font-mono font-semibold focus:ring-1 focus:ring-purple-500/40 focus:border-purple-500 focus:outline-none"
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
                className="px-6 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded font-semibold text-[11px] transition cursor-pointer disabled:opacity-50"
              >
                {submitting ? "Locating..." : "OK (F2)"}
              </button>
            </div>
            <div className="text-center text-[10px] text-ink-subtle italic pt-1">
              <kbd className="px-1 border border-line rounded bg-card text-[10px]">Esc</kbd> to quit ·
              {" "}<kbd className="px-1 border border-line rounded bg-card text-[10px]">F2</kbd> to submit
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default JournalEntryModifyPickerPage;
