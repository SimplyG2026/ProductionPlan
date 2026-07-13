/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Settings, DailySummary } from "../types";
import { FormulaInput } from "./FormulaInput";
import { convertValue, getUnitLabel } from "../calculations";
import { 
  Layers, 
  Edit3, 
  HelpCircle, 
  Save, 
  Calendar, 
  Check, 
  ArrowRight, 
  TrendingUp, 
  RotateCcw, 
  Filter, 
  Grid, 
  Sliders, 
  Database,
  X
} from "lucide-react";

interface WIPTabProps {
  dates: string[];
  summaries: DailySummary[];
  settings: Settings;
  cookingUnitId: string;
  extrudingUnitId: string;
  cuttingUnitId: string;
  packingUnitId: string;
  fillerUnitId: string;
  onUpdateSettings: (updated: Partial<Settings>) => void;
  wipOverrides: Record<string, Record<string, { cooked?: number; extruded?: number; cut?: number }>>;
  onUpdateWipOverrides: React.Dispatch<React.SetStateAction<Record<string, Record<string, { cooked?: number; extruded?: number; cut?: number }>>>>;
}

export default function WIPTab({
  dates,
  summaries,
  settings,
  cookingUnitId,
  extrudingUnitId,
  cuttingUnitId,
  packingUnitId,
  fillerUnitId,
  onUpdateSettings,
  wipOverrides,
  onUpdateWipOverrides,
}: WIPTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<"tracker" | "opening">("tracker");
  const [selectedDate, setSelectedDate] = useState<string>(dates[0] || "");
  const [flavorFilter, setFlavorFilter] = useState<string>("All");
  
  // Custom WIP tracker grouping & sorting controls
  const [viewGrouping, setViewGrouping] = useState<"flavor" | "type">("flavor");
  const [wipTypeFilter, setWipTypeFilter] = useState<"All" | "cooked" | "extruded" | "cut">("All");

  const [displayWipCooked, setDisplayWipCooked] = useState<Record<string, string>>({});
  const [displayWipExtruded, setDisplayWipExtruded] = useState<Record<string, string>>({});
  const [displayWipCut, setDisplayWipCut] = useState<Record<string, string>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync edits when settings or display unit changes
  React.useEffect(() => {
    const cooked: Record<string, string> = {};
    const extruded: Record<string, string> = {};
    const cut: Record<string, string> = {};

    settings.flavors.forEach((flavor) => {
      const cLbs = settings.openingWipCooked[flavor] !== undefined ? settings.openingWipCooked[flavor] : 0;
      const eLbs = settings.openingWipExtruded[flavor] !== undefined ? settings.openingWipExtruded[flavor] : 0;
      const cuLbs = settings.openingWipCut[flavor] !== undefined ? settings.openingWipCut[flavor] : 0;

      // Convert lbs to display unit value
      const cDisp = convertValue(cLbs, extrudingUnitId, settings);
      const eDisp = convertValue(eLbs, cuttingUnitId, settings);
      const cuDisp = convertValue(cuLbs, packingUnitId, settings);

      cooked[flavor] = String(Number(cDisp.toFixed(1)));
      extruded[flavor] = String(Number(eDisp.toFixed(1)));
      cut[flavor] = String(Number(cuDisp.toFixed(1)));
    });

    setDisplayWipCooked(cooked);
    setDisplayWipExtruded(extruded);
    setDisplayWipCut(cut);
  }, [settings, extrudingUnitId, cuttingUnitId, packingUnitId]);

  // Sync selected date when dates list updates
  React.useEffect(() => {
    if (!selectedDate && dates.length > 0) {
      setSelectedDate(dates[0]);
    }
  }, [dates, selectedDate]);

  const handleSaveOpeningWip = () => {
    const cookedLbs: Record<string, number> = {};
    const extrudedLbs: Record<string, number> = {};
    const cutLbs: Record<string, number> = {};

    settings.flavors.forEach((flavor) => {
      const cookedDisp = Number(displayWipCooked[flavor] || 0);
      const extrudedDisp = Number(displayWipExtruded[flavor] || 0);
      const cutDisp = Number(displayWipCut[flavor] || 0);

      cookedLbs[flavor] = convertToLbs(cookedDisp, extrudingUnitId, settings);
      extrudedLbs[flavor] = convertToLbs(extrudedDisp, cuttingUnitId, settings);
      cutLbs[flavor] = convertToLbs(cutDisp, packingUnitId, settings);
    });

    onUpdateSettings({
      openingWipCooked: cookedLbs,
      openingWipExtruded: extrudedLbs,
      openingWipCut: cutLbs,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Convert from selected Display Unit back to Lbs
  const convertToLbs = (val: number, unitId: string, currentSettings: Settings): number => {
    const unit = currentSettings.customUnits.find((u) => u.id === unitId);
    if (!unit) return val;
    let factor = unit.lbsPerUnit;
    if (unit.isLinkedToPackSizeId) {
      const linkedPs = currentSettings.packSizes.find((p) => p.id === unit.isLinkedToPackSizeId);
      if (linkedPs) {
        factor = linkedPs.lbsPerMc;
      }
    }
    if (factor <= 0) return 0;
    return val * factor;
  };

  // Update a specific daily override
  const handleUpdateOverride = (flavor: string, stage: "cooked" | "extruded" | "cut", valueStr: string) => {
    onUpdateWipOverrides((prev) => {
      const next = { ...prev };
      if (!next[selectedDate]) {
        next[selectedDate] = {};
      }
      if (!next[selectedDate][flavor]) {
        next[selectedDate][flavor] = {};
      }

      if (valueStr.trim() === "") {
        // Clear override
        const flavorOverrides = { ...next[selectedDate][flavor] };
        delete flavorOverrides[stage];
        
        const dayOverrides = { ...next[selectedDate] };
        if (Object.keys(flavorOverrides).length === 0) {
          delete dayOverrides[flavor];
        } else {
          dayOverrides[flavor] = flavorOverrides;
        }

        if (Object.keys(dayOverrides).length === 0) {
          delete next[selectedDate];
        } else {
          next[selectedDate] = dayOverrides;
        }
      } else {
        const numValue = Number(valueStr);
        if (!isNaN(numValue)) {
          let targetUnitId = extrudingUnitId;
          if (stage === "extruded") targetUnitId = cuttingUnitId;
          if (stage === "cut") targetUnitId = packingUnitId;
          const valInLbs = convertToLbs(numValue, targetUnitId, settings);
          next[selectedDate][flavor] = {
            ...next[selectedDate][flavor],
            [stage]: valInLbs,
          };
        }
      }
      return next;
    });
  };

  // Clear all overrides for current day
  const handleClearDayOverrides = () => {
    if (window.confirm("Are you sure you want to clear all manual WIP counts and overrides for this day?")) {
      onUpdateWipOverrides((prev) => {
        const next = { ...prev };
        delete next[selectedDate];
        return next;
      });
    }
  };

  const handleDateChange = (newDateStr: string) => {
    if (!newDateStr) return;
    
    // If the selected date is directly in our dates list, use it
    if (dates.includes(newDateStr)) {
      setSelectedDate(newDateStr);
      return;
    }
    
    // Otherwise, find the closest available date in our scheduled dates list
    const selectedTime = new Date(newDateStr + "T12:00:00").getTime();
    let closestDate = dates[0] || "";
    let minDiff = Infinity;
    
    for (const dStr of dates) {
      const dTime = new Date(dStr + "T12:00:00").getTime();
      const diff = Math.abs(selectedTime - dTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestDate = dStr;
      }
    }
    
    if (closestDate) {
      setSelectedDate(closestDate);
    }
  };

  const currentSummary = summaries.find((s) => s.date === selectedDate);
  const activeFlavors = settings.flavors;

  // Count total active overrides for selected day
  const dailyOverridesCount = Object.keys(wipOverrides[selectedDate] || {}).reduce((acc, flavor) => {
    const fOverrides = wipOverrides[selectedDate]?.[flavor] || {};
    return acc + Object.keys(fOverrides).length;
  }, 0);

  return (
    <div className="space-y-8" id="wip-tab-view">
      {/* 1. Header banner */}
      <div className="glass p-6 flex flex-col md:flex-row md:items-center justify-between gap-4" id="wip-banner">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-600" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Work in Progress (WIP) Management</h2>
          </div>
          <p className="text-slate-600 text-xs max-w-2xl">
            Configure initial starting stocks and track or manually enter daily WIP transformations as materials move sequentially from Mixer to Extruder, Cutter, and Packager.
          </p>
        </div>

        {/* Sub-tab Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/60 shrink-0">
          <button
            onClick={() => setActiveSubTab("tracker")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === "tracker"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200/10"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Calendar className="w-3.5 h-3.5 inline mr-1" /> Daily WIP Tracker
          </button>
          <button
            onClick={() => setActiveSubTab("opening")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === "opening"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200/10"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Edit3 className="w-3.5 h-3.5 inline mr-1" /> Edit Opening WIP
          </button>
        </div>
      </div>

      {activeSubTab === "opening" ? (
        /* ================= OPENING WIP EDITOR ================= */
        <div className="space-y-6" id="opening-wip-editor">
          <div className="glass p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Manage Initial Starting Stocks</h3>
                <p className="text-[11px] text-slate-500 font-medium">Specify the opening inventory values for all 3 production stages. These act as the starting points for your weekly schedule calculation.</p>
              </div>
              <button
                onClick={handleSaveOpeningWip}
                className="bg-slate-900 hover:bg-slate-950 text-white font-semibold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
              >
                {saveSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" /> Saved Starting Stocks!
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Save Starting Stocks
                  </>
                )}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-700">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="pb-3 pr-4">Gum Flavor</th>
                    <th className="pb-3 px-4">
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                        Stage 1: Unextruded ({getUnitLabel(extrudingUnitId, settings)})
                      </span>
                    </th>
                    <th className="pb-3 px-4">
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                        Stage 2: Extruded ({getUnitLabel(cuttingUnitId, settings)})
                      </span>
                    </th>
                    <th className="pb-3 px-4">
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                        Stage 3: Cut ({getUnitLabel(packingUnitId, settings)})
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeFlavors.map((flavor) => {
                    const cookedVal = displayWipCooked[flavor] !== undefined ? displayWipCooked[flavor] : "";
                    const extrudedVal = displayWipExtruded[flavor] !== undefined ? displayWipExtruded[flavor] : "";
                    const cutVal = displayWipCut[flavor] !== undefined ? displayWipCut[flavor] : "";

                    return (
                      <tr key={flavor} className="hover:bg-slate-50/50">
                        <td className="py-3.5 pr-4 font-bold text-slate-800">{flavor}</td>
                        
                        {/* Cooked / Unextruded */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              className="w-32 bg-white border border-slate-200 focus:border-slate-800 focus:outline-none py-1.5 px-2.5 rounded-lg text-slate-800 font-medium"
                              value={cookedVal}
                              onChange={(e) => {
                                let val = e.target.value.replace(/[^0-9.]/g, "");
                                if (/^0+(\d+)/.test(val)) {
                                  val = val.replace(/^0+(\d+)/, "$1");
                                }
                                setDisplayWipCooked((prev) => ({ ...prev, [flavor]: val }));
                              }}
                              onFocus={(e) => {
                                const target = e.currentTarget;
                                setTimeout(() => target.select(), 20);
                              }}
                            />
                            <span className="text-[10px] text-slate-400 font-bold uppercase">{getUnitLabel(extrudingUnitId, settings)}</span>
                          </div>
                        </td>

                        {/* Extruded */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              className="w-32 bg-white border border-slate-200 focus:border-slate-800 focus:outline-none py-1.5 px-2.5 rounded-lg text-slate-800 font-medium"
                              value={extrudedVal}
                              onChange={(e) => {
                                let val = e.target.value.replace(/[^0-9.]/g, "");
                                if (/^0+(\d+)/.test(val)) {
                                  val = val.replace(/^0+(\d+)/, "$1");
                                }
                                setDisplayWipExtruded((prev) => ({ ...prev, [flavor]: val }));
                              }}
                              onFocus={(e) => {
                                const target = e.currentTarget;
                                setTimeout(() => target.select(), 20);
                              }}
                            />
                            <span className="text-[10px] text-slate-400 font-bold uppercase">{getUnitLabel(cuttingUnitId, settings)}</span>
                          </div>
                        </td>

                        {/* Cut */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              className="w-32 bg-white border border-slate-200 focus:border-slate-800 focus:outline-none py-1.5 px-2.5 rounded-lg text-slate-800 font-medium"
                              value={cutVal}
                              onChange={(e) => {
                                let val = e.target.value.replace(/[^0-9.]/g, "");
                                if (/^0+(\d+)/.test(val)) {
                                  val = val.replace(/^0+(\d+)/, "$1");
                                }
                                setDisplayWipCut((prev) => ({ ...prev, [flavor]: val }));
                              }}
                              onFocus={(e) => {
                                const target = e.currentTarget;
                                setTimeout(() => target.select(), 20);
                              }}
                            />
                            <span className="text-[10px] text-slate-400 font-bold uppercase">{getUnitLabel(packingUnitId, settings)}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Save Notice */}
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 text-amber-800">
              <HelpCircle className="w-5 h-5 shrink-0 text-amber-500" />
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold">WIP Balancing Tip</h4>
                <p className="text-[11px] text-slate-600 leading-normal">
                  Make sure to click <strong>"Save Starting Stocks"</strong> to apply changes to the planning sheet computations. Updating these values immediately recalculates daily machine limits and suggested outputs across the entire week in real-time.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ================= WIP TRACKER FLOWS ================= */
        <div className="space-y-6" id="wip-tracker">
          
          {/* Calendar Picker and Filter Controls */}
          <div className="glass p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            
            {/* Selected Date */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Target Date:</label>
              <div className="relative flex items-center">
                <Calendar className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="date"
                  value={selectedDate}
                  min={dates[0]}
                  max={dates[dates.length - 1]}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-white border border-slate-200 hover:border-slate-400 focus:border-slate-800 focus:outline-none rounded-xl text-xs font-bold text-slate-800 transition-all cursor-pointer shadow-xs"
                />
              </div>
            </div>

            {/* View Grouping Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/50">
                <button
                  onClick={() => setViewGrouping("flavor")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    viewGrouping === "flavor"
                      ? "bg-white text-slate-900 shadow-xs border border-slate-200/30"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" /> By Flavor
                </button>
                <button
                  onClick={() => setViewGrouping("type")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    viewGrouping === "type"
                      ? "bg-white text-slate-900 shadow-xs border border-slate-200/30"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" /> By WIP Type
                </button>
              </div>

              {/* Reset daily overrides */}
              {dailyOverridesCount > 0 && (
                <button
                  onClick={handleClearDayOverrides}
                  className="bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold px-3 py-2 rounded-xl flex items-center gap-1 border border-amber-200 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Revert All {dailyOverridesCount} Edits
                </button>
              )}
            </div>
          </div>

          {/* Filtering Section */}
          <div className="glass px-5 py-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Flavor filter */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Filter Flavor:</span>
                <select
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none"
                  value={flavorFilter}
                  onChange={(e) => setFlavorFilter(e.target.value)}
                >
                  <option value="All">All Flavors</option>
                  {activeFlavors.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              {/* Stage Filter if view is By WIP Type */}
              {viewGrouping === "type" && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Filter Stage:</span>
                  <div className="flex bg-slate-50 border border-slate-200 p-0.5 rounded-lg">
                    {(["All", "cooked", "extruded", "cut"] as const).map((stage) => (
                      <button
                        key={stage}
                        onClick={() => setWipTypeFilter(stage)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase transition-all cursor-pointer ${
                          wipTypeFilter === stage
                            ? "bg-white text-slate-900 border border-slate-200/60 shadow-xs"
                            : "text-slate-400 hover:text-slate-700"
                        }`}
                      >
                        {stage === "All" ? "All Stages" : stage === "cooked" ? "1. Unextruded" : stage === "extruded" ? "2. Extruded" : "3. Cut"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <span className="text-[10px] bg-slate-100 text-slate-500 font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
              Department Specific Units
            </span>
          </div>

          {/* Core WIP Displays */}
          {currentSummary && currentSummary.wipFlows ? (
            
            viewGrouping === "flavor" ? (
              /* ================= VIEW 1: SORTED BY FLAVOR ================= */
              <div className="grid grid-cols-1 gap-6" id="wip-flow-cards-container">
                {activeFlavors
                  .filter((f) => flavorFilter === "All" || f === flavorFilter)
                  .map((flavor) => {
                    const flow = currentSummary.wipFlows?.[flavor] || {
                      openingCooked: 0, cookingOutput: 0, extrudingSuggested: 0, closingCooked: 0,
                      openingExtruded: 0, extrudingOutput: 0, cuttingSuggested: 0, closingExtruded: 0,
                      openingCut: 0, cuttingOutput: 0, packingSuggested: 0, closingCut: 0
                    };

                    // Values in selected unit
                    const opCooked = convertValue(flow.openingCooked, extrudingUnitId, settings);
                    const cookOut = convertValue(flow.cookingOutput, extrudingUnitId, settings);
                    const extSug = convertValue(flow.extrudingSuggested, extrudingUnitId, settings);
                    const clCooked = convertValue(flow.closingCooked, extrudingUnitId, settings);

                    const opExtruded = convertValue(flow.openingExtruded, cuttingUnitId, settings);
                    const extOut = convertValue(flow.extrudingOutput, cuttingUnitId, settings);
                    const cutSug = convertValue(flow.cuttingSuggested, cuttingUnitId, settings);
                    const clExtruded = convertValue(flow.closingExtruded, cuttingUnitId, settings);

                    const opCut = convertValue(flow.openingCut, packingUnitId, settings);
                    const cutOut = convertValue(flow.cuttingOutput, packingUnitId, settings);
                    const packSug = convertValue(flow.packingSuggested, packingUnitId, settings);
                    const clCut = convertValue(flow.closingCut, packingUnitId, settings);

                    // Overrides
                    const hasCookedOverride = wipOverrides[selectedDate]?.[flavor]?.cooked !== undefined;
                    const cookedOverrideVal = hasCookedOverride 
                      ? Math.round(convertValue(wipOverrides[selectedDate][flavor].cooked!, extrudingUnitId, settings) * 10) / 10
                      : "";

                    const hasExtrudedOverride = wipOverrides[selectedDate]?.[flavor]?.extruded !== undefined;
                    const extrudedOverrideVal = hasExtrudedOverride
                      ? Math.round(convertValue(wipOverrides[selectedDate][flavor].extruded!, cuttingUnitId, settings) * 10) / 10
                      : "";

                    const hasCutOverride = wipOverrides[selectedDate]?.[flavor]?.cut !== undefined;
                    const cutOverrideVal = hasCutOverride
                      ? Math.round(convertValue(wipOverrides[selectedDate][flavor].cut!, packingUnitId, settings) * 10) / 10
                      : "";

                    return (
                      <div key={flavor} className="glass p-6 space-y-5 border-l-4 border-l-amber-500/80">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-amber-500" />
                            <h4 className="text-base font-bold text-slate-900">{flavor}</h4>
                          </div>
                          
                          {(hasCookedOverride || hasExtrudedOverride || hasCutOverride) && (
                            <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Manual Override Active
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          
                          {/* Stage 1: Unextruded */}
                          <div className={`border rounded-xl p-4.5 space-y-3 transition-colors ${
                            hasCookedOverride ? "bg-amber-50/40 border-amber-200" : "bg-orange-50/50 border-orange-100"
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-orange-800 uppercase tracking-tight">Stage 1: Unextruded</span>
                              <span className="text-[10px] text-orange-500 font-bold">Mixer → Extruder</span>
                            </div>

                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between text-slate-600">
                                <span>Starting Stock</span>
                                <span className="font-semibold text-slate-800">{opCooked.toFixed(1)}</span>
                              </div>
                              <div className="flex justify-between text-emerald-600 font-medium">
                                <span>(+) Mixed / Cooked</span>
                                <span>+{cookOut.toFixed(1)}</span>
                              </div>
                              <div className="flex justify-between text-rose-600 font-medium">
                                <span>(-) Extruded</span>
                                <span>-{extSug.toFixed(1)}</span>
                              </div>
                              <div className="border-t border-slate-200/60 pt-2 flex justify-between text-slate-500 font-semibold mb-1">
                                <span>Calculated Stock</span>
                                <span>{(opCooked + cookOut - extSug).toFixed(1)}</span>
                              </div>

                              {/* Manual Input field */}
                              <div className="border-t border-slate-200/60 pt-3.5 space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                                  <span>Physical Ending Count</span>
                                  {hasCookedOverride && <span className="text-amber-800 font-extrabold text-[9px]">● OVERRIDDEN</span>}
                                </label>
                                <div className="flex items-center gap-1.5">
                                  <FormulaInput
                                    allowZero={true}
                                    placeholder={(opCooked + cookOut - extSug).toFixed(1)}
                                    className={`w-full bg-white text-xs border rounded-lg py-1 px-2.5 font-bold focus:outline-none focus:border-slate-800 focus:ring-0 ${
                                      hasCookedOverride ? "border-amber-400 bg-amber-50/40 text-amber-900" : "border-slate-200 text-slate-800"
                                    }`}
                                    value={hasCookedOverride ? Number(cookedOverrideVal) : undefined}
                                    onChange={(val) => handleUpdateOverride(flavor, "cooked", val === undefined ? "" : String(val))}
                                  />
                                  <span className="text-[10px] text-slate-400 font-bold">{getUnitLabel(extrudingUnitId, settings)}</span>
                                  {hasCookedOverride && (
                                    <button
                                      onClick={() => handleUpdateOverride(flavor, "cooked", "")}
                                      className="p-1 hover:bg-slate-200 rounded-md text-slate-400 hover:text-rose-600 transition-colors"
                                      title="Reset to calculated value"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Stage 2: Extruded */}
                          <div className={`border rounded-xl p-4.5 space-y-3 transition-colors ${
                            hasExtrudedOverride ? "bg-amber-50/40 border-amber-200" : "bg-blue-50/50 border-blue-100"
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-blue-800 uppercase tracking-tight">Stage 2: Extruded</span>
                              <span className="text-[10px] text-blue-500 font-bold">Extruder → Cutter</span>
                            </div>

                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between text-slate-600">
                                <span>Starting Stock</span>
                                <span className="font-semibold text-slate-800">{opExtruded.toFixed(1)}</span>
                              </div>
                              <div className="flex justify-between text-emerald-600 font-medium">
                                <span>(+) Extruded</span>
                                <span>+{extOut.toFixed(1)}</span>
                              </div>
                              <div className="flex justify-between text-rose-600 font-medium">
                                <span>(-) Cut</span>
                                <span>-{cutSug.toFixed(1)}</span>
                              </div>
                              <div className="border-t border-slate-200/60 pt-2 flex justify-between text-slate-500 font-semibold mb-1">
                                <span>Calculated Stock</span>
                                <span>{(opExtruded + extOut - cutSug).toFixed(1)}</span>
                              </div>

                              {/* Manual Input field */}
                              <div className="border-t border-slate-200/60 pt-3.5 space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                                  <span>Physical Ending Count</span>
                                  {hasExtrudedOverride && <span className="text-amber-800 font-extrabold text-[9px]">● OVERRIDDEN</span>}
                                </label>
                                <div className="flex items-center gap-1.5">
                                  <FormulaInput
                                    allowZero={true}
                                    placeholder={(opExtruded + extOut - cutSug).toFixed(1)}
                                    className={`w-full bg-white text-xs border rounded-lg py-1 px-2.5 font-bold focus:outline-none focus:border-slate-800 focus:ring-0 ${
                                      hasExtrudedOverride ? "border-amber-400 bg-amber-50/40 text-amber-900" : "border-slate-200 text-slate-800"
                                    }`}
                                    value={hasExtrudedOverride ? Number(extrudedOverrideVal) : undefined}
                                    onChange={(val) => handleUpdateOverride(flavor, "extruded", val === undefined ? "" : String(val))}
                                  />
                                  <span className="text-[10px] text-slate-400 font-bold">{getUnitLabel(cuttingUnitId, settings)}</span>
                                  {hasExtrudedOverride && (
                                    <button
                                      onClick={() => handleUpdateOverride(flavor, "extruded", "")}
                                      className="p-1 hover:bg-slate-200 rounded-md text-slate-400 hover:text-rose-600 transition-colors"
                                      title="Reset to calculated value"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Stage 3: Cut */}
                          <div className={`border rounded-xl p-4.5 space-y-3 transition-colors ${
                            hasCutOverride ? "bg-amber-50/40 border-amber-200" : "bg-indigo-50/50 border-indigo-100"
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-tight">Stage 3: Cut</span>
                              <span className="text-[10px] text-indigo-500 font-bold">Cutter → Packer</span>
                            </div>

                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between text-slate-600">
                                <span>Starting Stock</span>
                                <span className="font-semibold text-slate-800">{opCut.toFixed(1)}</span>
                              </div>
                              <div className="flex justify-between text-emerald-600 font-medium">
                                <span>(+) Cut</span>
                                <span>+{cutOut.toFixed(1)}</span>
                              </div>
                              <div className="flex justify-between text-rose-600 font-medium">
                                <span>(-) Packed (Outflow)</span>
                                <span>-{packSug.toFixed(1)}</span>
                              </div>
                              <div className="border-t border-slate-200/60 pt-2 flex justify-between text-slate-500 font-semibold mb-1">
                                <span>Calculated Stock</span>
                                <span>{(opCut + cutOut - packSug).toFixed(1)}</span>
                              </div>

                              {/* Manual Input field */}
                              <div className="border-t border-slate-200/60 pt-3.5 space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                                  <span>Physical Ending Count</span>
                                  {hasCutOverride && <span className="text-amber-800 font-extrabold text-[9px]">● OVERRIDDEN</span>}
                                </label>
                                <div className="flex items-center gap-1.5">
                                  <FormulaInput
                                    allowZero={true}
                                    placeholder={(opCut + cutOut - packSug).toFixed(1)}
                                    className={`w-full bg-white text-xs border rounded-lg py-1 px-2.5 font-bold focus:outline-none focus:border-slate-800 focus:ring-0 ${
                                      hasCutOverride ? "border-amber-400 bg-amber-50/40 text-amber-900" : "border-slate-200 text-slate-800"
                                    }`}
                                    value={hasCutOverride ? Number(cutOverrideVal) : undefined}
                                    onChange={(val) => handleUpdateOverride(flavor, "cut", val === undefined ? "" : String(val))}
                                  />
                                  <span className="text-[10px] text-slate-400 font-bold">{getUnitLabel(packingUnitId, settings)}</span>
                                  {hasCutOverride && (
                                    <button
                                      onClick={() => handleUpdateOverride(flavor, "cut", "")}
                                      className="p-1 hover:bg-slate-200 rounded-md text-slate-400 hover:text-rose-600 transition-colors"
                                      title="Reset to calculated value"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              /* ================= VIEW 2: SORTED BY WIP TYPE ================= */
              <div className="space-y-8" id="wip-by-type-container">
                {/* Stage 1 */}
                {(wipTypeFilter === "All" || wipTypeFilter === "cooked") && (
                  <div className="glass p-5 space-y-4 border-t-4 border-t-orange-400">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="space-y-0.5">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-orange-400" />
                          Stage 1: Cooked & Unextruded WIP
                        </h3>
                        <p className="text-[11px] text-slate-500">Materials mixed/cooked on floor but not yet fed to Extruders.</p>
                      </div>
                      <span className="text-[10px] text-orange-600 font-extrabold uppercase bg-orange-50 px-2 py-0.5 rounded-full">Mixer → Extruder</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left text-slate-700">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                            <th className="pb-2.5 pr-4">Gum Flavor</th>
                            <th className="pb-2.5 px-3">Starting WIP</th>
                            <th className="pb-2.5 px-3 text-emerald-600">(+) Mixed</th>
                            <th className="pb-2.5 px-3 text-rose-600">(-) Extruded</th>
                            <th className="pb-2.5 px-3">Calculated Ending</th>
                            <th className="pb-2.5 px-3 text-right">Physical Count / Actual Ending</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activeFlavors
                            .filter((f) => flavorFilter === "All" || f === flavorFilter)
                            .map((flavor) => {
                              const flow = currentSummary.wipFlows?.[flavor] || {
                                openingCooked: 0, cookingOutput: 0, extrudingSuggested: 0
                              };
                              const op = convertValue(flow.openingCooked, extrudingUnitId, settings);
                              const mix = convertValue(flow.cookingOutput, extrudingUnitId, settings);
                              const ext = convertValue(flow.extrudingSuggested, extrudingUnitId, settings);
                              const calcEnding = op + mix - ext;

                              const hasOverride = wipOverrides[selectedDate]?.[flavor]?.cooked !== undefined;
                              const overrideVal = hasOverride 
                                ? Math.round(convertValue(wipOverrides[selectedDate][flavor].cooked!, extrudingUnitId, settings) * 10) / 10
                                : "";

                              return (
                                <tr key={flavor} className={`hover:bg-slate-50/60 ${hasOverride ? "bg-amber-50/20" : ""}`}>
                                  <td className="py-2.5 pr-4 font-bold text-slate-800">{flavor}</td>
                                  <td className="py-2.5 px-3 text-slate-600">{op.toFixed(1)}</td>
                                  <td className="py-2.5 px-3 text-emerald-600 font-medium">+{mix.toFixed(1)}</td>
                                  <td className="py-2.5 px-3 text-rose-600 font-medium">-{ext.toFixed(1)}</td>
                                  <td className="py-2.5 px-3 font-semibold text-slate-500">{calcEnding.toFixed(1)}</td>
                                  <td className="py-2.5 px-3 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <FormulaInput
                                        allowZero={true}
                                        placeholder={calcEnding.toFixed(1)}
                                        className={`w-32 text-right bg-white text-xs border rounded-lg py-1 px-2 font-bold focus:outline-none focus:border-slate-800 focus:ring-0 ${
                                          hasOverride ? "border-amber-400 bg-amber-50/40 text-amber-900" : "border-slate-200 text-slate-800"
                                        }`}
                                        value={hasOverride ? Number(overrideVal) : undefined}
                                        onChange={(val) => handleUpdateOverride(flavor, "cooked", val === undefined ? "" : String(val))}
                                      />
                                      <span className="text-[10px] text-slate-400 font-bold min-w-[20px]">{getUnitLabel(extrudingUnitId, settings)}</span>
                                      {hasOverride && (
                                        <button
                                          onClick={() => handleUpdateOverride(flavor, "cooked", "")}
                                          className="p-1 hover:bg-slate-200 rounded-md text-slate-400 hover:text-rose-600 transition-colors"
                                          title="Reset to calculated value"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Stage 2 */}
                {(wipTypeFilter === "All" || wipTypeFilter === "extruded") && (
                  <div className="glass p-5 space-y-4 border-t-4 border-t-blue-400">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="space-y-0.5">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-blue-400" />
                          Stage 2: Extruded WIP
                        </h3>
                        <p className="text-[11px] text-slate-500">Materials extruded into ropes / slabs but not yet sliced into trays.</p>
                      </div>
                      <span className="text-[10px] text-blue-600 font-extrabold uppercase bg-blue-50 px-2 py-0.5 rounded-full">Extruder → Cutter</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left text-slate-700">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                            <th className="pb-2.5 pr-4">Gum Flavor</th>
                            <th className="pb-2.5 px-3">Starting WIP</th>
                            <th className="pb-2.5 px-3 text-emerald-600">(+) Extruded</th>
                            <th className="pb-2.5 px-3 text-rose-600">(-) Cut</th>
                            <th className="pb-2.5 px-3">Calculated Ending</th>
                            <th className="pb-2.5 px-3 text-right">Physical Count / Actual Ending</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activeFlavors
                            .filter((f) => flavorFilter === "All" || f === flavorFilter)
                            .map((flavor) => {
                              const flow = currentSummary.wipFlows?.[flavor] || {
                                openingExtruded: 0, extrudingOutput: 0, cuttingSuggested: 0
                              };
                              const op = convertValue(flow.openingExtruded, cuttingUnitId, settings);
                              const extIn = convertValue(flow.extrudingOutput, cuttingUnitId, settings);
                              const cutOut = convertValue(flow.cuttingSuggested, cuttingUnitId, settings);
                              const calcEnding = op + extIn - cutOut;

                              const hasOverride = wipOverrides[selectedDate]?.[flavor]?.extruded !== undefined;
                              const overrideVal = hasOverride 
                                ? Math.round(convertValue(wipOverrides[selectedDate][flavor].extruded!, cuttingUnitId, settings) * 10) / 10
                                : "";

                              return (
                                <tr key={flavor} className={`hover:bg-slate-50/60 ${hasOverride ? "bg-amber-50/20" : ""}`}>
                                  <td className="py-2.5 pr-4 font-bold text-slate-800">{flavor}</td>
                                  <td className="py-2.5 px-3 text-slate-600">{op.toFixed(1)}</td>
                                  <td className="py-2.5 px-3 text-emerald-600 font-medium">+{extIn.toFixed(1)}</td>
                                  <td className="py-2.5 px-3 text-rose-600 font-medium">-{cutOut.toFixed(1)}</td>
                                  <td className="py-2.5 px-3 font-semibold text-slate-500">{calcEnding.toFixed(1)}</td>
                                  <td className="py-2.5 px-3 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <FormulaInput
                                        allowZero={true}
                                        placeholder={calcEnding.toFixed(1)}
                                        className={`w-32 text-right bg-white text-xs border rounded-lg py-1 px-2 font-bold focus:outline-none focus:border-slate-800 focus:ring-0 ${
                                          hasOverride ? "border-amber-400 bg-amber-50/40 text-amber-900" : "border-slate-200 text-slate-800"
                                        }`}
                                        value={hasOverride ? Number(overrideVal) : undefined}
                                        onChange={(val) => handleUpdateOverride(flavor, "extruded", val === undefined ? "" : String(val))}
                                      />
                                      <span className="text-[10px] text-slate-400 font-bold min-w-[20px]">{getUnitLabel(cuttingUnitId, settings)}</span>
                                      {hasOverride && (
                                        <button
                                          onClick={() => handleUpdateOverride(flavor, "extruded", "")}
                                          className="p-1 hover:bg-slate-200 rounded-md text-slate-400 hover:text-rose-600 transition-colors"
                                          title="Reset to calculated value"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Stage 3 */}
                {(wipTypeFilter === "All" || wipTypeFilter === "cut") && (
                  <div className="glass p-5 space-y-4 border-t-4 border-t-indigo-400">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="space-y-0.5">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-indigo-400" />
                          Stage 3: Cut & Sliced WIP (Trayed)
                        </h3>
                        <p className="text-[11px] text-slate-500">Materials cut and trayed on floor, awaiting wrapping & packaging lines.</p>
                      </div>
                      <span className="text-[10px] text-indigo-600 font-extrabold uppercase bg-indigo-50 px-2 py-0.5 rounded-full">Cutter → Packer</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left text-slate-700">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                            <th className="pb-2.5 pr-4">Gum Flavor</th>
                            <th className="pb-2.5 px-3">Starting WIP</th>
                            <th className="pb-2.5 px-3 text-emerald-600">(+) Sliced</th>
                            <th className="pb-2.5 px-3 text-rose-600">(-) Packed</th>
                            <th className="pb-2.5 px-3">Calculated Ending</th>
                            <th className="pb-2.5 px-3 text-right">Physical Count / Actual Ending</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activeFlavors
                            .filter((f) => flavorFilter === "All" || f === flavorFilter)
                            .map((flavor) => {
                              const flow = currentSummary.wipFlows?.[flavor] || {
                                openingCut: 0, cuttingOutput: 0, packingSuggested: 0
                              };
                              const op = convertValue(flow.openingCut, packingUnitId, settings);
                              const cutIn = convertValue(flow.cuttingOutput, packingUnitId, settings);
                              const packOut = convertValue(flow.packingSuggested, packingUnitId, settings);
                              const calcEnding = op + cutIn - packOut;

                              const hasOverride = wipOverrides[selectedDate]?.[flavor]?.cut !== undefined;
                              const overrideVal = hasOverride 
                                ? Math.round(convertValue(wipOverrides[selectedDate][flavor].cut!, packingUnitId, settings) * 10) / 10
                                : "";

                              return (
                                <tr key={flavor} className={`hover:bg-slate-50/60 ${hasOverride ? "bg-amber-50/20" : ""}`}>
                                  <td className="py-2.5 pr-4 font-bold text-slate-800">{flavor}</td>
                                  <td className="py-2.5 px-3 text-slate-600">{op.toFixed(1)}</td>
                                  <td className="py-2.5 px-3 text-emerald-600 font-medium">+{cutIn.toFixed(1)}</td>
                                  <td className="py-2.5 px-3 text-rose-600 font-medium">-{packOut.toFixed(1)}</td>
                                  <td className="py-2.5 px-3 font-semibold text-slate-500">{calcEnding.toFixed(1)}</td>
                                  <td className="py-2.5 px-3 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <FormulaInput
                                        allowZero={true}
                                        placeholder={calcEnding.toFixed(1)}
                                        className={`w-32 text-right bg-white text-xs border rounded-lg py-1 px-2 font-bold focus:outline-none focus:border-slate-800 focus:ring-0 ${
                                          hasOverride ? "border-amber-400 bg-amber-50/40 text-amber-900" : "border-slate-200 text-slate-800"
                                        }`}
                                        value={hasOverride ? Number(overrideVal) : undefined}
                                        onChange={(val) => handleUpdateOverride(flavor, "cut", val === undefined ? "" : String(val))}
                                      />
                                      <span className="text-[10px] text-slate-400 font-bold min-w-[20px]">{getUnitLabel(packingUnitId, settings)}</span>
                                      {hasOverride && (
                                        <button
                                          onClick={() => handleUpdateOverride(flavor, "cut", "")}
                                          className="p-1 hover:bg-slate-200 rounded-md text-slate-400 hover:text-rose-600 transition-colors"
                                          title="Reset to calculated value"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="bg-white/50 border border-slate-200/50 p-12 text-center rounded-2xl">
              <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 text-sm font-semibold">No planning schedules generated.</p>
              <p className="text-slate-400 text-xs mt-1">Make sure dates are configured in the header.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
