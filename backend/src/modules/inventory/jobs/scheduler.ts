import cron from "node-cron";
import { prisma } from "../../../config/prisma";
import { runEodStockSnapshot } from "./eodStockSnapshot.job";

let lastRunDate: string | null = null;

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

initDefaultCutoffSetting();

/**
 * Cron job that checks every minute if EOD snapshot cutoff is reached.
 * Runs strictly ONCE per day at the specified cutoff time.
 */
cron.schedule("* * * * *", async () => {
  try {
    const setting = await prisma.systemSetting.findFirst({
      where: { key: "EOD_CUTOFF_TIME" },
    });

    if (!setting) return;

    const [hh, mm] = setting.value.split(":").map(Number);
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    // Fire job strictly ONCE per day if hour/minute match
    if (now.getHours() === hh && now.getMinutes() === mm && lastRunDate !== todayStr) {
      lastRunDate = todayStr; // Guard immediately against duplicate runs in the same minute
      console.log(`⏰ EOD cutoff time reached (${setting.value}). Running daily stock snapshot...`);
      await runEodStockSnapshot();
    }
  } catch (err) {
    console.error("❌ Error in EOD snapshot scheduler loop:", err);
  }
});
