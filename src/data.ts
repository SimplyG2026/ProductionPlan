/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Settings, DaySchedule, ScheduleState } from "./types";

// Helper to generate a unique ID
export const generateId = () => Math.random().toString(36).substring(2, 9);

export const Flavors = [
  "Peppermint",
  "Cinnamon",
  "Ginger",
  "Fennel",
  "Coffee",
  "Maple",
  "Cleanse",
  "Spearmint",
  "Trader Joe's",
  "SF Peppermint",
  "SF Bubblegum",
  "SF Spearmint",
  "Pumpkin Spice",
  "Wintergreen",
];

export const DEFAULT_EMPLOYEES = [
  "RY",
  "JE",
  "MT",
  "EQ",
  "IP",
  "Vianka",
  "Rhodie",
];

export const DEFAULT_PACK_SIZES = [
  { id: "12pk", name: "12 Pack", mcPerHour: 0.7, lbsPerMc: 10, isPlaceholder: false, unitsPerMc: 48 },
  { id: "loose", name: "Loose", mcPerHour: 0.7, lbsPerMc: 10, isPlaceholder: false, unitsPerMc: 144 },
  { id: "6pk", name: "6 Pack", mcPerHour: 0.375, lbsPerMc: 10, isPlaceholder: false, unitsPerMc: 24 },
  { id: "bulk", name: "Bulk", mcPerHour: 1.0, lbsPerMc: 25, isPlaceholder: false, unitsPerMc: 100 },
  { id: "bag70ct", name: "Bag 70ct", mcPerHour: 10.0, lbsPerMc: 12, isPlaceholder: false, unitsPerMc: 120 },
  { id: "3pk", name: "3 Pack", mcPerHour: 0.7, lbsPerMc: 8, isPlaceholder: false, unitsPerMc: 12 },
  { id: "1.8oz", name: "1.8 oz", mcPerHour: 1.0, lbsPerMc: 12, isPlaceholder: false, unitsPerMc: 24 },
  { id: "5.3oz", name: "5.3 oz", mcPerHour: 1.0, lbsPerMc: 15, isPlaceholder: false, unitsPerMc: 12 },
];

export const DEFAULT_SETTINGS: Settings = {
  cookingBigLbsPerRound: 121,
  cookingSmallLbsPerRound: 74,
  ex1LbsPerHour: 91,
  ex2LbsPerHour: 60.5,
  ex3LbsPerHour: 68,
  cuttingLbsPerHourPerPerson: 40,
  fillerLbsPerRound: 100,
  isFillerPlaceholder: false,
  shiftHours: 8,
  flavors: [...Flavors],
  employees: [...DEFAULT_EMPLOYEES],
  allowedCombos: {}, // empty means all allowed by default
  packSizes: [...DEFAULT_PACK_SIZES],
  customUnits: [
    { id: "lb", name: "LB", lbsPerUnit: 1 },
    { id: "loaf", name: "Loaf", lbsPerUnit: 3.7 },
    { id: "round", name: "Round", lbsPerUnit: 100, isPlaceholder: false },
    { id: "12pk_mc", name: "12pk MC", lbsPerUnit: 10, isLinkedToPackSizeId: "12pk" },
    { id: "bulk_mc", name: "Bulk MC", lbsPerUnit: 25, isLinkedToPackSizeId: "bulk" },
    { id: "bag_mc", name: "Bag MC", lbsPerUnit: 12, isLinkedToPackSizeId: "bag70ct" },
    { id: "pieces", name: "Pieces", lbsPerUnit: 0.0034 },
  ],
  openingWipCooked: { Peppermint: 200, Cinnamon: 150, Ginger: 150 },
  openingWipExtruded: { Peppermint: 200, Cinnamon: 150, Ginger: 100 },
  openingWipCut: { Peppermint: 200, Cinnamon: 100, Ginger: 100 },
  
  // Real headcounts from current reality
  cooksHeadcountAM: 4,
  cooksHeadcountPM: 4,
  cooksHeadcount2nd: 0,
  cuttersHeadcountAM: 5,
  cuttersHeadcountPM: 2,
  cuttersHeadcount2nd: 0,
  packersHeadcount: 14,
  fillerOperatorsHeadcount: 2,
  amazonHeadcount: 4,

  // Filler products and sizes
  fillerProducts: ["Sour", "Peach", "P/R"],
  fillerSizes: ["1.8 oz", "5.3 oz"],

  // Default planning slots count
  cookingBigSlots: 1,
  cookingSmallSlots: 1,
  ex1Slots: 1,
  ex2Slots: 1,
  ex3Slots: 1,

  departmentColors: {
    cooking: "blue",
    extruding: "amber",
    cutting: "emerald",
    packing: "purple",
    filler: "rose",
  },
};

// Initialize combinations
Flavors.forEach((f) => {
  DEFAULT_PACK_SIZES.forEach((p) => {
    DEFAULT_SETTINGS.allowedCombos[`${f}|${p.id}`] = true;
  });
});

export const createBlankDay = (): DaySchedule => ({
  cookingBig: [
    { flavor: "", rounds: 0, shift: "AM" }
  ],
  cookingSmall: [
    { flavor: "", rounds: 0, shift: "AM" }
  ],
  ex1: [
    { flavor: "", hours: 0, shift: "AM" }
  ],
  ex2: [
    { flavor: "", hours: 0, shift: "AM" }
  ],
  ex3: [
    { flavor: "", hours: 0, shift: "AM" }
  ],
  cutting: [
    { flavor: "", cutters: 0, shift: "AM", employees: [] }
  ],
  packing: [
    { flavor: "", packSizeId: "12pk", packers: 0, mcTarget: undefined, orderTag: "" }
  ],
  filler: [
    { product: "Sour", size: "1.8 oz", rounds: 0, mcTarget: undefined }
  ],
  amazonTask: "",
  closed: false,
  notes: "",
  machineStatuses: {},
});

