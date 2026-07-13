/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Settings, ScheduleState, DailySummary, DepartmentMetrics, PackSize } from "./types";
import { createBlankDay } from "./data";

/**
 * Returns weekdays (Mon-Fri) in YYYY-MM-DD format between start and end.
 * Capped at 1000 to smoothly handle 18 months of dates.
 */
export function getWeekdaysInRange(startStr: string, endStr: string): string[] {
  if (!startStr || !endStr) return [];
  const start = new Date(startStr + "T12:00:00");
  const end = new Date(endStr + "T12:00:00");
  const dates: string[] = [];
  
  if (start > end) return [];
  
  const current = new Date(start);
  let limit = 0;
  while (current <= end && limit < 1000) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) { // 0 = Sunday, 6 = Saturday
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, '0');
      const dd = String(current.getDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
    current.setDate(current.getDate() + 1);
    limit++;
  }
  return dates;
}

/**
 * Main calculator. Chronologically processes each day,
 * computing scheduled capacity, available WIP, and constrained suggested output per flavor.
 */
export function computeDailySummaries(
  dates: string[],
  schedule: ScheduleState,
  settings: Settings,
  wipOverrides?: Record<string, Record<string, { cooked?: number; extruded?: number; cut?: number }>>
): DailySummary[] {
  // Initialize with the opening WIP from settings.
  const currentWipCooked = { ...settings.openingWipCooked };
  const currentWipExtruded = { ...settings.openingWipExtruded };
  const currentWipCut = { ...settings.openingWipCut };

  // Make sure all current flavors exist in the tracking maps
  settings.flavors.forEach((f) => {
    if (currentWipCooked[f] === undefined) currentWipCooked[f] = 0;
    if (currentWipExtruded[f] === undefined) currentWipExtruded[f] = 0;
    if (currentWipCut[f] === undefined) currentWipCut[f] = 0;
  });

  const summaries: DailySummary[] = [];
  const sortedDates = [...dates].sort();

  sortedDates.forEach((date) => {
    const rawDay = schedule[date] || createBlankDay();
    const blank = createBlankDay();
    const day = {
      ...blank,
      ...rawDay,
      cookingBig: rawDay.cookingBig || blank.cookingBig,
      cookingSmall: rawDay.cookingSmall || blank.cookingSmall,
      ex1: rawDay.ex1 || blank.ex1,
      ex2: rawDay.ex2 || blank.ex2,
      ex3: rawDay.ex3 || blank.ex3,
      cutting: rawDay.cutting || blank.cutting,
      packing: rawDay.packing || blank.packing,
      filler: rawDay.filler || blank.filler,
      machineStatuses: rawDay.machineStatuses || blank.machineStatuses,
    };
    const flavorOutputs: DailySummary["flavorOutputs"] = {};

    // Helper to ensure flavor is initialized in flavorOutputs
    const ensureFlavor = (f: string) => {
      if (!f) return;
      if (!flavorOutputs[f]) {
        flavorOutputs[f] = {
          cooking: 0,
          extrudingScheduled: 0,
          extrudingSuggested: 0,
          cuttingScheduled: 0,
          cuttingSuggested: 0,
          packingScheduled: 0,
          packingSuggested: 0,
          packingSuggestedMc: 0,
          filler: 0,
        };
      }
    };

    // Day is closed: no production happens, outputs are 0, WIP remains unchanged.
    if (day.closed) {
      // Just record a summary with all zeros
      summaries.push({
        date,
        departments: {
          cooking: { scheduled: 0, wipAvailable: 0, suggested: 0, bottleneck: false },
          extruding: { scheduled: 0, wipAvailable: 0, suggested: 0, bottleneck: false },
          cutting: { scheduled: 0, wipAvailable: 0, suggested: 0, bottleneck: false },
          packing: { scheduled: 0, wipAvailable: 0, suggested: 0, bottleneck: false },
          filler: { scheduled: 0, wipAvailable: 0, suggested: 0, bottleneck: false },
        },
        flavorOutputs: {},
      });
      return;
    }

    // Helper to get available machine hours considering status
    const getMachineAvailableHours = (machineId: string, defaultHours: number): number => {
      const status = day.machineStatuses?.[machineId];
      if (!status) return defaultHours;
      if (status.status === "OFF" || status.status === "MAINTENANCE") return 0;
      if (status.status === "CLEAN") {
        return Math.max(0, defaultHours - (status.deductHours || 0));
      }
      return defaultHours;
    };

    // --- COOKING OUTPUT ---
    const bigActive = getMachineAvailableHours("cookingBig", settings.shiftHours) > 0;
    if (bigActive) {
      day.cookingBig.forEach((entry) => {
        if (entry.flavor && entry.rounds > 0) {
          ensureFlavor(entry.flavor);
          flavorOutputs[entry.flavor].cooking += entry.rounds * settings.cookingBigLbsPerRound;
        }
      });
    }

    const smallActive = getMachineAvailableHours("cookingSmall", settings.shiftHours) > 0;
    if (smallActive) {
      day.cookingSmall.forEach((entry) => {
        if (entry.flavor && entry.rounds > 0) {
          ensureFlavor(entry.flavor);
          flavorOutputs[entry.flavor].cooking += entry.rounds * settings.cookingSmallLbsPerRound;
        }
      });
    }

    // --- EXTRUDING SCHEDULED ---
    const addExtruding = (entry: { flavor: string; hours: number }, rate: number, machineId: string) => {
      if (entry.flavor && entry.hours > 0) {
        const availHours = getMachineAvailableHours(machineId, settings.shiftHours);
        const effectiveHours = Math.min(entry.hours, availHours);
        if (effectiveHours > 0) {
          ensureFlavor(entry.flavor);
          flavorOutputs[entry.flavor].extrudingScheduled += effectiveHours * rate;
        }
      }
    };
    day.ex1.forEach((e) => addExtruding(e, settings.ex1LbsPerHour, "ex1"));
    day.ex2.forEach((e) => addExtruding(e, settings.ex2LbsPerHour, "ex2"));
    day.ex3.forEach((e) => addExtruding(e, settings.ex3LbsPerHour, "ex3"));

    // --- CUTTING SCHEDULED ---
    // status of cutting machine / area
    const cuttingAvailHours = getMachineAvailableHours("cutting", settings.shiftHours);
    if (cuttingAvailHours > 0) {
      day.cutting.forEach((entry) => {
        if (entry.flavor && entry.cutters > 0) {
          ensureFlavor(entry.flavor);
          flavorOutputs[entry.flavor].cuttingScheduled +=
            entry.cutters * settings.cuttingLbsPerHourPerPerson * cuttingAvailHours;
        }
      });
    }

    // --- PACKING SCHEDULED ---
    const packingAvailHours = getMachineAvailableHours("packing", settings.shiftHours);
    if (packingAvailHours > 0) {
      day.packing.forEach((entry) => {
        if (entry.flavor && entry.packSizeId && entry.packers > 0) {
          const packSize = settings.packSizes.find((ps) => ps.id === entry.packSizeId);
          if (packSize) {
            ensureFlavor(entry.flavor);
            // capacity in MC = packers * mcPerHour * hours
            const capacityMc = entry.packers * packSize.mcPerHour * packingAvailHours;
            // output in MC is capped at target if set
            const mcOutput = entry.mcTarget !== undefined && entry.mcTarget > 0
              ? Math.min(entry.mcTarget, capacityMc)
              : capacityMc;
            const lbsOutput = mcOutput * packSize.lbsPerMc;
            flavorOutputs[entry.flavor].packingScheduled += lbsOutput;
          }
        }
      });
    }

    // --- FILLER SCHEDULED ---
    // Filler is a separate product line. It does not run gum flavors, keeps out of the gum WIP chain.
    // However, we still need to compute its output and display it in the Daily Summary's filler total.
    let dailyFillerLbs = 0;
    const fillerAvailHours = getMachineAvailableHours("filler", settings.shiftHours);
    if (fillerAvailHours > 0) {
      day.filler.forEach((entry) => {
        if (entry.product) {
          // If rounds is specified
          if (entry.rounds !== undefined && entry.rounds > 0) {
            dailyFillerLbs += entry.rounds * settings.fillerLbsPerRound;
          } else if (entry.mcTarget !== undefined && entry.mcTarget > 0) {
            // Find corresponding size/pack-size (e.g. "1.8 oz" or "5.3 oz")
            const packSize = settings.packSizes.find(
              (ps) => ps.id === entry.size || ps.name === entry.size
            );
            if (packSize) {
              dailyFillerLbs += entry.mcTarget * packSize.lbsPerMc;
            }
          }
        }
      });
    }

    // --- WIP & CONSTRAINT PROPAGATION ---
    const allFlavors = Array.from(
      new Set([
        ...settings.flavors,
        ...Object.keys(flavorOutputs),
        ...Object.keys(currentWipCooked),
        ...Object.keys(currentWipExtruded),
        ...Object.keys(currentWipCut),
      ])
    ).filter(Boolean);

    // Day level department metrics
    let totalCookingSched = 0;
    
    let totalExtrudingSched = 0;
    let totalExtrudingWipAvailable = 0;
    let totalExtrudingSug = 0;

    let totalCuttingSched = 0;
    let totalCuttingWipAvailable = 0;
    let totalCuttingSug = 0;

    let totalPackingSched = 0;
    let totalPackingWipAvailable = 0;
    let totalPackingSug = 0;

    const wipFlows: Record<string, any> = {};

    allFlavors.forEach((f) => {
      ensureFlavor(f);
      const metrics = flavorOutputs[f];

      // 1. Cooking
      totalCookingSched += metrics.cooking;

      // 2. Extruding
      const extrudingWipAvailable = currentWipCooked[f] || 0;
      totalExtrudingWipAvailable += extrudingWipAvailable;
      totalExtrudingSched += metrics.extrudingScheduled;
      
      const extrudingSug = Math.min(metrics.extrudingScheduled, Math.max(extrudingWipAvailable, 0));
      metrics.extrudingSuggested = extrudingSug;
      totalExtrudingSug += extrudingSug;

      // Update Cooked WIP
      currentWipCooked[f] = extrudingWipAvailable + metrics.cooking - extrudingSug;

      // 3. Cutting
      const cuttingWipAvailable = currentWipExtruded[f] || 0;
      totalCuttingWipAvailable += cuttingWipAvailable;
      totalCuttingSched += metrics.cuttingScheduled;

      const cuttingSug = Math.min(metrics.cuttingScheduled, Math.max(cuttingWipAvailable, 0));
      metrics.cuttingSuggested = cuttingSug;
      totalCuttingSug += cuttingSug;

      // Update Extruded WIP
      currentWipExtruded[f] = cuttingWipAvailable + extrudingSug - cuttingSug;

      // 4. Packing
      const packingWipAvailable = currentWipCut[f] || 0;
      totalPackingWipAvailable += packingWipAvailable;
      totalPackingSched += metrics.packingScheduled;

      const packingSug = Math.min(metrics.packingScheduled, Math.max(packingWipAvailable, 0));
      metrics.packingSuggested = packingSug;
      totalPackingSug += packingSug;

      // Convert packing suggested back to MC
      let totalSchedMcForFlavor = 0;
      day.packing.forEach((entry) => {
        if (entry.flavor === f && entry.packSizeId) {
          const ps = settings.packSizes.find((p) => p.id === entry.packSizeId);
          if (ps) {
            const capMc = entry.packers * ps.mcPerHour * packingAvailHours;
            const actualMc = entry.mcTarget !== undefined && entry.mcTarget > 0
              ? Math.min(entry.mcTarget, capMc)
              : capMc;
            totalSchedMcForFlavor += actualMc;
          }
        }
      });
      if (metrics.packingScheduled > 0) {
        metrics.packingSuggestedMc = totalSchedMcForFlavor * (packingSug / metrics.packingScheduled);
      } else {
        metrics.packingSuggestedMc = 0;
      }

      // Update Cut WIP
      currentWipCut[f] = packingWipAvailable + cuttingSug - packingSug;

      // Apply manual WIP overrides/entries if they exist for this day and flavor
      const dayOverrides = wipOverrides?.[date]?.[f];
      if (dayOverrides) {
        if (dayOverrides.cooked !== undefined) {
          currentWipCooked[f] = dayOverrides.cooked;
        }
        if (dayOverrides.extruded !== undefined) {
          currentWipExtruded[f] = dayOverrides.extruded;
        }
        if (dayOverrides.cut !== undefined) {
          currentWipCut[f] = dayOverrides.cut;
        }
      }

      // Record WIP flows
      wipFlows[f] = {
        openingCooked: extrudingWipAvailable,
        cookingOutput: metrics.cooking,
        extrudingSuggested: extrudingSug,
        closingCooked: currentWipCooked[f],

        openingExtruded: cuttingWipAvailable,
        extrudingOutput: extrudingSug,
        cuttingSuggested: cuttingSug,
        closingExtruded: currentWipExtruded[f],

        openingCut: packingWipAvailable,
        cuttingOutput: cuttingSug,
        packingSuggested: packingSug,
        closingCut: currentWipCut[f],
      };
    });

    // Populate DailySummary
    summaries.push({
      date,
      departments: {
        cooking: {
          scheduled: totalCookingSched,
          wipAvailable: 0,
          suggested: totalCookingSched,
          bottleneck: false,
        },
        extruding: {
          scheduled: totalExtrudingSched,
          wipAvailable: totalExtrudingWipAvailable,
          suggested: totalExtrudingSug,
          bottleneck: totalExtrudingSug < totalExtrudingSched,
        },
        cutting: {
          scheduled: totalCuttingSched,
          wipAvailable: totalCuttingWipAvailable,
          suggested: totalCuttingSug,
          bottleneck: totalCuttingSug < totalCuttingSched,
        },
        packing: {
          scheduled: totalPackingSched,
          wipAvailable: totalPackingWipAvailable,
          suggested: totalPackingSug,
          bottleneck: totalPackingSug < totalPackingSched,
        },
        filler: {
          scheduled: dailyFillerLbs,
          wipAvailable: 0,
          suggested: dailyFillerLbs,
          bottleneck: false,
        },
      },
      flavorOutputs,
      wipFlows,
    });
  });

  return summaries;
}

