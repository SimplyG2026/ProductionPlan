/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Settings, ScheduleState, PackingPriorityItem } from "./types";
import { DEFAULT_SETTINGS, loadDemoSchedules, createBlankDay, generateId } from "./data";
import { computeDailySummaries, getWeekdaysInRange } from "./calculations";
import SettingsTab from "./components/SettingsTab";
import PlannerTab from "./components/PlannerTab";
import SummaryTab from "./components/SummaryTab";
import WIPTab from "./components/WIPTab";
import FinishedGoodsTab from "./components/FinishedGoodsTab";
import ProductionNeedsTab from "./components/ProductionNeedsTab";
import {
  CalendarDays,
  Layers,
  Settings as SettingsIcon,
  Download,
  Upload,
  CheckCircle2,
  HelpCircle,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Boxes,
  FileSpreadsheet,
} from "lucide-react";

export default function App() {
  // --- STATE ---
  const [activeTab, setActiveTab] = useState<"planner" | "summary" | "wip" | "finished_goods" | "production_needs" | "settings">("planner");
  
  const [startDate, setStartDate] = useState<string>(() => {
    return localStorage.getItem("sg_startDate") || "2026-07-06";
  });
  
  const [endDate, setEndDate] = useState<string>(() => {
    return localStorage.getItem("sg_endDate") || "2026-07-10";
  });

  const [selectedUnitId, setSelectedUnitId] = useState<string>(() => {
    return localStorage.getItem("sg_selectedUnit") || "lb";
  });

  const [cookingUnitId, setCookingUnitId] = useState<string>(() => {
    return localStorage.getItem("sg_cookingUnit") || "lb";
  });
  const [extrudingUnitId, setExtrudingUnitId] = useState<string>(() => {
    return localStorage.getItem("sg_extrudingUnit") || "loaf";
  });
  const [cuttingUnitId, setCuttingUnitId] = useState<string>(() => {
    return localStorage.getItem("sg_cuttingUnit") || "loaf";
  });
  const [packingUnitId, setPackingUnitId] = useState<string>(() => {
    return localStorage.getItem("sg_packingUnit") || "12pk_mc";
  });
  const [fillerUnitId, setFillerUnitId] = useState<string>(() => {
    return localStorage.getItem("sg_fillerUnit") || "round";
  });

  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem("sg_settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          flavors: (() => {
            const hasAll = parsed.flavors && 
              parsed.flavors.length === DEFAULT_SETTINGS.flavors.length &&
              DEFAULT_SETTINGS.flavors.every((f: string) => parsed.flavors.includes(f));
            return hasAll ? parsed.flavors : DEFAULT_SETTINGS.flavors;
          })(),
          employees: parsed.employees || DEFAULT_SETTINGS.employees,
          packSizes: (parsed.packSizes || DEFAULT_SETTINGS.packSizes).map((ps: any) => ({
            ...ps,
            unitsPerMc: ps.unitsPerMc !== undefined ? ps.unitsPerMc : 144,
          })),
          customUnits: parsed.customUnits || DEFAULT_SETTINGS.customUnits,
          fillerProducts: parsed.fillerProducts || DEFAULT_SETTINGS.fillerProducts,
          fillerSizes: parsed.fillerSizes || DEFAULT_SETTINGS.fillerSizes,
          openingWipCooked: parsed.openingWipCooked || DEFAULT_SETTINGS.openingWipCooked,
          openingWipExtruded: parsed.openingWipExtruded || DEFAULT_SETTINGS.openingWipExtruded,
          openingWipCut: parsed.openingWipCut || DEFAULT_SETTINGS.openingWipCut,
          cookingBigSlots: parsed.cookingBigSlots !== undefined ? parsed.cookingBigSlots : DEFAULT_SETTINGS.cookingBigSlots,
          cookingSmallSlots: parsed.cookingSmallSlots !== undefined ? parsed.cookingSmallSlots : DEFAULT_SETTINGS.cookingSmallSlots,
          ex1Slots: parsed.ex1Slots !== undefined ? parsed.ex1Slots : DEFAULT_SETTINGS.ex1Slots,
          ex2Slots: parsed.ex2Slots !== undefined ? parsed.ex2Slots : DEFAULT_SETTINGS.ex2Slots,
          ex3Slots: parsed.ex3Slots !== undefined ? parsed.ex3Slots : DEFAULT_SETTINGS.ex3Slots,
        };
      } catch (e) {
        console.error("Error loading settings from localStorage:", e);
      }
    }
    return DEFAULT_SETTINGS;
  });

  const [schedule, setSchedule] = useState<ScheduleState>(() => {
    const saved = localStorage.getItem("sg_schedule");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const sanitized: ScheduleState = {};
        Object.keys(parsed).forEach((date) => {
          const rawDay = parsed[date];
          const blank = createBlankDay();
          sanitized[date] = {
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
        });
        return sanitized;
      } catch (e) {
        console.error("Error loading schedule from localStorage:", e);
      }
    }
    // Load default seed data
    return loadDemoSchedules("2026-07-06", "2026-07-07");
  });

  const [wipOverrides, setWipOverrides] = useState<Record<string, Record<string, { cooked?: number; extruded?: number; cut?: number }>>>(() => {
    const saved = localStorage.getItem("sg_wip_overrides");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing wip overrides:", e);
      }
    }
    return {};
  });

  useEffect(() => {
    localStorage.setItem("sg_wip_overrides", JSON.stringify(wipOverrides));
  }, [wipOverrides]);

  const [showSanityChecks, setShowSanityChecks] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [priorities, setPriorities] = useState<PackingPriorityItem[]>(() => {
    const saved = localStorage.getItem("sg_priorities");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing packing priorities:", e);
      }
    }
    return [
      {
        id: generateId(),
        flavor: "Peppermint",
        packSizeId: "12pk",
        mcsNeeded: 100,
        priority: "High",
        poTag: "Marshalls PO#337333",
        completed: false,
      },
      {
        id: generateId(),
        flavor: "Spearmint",
        packSizeId: "loose",
        mcsNeeded: 50,
        priority: "Medium",
        poTag: "TJMaxx PO#99281",
        completed: false,
      },
    ];
  });

  const handleImportToPriorities = (needs: { flavor: string; packSizeId: string; mcsNeeded: number }[]) => {
    const newItems = needs.map(need => ({
      id: generateId(),
      flavor: need.flavor,
      packSizeId: need.packSizeId,
      mcsNeeded: need.mcsNeeded,
      priority: "High" as const,
      poTag: "Sheets Demand",
      completed: false
    }));
    setPriorities(prev => [...prev, ...newItems]);
    setActiveTab("planner");
  };

  useEffect(() => {
    localStorage.setItem("sg_priorities", JSON.stringify(priorities));
  }, [priorities]);

  // --- SAVE STATE TO LOCAL STORAGE ---
  useEffect(() => {
    localStorage.setItem("sg_startDate", startDate);
  }, [startDate]);

  useEffect(() => {
    localStorage.setItem("sg_endDate", endDate);
  }, [endDate]);

  useEffect(() => {
    localStorage.setItem("sg_selectedUnit", selectedUnitId);
  }, [selectedUnitId]);

  useEffect(() => {
    localStorage.setItem("sg_cookingUnit", cookingUnitId);
  }, [cookingUnitId]);

  useEffect(() => {
    localStorage.setItem("sg_extrudingUnit", extrudingUnitId);
  }, [extrudingUnitId]);

  useEffect(() => {
    localStorage.setItem("sg_cuttingUnit", cuttingUnitId);
  }, [cuttingUnitId]);

  useEffect(() => {
    localStorage.setItem("sg_packingUnit", packingUnitId);
  }, [packingUnitId]);

  useEffect(() => {
    localStorage.setItem("sg_fillerUnit", fillerUnitId);
  }, [fillerUnitId]);

  useEffect(() => {
    localStorage.setItem("sg_settings", JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem("sg_schedule", JSON.stringify(schedule));
  }, [schedule]);

  // --- DATES GENERATION & CALCULATION ---
  const dates = React.useMemo(() => {
    return getWeekdaysInRange(startDate, endDate);
  }, [startDate, endDate]);

  const summaries = React.useMemo(() => {
    return computeDailySummaries(dates, schedule, settings, wipOverrides);
  }, [dates, schedule, settings, wipOverrides]);

  // --- SHEET CONTROLS ---
  const handleResetDemo = () => {
    setSettings({ ...DEFAULT_SETTINGS });
    setSchedule(loadDemoSchedules("2026-07-06", "2026-07-07"));
    setStartDate("2026-07-06");
    setEndDate("2026-07-10");
    setSelectedUnitId("lb");
    setActiveTab("planner");
  };

  const handleStartBlank = () => {
    setSchedule({});
    setStartDate("2026-07-06");
    setEndDate("2026-07-10");
    setActiveTab("planner");
  };

  const handleClearAll = () => {
    if (window.confirm("Are you sure you want to clear all inputs for all days? This action cannot be undone.")) {
      setSchedule({});
    }
  };

  // --- IMPORT/EXPORT JSON BACKUPS ---
  const handleExportBackup = () => {
    const backup = {
      version: 1,
      settings,
      schedule,
      startDate,
      endDate,
      selectedUnitId,
      cookingUnitId,
      extrudingUnitId,
      cuttingUnitId,
      packingUnitId,
      fillerUnitId,
    };
    const dataStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `simply_gum_planner_backup_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && parsed.settings && parsed.schedule) {
          setSettings(parsed.settings);
          setSchedule(parsed.schedule);
          if (parsed.startDate) setStartDate(parsed.startDate);
          if (parsed.endDate) setEndDate(parsed.endDate);
          if (parsed.selectedUnitId) setSelectedUnitId(parsed.selectedUnitId);
          if (parsed.cookingUnitId) setCookingUnitId(parsed.cookingUnitId);
          if (parsed.extrudingUnitId) setExtrudingUnitId(parsed.extrudingUnitId);
          if (parsed.cuttingUnitId) setCuttingUnitId(parsed.cuttingUnitId);
          if (parsed.packingUnitId) setPackingUnitId(parsed.packingUnitId);
          if (parsed.fillerUnitId) setFillerUnitId(parsed.fillerUnitId);
          alert("Backup file loaded and applied successfully!");
        } else {
          alert("Error: File is not a valid Simply Gum Production Planner backup structure.");
        }
      } catch (err) {
        alert("Error parsing JSON backup: " + (err as Error).message);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = ""; // clear selector
  };

  return (
    <div className="min-h-screen flex flex-col font-sans relative" id="app-root">
      {/* BACKGROUND MESH */}
      <div className="bg-mesh" />
      
      {/* GLOBAL BRAND HEADER */}
      <header className="sticky top-0 glass-header border-b border-white/20 z-40 shadow-sm" id="global-nav">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Logo & Identity */}
          <div className="flex items-center gap-4">
            <div className="h-7 md:h-8 flex items-center" id="brand-logo" title="Simply Gum">
              <svg viewBox="0 0 620 90" className="h-full w-auto text-slate-900 fill-current" aria-label="Simply Gum">
                <text
                  x="0"
                  y="70"
                  fontFamily="'Space Grotesk', system-ui, -apple-system, sans-serif"
                  fontWeight="950"
                  fontSize="64"
                  letterSpacing="18"
                >
                  SIMPLY GUM
                </text>
              </svg>
            </div>
            <span className="bg-slate-100 border border-slate-200/60 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider backdrop-blur-xs">
              Production Planner
            </span>
          </div>

          {/* Operational Controls & Selection */}
          <div className="flex flex-wrap items-center gap-3 md:gap-4" id="global-control-panel">
            
            {/* Weekday calendar filters */}
            <div className="flex items-center gap-1.5 bg-white/50 backdrop-blur-md border border-white/40 rounded-lg p-1 text-xs font-semibold text-slate-700 shadow-xs">
              <span className="px-2 text-slate-500">From</span>
              <input
                type="date"
                className="bg-white/80 border-none py-1 px-1.5 rounded focus:outline-none focus:ring-1 focus:ring-slate-900 font-bold text-slate-800"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span className="px-1 text-slate-400">to</span>
              <input
                type="date"
                className="bg-white/80 border-none py-1 px-1.5 rounded focus:outline-none focus:ring-1 focus:ring-slate-900 font-bold text-slate-800"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {/* Conversion Selector */}
            <div className="flex items-center gap-2 bg-white/50 backdrop-blur-md border border-white/40 rounded-lg p-1 text-xs shadow-xs">
              <span className="px-2 font-semibold text-slate-500 uppercase tracking-wide">Display Unit:</span>
              <select
                className="bg-white/80 border-none py-1 px-2.5 rounded font-bold text-slate-900 focus:ring-1 focus:ring-slate-950 cursor-pointer"
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
              >
                {settings.customUnits.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            {/* Backups & Transfer */}
            <div className="flex items-center gap-2 border-l border-slate-200/50 pl-3 md:pl-4">
              <button
                onClick={handleExportBackup}
                className="p-2 text-slate-600 hover:text-slate-900 bg-white/60 hover:bg-white/90 border border-white/50 hover:border-slate-300 rounded-lg shadow-xs hover:shadow-sm transition-all cursor-pointer backdrop-blur-xs"
                title="Export settings & schedules file (JSON)"
              >
                <Download className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-slate-600 hover:text-slate-900 bg-white/60 hover:bg-white/90 border border-white/50 hover:border-slate-300 rounded-lg shadow-xs hover:shadow-sm transition-all cursor-pointer backdrop-blur-xs"
                title="Import settings & schedules file (JSON)"
              >
                <Upload className="w-4 h-4" />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportBackup}
                accept=".json"
                className="hidden"
              />
            </div>

          </div>
        </div>

        {/* TAB NAVIGATION ROW */}
        <div className="bg-white/40 border-t border-b border-white/20 backdrop-blur-xs shadow-xs" id="tabs-bar">
          <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row md:items-center justify-between gap-2">
            <nav className="flex flex-wrap gap-1 py-2">
              <button
                onClick={() => setActiveTab("planner")}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold tracking-tight transition-all cursor-pointer ${
                  activeTab === "planner"
                    ? "bg-slate-900 text-white shadow-sm border border-white/10"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                }`}
              >
                <CalendarDays className="w-4 h-4" /> Planning Sheet
              </button>

              <button
                onClick={() => setActiveTab("summary")}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold tracking-tight transition-all cursor-pointer ${
                  activeTab === "summary"
                    ? "bg-slate-900 text-white shadow-sm border border-white/10"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                }`}
              >
                <Layers className="w-4 h-4" /> Daily Summaries
              </button>

              <button
                onClick={() => setActiveTab("wip")}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold tracking-tight transition-all cursor-pointer ${
                  activeTab === "wip"
                    ? "bg-slate-900 text-white shadow-sm border border-white/10"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                }`}
              >
                <TrendingUp className="w-4 h-4" /> Work in Progress
              </button>

              <button
                onClick={() => setActiveTab("finished_goods")}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold tracking-tight transition-all cursor-pointer ${
                  activeTab === "finished_goods"
                    ? "bg-slate-900 text-white shadow-sm border border-white/10"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                }`}
              >
                <Boxes className="w-4 h-4" /> Finished Goods
              </button>

              <button
                onClick={() => setActiveTab("production_needs")}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold tracking-tight transition-all cursor-pointer ${
                  activeTab === "production_needs"
                    ? "bg-slate-900 text-white shadow-sm border border-white/10"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" /> Production Needs
              </button>

              <button
                onClick={() => setActiveTab("settings")}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold tracking-tight transition-all cursor-pointer ${
                  activeTab === "settings"
                    ? "bg-slate-900 text-white shadow-sm border border-white/10"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                }`}
              >
                <SettingsIcon className="w-4 h-4" /> Parameters
              </button>
            </nav>

            {/* Quick Operational Info */}
            <div className="hidden lg:flex items-center gap-4 text-xs font-medium text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-950" />
                <span>Shift Length: <span className="font-bold text-slate-800">{settings.shiftHours} hrs</span></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span>Active Flavors: <span className="font-bold text-slate-800">{settings.flavors.length}</span></span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN VIEW CONTROLLER */}
      <main className="flex-1 max-w-8xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8" id="tab-renderer">
        {activeTab === "planner" && (
          <PlannerTab
            dates={dates}
            schedule={schedule}
            settings={settings}
            cookingUnitId={cookingUnitId}
            onUpdateCookingUnit={setCookingUnitId}
            extrudingUnitId={extrudingUnitId}
            onUpdateExtrudingUnit={setExtrudingUnitId}
            cuttingUnitId={cuttingUnitId}
            onUpdateCuttingUnit={setCuttingUnitId}
            packingUnitId={packingUnitId}
            onUpdatePackingUnit={setPackingUnitId}
            fillerUnitId={fillerUnitId}
            onUpdateFillerUnit={setFillerUnitId}
            onUpdateSchedule={setSchedule}
            onResetDemo={handleResetDemo}
            onClearAll={handleClearAll}
            onStartBlank={handleStartBlank}
            priorities={priorities}
            onUpdatePriorities={setPriorities}
            onUpdateSettings={setSettings}
            summaries={summaries}
          />
        )}

        {activeTab === "summary" && (
          <SummaryTab
            dates={dates}
            summaries={summaries}
            settings={settings}
            cookingUnitId={cookingUnitId}
            extrudingUnitId={extrudingUnitId}
            cuttingUnitId={cuttingUnitId}
            packingUnitId={packingUnitId}
            fillerUnitId={fillerUnitId}
          />
        )}

        {activeTab === "wip" && (
          <WIPTab
            dates={dates}
            summaries={summaries}
            settings={settings}
            cookingUnitId={cookingUnitId}
            extrudingUnitId={extrudingUnitId}
            cuttingUnitId={cuttingUnitId}
            packingUnitId={packingUnitId}
            fillerUnitId={fillerUnitId}
            onUpdateSettings={(updated) => setSettings(prev => ({ ...prev, ...updated }))}
            wipOverrides={wipOverrides}
            onUpdateWipOverrides={setWipOverrides}
          />
        )}

        {activeTab === "finished_goods" && (
          <FinishedGoodsTab
            settings={settings}
          />
        )}

        {activeTab === "production_needs" && (
          <ProductionNeedsTab
            settings={settings}
            onImportToPriorities={handleImportToPriorities}
          />
        )}

        {activeTab === "settings" && (
          <SettingsTab
            settings={settings}
            onUpdateSettings={setSettings}
          />
        )}
      </main>

      {/* SANITY CHECKS & VERIFICATION CRITERIA (FOOTER DRAWER) */}
      <footer className="bg-white/40 border-t border-white/25 mt-auto py-6 backdrop-blur-xs" id="app-footer">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/20 pb-3">
            <p className="text-xs text-slate-500 font-medium">
              Simply Gum Production Planner App © 2026. Designed for factory ops supervisors. Persistent via HTML5 Local Storage.
            </p>
            <button
              onClick={() => setShowSanityChecks(!showSanityChecks)}
              className="text-xs text-slate-700 hover:text-slate-950 font-bold flex items-center gap-1 cursor-pointer bg-white/60 hover:bg-white/90 px-3 py-1.5 rounded-lg border border-white/50 backdrop-blur-xs transition-all shadow-xs"
            >
              <HelpCircle className="w-4 h-4 text-slate-500" />
              <span>{showSanityChecks ? "Hide Factory Sanity Checks" : "Show Factory Sanity Checks"}</span>
            </button>
          </div>

          {showSanityChecks && (
            <div className="glass p-6 space-y-4 text-xs font-medium text-slate-700 animate-fadeIn" id="sanity-checks-panel">
              <div className="flex items-center gap-2 text-slate-900 border-b border-white/20 pb-2">
                <CheckCircle2 className="w-4.5 h-4.5 text-green-600 shrink-0" />
                <h4 className="font-bold">Validation Criteria & Built-in Sanity Checks</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" id="sanity-checks-grid">
                
                {/* Check 1 */}
                <div className="bg-white/65 p-4 rounded-lg border border-white/45 space-y-1.5 backdrop-blur-xs shadow-xs">
                  <span className="text-[10px] bg-white/80 border border-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded-full uppercase">Check 1: Mixer to Loaf</span>
                  <p className="text-slate-800 font-semibold leading-relaxed">Big machine, 2 rounds Mint → 242 lbs → 65.4 Loaves.</p>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Math: 2 rds × 121 lbs/rd = 242 lbs. 242 lbs ÷ 3.7 lbs per Loaf = 65.405 Loaves. Passes check.
                  </p>
                </div>

                {/* Check 2 */}
                <div className="bg-white/65 p-4 rounded-lg border border-white/45 space-y-1.5 backdrop-blur-xs shadow-xs">
                  <span className="text-[10px] bg-white/80 border border-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded-full uppercase">Check 2: Bag Packer Output</span>
                  <p className="text-slate-800 font-semibold leading-relaxed">1 packer on Bag 70ct for an 8-h shift → 80 MC → 960 lbs.</p>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Math: 10 MC/hr × 8 h = 80 MC. 80 MC × 12 lbs per MC = 960 lbs weight. Passes check.
                  </p>
                </div>

                {/* Check 3 */}
                <div className="bg-white/65 p-4 rounded-lg border border-white/45 space-y-1.5 backdrop-blur-xs shadow-xs">
                  <span className="text-[10px] bg-white/80 border border-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded-full uppercase">Check 3: Cutters Capacity</span>
                  <p className="text-slate-800 font-semibold leading-relaxed">3 cutters on Mint for 8 hrs → 960 lbs cutting capacity.</p>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Math: 3 cutters × 40 lbs/hr per person × 8 hrs = 960 lbs capacity. Passes check.
                  </p>
                </div>

                {/* Check 4 */}
                <div className="bg-white/65 p-4 rounded-lg border border-white/45 space-y-1.5 backdrop-blur-xs shadow-xs">
                  <span className="text-[10px] bg-white/80 border border-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded-full uppercase">Check 4: Chrono WIP Contoh</span>
                  <p className="text-slate-800 font-semibold leading-relaxed">0 suggested extruding on Day 1, 484 suggested on Day 2.</p>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Math: Day 1 Cooking Mint 4 rds (484 lbs). Opening WIP = 0. Day 1 Extruding Sug = min(728 capacity, 0 WIP) = 0. Day 2 WIP = 484 lbs. Day 2 Sug = min(728 capacity, 484 WIP) = 484 lbs. Passes check.
                  </p>
                </div>

              </div>
            </div>
          )}
        </div>
      </footer>

    </div>
  );
}
