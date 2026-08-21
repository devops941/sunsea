import { standardConverter } from "../../utils/convert.util";
import { prisma } from "../../config/prisma";

export interface DynamicUnitResponse {
  code: string;
  label: string;
  category: string;
}

class UOMService {
  /**
   * Returns all active UOMs from the database.
   */
  async getActiveUOMs() {
    return prisma.unitOfMeasure.findMany({
      where: { isActive: true },
      orderBy: { uomName: "asc" },
    });
  }

  /**
   * Returns all measurement categories dynamically from convert-units.
   */
  getCategories(): string[] {
    return standardConverter().measures();
  }

  /**
   * Dynamically retrieves every available unit from convert-units, optionally filtered by category.
   */
  getUnits(categoryFilter?: string): DynamicUnitResponse[] {
    const categories = this.getCategories();
    const unitsList: DynamicUnitResponse[] = [];

    // Filter categories if request parameter exists
    const categoriesToProcess = categoryFilter
      ? categories.filter((c) => c.toLowerCase() === categoryFilter.toLowerCase())
      : categories;

    for (const category of categoriesToProcess) {
      try {
        const possibilities = standardConverter().possibilities(category as any);
        for (const code of possibilities) {
          const details = standardConverter().describe(code as any);
          unitsList.push({
            code: details.abbr,
            label: details.plural || details.singular || code,
            category: category,
          });
        }
      } catch (error) {
        // Safe skip if an invalid category query was requested
      }
    }

    return unitsList;
  }
}

export default new UOMService();