/**
 * Returns formatted value based on the selected unit.
 * Default unit is 'lb' (1 lb).
 * If unit is MC-linked, matches against pack size settings.
 * If overridePackSizeId is passed, handles native MC calculation for packing sections.
 */
export function convertValue(
  lbsValue: number,
  unitId: string,
  settings: Settings,
  overridePackSizeId?: string
): number {
  const unit = settings.customUnits.find((u) => u.id === unitId);
  const isMcUnit = unitId.endsWith("_mc") || (unit && unit.isLinkedToPackSizeId);

  if (isMcUnit && overridePackSizeId) {
    const ps = settings.packSizes.find((p) => p.id === overridePackSizeId);
    if (ps && ps.lbsPerMc > 0) {
      const result = lbsValue / ps.lbsPerMc;
      return Math.round(result * 1000000) / 1000000;
    }
  }

  if (!unit) return lbsValue;
  
  let factor = unit.lbsPerUnit;
  if (unit.isLinkedToPackSizeId) {
    const linkedPs = settings.packSizes.find((p) => p.id === unit.isLinkedToPackSizeId);
    if (linkedPs) {
      factor = linkedPs.lbsPerMc;
    }
  }

  if (factor <= 0) return 0;
  const result = lbsValue / factor;
  return Math.round(result * 1000000) / 1000000;
}

/**
 * Returns unit label (e.g. "LB", "Loaf", "12pk MC")
 */
export function getUnitLabel(unitId: string, settings: Settings): string {
  const unit = settings.customUnits.find((u) => u.id === unitId);
  return unit ? unit.name : "LB";
}