export const loadDemoSchedules = (
  day1Date: string,
  day2Date: string
): ScheduleState => {
  const day1 = createBlankDay();
  const day2 = createBlankDay();

  // Day 1 Cooking Big: Peppermint 4 rds, Cinnamon 2 rds
  day1.cookingBig[0] = { flavor: "Peppermint", rounds: 4, shift: "AM" };
  day1.cookingBig[1] = { flavor: "Cinnamon", rounds: 2, shift: "AM" };

  // Day 1 Cooking Small: Ginger 5 rds, Fennel 3 rds
  day1.cookingSmall[0] = { flavor: "Ginger", rounds: 5, shift: "AM" };
  day1.cookingSmall[1] = { flavor: "Fennel", rounds: 3, shift: "AM" };

  // Day 1 Extruding: Ex1 Peppermint 8h, Ex2 Cinnamon 8h, Ex3 Ginger 8h
  day1.ex1[0] = { flavor: "Peppermint", hours: 8, shift: "AM" };
  day1.ex2[0] = { flavor: "Cinnamon", hours: 8, shift: "AM" };
  day1.ex3[0] = { flavor: "Ginger", hours: 8, shift: "AM" };

  // Day 1 Cutters: Peppermint x2 AM, Cinnamon x1 AM, Ginger x2 AM
  day1.cutting = [
    { flavor: "Peppermint", cutters: 2, shift: "AM", employees: ["RY", "JE"] },
    { flavor: "Cinnamon", cutters: 1, shift: "AM", employees: ["MT"] },
    { flavor: "Ginger", cutters: 2, shift: "AM", employees: ["EQ", "IP"] },
  ];

  // Day 1 Packers: Peppermint 12pk (4 packers), Peppermint Loose (4 packers), Cinnamon 6pk (3 packers), Ginger Bulk (2 packers), Peppermint Bag 70ct (1 packer)
  day1.packing = [
    { flavor: "Peppermint", packSizeId: "12pk", packers: 4, orderTag: "PO#1001" },
    { flavor: "Peppermint", packSizeId: "loose", packers: 4 },
    { flavor: "Cinnamon", packSizeId: "6pk", packers: 3 },
    { flavor: "Ginger", packSizeId: "bulk", packers: 2 },
    { flavor: "Peppermint", packSizeId: "bag70ct", packers: 1, mcTarget: 50, orderTag: "Marshalls" },
  ];

  // Day 1 Filler: Sour 1.8 oz (4 rounds)
  day1.filler = [
    { product: "Sour", size: "1.8 oz", rounds: 4 }
  ];
  
  day1.amazonTask = "Build and Fulfillment";
  day1.notes = "Container arrives 10am";

  // --- Day 2 ---
  // Day 2 Cooking Big: Peppermint 3 rds, Maple 3 rds
  day2.cookingBig[0] = { flavor: "Peppermint", rounds: 3, shift: "AM" };
  day2.cookingBig[1] = { flavor: "Maple", rounds: 3, shift: "AM" };

  // Day 2 Cooking Small: Cinnamon 6 rds, Coffee 4 rds
  day2.cookingSmall[0] = { flavor: "Cinnamon", rounds: 6, shift: "AM" };
  day2.cookingSmall[1] = { flavor: "Coffee", rounds: 4, shift: "AM" };

  // Day 2 Extruding: Ex1 Peppermint 4h + Maple 4h, Ex2 Cinnamon 8h, Ex3 Fennel 8h
  day2.ex1[0] = { flavor: "Peppermint", hours: 4, shift: "AM" };
  day2.ex1[1] = { flavor: "Maple", hours: 4, shift: "AM" };
  day2.ex2[0] = { flavor: "Cinnamon", hours: 8, shift: "AM" };
  day2.ex3[0] = { flavor: "Fennel", hours: 8, shift: "AM" };

  // Day 2 Cutters: Peppermint x1 AM, Maple x1 AM, Cinnamon x2 AM, Ginger x1 AM
  day2.cutting = [
    { flavor: "Peppermint", cutters: 1, shift: "AM", employees: ["RY"] },
    { flavor: "Maple", cutters: 1, shift: "AM", employees: ["JE"] },
    { flavor: "Cinnamon", cutters: 2, shift: "AM", employees: ["MT", "EQ"] },
    { flavor: "Ginger", cutters: 1, shift: "AM", employees: ["Vianka"] },
  ];

  // Day 2 Packers: Cinnamon 12pk (4 packers), Peppermint Loose (3 packers), Maple 6pk (3 packers), Peppermint Bulk (2 packers), Ginger Bag 70ct (2 packers)
  day2.packing = [
    { flavor: "Cinnamon", packSizeId: "12pk", packers: 4, mcTarget: 10 }, // 4 packers, 8h -> capacity 22.4 MC -> target 10 expected
    { flavor: "Peppermint", packSizeId: "loose", packers: 3 },
    { flavor: "Maple", packSizeId: "6pk", packers: 3 },
    { flavor: "Peppermint", packSizeId: "bulk", packers: 2 },
    { flavor: "Ginger", packSizeId: "bag70ct", packers: 2 },
  ];

  // Day 2 Filler: Cinnamon 3, Peppermint 2
  day2.filler = [
    { product: "Sour", size: "1.8 oz", mcTarget: 30 },
    { product: "Peach", size: "5.3 oz", rounds: 2 }
  ];
  
  day2.amazonTask = "Pouches Sorting";
  day2.notes = "NO TEMPS today";

  return {
    [day1Date]: day1,
    [day2Date]: day2,
  };
};
