import cron from "node-cron";
import { prisma } from "../../../config/prisma";
import { runEodStockSnapshot } from "./eodStockSnapshot.job";

let lastRunDate: string | null = null;

/**
 * Ensures a default EOD cutoff setting exists in the database
 */
const initDefaultCutoffSetting = async () => {
  try {
    await prisma.systemSetting.upsert({
      where: { key: "EOD_CUTOFF_TIME" },
      update: {},
      create: { key: "EOD_CUTOFF_TIME", value: "16:45" },
    });
    console.log("✅ EOD cutoff time system setting initialized.");
  } catch (error) {
    console.error("❌ Failed to initialize EOD cutoff setting:", error);
  }
};

initDefaultCutoffSetting();

/**
 * Cron job that checks every minute if EOD snapshot cutoff is reached
 */
cron.schedule("* * * * *", async () => {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "EOD_CUTOFF_TIME" },
    });

    if (!setting) return;

    const [hh, mm] = setting.value.split(":").map(Number);
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // Fire job if hour/minute match, and it hasn't run today
    if (now.getHours() === hh && now.getMinutes() === mm && lastRunDate !== todayStr) {
      await runEodStockSnapshot();
      lastRunDate = todayStr;
    }
  } catch (err) {
    console.error("❌ Error in EOD snapshot scheduler loop:", err);
  }
});
