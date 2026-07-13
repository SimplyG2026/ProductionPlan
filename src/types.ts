/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PackSize {
  id: string;
  name: string;
  mcPerHour: number;
  lbsPerMc: number;
  isPlaceholder: boolean;
  unitsPerMc: number; // added Units per MC column
}

export interface UnitConversion {
  id: string;
  name: string;
  lbsPerUnit: number;
  isLinkedToPackSizeId?: string; // Linked to pack size table for dynamic sync
  isPlaceholder?: boolean;
}

export interface Settings {
  // Machine rates
  cookingBigLbsPerRound: number;
  cookingSmallLbsPerRound: number;
  ex1LbsPerHour: number;
  ex2LbsPerHour: number;
  ex3LbsPerHour: number;
  cuttingLbsPerHourPerPerson: number;
  fillerLbsPerRound: number;
  isFillerPlaceholder: boolean;

  // General settings
  shiftHours: number;
  flavors: string[];
  employees: string[];
  
  // Flavor x Pack-size combinations allowed (key is "flavor|packSizeId", value is boolean)
  allowedCombos: Record<string, boolean>;

  // Pack sizes table
  packSizes: PackSize[];

  // Custom unit conversions
  customUnits: UnitConversion[];

  // Opening WIP (per flavor)
  openingWipCooked: Record<string, number>; // Cooked-not-extruded
  openingWipExtruded: Record<string, number>; // Extruded-not-cut
  openingWipCut: Record<string, number>; // Cut-not-packed

  // Editable headcounts per station per shift
  cooksHeadcountAM: number;
  cooksHeadcountPM: number;
  cooksHeadcount2nd: number;
  cuttersHeadcountAM: number;
  cuttersHeadcountPM: number;
  cuttersHeadcount2nd: number;
  packersHeadcount: number;
  fillerOperatorsHeadcount: number;
  amazonHeadcount: number;

  // Filler products and sizes (editable)
  fillerProducts: string[];
  fillerSizes: string[];

  // Machine slot counts for planning
  cookingBigSlots?: number;
  cookingSmallSlots?: number;
  ex1Slots?: number;
  ex2Slots?: number;
  ex3Slots?: number;

  departmentColors: {
    cooking: string;
    extruding: string;
    cutting: string;
    packing: string;
    filler: string;
  };
}

// Scheduled inputs per day
export interface CookingEntry {
  flavor: string;
  rounds: number;
  shift: "AM" | "PM" | "2nd";
}

export interface ExtrudingEntry {
  flavor: string;
  hours: number;
  shift: "AM" | "PM" | "2nd";
}

export interface CuttingEntry {
  flavor: string;
  cutters: number;
  shift: "AM" | "PM" | "2nd";
  employees?: string[];
}

export interface PackingEntry {
  flavor: string;
  packSizeId: string;
  packers: number;
  mcTarget?: number;
  orderTag?: string;
  employees?: string[];
}

export interface FillerEntry {
  product: string;
  size: string; // 1.8 oz, 5.3 oz, etc
  rounds?: number;
  mcTarget?: number;
}

export interface MachineStatus {
  status: "ACTIVE" | "OFF" | "MAINTENANCE" | "CLEAN";
  note?: string;
  deductHours?: number;
}

export interface DaySchedule {
  cookingBig: CookingEntry[]; // Max 3 slots
  cookingSmall: CookingEntry[]; // Max 3 slots
  ex1: ExtrudingEntry[]; // Max 2 slots
  ex2: ExtrudingEntry[]; // Max 2 slots
  ex3: ExtrudingEntry[]; // Max 2 slots
  cutting: CuttingEntry[];
  packing: PackingEntry[];
  filler: FillerEntry[];
  amazonTask?: string;
  closed?: boolean;
  notes?: string;
  machineStatuses?: Record<string, MachineStatus>;
}

// Full schedules state, keyed by date string (YYYY-MM-DD)
export type ScheduleState = Record<string, DaySchedule>;

// WIP metrics per department per flavor per day
export interface FlavorWipMetrics {
  openingWip: number;
  incoming: number;
  outgoing: number;
  closingWip: number;
}

export interface DepartmentMetrics {
  scheduled: number;
  wipAvailable: number;
  suggested: number;
  bottleneck: boolean;
}

export interface WipFlow {
  openingCooked: number;
  cookingOutput: number;
  extrudingSuggested: number;
  closingCooked: number;

  openingExtruded: number;
  extrudingOutput: number;
  cuttingSuggested: number;
  closingExtruded: number;

  openingCut: number;
  cuttingOutput: number;
  packingSuggested: number;
  closingCut: number;
}

// Summary statistics for a single day
export interface DailySummary {
  date: string;
  departments: {
    cooking: DepartmentMetrics;
    extruding: DepartmentMetrics;
    cutting: DepartmentMetrics;
    packing: DepartmentMetrics;
    filler: DepartmentMetrics;
  };
  // Detailed flavor-level outputs
  flavorOutputs: Record<string, {
    cooking: number;
    extrudingScheduled: number;
    extrudingSuggested: number;
    cuttingScheduled: number;
    cuttingSuggested: number;
    packingScheduled: number;
    packingSuggested: number;
    packingSuggestedMc: number;
    filler: number;
  }>;
  wipFlows?: Record<string, WipFlow>;
}

export interface PackingPriorityItem {
  id: string;
  flavor: string;
  packSizeId: string;
  mcsNeeded: number;
  priority: "High" | "Medium" | "Low";
  poTag?: string;
  completed: boolean;
  linkedDate?: string;
}
