import cron from "node-cron";
import { prisma } from "../../../config/prisma";
import { runEodStockSnapshot } from "./eodStockSnapshot.job";
import { getISTDateParts } from "../../../utils/dateUtils";

/**
 * Checks if a snapshot already exists in the database for the given UTC date
 */
const checkSnapshotExists = async (year: number, month: number, day: number): Promise<boolean> => {
  const utcDate = new Date(Date.UTC(year, month, day));
  const count = await prisma.eodStockSnapshot.count({
    where: {
      snapshotDate: utcDate,
    },
  });
  return count > 0;
};

/**
 * Common logic to check missing EOD snapshots for a specified range of days.
 * If the current time is past the cutoff time for a given day, and no snapshot exists,
 * it runs the snapshot generator for that day.
 * 
 * @param daysToCheck Number of past days to check (including today)
 */
const runEodCheckForDaysRange = async (daysToCheck: number, contextLabel: string) => {
  try {
    const setting = await prisma.systemSetting.findFirst({
      where: { key: "EOD_CUTOFF_TIME" },
    });
    const cutoffTime = setting?.value || "23:59";
    const [cutoffHh, cutoffMm] = cutoffTime.split(":").map(Number);

    const now = new Date();
    const nowParts = getISTDateParts(now);

    for (let i = daysToCheck; i >= 0; i--) {
      // Get the day to check in IST
      const checkDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const parts = getISTDateParts(checkDate);
      const { year, month, day } = parts;

      // Evaluate cutoff against IST clock time:
      // Past days (i > 0) are always past cutoff. For today (i === 0), we check if current IST time >= cutoff time.
      const isPastCutoff = i > 0 || (nowParts.hours > cutoffHh || (nowParts.hours === cutoffHh && nowParts.minutes >= cutoffMm));

      if (isPastCutoff) {
        const exists = await checkSnapshotExists(year, month, day);
        if (!exists) {
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          console.log(`⏰ [${contextLabel}] EOD snapshot for ${dateStr} is missing (cutoff: ${cutoffTime}). Running snapshot...`);
          await runEodStockSnapshot(dateStr);
        }
      }
    }
  } catch (error) {
    console.error(`❌ Error in EOD snapshot check [${contextLabel}]:`, error);
  }
};

/**
 * Startup catch-up check: Runs once when the server boots.
 * It sweeps the last 7 days to cover any extended period the server might have been offline.
 */
const runStartupCatchUpCheck = async () => {
  console.log("🔍 Running EOD startup catch-up check (scanning last 7 days)...");
  await runEodCheckForDaysRange(7, "Startup Catch-up");
};

/**
 * Regular cron check: Executed every minute.
 * It only checks the last 3 days to keep DB query overhead lightweight while still
 * safely catching up if the server went to sleep or experienced lag during the cutoff minute.
 */
const runDailyCronCheck = async () => {
  await runEodCheckForDaysRange(2, "Cron Loop");
};

/**
 * Ensures a default EOD cutoff setting exists in the database
 */
const initDefaultCutoffSetting = async () => {
  try {
    const existing = await prisma.systemSetting.findFirst({
      where: { key: "EOD_CUTOFF_TIME" },
    });

    if (!existing) {
      await prisma.systemSetting.create({
        data: { key: "EOD_CUTOFF_TIME", value: "23:59" },
      });
      console.log("✅ EOD cutoff time system setting initialized to 23:59.");
    } else if (["10:50", "10:10", "10:08"].includes(existing.value)) {
      await prisma.systemSetting.updateMany({
        where: { key: "EOD_CUTOFF_TIME" },
        data: { value: "23:59" },
      });
      console.log("✅ EOD cutoff time test setting reset to standard 23:59.");
    }
  } catch (error) {
    console.error("❌ Failed to initialize EOD cutoff setting:", error);
  }
};
// Initialize settings only on server boot (no catch-up auto-snapshot creation)
export const initScheduler = async () => {
  await initDefaultCutoffSetting();
  // NOTE: Startup catch-up check is intentionally disabled.
  // Past dates should only have EOD snapshots from the actual nightly cron job.
  // Auto-generating snapshots on startup would create fake historical data
  // especially after a DB reset or fresh setup.
  // await runStartupCatchUpCheck();
};

/**
 * Nightly cron job: runs at 23:59 IST every day to lock today's EOD snapshot.
 * Only runs for today — does NOT backfill past days.
 */
cron.schedule("59 23 * * *", async () => {
  const now = new Date();
  const parts = getISTDateParts(now);
  const dateStr = `${parts.year}-${String(parts.month + 1).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  console.log(`⏰ [Nightly Cron] Running EOD snapshot for today: ${dateStr}`);
  try {
    await runEodStockSnapshot(dateStr);
  } catch (error) {
    console.error("❌ Nightly EOD snapshot failed:", error);
  }
}, { timezone: "Asia/Kolkata" });

