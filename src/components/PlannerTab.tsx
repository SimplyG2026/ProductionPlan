/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import {
  Settings,
  DaySchedule,
  ScheduleState,
  CookingEntry,
  ExtrudingEntry,
  CuttingEntry,
  PackingEntry,
  FillerEntry,
  MachineStatus,
  PackingPriorityItem,
  DailySummary,
} from "../types";
import { createBlankDay, generateId } from "../data";
import { convertValue, getUnitLabel } from "../calculations";
import { FormulaInput } from "./FormulaInput";
import {
  Copy,
  Clipboard,
  Trash2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  AlertCircle,
  RefreshCw,
  Plus,
  Trash,
  ArrowUp,
  ArrowDown,
  Check,
  Calendar,
  Settings as SettingsIcon,
  AlertTriangle,
  X,
  FileSpreadsheet,
} from "lucide-react";

const WipSection = ({ title, total, unit, flavorBreakdown, colorClass }: { title: string, total: string, unit: string, flavorBreakdown: {flavor: string, quantity: number}[], colorClass: string }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <div className="flex flex-col items-end">
      <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-1 font-bold uppercase">
          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          <span className={`text-[10px] ${colorClass}`}>{title}: {total} {unit}</span>
      </button>
      {isExpanded && flavorBreakdown.length > 0 && (
          <div className="mt-1 flex flex-col items-end text-[9px] text-slate-400 border-t border-slate-200 pt-1">
            {flavorBreakdown.map(({flavor, quantity}) => (
              <span key={flavor} className="whitespace-nowrap">{flavor}: {quantity.toFixed(1)}</span>
            ))}
          </div>
      )}
    </div>
  );
};

interface PlannerTabProps {
  dates: string[];
  schedule: ScheduleState;
  settings: Settings;
  cookingUnitId: string;
  onUpdateCookingUnit: (unit: string) => void;
  extrudingUnitId: string;
  onUpdateExtrudingUnit: (unit: string) => void;
  cuttingUnitId: string;
  onUpdateCuttingUnit: (unit: string) => void;
  packingUnitId: string;
  onUpdatePackingUnit: (unit: string) => void;
  fillerUnitId: string;
  onUpdateFillerUnit: (unit: string) => void;
  onUpdateSchedule: (newSchedule: ScheduleState) => void;
  onResetDemo: () => void;
  onClearAll: () => void;
  onStartBlank: () => void;
  priorities: PackingPriorityItem[];
  onUpdatePriorities: (newPriorities: PackingPriorityItem[]) => void;
  onUpdateSettings?: (newSettings: Settings) => void;
  summaries?: DailySummary[];
}

export default function PlannerTab({
  dates,
  schedule,
  settings,
  cookingUnitId,
  onUpdateCookingUnit,
  extrudingUnitId,
  onUpdateExtrudingUnit,
  cuttingUnitId,
  onUpdateCuttingUnit,
  packingUnitId,
  onUpdatePackingUnit,
  fillerUnitId,
  onUpdateFillerUnit,
  onUpdateSchedule,
  onResetDemo,
  onClearAll,
  onStartBlank,
  priorities,
  onUpdatePriorities,
  onUpdateSettings,
  summaries = [],
}: PlannerTabProps) {
  // --- PAGINATION & VIEWPORT VIRTUALIZATION ---
  const [viewportStartIdx, setViewportStartIdx] = useState(0);
  const visibleColumnsCount = 6;

  // Derived current visible dates
  const visibleDates = useMemo(() => {
    return dates;
  }, [dates]);

  // Jump to date search input
  const [jumpDateStr, setJumpDateStr] = useState("");

  // Jump to today helper
  const handleJumpToToday = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    // Find index of today's date, or closest subsequent date
    let closestIdx = dates.findIndex((d) => d >= todayStr);
    if (closestIdx === -1) {
      closestIdx = dates.length - 1;
    }
    if (closestIdx >= 0) {
      setViewportStartIdx(Math.max(0, Math.min(closestIdx, dates.length - visibleColumnsCount)));
    }
  };

  // Jump to specific date
  const handleJumpToDate = (targetDate: string) => {
    if (!targetDate) return;
    const idx = dates.findIndex((d) => d >= targetDate);
    if (idx !== -1) {
      setViewportStartIdx(Math.max(0, Math.min(idx, dates.length - visibleColumnsCount)));
    }
  };

  // Predefined ranges for easy calendar extensions
  const extendDateRange = (months: number) => {
    const today = new Date();
    const future = new Date();
    future.setMonth(today.getMonth() + months);
    
    // Calculate first monday of current month
    const start = new Date(today);
    start.setDate(1);
    while (start.getDay() !== 1) {
      start.setDate(start.getDate() + 1);
    }
    const startStr = start.toISOString().split("T")[0];
    const endStr = future.toISOString().split("T")[0];
    
    localStorage.setItem("sg_startDate", startStr);
    localStorage.setItem("sg_endDate", endStr);
    // Reload page to propagate range update cleanly
    window.location.reload();
  };

  // --- PACKING PRIORITIES SIDEBAR STATE ---
  const setPriorities = onUpdatePriorities;

  const [newPriority, setNewPriority] = useState<Partial<PackingPriorityItem>>({
    flavor: settings.flavors[0] || "",
    packSizeId: settings.packSizes[0]?.id || "",
    mcsNeeded: 20,
    priority: "High",
    poTag: "",
  });

  const handleAddPriority = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPriority.flavor || !newPriority.packSizeId || !newPriority.mcsNeeded) return;
    const item: PackingPriorityItem = {
      id: generateId(),
      flavor: newPriority.flavor,
      packSizeId: newPriority.packSizeId,
      mcsNeeded: Number(newPriority.mcsNeeded),
      priority: newPriority.priority || "Medium",
      poTag: newPriority.poTag || "",
      completed: false,
    };
    setPriorities([...priorities, item]);
    setNewPriority({
      flavor: settings.flavors[0] || "",
      packSizeId: settings.packSizes[0]?.id || "",
      mcsNeeded: 20,
      priority: "High",
      poTag: "",
    });
  };

  const handleDeletePriority = (id: string) => {
    setPriorities(priorities.filter((p) => p.id !== id));
  };

  const handleTogglePriorityCompleted = (id: string) => {
    setPriorities(
      priorities.map((p) => (p.id === id ? { ...p, completed: !p.completed } : p))
    );
  };

  const handleMovePriority = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === priorities.length - 1) return;
    
    const nextIdx = direction === "up" ? index - 1 : index + 1;
    const reordered = [...priorities];
    const temp = reordered[index];
    reordered[index] = reordered[nextIdx];
    reordered[nextIdx] = temp;
    setPriorities(reordered);
  };

  // --- GENERAL APP STATE ---
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    cooking: false,
    extruding: false,
    cutting: false,
    packing: false,
    filler: false,
    amazon: false,
  });

  const [copiedDayData, setCopiedDayData] = useState<DaySchedule | null>(null);
  const [copiedFromDate, setCopiedFromDate] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Status Modal State
  const [statusSelectorOpen, setStatusSelectorOpen] = useState<{ date: string; machineId: string } | null>(null);

  const triggerFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const toggleGroup = (group: string) => {
    setCollapsed((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const getDaySchedule = (date: string): DaySchedule => {
    const rawDay = schedule[date];
    if (!rawDay) return createBlankDay();
    const blank = createBlankDay();
    return {
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
  };

  const updateDaySchedule = (date: string, updated: DaySchedule) => {
    onUpdateSchedule({
      ...schedule,
      [date]: updated,
    });
  };

  const handleCopyDay = (date: string) => {
    const day = getDaySchedule(date);
    setCopiedDayData(JSON.parse(JSON.stringify(day)));
    setCopiedFromDate(date);
    triggerFeedback(`Copied schedule from ${formatDateLabel(date).weekday} ${formatDateLabel(date).monthDay}`);
  };

  const handlePasteDay = (date: string) => {
    if (!copiedDayData) return;
    const dataToPaste = JSON.parse(JSON.stringify(copiedDayData));
    updateDaySchedule(date, dataToPaste);
    triggerFeedback(`Pasted schedule to ${formatDateLabel(date).weekday} ${formatDateLabel(date).monthDay}`);
  };

  const handleClearDay = (date: string) => {
    updateDaySchedule(date, createBlankDay());
    triggerFeedback(`Cleared entries for ${formatDateLabel(date).weekday}`);
  };

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
    const monthDay = d.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
    const year = d.getFullYear();
    return { weekday, monthDay, year, full: dateStr };
  };

  // Check combo errors
  const getPackComboError = (flavor: string, packSizeId: string) => {
    if (!flavor || !packSizeId) return null;
    const key = `${flavor}|${packSizeId}`;
    if (settings.allowedCombos[key] === false) {
      return `${flavor} × ${settings.packSizes.find((p) => p.id === packSizeId)?.name || packSizeId} is disallowed in Settings.`;
    }
    return null;
  };

  // Employee checks
  const isCutterEmployeeDuplicate = (date: string, employee: string, currentEntryIdx: number) => {
    if (!employee) return false;
    const day = getDaySchedule(date);
    let occurrences = 0;
    day.cutting.forEach((entry, idx) => {
      if (entry.employees && entry.employees.includes(employee)) {
        if (idx !== currentEntryIdx) occurrences++;
      }
    });
    return occurrences > 0;
  };

  const isPackingEmployeeDuplicate = (date: string, employee: string, currentEntryIdx: number) => {
    if (!employee) return false;
    const day = getDaySchedule(date);
    let occurrences = 0;
    day.packing.forEach((entry, idx) => {
      if (entry.employees && entry.employees.includes(employee)) {
        if (idx !== currentEntryIdx) occurrences++;
      }
    });
    return occurrences > 0;
  };

  // --- RENDERING PARSER HELPERS ---

  const getDeptColor = (color: string, type: 'bg' | 'border' | 'text' | 'ring' | 'hover') => {
    switch (color) {
      case 'blue': return type === 'bg' ? 'bg-blue-50' : type === 'border' ? 'border-blue-100' : type === 'text' ? 'text-blue-900' : type === 'ring' ? 'ring-blue-900' : 'hover:bg-blue-100/50';
      case 'amber': return type === 'bg' ? 'bg-amber-50' : type === 'border' ? 'border-amber-100' : type === 'text' ? 'text-amber-900' : type === 'ring' ? 'ring-amber-900' : 'hover:bg-amber-100/50';
      case 'emerald': return type === 'bg' ? 'bg-emerald-50' : type === 'border' ? 'border-emerald-100' : type === 'text' ? 'text-emerald-900' : type === 'ring' ? 'ring-emerald-900' : 'hover:bg-emerald-100/50';
      case 'purple': return type === 'bg' ? 'bg-purple-50' : type === 'border' ? 'border-purple-100' : type === 'text' ? 'text-purple-900' : type === 'ring' ? 'ring-purple-900' : 'hover:bg-purple-100/50';
      case 'rose': return type === 'bg' ? 'bg-rose-50' : type === 'border' ? 'border-rose-100' : type === 'text' ? 'text-rose-900' : type === 'ring' ? 'ring-rose-900' : 'hover:bg-rose-100/50';
      default: return type === 'bg' ? 'bg-slate-50' : type === 'border' ? 'border-slate-100' : type === 'text' ? 'text-slate-900' : type === 'ring' ? 'ring-slate-900' : 'hover:bg-slate-100/50';
    }
  };
  const renderMachineStatusBadge = (date: string, machineId: string) => {
    const day = getDaySchedule(date);
    const status = day.machineStatuses?.[machineId] || { status: "ACTIVE" };
    
    let color = "text-green-600 bg-green-500/10 border-green-500/20";
    if (status.status === "OFF") color = "text-slate-500 bg-slate-500/10 border-slate-500/20";
    if (status.status === "MAINTENANCE") color = "text-red-500 bg-red-500/10 border-red-500/20";
    if (status.status === "CLEAN") color = "text-indigo-500 bg-indigo-500/10 border-indigo-500/20";

    return (
      <div className="relative">
        <button
          onClick={() => setStatusSelectorOpen({ date, machineId })}
          className={`flex items-center gap-1 text-[9px] font-extrabold tracking-wider px-1.5 py-0.5 rounded border ${color} hover:shadow-xs transition-all cursor-pointer`}
          title="Click to edit machine status"
        >
          <SettingsIcon className="w-2.5 h-2.5 opacity-70" />
          <span>{status.status}</span>
          {status.status === "CLEAN" && status.deductHours && (
            <span className="font-semibold text-slate-500 text-[8px]">-{status.deductHours}h</span>
          )}
        </button>

        {statusSelectorOpen?.date === date && statusSelectorOpen?.machineId === machineId && (
          <div className="absolute left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-50 w-52 text-left text-slate-800 space-y-2 animate-fadeIn">
            <div className="flex justify-between items-center border-b border-slate-150 pb-1.5">
              <span className="text-[10px] font-extrabold uppercase text-slate-400">Machine Status</span>
              <button onClick={() => setStatusSelectorOpen(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <div className="space-y-1">
              {["ACTIVE", "OFF", "MAINTENANCE", "CLEAN"].map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    const currentStatuses = day.machineStatuses || {};
                    const prevStatus = currentStatuses[machineId] || { status: "ACTIVE" };
                    currentStatuses[machineId] = {
                      ...prevStatus,
                      status: st as any,
                      note: prevStatus.note || "",
                      deductHours: prevStatus.deductHours || 0,
                    };
                    updateDaySchedule(date, { ...day, machineStatuses: currentStatuses });
                  }}
                  className={`w-full text-left px-2 py-1 rounded text-xs font-semibold ${
                    status.status === st ? "bg-slate-900 text-white" : "hover:bg-slate-100 text-slate-700"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {status.status === "CLEAN" && (
              <div className="space-y-1 pt-1.5 border-t border-slate-150">
                <label className="text-[9px] font-bold text-slate-500 uppercase block">Deduct Shift Hours</label>
                <input
                  type="number"
                  min="0"
                  max="12"
                  step="0.5"
                  className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-800 focus:outline-none"
                  value={status.deductHours || ""}
                  placeholder="e.g. 1.5 hrs"
                  onChange={(e) => {
                    const currentStatuses = day.machineStatuses || {};
                    currentStatuses[machineId] = {
                      ...status,
                      deductHours: Number(e.target.value),
                    };
                    updateDaySchedule(date, { ...day, machineStatuses: currentStatuses });
                  }}
                />
                <label className="text-[9px] font-bold text-slate-500 uppercase block mt-1">Next Flavor note</label>
                <input
                  type="text"
                  className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-800 focus:outline-none"
                  value={status.note || ""}
                  placeholder="Clean for Coffee..."
                  onChange={(e) => {
                    const currentStatuses = day.machineStatuses || {};
                    currentStatuses[machineId] = {
                      ...status,
                      note: e.target.value,
                    };
                    updateDaySchedule(date, { ...day, machineStatuses: currentStatuses });
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8" id="planner-tab-view">
      
      {/* LEFT COLUMN: TIMELINE SHEET (9 COLS) */}
      <div className="xl:col-span-9 space-y-6">
        
        {/* VIEWPORT SLIDER / CONTROL CARD */}
        <div className="glass p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Timeline Window</h2>
            </div>
            <p className="text-xs text-slate-500">
              Showing all <strong>{dates.length}</strong> weekdays in the active scheduling window. Stored inventory values are tracked in Lbs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {dates.length > 0 && (
              <div className="bg-slate-100 border border-slate-200/80 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 shadow-xs flex items-center gap-2">
                <span>Range:</span>
                <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded font-black text-slate-800 text-[10px]">{dates[0]}</span>
                <span className="text-slate-400">to</span>
                <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded font-black text-slate-800 text-[10px]">{dates[dates.length - 1]}</span>
              </div>
            )}
          </div>
        </div>

        {/* CORE INTERACTIVE CALENDAR CONTAINER */}
        <div className="glass overflow-hidden" id="planner-grid-container">
          <div className="overflow-x-auto" id="planner-horizontal-scroll">
            <table className="w-full border-collapse" id="planner-sheet-table">
              
              <thead>
                {/* 1. DATE HEADER */}
                <tr className="bg-slate-900 text-white border-b border-slate-800">
                  <th className="sticky left-0 bg-slate-950 z-30 px-4 py-4 text-left text-[11px] font-black uppercase tracking-widest border-r border-slate-850 w-[180px] shrink-0 shadow-[2px_0_5px_rgba(0,0,0,0.15)]">
                    Station / Department
                  </th>
                  {visibleDates.map((date) => {
                    const day = getDaySchedule(date);
                    const { weekday, monthDay } = formatDateLabel(date);
                    return (
                      <th key={date} className={`px-3 py-3 border-r border-slate-800 min-w-[310px] text-center ${day.closed ? "bg-slate-850" : ""}`}>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between px-1">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">{weekday}</span>
                            
                            {/* Closed Day toggle */}
                            <label className="flex items-center gap-1 text-[9px] font-extrabold uppercase text-slate-300 cursor-pointer">
                              <input
                                type="checkbox"
                                className="rounded bg-slate-800 border-slate-700 text-indigo-500 focus:ring-0 focus:ring-offset-0"
                                checked={!!day.closed}
                                onChange={(e) => {
                                  updateDaySchedule(date, { ...day, closed: e.target.checked });
                                }}
                              />
                              <span>{day.closed ? "Closed" : "Active"}</span>
                            </label>
                          </div>

                          <div className="text-base font-black text-slate-100">{monthDay}</div>

                          {/* Day Quick Copy/Paste actions */}
                          <div className="flex items-center justify-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1 text-[9px] font-bold">
                            <button onClick={() => handleCopyDay(date)} className="hover:text-white text-slate-300 px-1 py-0.5 rounded hover:bg-white/10 cursor-pointer">
                              Copy
                            </button>
                            <button
                              onClick={() => handlePasteDay(date)}
                              disabled={!copiedDayData}
                              className={`px-1 py-0.5 rounded ${copiedDayData ? "text-green-300 hover:text-white hover:bg-green-800/40 cursor-pointer" : "text-slate-500"}`}
                            >
                              Paste
                            </button>
                            <button onClick={() => handleClearDay(date)} className="hover:text-red-300 text-slate-400 px-1 py-0.5 rounded hover:bg-red-950/40 cursor-pointer">
                              Clear
                            </button>
                          </div>
                        </div>
                      </th>
                    );
                  })}
                </tr>

                {/* 2. DAY NOTES & SYSTEM ANNOUNCEMENTS FIELD */}
                <tr className="bg-slate-50 border-b border-slate-200/80">
                  <td className="sticky left-0 bg-slate-100 font-bold text-slate-500 text-[10px] uppercase px-4 py-2 border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.03)] z-25 w-[180px] shrink-0">
                    Day Notes & Staffing
                  </td>
                  {visibleDates.map((date) => {
                    const day = getDaySchedule(date);
                    return (
                      <td key={date} className={`px-2 py-1.5 border-r border-slate-150 ${day.closed ? "bg-slate-200/40 text-slate-400" : ""}`}>
                        <textarea
                          rows={2}
                          className="w-full bg-white/80 border border-slate-200 rounded-lg p-1 text-[11px] font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-slate-800 resize-none leading-tight"
                          placeholder="Holidays, arrivals, notes..."
                          value={day.notes || ""}
                          disabled={!!day.closed}
                          onChange={(e) => {
                            updateDaySchedule(date, { ...day, notes: e.target.value });
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                
                {/* --- DEPARTMENT: 1. COOKING --- */}
                {/* ======================================= */}
                <tr className={`${getDeptColor(settings.departmentColors.cooking, 'bg')} border-b ${getDeptColor(settings.departmentColors.cooking, 'border')}`}>
                  <td
                    className={`sticky left-0 ${getDeptColor(settings.departmentColors.cooking, 'bg')} backdrop-blur-xs font-black text-slate-800 text-[11px] uppercase tracking-wider px-4 py-3 border-r ${getDeptColor(settings.departmentColors.cooking, 'border')} shadow-[2px_0_5px_rgba(0,0,0,0.03)] cursor-pointer z-25 ${getDeptColor(settings.departmentColors.cooking, 'hover')} transition-colors`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5" onClick={() => toggleGroup("cooking")}>
                        {collapsed.cooking ? <ChevronRight className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                        <span>1. Cooking</span>
                      </div>
                      <select
                        className={`bg-white border ${getDeptColor(settings.departmentColors.cooking, 'border')} rounded px-1 py-0.5 text-[9px] font-bold text-slate-700 focus:outline-none focus:ring-1 ${getDeptColor(settings.departmentColors.cooking, 'ring')} cursor-pointer`}
                        value={cookingUnitId}
                        onChange={(e) => onUpdateCookingUnit(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {settings.customUnits.map((u) => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                  {visibleDates.map((date) => {
                    const day = getDaySchedule(date);
                    const bigSum = day.closed ? 0 : day.cookingBig.reduce((sum, e) => sum + (e.rounds || 0) * settings.cookingBigLbsPerRound, 0);
                    const smallSum = day.closed ? 0 : day.cookingSmall.reduce((sum, e) => sum + (e.rounds || 0) * settings.cookingSmallLbsPerRound, 0);
                    const totalSumConverted = convertValue(bigSum + smallSum, cookingUnitId, settings);
                    
                    return (
                      <td key={date} className={`px-3 py-3 border-r border-slate-150 text-right font-black text-xs text-slate-700 bg-slate-50/50 ${day.closed ? "bg-slate-200/40 text-slate-400" : ""}`}>
                        Sched: {totalSumConverted.toLocaleString(undefined, { maximumFractionDigits: 1 })} {getUnitLabel(cookingUnitId, settings)}
                      </td>
                    );
                  })}
                </tr>

                {!collapsed.cooking && (
                  <>
                    {/* Big Mixer Slots */}
                    {Array(settings.cookingBigSlots || 1).fill(null).map((_, slotIdx) => (
                      <tr key={`cooking-big-${slotIdx}`} className="hover:bg-slate-50/40 border-b border-slate-100 transition-all">
                        <td className="sticky left-0 bg-white z-20 px-4 py-2 border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.03)] w-[180px] shrink-0 text-left">
                          <div className="flex flex-col text-left space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800 text-[11px]">Big Mixer</span>
                              <span className="text-[9px] text-slate-400 uppercase font-extrabold">Slot {slotIdx + 1}</span>
                            </div>
                            {slotIdx === 0 && (
                              <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-slate-100">
                                <span className="text-[9px] text-slate-500 font-extrabold uppercase">Slots:</span>
                                <input
                                  type="number"
                                  min="1"
                                  max="10"
                                  className="w-12 bg-slate-50 border border-slate-200 rounded text-center text-[10px] font-bold text-slate-700 py-0.5 focus:outline-none focus:border-slate-800"
                                  value={settings.cookingBigSlots || 1}
                                  onChange={(e) => {
                                    const val = Math.max(1, Number(e.target.value) || 1);
                                    if (onUpdateSettings) {
                                      onUpdateSettings({ ...settings, cookingBigSlots: val });
                                    }
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                        {visibleDates.map((date) => {
                          const day = getDaySchedule(date);
                          const entry = day.cookingBig[slotIdx] || { flavor: "", rounds: 0, shift: "AM" };
                          const isClosed = !!day.closed;

                          return (
                            <td key={date} className={`px-3 py-1.5 border-r border-slate-150 text-xs ${isClosed ? "bg-slate-200/10" : ""}`}>
                              <div className="flex flex-col gap-1 bg-slate-50 border border-slate-200/80 rounded-lg p-1.5 shadow-xs">
                                <div className="flex gap-1.5 items-center">
                                  <select
                                    disabled={isClosed}
                                    className="flex-1 bg-white border border-slate-200 py-1 px-1.5 text-[11px] text-slate-700 font-semibold rounded focus:ring-0 focus:outline-none cursor-pointer"
                                    value={entry.flavor}
                                    onChange={(e) => {
                                      const updated = [...day.cookingBig];
                                      while (updated.length <= slotIdx) {
                                        updated.push({ flavor: "", rounds: 0, shift: "AM" });
                                      }
                                      updated[slotIdx] = { ...entry, flavor: e.target.value };
                                      updateDaySchedule(date, { ...day, cookingBig: updated });
                                    }}
                                  >
                                    <option value="">-- No Flavor --</option>
                                    {settings.flavors.map((f) => (
                                      <option key={f} value={f}>{f}</option>
                                    ))}
                                  </select>
                                  <div className="relative w-14 shrink-0">
                                    <FormulaInput
                                      disabled={isClosed}
                                      placeholder="Rds"
                                      className="w-full bg-white border border-slate-200 rounded py-1 pl-1 pr-3 text-center text-[11px] font-bold text-slate-800 focus:outline-none focus:border-slate-800"
                                      value={entry.rounds}
                                      onChange={(val) => {
                                        const updated = [...day.cookingBig];
                                        while (updated.length <= slotIdx) {
                                          updated.push({ flavor: "", rounds: 0, shift: "AM" });
                                        }
                                        updated[slotIdx] = { ...entry, rounds: val };
                                        updateDaySchedule(date, { ...day, cookingBig: updated });
                                      }}
                                    />
                                    <span className="absolute right-0.5 top-1.5 text-[7px] text-slate-400 font-extrabold uppercase pointer-events-none">rd</span>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between pt-1">
                                  {/* Shift toggle for this slot */}
                                  <div className="flex rounded border border-slate-200 overflow-hidden text-[9px] font-black">
                                    {["AM", "PM", "2nd"].map((sh) => (
                                      <button
                                        key={sh}
                                        disabled={isClosed}
                                        onClick={() => {
                                          const updated = [...day.cookingBig];
                                          while (updated.length <= slotIdx) {
                                            updated.push({ flavor: "", rounds: 0, shift: "AM" });
                                          }
                                          updated[slotIdx] = { ...entry, shift: sh as any };
                                          updateDaySchedule(date, { ...day, cookingBig: updated });
                                        }}
                                        className={`px-1.5 py-0.5 ${entry.shift === sh ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:text-slate-800"}`}
                                      >
                                        {sh}
                                      </button>
                                    ))}
                                  </div>
                                  {/* Machine status badge (only on first row of machine, but we can put a global status selector) */}
                                  {slotIdx === 0 && renderMachineStatusBadge(date, "cookingBig")}
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    {/* Small Mixer Slots */}
                    {Array(settings.cookingSmallSlots || 1).fill(null).map((_, slotIdx) => (
                      <tr key={`cooking-small-${slotIdx}`} className="hover:bg-slate-50/40 border-b border-slate-100 transition-all">
                        <td className="sticky left-0 bg-white z-20 px-4 py-2 border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.03)] w-[180px] shrink-0 text-left">
                          <div className="flex flex-col text-left space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800 text-[11px]">Small Mixer</span>
                              <span className="text-[9px] text-slate-400 uppercase font-extrabold">Slot {slotIdx + 1}</span>
                            </div>
                            {slotIdx === 0 && (
                              <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-slate-100">
                                <span className="text-[9px] text-slate-500 font-extrabold uppercase">Slots:</span>
                                <input
                                  type="number"
                                  min="1"
                                  max="10"
                                  className="w-12 bg-slate-50 border border-slate-200 rounded text-center text-[10px] font-bold text-slate-700 py-0.5 focus:outline-none focus:border-slate-800"
                                  value={settings.cookingSmallSlots || 1}
                                  onChange={(e) => {
                                    const val = Math.max(1, Number(e.target.value) || 1);
                                    if (onUpdateSettings) {
                                      onUpdateSettings({ ...settings, cookingSmallSlots: val });
                                    }
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                        {visibleDates.map((date) => {
                          const day = getDaySchedule(date);
                          const entry = day.cookingSmall[slotIdx] || { flavor: "", rounds: 0, shift: "AM" };
                          const isClosed = !!day.closed;

                          return (
                            <td key={date} className={`px-3 py-1.5 border-r border-slate-150 text-xs ${isClosed ? "bg-slate-200/10" : ""}`}>
                              <div className="flex flex-col gap-1 bg-slate-50 border border-slate-200/80 rounded-lg p-1.5 shadow-xs">
                                <div className="flex gap-1.5 items-center">
                                  <select
                                    disabled={isClosed}
                                    className="flex-1 bg-white border border-slate-200 py-1 px-1.5 text-[11px] text-slate-700 font-semibold rounded focus:ring-0 focus:outline-none cursor-pointer"
                                    value={entry.flavor}
                                    onChange={(e) => {
                                      const updated = [...day.cookingSmall];
                                      while (updated.length <= slotIdx) {
                                        updated.push({ flavor: "", rounds: 0, shift: "AM" });
                                      }
                                      updated[slotIdx] = { ...entry, flavor: e.target.value };
                                      updateDaySchedule(date, { ...day, cookingSmall: updated });
                                    }}
                                  >
                                    <option value="">-- No Flavor --</option>
                                    {settings.flavors.map((f) => (
                                      <option key={f} value={f}>{f}</option>
                                    ))}
                                  </select>
                                  <div className="relative w-14 shrink-0">
                                    <FormulaInput
                                      disabled={isClosed}
                                      placeholder="Rds"
                                      className="w-full bg-white border border-slate-200 rounded py-1 pl-1 pr-3 text-center text-[11px] font-bold text-slate-800 focus:outline-none focus:border-slate-800"
                                      value={entry.rounds}
                                      onChange={(val) => {
                                        const updated = [...day.cookingSmall];
                                        while (updated.length <= slotIdx) {
                                          updated.push({ flavor: "", rounds: 0, shift: "AM" });
                                        }
                                        updated[slotIdx] = { ...entry, rounds: val };
                                        updateDaySchedule(date, { ...day, cookingSmall: updated });
                                      }}
                                    />
                                    <span className="absolute right-0.5 top-1.5 text-[7px] text-slate-400 font-extrabold uppercase pointer-events-none">rd</span>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between pt-1">
                                  {/* Shift toggle for this slot */}
                                  <div className="flex rounded border border-slate-200 overflow-hidden text-[9px] font-black">
                                    {["AM", "PM", "2nd"].map((sh) => (
                                      <button
                                        key={sh}
                                        disabled={isClosed}
                                        onClick={() => {
                                          const updated = [...day.cookingSmall];
                                          while (updated.length <= slotIdx) {
                                            updated.push({ flavor: "", rounds: 0, shift: "AM" });
                                          }
                                          updated[slotIdx] = { ...entry, shift: sh as any };
                                          updateDaySchedule(date, { ...day, cookingSmall: updated });
                                        }}
                                        className={`px-1.5 py-0.5 ${entry.shift === sh ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:text-slate-800"}`}
                                      >
                                        {sh}
                                      </button>
                                    ))}
                                  </div>
                                  {/* Machine status badge */}
                                  {slotIdx === 0 && renderMachineStatusBadge(date, "cookingSmall")}
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                )}

                {/* --- DEPARTMENT: 2. EXTRUDING (LINES 1-3) --- */}
                {/* ======================================= */}
                <tr className={`${getDeptColor(settings.departmentColors.extruding, 'bg')} border-b ${getDeptColor(settings.departmentColors.extruding, 'border')}`}>
                  <td
                    className={`sticky left-0 ${getDeptColor(settings.departmentColors.extruding, 'bg')} backdrop-blur-xs font-black text-slate-800 text-[11px] uppercase tracking-wider px-4 py-3 border-r ${getDeptColor(settings.departmentColors.extruding, 'border')} shadow-[2px_0_5px_rgba(0,0,0,0.03)] cursor-pointer z-25 ${getDeptColor(settings.departmentColors.extruding, 'hover')} transition-colors`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5" onClick={() => toggleGroup("extruding")}>
                        {collapsed.extruding ? <ChevronRight className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                        <span>2. Extruding</span>
                      </div>
                      <select
                        className={`bg-white border ${getDeptColor(settings.departmentColors.extruding, 'border')} rounded px-1 py-0.5 text-[9px] font-bold text-slate-700 focus:outline-none focus:ring-1 ${getDeptColor(settings.departmentColors.extruding, 'ring')} cursor-pointer`}
                        value={extrudingUnitId}
                        onChange={(e) => onUpdateExtrudingUnit(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {settings.customUnits.map((u) => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                  {visibleDates.map((date) => {
                    const day = getDaySchedule(date);
                    const daySummary = summaries?.find((s) => s.date === date);
                    const totalWip = day.closed ? 0 : (daySummary ? daySummary.departments.extruding.wipAvailable : 0);
                    const totalWipConverted = convertValue(totalWip, extrudingUnitId, settings);

                    const flavorAvailability = daySummary?.wipFlows
                      ? Object.entries(daySummary.wipFlows)
                          .filter(([_, flow]) => flow.openingExtruded > 0)
                          .map(([flavor, flow]) => ({ flavor, quantity: convertValue(flow.openingExtruded, extrudingUnitId, settings) }))
                      : [];

                    const scheduledFlavorBreakdown = daySummary?.wipFlows
                      ? Object.entries(daySummary.wipFlows)
                          .filter(([_, flow]) => flow.cookingOutput > 0)
                          .map(([flavor, flow]) => ({ flavor, quantity: convertValue(flow.cookingOutput, extrudingUnitId, settings) }))
                      : [];

                    return (
                      <td key={date} className={`px-3 py-3 border-r border-slate-150 text-right font-black text-xs text-slate-700 bg-slate-50/50 ${day.closed ? "bg-slate-200/40 text-slate-400" : ""}`}>
                        {day.closed ? "" : (
                          <div className="flex gap-4">
                            <WipSection
                              title="Avail"
                              total={totalWipConverted.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                              unit={getUnitLabel(extrudingUnitId, settings)}
                              flavorBreakdown={flavorAvailability}
                              colorClass="text-slate-500"
                            />
                            <div className="border-l border-slate-200 pl-4">
                               <WipSection
                                title="Sched"
                                total={convertValue(daySummary?.departments.cooking.scheduled || 0, extrudingUnitId, settings).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                unit={getUnitLabel(extrudingUnitId, settings)}
                                flavorBreakdown={scheduledFlavorBreakdown}
                                colorClass="text-orange-600"
                              />
                            </div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {!collapsed.extruding && (
                  <>
                    {/* Render Extruders ex1, ex2, ex3 */}
                    {["ex1", "ex2", "ex3"].map((exId) => {
                      const rate = exId === "ex1" ? settings.ex1LbsPerHour : exId === "ex2" ? settings.ex2LbsPerHour : settings.ex3LbsPerHour;
                      const label = exId.toUpperCase();
                      const slotsCount = (settings as any)[`${exId}Slots`] || 1;
                      
                      return Array(slotsCount).fill(null).map((_, slotIdx) => (
                        <tr key={`${exId}-${slotIdx}`} className="hover:bg-slate-50/40 border-b border-slate-100 transition-all">
                          <td className="sticky left-0 bg-white z-20 px-4 py-2 border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.03)] w-[180px] shrink-0 text-left">
                            <div className="flex flex-col space-y-1">
                              <span className="font-bold text-slate-800 text-[11px]">Extruder {label}</span>
                              <span className="text-[9px] text-slate-400 uppercase font-extrabold">Slot {slotIdx + 1} ({rate} lb/h)</span>
                              {slotIdx === 0 && (
                                <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-slate-100">
                                  <span className="text-[9px] text-slate-500 font-extrabold uppercase">Slots:</span>
                                  <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    className="w-12 bg-slate-50 border border-slate-200 rounded text-center text-[10px] font-bold text-slate-700 py-0.5 focus:outline-none focus:border-slate-800"
                                    value={slotsCount}
                                    onChange={(e) => {
                                      const val = Math.max(1, Number(e.target.value) || 1);
                                      if (onUpdateSettings) {
                                        onUpdateSettings({ ...settings, [`${exId}Slots`]: val });
                                      }
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                          {visibleDates.map((date) => {
                            const day = getDaySchedule(date);
                            const entries = (day as any)[exId] as ExtrudingEntry[];
                            const entry = entries[slotIdx] || { flavor: "", hours: 0, shift: "AM" };
                            const isClosed = !!day.closed;

                            return (
                              <td key={date} className={`px-3 py-1.5 border-r border-slate-150 text-xs ${isClosed ? "bg-slate-200/10" : ""}`}>
                                <div className="flex flex-col gap-1 bg-slate-50 border border-slate-200/80 rounded-lg p-1.5 shadow-xs">
                                  <div className="flex gap-1.5 items-center">
                                    <select
                                      disabled={isClosed}
                                      className="flex-1 bg-white border border-slate-200 py-1 px-1.5 text-[11px] text-slate-700 font-semibold rounded focus:ring-0 focus:outline-none cursor-pointer"
                                      value={entry.flavor}
                                      onChange={(e) => {
                                        const updated = [...entries];
                                        while (updated.length <= slotIdx) {
                                          updated.push({ flavor: "", hours: 0, shift: "AM" });
                                        }
                                        updated[slotIdx] = { ...entry, flavor: e.target.value };
                                        updateDaySchedule(date, { ...day, [exId]: updated });
                                      }}
                                    >
                                      <option value="">-- No Flavor --</option>
                                      {settings.flavors.map((f) => (
                                        <option key={f} value={f}>{f}</option>
                                      ))}
                                    </select>
                                    <div className="relative w-14 shrink-0">
                                      <FormulaInput
                                        disabled={isClosed}
                                        placeholder="Hrs"
                                        className="w-full bg-white border border-slate-200 rounded py-1 pl-1 pr-3 text-center text-[11px] font-bold text-slate-800 focus:outline-none"
                                        value={entry.hours}
                                        onChange={(val) => {
                                          const updated = [...entries];
                                          while (updated.length <= slotIdx) {
                                            updated.push({ flavor: "", hours: 0, shift: "AM" });
                                          }
                                          updated[slotIdx] = { ...entry, hours: Math.min(24, val || 0) };
                                          updateDaySchedule(date, { ...day, [exId]: updated });
                                        }}
                                      />
                                      <span className="absolute right-0.5 top-1.5 text-[7px] text-slate-400 font-extrabold uppercase pointer-events-none">h</span>
                                    </div>
                                  </div>

                                  {entry.flavor && (() => {
                                    const daySummary = summaries?.find((s) => s.date === date);
                                    const flow = daySummary?.wipFlows?.[entry.flavor];
                                    if (!flow) return null;

                                    const opCooked = convertValue(flow.openingCooked, extrudingUnitId, settings);
                                    const cookOut = convertValue(flow.cookingOutput, extrudingUnitId, settings);
                                    const flavorOutput = daySummary?.flavorOutputs?.[entry.flavor];
                                    const totalScheduledExtruding = flavorOutput ? convertValue(flavorOutput.extrudingScheduled, extrudingUnitId, settings) : 0;

                                    const unitLabel = getUnitLabel(extrudingUnitId, settings);
                                    const totalAvail = opCooked + cookOut;
                                    const isShortCritical = totalScheduledExtruding > totalAvail;
                                    const isShortStarting = totalScheduledExtruding > opCooked;

                                    return (
                                      <div className="mt-1 pt-1 border-t border-slate-100 text-[9px] text-slate-500 space-y-0.5">
                                        <div className="flex justify-between">
                                          <span>Opening WIP:</span>
                                          <span className="font-semibold text-slate-700">{opCooked.toFixed(1)} {unitLabel}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>Projected Cooked:</span>
                                          <span className="font-semibold text-emerald-600">+{cookOut.toFixed(1)} {unitLabel}</span>
                                        </div>
                                        {isShortCritical ? (
                                          <div className="bg-red-50 text-red-700 rounded px-1.5 py-0.5 font-bold flex items-center gap-1 mt-1">
                                            <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                                            <span>Short by {(totalScheduledExtruding - totalAvail).toFixed(1)} {unitLabel}!</span>
                                          </div>
                                        ) : isShortStarting ? (
                                          <div className="bg-amber-50 text-amber-800 rounded px-1.5 py-0.5 font-semibold flex items-center gap-1 mt-1">
                                            <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                                            <span>Needs same-day cooking</span>
                                          </div>
                                        ) : null}
                                      </div>
                                    );
                                  })()}

                                  <div className="flex items-center justify-between pt-1">
                                    {/* Shift toggle */}
                                    <div className="flex rounded border border-slate-200 overflow-hidden text-[9px] font-black">
                                      {["AM", "PM", "2nd"].map((sh) => (
                                        <button
                                          key={sh}
                                          disabled={isClosed}
                                          onClick={() => {
                                            const updated = [...entries];
                                            while (updated.length <= slotIdx) {
                                              updated.push({ flavor: "", hours: 0, shift: "AM" });
                                            }
                                            updated[slotIdx] = { ...entry, shift: sh as any };
                                            updateDaySchedule(date, { ...day, [exId]: updated });
                                          }}
                                          className={`px-1.5 py-0.5 ${entry.shift === sh ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:text-slate-800"}`}
                                        >
                                          {sh}
                                        </button>
                                      ))}
                                    </div>
                                    {slotIdx === 0 && renderMachineStatusBadge(date, exId)}
                                  </div>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ));
                    })}
                  </>
                )}

                {/* --- DEPARTMENT: 3. CUTTING --- */}
                {/* ======================================= */}
                <tr className={`${getDeptColor(settings.departmentColors.cutting, 'bg')} border-b ${getDeptColor(settings.departmentColors.cutting, 'border')}`}>
                  <td
                    className={`sticky left-0 ${getDeptColor(settings.departmentColors.cutting, 'bg')} backdrop-blur-xs font-black text-slate-800 text-[11px] uppercase tracking-wider px-4 py-3 border-r ${getDeptColor(settings.departmentColors.cutting, 'border')} shadow-[2px_0_5px_rgba(0,0,0,0.03)] cursor-pointer z-25 ${getDeptColor(settings.departmentColors.cutting, 'hover')} transition-colors`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5" onClick={() => toggleGroup("cutting")}>
                        {collapsed.cutting ? <ChevronRight className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                        <span>3. Cutting</span>
                      </div>
                      <select
                        className={`bg-white border ${getDeptColor(settings.departmentColors.cutting, 'border')} rounded px-1 py-0.5 text-[9px] font-bold text-slate-700 focus:outline-none focus:ring-1 ${getDeptColor(settings.departmentColors.cutting, 'ring')} cursor-pointer`}
                        value={cuttingUnitId}
                        onChange={(e) => onUpdateCuttingUnit(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {settings.customUnits.map((u) => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                  {visibleDates.map((date) => {
                    const day = getDaySchedule(date);
                    const totalCutters = day.closed ? 0 : day.cutting.reduce((sum, e) => sum + (e.cutters || 0), 0);
                    const daySummary = summaries?.find((s) => s.date === date);
                    const totalWip = day.closed ? 0 : (daySummary ? daySummary.departments.cutting.wipAvailable : 0);
                    const totalWipConverted = convertValue(totalWip, cuttingUnitId, settings);

                    const flavorAvailability = daySummary?.wipFlows
                      ? Object.entries(daySummary.wipFlows)
                          .filter(([_, flow]) => flow.openingCut > 0)
                          .map(([flavor, flow]) => ({ flavor, quantity: convertValue(flow.openingCut, cuttingUnitId, settings) }))
                      : [];

                    const scheduledFlavorBreakdown = daySummary?.wipFlows
                      ? Object.entries(daySummary.wipFlows)
                          .filter(([_, flow]) => flow.extrudingOutput > 0)
                          .map(([flavor, flow]) => ({ flavor, quantity: convertValue(flow.extrudingOutput, cuttingUnitId, settings) }))
                      : [];

                    return (
                      <td key={date} className={`px-3 py-3 border-r border-slate-150 text-right font-black text-xs text-slate-700 bg-slate-50/50 ${day.closed ? "bg-slate-200/40 text-slate-400" : ""}`}>
                        {day.closed ? "" : (
                          <div className="flex gap-4">
                            <WipSection
                              title="Avail"
                              total={`${totalWipConverted.toLocaleString(undefined, { maximumFractionDigits: 1 })} (${totalCutters} Cutters)`}
                              unit={getUnitLabel(cuttingUnitId, settings)}
                              flavorBreakdown={flavorAvailability}
                              colorClass="text-slate-500"
                            />
                            <div className="border-l border-slate-200 pl-4">
                               <WipSection
                                title="Sched"
                                total={convertValue(daySummary?.departments.extruding.scheduled || 0, cuttingUnitId, settings).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                unit={getUnitLabel(cuttingUnitId, settings)}
                                flavorBreakdown={scheduledFlavorBreakdown}
                                colorClass="text-orange-600"
                              />
                            </div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {!collapsed.cutting && (
                  <tr className="hover:bg-slate-50/20">
                    <td className="sticky left-0 bg-white z-20 px-4 py-3 border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.03)] w-[180px] shrink-0 text-left">
                      <div className="flex flex-col space-y-1">
                        <span className="font-bold text-slate-800 text-[11px]">Cutting Tables</span>
                        <span className="text-[9px] text-slate-400 uppercase font-extrabold">Flavor × Count</span>
                        <span className="text-[9px] text-slate-500 font-semibold leading-tight bg-slate-50 p-1 border rounded-md">
                          Rate: {settings.cuttingLbsPerHourPerPerson} lb/h/person
                        </span>
                      </div>
                    </td>
                    {visibleDates.map((date) => {
                      const day = getDaySchedule(date);
                      const isClosed = !!day.closed;

                      // Headcount checks per shift
                      const amCutters = day.cutting.filter(c => c.shift === "AM").reduce((sum, c) => sum + (c.cutters || 0), 0);
                      const pmCutters = day.cutting.filter(c => c.shift === "PM").reduce((sum, c) => sum + (c.cutters || 0), 0);
                      const warningAM = amCutters > settings.cuttersHeadcountAM;
                      const warningPM = pmCutters > settings.cuttersHeadcountPM;

                      return (
                        <td key={date} className={`px-3 py-2 border-r border-slate-150 text-xs align-top ${isClosed ? "bg-slate-200/10" : ""}`}>
                          <div className="space-y-2">
                            {/* Headcount Warnings */}
                            {!isClosed && (warningAM || warningPM) && (
                              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-900 rounded-lg p-2 space-y-0.5 text-[10px] font-bold">
                                {warningAM && (
                                  <div className="flex items-center gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    <span>AM Cutters ({amCutters}) exceeds roster headcount limit ({settings.cuttersHeadcountAM})!</span>
                                  </div>
                                )}
                                {warningPM && (
                                  <div className="flex items-center gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    <span>PM Cutters ({pmCutters}) exceeds roster headcount limit ({settings.cuttersHeadcountPM})!</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Render Table status selector */}
                            <div className="flex items-center justify-between bg-slate-100 p-1 rounded-md border text-[10px] font-bold">
                              <span>Table Status:</span>
                              {renderMachineStatusBadge(date, "cutting")}
                            </div>

                            {/* Cutting Entry List */}
                            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                              {day.cutting.map((entry, idx) => {
                                return (
                                  <div key={idx} className="bg-white/80 border rounded-lg p-1.5 space-y-1 shadow-xs">
                                    <div className="flex items-center gap-1">
                                      <select
                                        disabled={isClosed}
                                        className="flex-1 bg-slate-50 border border-slate-200 py-0.5 px-1 text-[10px] text-slate-700 font-bold rounded cursor-pointer"
                                        value={entry.flavor}
                                        onChange={(e) => {
                                          const updated = [...day.cutting];
                                          updated[idx] = { ...entry, flavor: e.target.value };
                                          updateDaySchedule(date, { ...day, cutting: updated });
                                        }}
                                      >
                                        <option value="">-- Flavor --</option>
                                        {settings.flavors.map(f => (
                                          <option key={f} value={f}>{f}</option>
                                        ))}
                                      </select>
                                      
                                      <FormulaInput
                                        disabled={isClosed}
                                        placeholder="Ppl"
                                        className="w-10 bg-slate-50 border border-slate-200 rounded py-0.5 text-center text-[10px] font-extrabold text-slate-800"
                                        value={entry.cutters}
                                        onChange={(val) => {
                                          const updated = [...day.cutting];
                                          updated[idx] = { ...entry, cutters: val };
                                          updateDaySchedule(date, { ...day, cutting: updated });
                                        }}
                                      />

                                      <button
                                        disabled={isClosed}
                                        onClick={() => {
                                          const updated = day.cutting.filter((_, i) => i !== idx);
                                          updateDaySchedule(date, { ...day, cutting: updated });
                                        }}
                                        className="text-red-500 hover:text-red-700 disabled:opacity-45"
                                      >
                                        <Trash className="w-3.5 h-3.5" />
                                      </button>
                                    </div>

                                    {entry.flavor && (() => {
                                      const daySummary = summaries?.find((s) => s.date === date);
                                      const flow = daySummary?.wipFlows?.[entry.flavor];
                                      if (!flow) return null;

                                      const opExtruded = convertValue(flow.openingExtruded, cuttingUnitId, settings);
                                      const extOut = convertValue(flow.extrudingOutput, cuttingUnitId, settings);
                                      const flavorOutput = daySummary?.flavorOutputs?.[entry.flavor];
                                      const totalScheduledCutting = flavorOutput ? convertValue(flavorOutput.cuttingScheduled, cuttingUnitId, settings) : 0;

                                      const unitLabel = getUnitLabel(cuttingUnitId, settings);
                                      const totalAvail = opExtruded + extOut;
                                      const isShortCritical = totalScheduledCutting > totalAvail;
                                      const isShortStarting = totalScheduledCutting > opExtruded;

                                      return (
                                        <div className="mt-1 pt-1 border-t border-slate-100 text-[9px] text-slate-500 space-y-0.5">
                                          <div className="flex justify-between">
                                            <span>Opening WIP:</span>
                                            <span className="font-semibold text-slate-700">{opExtruded.toFixed(1)} {unitLabel}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span>Projected Extruded:</span>
                                            <span className="font-semibold text-emerald-600">+{extOut.toFixed(1)} {unitLabel}</span>
                                          </div>
                                          {isShortCritical ? (
                                            <div className="bg-red-50 text-red-700 rounded px-1.5 py-0.5 font-bold flex items-center gap-1 mt-1">
                                              <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                                              <span>Short by {(totalScheduledCutting - totalAvail).toFixed(1)} {unitLabel}!</span>
                                            </div>
                                          ) : isShortStarting ? (
                                            <div className="bg-amber-50 text-amber-800 rounded px-1.5 py-0.5 font-semibold flex items-center gap-1 mt-1">
                                              <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                                              <span>Needs same-day extruding</span>
                                            </div>
                                          ) : null}
                                        </div>
                                      );
                                    })()}

                                    {/* Shift Selection and optional worker names tag */}
                                    <div className="flex items-center justify-between pt-0.5">
                                      <div className="flex rounded border border-slate-200 overflow-hidden text-[8px] font-bold">
                                        {["AM", "PM", "2nd"].map(sh => (
                                          <button
                                            key={sh}
                                            disabled={isClosed}
                                            onClick={() => {
                                              const updated = [...day.cutting];
                                              updated[idx] = { ...entry, shift: sh as any };
                                              updateDaySchedule(date, { ...day, cutting: updated });
                                            }}
                                            className={`px-1 py-0.25 ${entry.shift === sh ? "bg-slate-900 text-white" : "bg-white text-slate-500"}`}
                                          >
                                            {sh}
                                          </button>
                                        ))}
                                      </div>

                                      <div className="text-[9px] text-slate-400 font-semibold italic">
                                        Capacity: {((entry.cutters || 0) * settings.cuttingLbsPerHourPerPerson * settings.shiftHours).toLocaleString()} lbs
                                      </div>
                                    </div>
                                    
                                    {/* Multi select list for workers (Optional attachment) */}
                                    <div className="pt-1 flex flex-wrap gap-1 border-t border-slate-100">
                                      <span className="text-[8px] text-slate-400 font-extrabold uppercase shrink-0">Staff:</span>
                                      {settings.employees.map((emp) => {
                                        const assigned = entry.employees?.includes(emp);
                                        const isDup = isCutterEmployeeDuplicate(date, emp, idx);
                                        return (
                                          <button
                                            key={emp}
                                            disabled={isClosed}
                                            onClick={() => {
                                              const currentAssigned = entry.employees || [];
                                              const nextAssigned = currentAssigned.includes(emp)
                                                ? currentAssigned.filter(item => item !== emp)
                                                : [...currentAssigned, emp];
                                              const updated = [...day.cutting];
                                              updated[idx] = { ...entry, employees: nextAssigned };
                                              updateDaySchedule(date, { ...day, cutting: updated });
                                            }}
                                            className={`text-[8px] font-extrabold px-1 rounded-sm border ${
                                              assigned
                                                ? isDup
                                                  ? "bg-red-500/10 border-red-500/30 text-red-700 animate-pulse"
                                                  : "bg-slate-900 border-transparent text-white"
                                                : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                                            }`}
                                            title={isDup ? `${emp} is already working on another table!` : `Click to assign ${emp}`}
                                          >
                                            {emp}
                                          </button>
                                        );
                                      })}
                                    </div>

                                  </div>
                                );
                              })}
                            </div>

                            {/* Add button */}
                            {!isClosed && (
                              <button
                                onClick={() => {
                                  const updated = [...day.cutting, { flavor: "", cutters: 1, shift: "AM" as const, employees: [] }];
                                  updateDaySchedule(date, { ...day, cutting: updated });
                                }}
                                className="w-full flex items-center justify-center gap-1.5 py-1 bg-white hover:bg-slate-50 border border-dashed border-slate-300 text-slate-600 font-black text-[10px] uppercase rounded-lg cursor-pointer hover:shadow-xs transition-all"
                              >
                                <Plus className="w-3.5 h-3.5 text-slate-400" /> Add Cutting Line
                              </button>
                            )}

                          </div>
                        </td>
                      );
                    })}
                  </tr>
                )}

                {/* --- DEPARTMENT: 4. PACKING --- */}
                {/* ======================================= */}
                <tr className={`${getDeptColor(settings.departmentColors.packing, 'bg')} border-b ${getDeptColor(settings.departmentColors.packing, 'border')}`}>
                  <td
                    className={`sticky left-0 ${getDeptColor(settings.departmentColors.packing, 'bg')} backdrop-blur-xs font-black text-slate-800 text-[11px] uppercase tracking-wider px-4 py-3 border-r ${getDeptColor(settings.departmentColors.packing, 'border')} shadow-[2px_0_5px_rgba(0,0,0,0.03)] cursor-pointer z-25 ${getDeptColor(settings.departmentColors.packing, 'hover')} transition-colors`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5" onClick={() => toggleGroup("packing")}>
                        {collapsed.packing ? <ChevronRight className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                        <span>4. Packing</span>
                      </div>
                      <select
                        className={`bg-white border ${getDeptColor(settings.departmentColors.packing, 'border')} rounded px-1 py-0.5 text-[9px] font-bold text-slate-700 focus:outline-none focus:ring-1 ${getDeptColor(settings.departmentColors.packing, 'ring')} cursor-pointer`}
                        value={packingUnitId}
                        onChange={(e) => onUpdatePackingUnit(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {settings.customUnits.map((u) => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                  {visibleDates.map((date) => {
                    const day = getDaySchedule(date);
                    const totalPackers = day.closed ? 0 : day.packing.reduce((sum, e) => sum + (e.packers || 0), 0);
                    const daySummary = summaries?.find((s) => s.date === date);
                    const totalWip = day.closed ? 0 : (daySummary ? daySummary.departments.packing.wipAvailable : 0);
                    const totalWipConverted = convertValue(totalWip, packingUnitId, settings);

                    const flavorAvailability = daySummary?.wipFlows
                      ? Object.entries(daySummary.wipFlows)
                          .filter(([_, flow]) => flow.openingCut > 0)
                          .map(([flavor, flow]) => ({ flavor, quantity: convertValue(flow.openingCut, packingUnitId, settings) }))
                      : [];

                    const scheduledFlavorBreakdown = daySummary?.wipFlows
                      ? Object.entries(daySummary.wipFlows)
                          .filter(([_, flow]) => flow.cuttingOutput > 0)
                          .map(([flavor, flow]) => ({ flavor, quantity: convertValue(flow.cuttingOutput, packingUnitId, settings) }))
                      : [];

                    return (
                      <td key={date} className={`px-3 py-3 border-r border-slate-150 text-right font-black text-xs text-slate-700 bg-slate-50/50 ${day.closed ? "bg-slate-200/40 text-slate-400" : ""}`}>
                        {day.closed ? "" : (
                          <div className="flex gap-4">
                            <WipSection
                              title="Avail"
                              total={`${totalWipConverted.toLocaleString(undefined, { maximumFractionDigits: 1 })} (${totalPackers} Packers)`}
                              unit={getUnitLabel(packingUnitId, settings)}
                              flavorBreakdown={flavorAvailability}
                              colorClass="text-slate-500"
                            />
                            <div className="border-l border-slate-200 pl-4">
                               <WipSection
                                title="Sched"
                                total={convertValue(daySummary?.departments.cutting.scheduled || 0, packingUnitId, settings).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                unit={getUnitLabel(packingUnitId, settings)}
                                flavorBreakdown={scheduledFlavorBreakdown}
                                colorClass="text-orange-600"
                              />
                            </div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {!collapsed.packing && (
                  <tr className="hover:bg-slate-50/20">
                    <td className="sticky left-0 bg-white z-20 px-4 py-3 border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.03)] w-[180px] shrink-0 text-left">
                      <div className="flex flex-col space-y-1">
                        <span className="font-bold text-slate-800 text-[11px]">Packing Lines</span>
                        <span className="text-[9px] text-slate-400 uppercase font-extrabold">Flavor, Pack Size × Target</span>
                        <span className="text-[9px] text-slate-500 font-semibold bg-slate-50 p-1 border rounded-md">
                          Total Packers: {settings.packersHeadcount}
                        </span>
                      </div>
                    </td>
                    {visibleDates.map((date) => {
                      const day = getDaySchedule(date);
                      const isClosed = !!day.closed;

                      // Headcount warning
                      const currentPackers = day.packing.reduce((sum, p) => sum + (p.packers || 0), 0);
                      const warningPackers = currentPackers > settings.packersHeadcount;

                      return (
                        <td key={date} className={`px-3 py-2 border-r border-slate-150 text-xs align-top ${isClosed ? "bg-slate-200/10" : ""}`}>
                          <div className="space-y-2">
                            {/* Headcount Warnings */}
                            {!isClosed && warningPackers && (
                              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-900 rounded-lg p-2 flex items-center gap-1 text-[10px] font-bold">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>AM Packers ({currentPackers}) exceeds roster headcount limit ({settings.packersHeadcount})!</span>
                              </div>
                            )}

                            {/* Machine status selection */}
                            <div className="flex items-center justify-between bg-slate-100 p-1 rounded-md border text-[10px] font-bold">
                              <span>Packing Line Status:</span>
                              {renderMachineStatusBadge(date, "packing")}
                            </div>

                            {/* Packing Entry List */}
                            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                              {day.packing.map((entry, idx) => {
                                const packSize = settings.packSizes.find(p => p.id === entry.packSizeId);
                                const comboError = getPackComboError(entry.flavor, entry.packSizeId);
                                
                                // Calculation details
                                let capacityMc = 0;
                                let expectedMc = 0;
                                if (packSize && entry.packers > 0) {
                                  capacityMc = entry.packers * packSize.mcPerHour * settings.shiftHours;
                                  expectedMc = entry.mcTarget !== undefined && entry.mcTarget > 0
                                    ? Math.min(entry.mcTarget, capacityMc)
                                    : capacityMc;
                                }

                                return (
                                  <div key={idx} className={`border rounded-lg p-1.5 space-y-1.5 shadow-xs ${
                                    comboError ? "bg-red-500/5 border-red-500/20" : "bg-white/80"
                                  }`}>
                                    
                                    <div className="flex items-center gap-1.5">
                                      <select
                                        disabled={isClosed}
                                        className="w-1/2 bg-slate-50 border border-slate-200 py-0.5 px-1 text-[10px] text-slate-700 font-bold rounded cursor-pointer"
                                        value={entry.flavor}
                                        onChange={(e) => {
                                          const updated = [...day.packing];
                                          updated[idx] = { ...entry, flavor: e.target.value };
                                          updateDaySchedule(date, { ...day, packing: updated });
                                        }}
                                      >
                                        <option value="">-- Flavor --</option>
                                        {settings.flavors.map(f => (
                                          <option key={f} value={f}>{f}</option>
                                        ))}
                                      </select>
                                      
                                      <select
                                        disabled={isClosed}
                                        className="w-1/2 bg-slate-50 border border-slate-200 py-0.5 px-1 text-[10px] text-slate-700 font-bold rounded cursor-pointer"
                                        value={entry.packSizeId}
                                        onChange={(e) => {
                                          const updated = [...day.packing];
                                          updated[idx] = { ...entry, packSizeId: e.target.value };
                                          updateDaySchedule(date, { ...day, packing: updated });
                                        }}
                                      >
                                        <option value="">-- Size --</option>
                                        {settings.packSizes.map(p => (
                                          <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                      </select>
                                      
                                      <button
                                        disabled={isClosed}
                                        onClick={() => {
                                          const updated = day.packing.filter((_, i) => i !== idx);
                                          updateDaySchedule(date, { ...day, packing: updated });
                                        }}
                                        className="text-red-500 hover:text-red-700 disabled:opacity-45"
                                      >
                                        <Trash className="w-3.5 h-3.5" />
                                      </button>
                                    </div>

                                    {entry.flavor && (() => {
                                      const daySummary = summaries?.find((s) => s.date === date);
                                      const flow = daySummary?.wipFlows?.[entry.flavor];
                                      if (!flow) return null;

                                      const opCut = convertValue(flow.openingCut, packingUnitId, settings);
                                      const cutOut = convertValue(flow.cuttingOutput, packingUnitId, settings);
                                      const flavorOutput = daySummary?.flavorOutputs?.[entry.flavor];
                                      const totalScheduledPacking = flavorOutput ? convertValue(flavorOutput.packingScheduled, packingUnitId, settings) : 0;

                                      const unitLabel = getUnitLabel(packingUnitId, settings);
                                      const totalAvail = opCut + cutOut;
                                      const isShortCritical = totalScheduledPacking > totalAvail;
                                      const isShortStarting = totalScheduledPacking > opCut;

                                      return (
                                        <div className="mt-1 pt-1 border-t border-slate-100 text-[9px] text-slate-500 space-y-0.5">
                                          <div className="flex justify-between">
                                            <span>Opening WIP:</span>
                                            <span className="font-semibold text-slate-700">{opCut.toFixed(1)} {unitLabel}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span>Projected Cut/Sliced:</span>
                                            <span className="font-semibold text-emerald-600">+{cutOut.toFixed(1)} {unitLabel}</span>
                                          </div>
                                          {isShortCritical ? (
                                            <div className="bg-red-50 text-red-700 rounded px-1.5 py-0.5 font-bold flex items-center gap-1 mt-1">
                                              <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                                              <span>Short by {(totalScheduledPacking - totalAvail).toFixed(1)} {unitLabel}!</span>
                                            </div>
                                          ) : isShortStarting ? (
                                            <div className="bg-amber-50 text-amber-800 rounded px-1.5 py-0.5 font-semibold flex items-center gap-1 mt-1">
                                              <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                                              <span>Needs same-day cutting</span>
                                            </div>
                                          ) : null}
                                        </div>
                                      );
                                    })()}

                                    {comboError && (
                                      <div className="text-[8px] text-red-600 font-bold leading-tight">
                                        ⚠ {comboError}
                                      </div>
                                    )}

                                    {/* Packers assigned + optional targets & order PO tags */}
                                    <div className="grid grid-cols-3 gap-1">
                                      <div className="space-y-0.5">
                                        <label className="text-[7px] text-slate-400 font-extrabold uppercase">Packers</label>
                                        <FormulaInput
                                          disabled={isClosed}
                                          placeholder="Ppl"
                                          className="w-full bg-slate-50 border border-slate-200 rounded py-0.5 text-center text-[10px] font-extrabold text-slate-800"
                                          value={entry.packers}
                                          onChange={(val) => {
                                            const updated = [...day.packing];
                                            updated[idx] = { ...entry, packers: val };
                                            updateDaySchedule(date, { ...day, packing: updated });
                                          }}
                                        />
                                      </div>
                                      
                                      <div className="space-y-0.5 col-span-2">
                                        <label className="text-[7px] text-slate-400 font-extrabold uppercase block text-left">MC Target (Optional)</label>
                                        <FormulaInput
                                          disabled={isClosed}
                                          placeholder="Unlimited capacity"
                                          className="w-full bg-slate-50 border border-slate-200 rounded py-0.5 px-1 text-left text-[10px] font-bold text-slate-850"
                                          value={entry.mcTarget}
                                          onChange={(val) => {
                                            const updated = [...day.packing];
                                            updated[idx] = { ...entry, mcTarget: val === 0 ? undefined : val };
                                            updateDaySchedule(date, { ...day, packing: updated });
                                          }}
                                        />
                                      </div>
                                    </div>

                                    {/* Staff Assignment */}
                                    <div className="space-y-1">
                                      <label className="text-[7px] text-slate-400 font-extrabold uppercase block text-left">Staff</label>
                                      <div className="flex flex-wrap gap-1">
                                        {settings.employees.map((emp) => {
                                          const assigned = entry.employees?.includes(emp);
                                          const isDup = isPackingEmployeeDuplicate(date, emp, idx);
                                          return (
                                            <button
                                              key={emp}
                                              disabled={isClosed}
                                              onClick={() => {
                                                const currentAssigned = entry.employees || [];
                                                const nextAssigned = currentAssigned.includes(emp)
                                                  ? currentAssigned.filter(item => item !== emp)
                                                  : [...currentAssigned, emp];
                                                const updated = [...day.packing];
                                                updated[idx] = { ...entry, employees: nextAssigned };
                                                updateDaySchedule(date, { ...day, packing: updated });
                                              }}
                                              className={`text-[8px] font-extrabold px-1 rounded-sm border ${
                                                assigned
                                                  ? isDup
                                                    ? "bg-red-500/10 border-red-500/30 text-red-700 animate-pulse"
                                                    : "bg-slate-900 border-transparent text-white"
                                                  : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                                              }`}
                                              title={isDup ? `${emp} is already working on another line!` : `Click to assign ${emp}`}
                                            >
                                              {emp}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    <div className="space-y-0.5">
                                      <label className="text-[7px] text-slate-400 font-extrabold uppercase block text-left">Retail Order PO tag / Notes</label>
                                      <input
                                        type="text"
                                        disabled={isClosed}
                                        placeholder="e.g. Marshalls PO#337333"
                                        className="w-full bg-slate-50 border border-slate-200 rounded py-0.5 px-1.5 text-left text-[10px] font-semibold text-slate-700"
                                        value={entry.orderTag || ""}
                                        onChange={(e) => {
                                          const updated = [...day.packing];
                                          updated[idx] = { ...entry, orderTag: e.target.value };
                                          updateDaySchedule(date, { ...day, packing: updated });
                                        }}
                                      />
                                    </div>

                                    {/* Outputs Math Visibility */}
                                    {packSize && entry.packers > 0 && (
                                      <div className="bg-slate-50 border border-slate-100 rounded p-1 text-[9px] font-semibold text-slate-600 flex justify-between">
                                        <span>Cap: <strong className="text-slate-800">{capacityMc.toFixed(1)}</strong> MC</span>
                                        <span>Exp: <strong className="text-slate-800 font-black">{expectedMc.toFixed(1)}</strong> MC</span>
                                        <span>Lbs: <strong className="text-indigo-600">{(expectedMc * packSize.lbsPerMc).toLocaleString()}</strong> lbs</span>
                                      </div>
                                    )}

                                  </div>
                                );
                              })}
                            </div>

                            {/* Add Button */}
                            {!isClosed && (
                              <button
                                onClick={() => {
                                  const updated = [...day.packing, { flavor: "", packSizeId: "12pk", packers: 1 }];
                                  updateDaySchedule(date, { ...day, packing: updated });
                                }}
                                className="w-full flex items-center justify-center gap-1.5 py-1 bg-white hover:bg-slate-50 border border-dashed border-slate-300 text-slate-600 font-black text-[10px] uppercase rounded-lg cursor-pointer hover:shadow-xs transition-all"
                              >
                                <Plus className="w-3.5 h-3.5 text-slate-400" /> Add Packing Line
                              </button>
                            )}

                          </div>
                        </td>
                      );
                    })}
                  </tr>
                )}

                {/* --- DEPARTMENT: 5. FILLER --- */}
                {/* ======================================= */}
                <tr className={`${getDeptColor(settings.departmentColors.filler, 'bg')} border-b ${getDeptColor(settings.departmentColors.filler, 'border')}`}>
                  <td
                    className={`sticky left-0 ${getDeptColor(settings.departmentColors.filler, 'bg')} backdrop-blur-xs font-black text-slate-800 text-[11px] uppercase tracking-wider px-4 py-3 border-r ${getDeptColor(settings.departmentColors.filler, 'border')} shadow-[2px_0_5px_rgba(0,0,0,0.03)] cursor-pointer z-25 ${getDeptColor(settings.departmentColors.filler, 'hover')} transition-colors`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5" onClick={() => toggleGroup("filler")}>
                        {collapsed.filler ? <ChevronRight className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                        <span>5. Filler</span>
                      </div>
                      <select
                        className={`bg-white border ${getDeptColor(settings.departmentColors.filler, 'border')} rounded px-1 py-0.5 text-[9px] font-bold text-slate-700 focus:outline-none focus:ring-1 ${getDeptColor(settings.departmentColors.filler, 'ring')} cursor-pointer`}
                        value={fillerUnitId}
                        onChange={(e) => onUpdateFillerUnit(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {settings.customUnits.map((u) => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                  {visibleDates.map((date) => {
                    const day = getDaySchedule(date);
                    
                    let totalLbs = 0;
                    if (!day.closed) {
                      day.filler.forEach((entry) => {
                        if (entry.product) {
                          if (entry.rounds !== undefined && entry.rounds > 0) {
                            totalLbs += entry.rounds * settings.fillerLbsPerRound;
                          } else if (entry.mcTarget !== undefined && entry.mcTarget > 0) {
                            const ps = settings.packSizes.find(p => p.id === entry.size || p.name === entry.size);
                            if (ps) {
                              totalLbs += entry.mcTarget * ps.lbsPerMc;
                            }
                          }
                        }
                      });
                    }
                    const totalConverted = convertValue(totalLbs, fillerUnitId, settings);

                    return (
                      <td key={date} className={`px-3 py-3 border-r border-slate-150 text-right font-black text-xs text-slate-700 bg-slate-50/50 ${day.closed ? "bg-slate-200/40 text-slate-400" : ""}`}>
                        Sched: {totalConverted.toLocaleString(undefined, { maximumFractionDigits: 1 })} {getUnitLabel(fillerUnitId, settings)}
                      </td>
                    );
                  })}
                </tr>

                {!collapsed.filler && (
                  <tr className="hover:bg-slate-50/20">
                    <td className="sticky left-0 bg-white z-20 px-4 py-3 border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.03)] w-[180px] shrink-0 text-left">
                      <div className="flex flex-col space-y-1">
                        <span className="font-bold text-slate-800 text-[11px]">Filler Table</span>
                        <span className="text-[9px] text-slate-400 uppercase font-extrabold">Parallel Non-Gum line</span>
                        <span className="text-[9px] text-slate-500 font-semibold bg-slate-50 p-1 border rounded-md">
                          Operators: {settings.fillerOperatorsHeadcount}
                        </span>
                      </div>
                    </td>
                    {visibleDates.map((date) => {
                      const day = getDaySchedule(date);
                      const isClosed = !!day.closed;

                      return (
                        <td key={date} className={`px-3 py-2 border-r border-slate-150 text-xs align-top ${isClosed ? "bg-slate-200/10" : ""}`}>
                          <div className="space-y-2">
                            {/* Status selection */}
                            <div className="flex items-center justify-between bg-slate-100 p-1 rounded-md border text-[10px] font-bold">
                              <span>Filler Status:</span>
                              {renderMachineStatusBadge(date, "filler")}
                            </div>

                            {/* Filler dynamic lines */}
                            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                              {day.filler.map((entry, idx) => {
                                return (
                                  <div key={idx} className="bg-white/80 border rounded-lg p-1.5 space-y-1.5 shadow-xs">
                                    <div className="flex items-center gap-1.5">
                                      <select
                                        disabled={isClosed}
                                        className="w-1/2 bg-slate-50 border border-slate-200 py-0.5 px-1 text-[10px] text-slate-700 font-bold rounded cursor-pointer"
                                        value={entry.product}
                                        onChange={(e) => {
                                          const updated = [...day.filler];
                                          updated[idx] = { ...entry, product: e.target.value };
                                          updateDaySchedule(date, { ...day, filler: updated });
                                        }}
                                      >
                                        <option value="">-- Product --</option>
                                        {settings.fillerProducts.map(p => (
                                          <option key={p} value={p}>{p}</option>
                                        ))}
                                      </select>
                                      
                                      <select
                                        disabled={isClosed}
                                        className="w-1/2 bg-slate-50 border border-slate-200 py-0.5 px-1 text-[10px] text-slate-700 font-bold rounded cursor-pointer"
                                        value={entry.size}
                                        onChange={(e) => {
                                          const updated = [...day.filler];
                                          updated[idx] = { ...entry, size: e.target.value };
                                          updateDaySchedule(date, { ...day, filler: updated });
                                        }}
                                      >
                                        <option value="">-- Size --</option>
                                        {settings.fillerSizes.map(s => (
                                          <option key={s} value={s}>{s}</option>
                                        ))}
                                      </select>
                                      
                                      <button
                                        disabled={isClosed}
                                        onClick={() => {
                                          const updated = day.filler.filter((_, i) => i !== idx);
                                          updateDaySchedule(date, { ...day, filler: updated });
                                        }}
                                        className="text-red-500 hover:text-red-700 disabled:opacity-45"
                                      >
                                        <Trash className="w-3.5 h-3.5" />
                                      </button>
                                    </div>

                                    {/* Choice: rounds or MC Target */}
                                    <div className="grid grid-cols-2 gap-1.5">
                                      <div className="relative">
                                        <FormulaInput
                                          disabled={isClosed}
                                          placeholder="Rounds"
                                          className="w-full bg-slate-50 border border-slate-200 rounded py-0.5 pl-1.5 pr-4 text-[10px] font-bold text-slate-800"
                                          value={entry.rounds}
                                          onChange={(val) => {
                                            const updated = [...day.filler];
                                            updated[idx] = { ...entry, rounds: val === 0 ? undefined : val, mcTarget: val !== 0 ? undefined : entry.mcTarget };
                                            updateDaySchedule(date, { ...day, filler: updated });
                                          }}
                                        />
                                        <span className="absolute right-0.5 top-1 text-[7px] text-slate-400 font-extrabold uppercase">rd</span>
                                      </div>

                                      <div className="relative">
                                        <FormulaInput
                                          disabled={isClosed}
                                          placeholder="MC Target"
                                          className="w-full bg-slate-50 border border-slate-200 rounded py-0.5 pl-1.5 pr-4 text-[10px] font-bold text-slate-800"
                                          value={entry.mcTarget}
                                          onChange={(val) => {
                                            const updated = [...day.filler];
                                            updated[idx] = { ...entry, mcTarget: val === 0 ? undefined : val, rounds: val !== 0 ? undefined : entry.rounds };
                                            updateDaySchedule(date, { ...day, filler: updated });
                                          }}
                                        />
                                        <span className="absolute right-0.5 top-1 text-[7px] text-slate-400 font-extrabold uppercase">mc</span>
                                      </div>
                                    </div>

                                    {/* Calculated Output Display */}
                                    {entry.product && (
                                      <div className="text-[9px] text-slate-400 text-right font-semibold">
                                        Lbs output:{" "}
                                        {(() => {
                                          let lbs = 0;
                                          if (entry.rounds !== undefined) lbs = entry.rounds * settings.fillerLbsPerRound;
                                          else if (entry.mcTarget !== undefined) {
                                            const ps = settings.packSizes.find(p => p.id === entry.size || p.name === entry.size);
                                            if (ps) lbs = entry.mcTarget * ps.lbsPerMc;
                                          }
                                          return lbs.toLocaleString();
                                        })()}{" "}
                                        lbs
                                      </div>
                                    )}

                                  </div>
                                );
                              })}
                            </div>

                            {/* Add filler line button */}
                            {!isClosed && (
                              <button
                                onClick={() => {
                                  const updated = [...day.filler, { product: "Sour", size: "1.8 oz" }];
                                  updateDaySchedule(date, { ...day, filler: updated });
                                }}
                                className="w-full flex items-center justify-center gap-1.5 py-1 bg-white hover:bg-slate-50 border border-dashed border-slate-300 text-slate-600 font-black text-[10px] uppercase rounded-lg cursor-pointer hover:shadow-xs transition-all"
                              >
                                <Plus className="w-3.5 h-3.5 text-slate-400" /> Add Filler product
                              </button>
                            )}

                          </div>
                        </td>
                      );
                    })}
                  </tr>
                )}

                {/* ======================================= */}
                {/* --- STATION ROW: AMAZON TEAM (VISIBILITY) --- */}
                {/* ======================================= */}
                <tr className="bg-slate-150 border-b border-slate-200">
                  <td
                    className="sticky left-0 bg-slate-200/95 backdrop-blur-xs font-black text-slate-800 text-[11px] uppercase tracking-wider px-4 py-3 border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.03)] cursor-pointer z-25 hover:bg-slate-250 transition-colors"
                    onClick={() => toggleGroup("amazon")}
                  >
                    <div className="flex items-center gap-1.5">
                      {collapsed.amazon ? <ChevronRight className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
                      <span>6. Amazon Team ({settings.amazonHeadcount})</span>
                    </div>
                  </td>
                  {visibleDates.map((date) => {
                    const day = getDaySchedule(date);
                    return (
                      <td key={date} className={`px-3 py-3 border-r border-slate-150 text-left font-semibold text-xs text-slate-500 bg-slate-100 ${day.closed ? "bg-slate-200/40 text-slate-400" : ""}`}>
                        Tasks: <strong className="text-slate-700">{day.amazonTask || "None assigned"}</strong>
                      </td>
                    );
                  })}
                </tr>

                {!collapsed.amazon && (
                  <tr className="hover:bg-slate-50/20">
                    <td className="sticky left-0 bg-white z-20 px-4 py-4 border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.03)] w-[180px] shrink-0 text-left">
                      <div className="flex flex-col space-y-1">
                        <span className="font-bold text-slate-800 text-[11px]">Amazon Logistics</span>
                        <span className="text-[9px] text-slate-400 uppercase font-extrabold">Visibility & task allocation</span>
                      </div>
                    </td>
                    {visibleDates.map((date) => {
                      const day = getDaySchedule(date);
                      const isClosed = !!day.closed;

                      return (
                        <td key={date} className={`px-3 py-3 border-r border-slate-150 text-xs align-middle ${isClosed ? "bg-slate-200/10" : ""}`}>
                          <input
                            type="text"
                            disabled={isClosed}
                            placeholder="e.g. Build, Fulfillment, Pouches..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-slate-800"
                            value={day.amazonTask || ""}
                            onChange={(e) => {
                              updateDaySchedule(date, { ...day, amazonTask: e.target.value });
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                )}

              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: MANUAL PACKING PRIORITIES PANEL (3 COLS) */}
      <div className="xl:col-span-3 space-y-6" id="priorities-sidebar">
        
        {/* PRIORITIES CARD */}
        <div className="glass p-6 space-y-5" id="packing-priorities-card">
          <div className="flex items-center gap-2 border-b border-white/20 pb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <h2 className="text-base font-black text-slate-800 uppercase tracking-wider">Packing Priorities</h2>
          </div>

          <p className="text-xs text-slate-500 leading-normal">
            A manually maintained priority queue. Check lines off or order them by importance. 
          </p>

          {/* Quick Add Form */}
          <form onSubmit={handleAddPriority} className="bg-white/55 border border-white/45 p-3 rounded-xl space-y-3 shadow-xs">
            <span className="text-[9px] font-extrabold uppercase text-slate-400 block tracking-widest border-b pb-1">Queue New Priority</span>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <label className="text-[8px] text-slate-400 font-bold uppercase">Flavor</label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded p-1 text-[10px] font-bold"
                  value={newPriority.flavor}
                  onChange={(e) => setNewPriority({ ...newPriority, flavor: e.target.value })}
                >
                  {settings.flavors.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-0.5">
                <label className="text-[8px] text-slate-400 font-bold uppercase">Pack Size</label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded p-1 text-[10px] font-bold"
                  value={newPriority.packSizeId}
                  onChange={(e) => setNewPriority({ ...newPriority, packSizeId: e.target.value })}
                >
                  {settings.packSizes.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <label className="text-[8px] text-slate-400 font-bold uppercase">MCs Needed</label>
                <input
                  type="number"
                  min="1"
                  className="w-full bg-slate-50 border border-slate-200 rounded p-1 text-[10px] font-bold"
                  value={newPriority.mcsNeeded || ""}
                  onChange={(e) => setNewPriority({ ...newPriority, mcsNeeded: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-0.5">
                <label className="text-[8px] text-slate-400 font-bold uppercase">Priority</label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded p-1 text-[10px] font-bold"
                  value={newPriority.priority}
                  onChange={(e) => setNewPriority({ ...newPriority, priority: e.target.value as any })}
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            <div className="space-y-0.5">
              <label className="text-[8px] text-slate-400 font-bold uppercase block text-left">PO Tag / Notes</label>
              <input
                type="text"
                placeholder="Marshalls PO#..."
                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[10px] font-semibold text-slate-700"
                value={newPriority.poTag || ""}
                onChange={(e) => setNewPriority({ ...newPriority, poTag: e.target.value })}
              />
            </div>

            <button
              type="submit"
              className="w-full py-1.5 bg-slate-900 hover:bg-black text-white font-black text-[10px] uppercase rounded-lg shadow-md cursor-pointer transition-all"
            >
              Add Priority Row
            </button>
          </form>

          {/* List items */}
          <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1" id="priorities-list">
            {priorities.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs font-semibold italic">
                No active packing priorities in the queue.
              </div>
            ) : (
              priorities.map((item, index) => {
                let badgeColor = "bg-red-500/10 text-red-700 border-red-500/20";
                if (item.priority === "Medium") badgeColor = "bg-amber-500/10 text-amber-700 border-amber-500/20";
                if (item.priority === "Low") badgeColor = "bg-green-500/10 text-green-700 border-green-500/20";

                return (
                  <div
                    key={item.id}
                    className={`border rounded-xl p-3 space-y-1.5 transition-all shadow-xs flex flex-col justify-between ${
                      item.completed 
                        ? "bg-slate-50 border-slate-200 opacity-60 line-through" 
                        : "bg-white/85 border-slate-150 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {/* Checkbox to mark complete */}
                        <button
                          onClick={() => handleTogglePriorityCompleted(item.id)}
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer ${
                            item.completed 
                              ? "bg-slate-900 border-transparent text-white" 
                              : "border-slate-300 text-transparent hover:border-slate-950"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[4]" />
                        </button>
                        
                        <span className="font-extrabold text-slate-800 text-xs tracking-tight">
                          {item.flavor} ({settings.packSizes.find(p=>p.id===item.packSizeId)?.name || item.packSizeId})
                        </span>
                      </div>

                      {/* Rank Arrow Controls */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleMovePriority(index, "up")}
                          disabled={index === 0}
                          className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-800 disabled:opacity-30"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleMovePriority(index, "down")}
                          disabled={index === priorities.length - 1}
                          className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-800 disabled:opacity-30"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className="text-slate-500">Need: <strong className="text-indigo-600 font-extrabold">{item.mcsNeeded} MCs</strong></span>
                      <span className={`text-[8px] uppercase tracking-wider font-extrabold px-1.5 py-0.25 rounded-full border ${badgeColor}`}>
                        {item.priority}
                      </span>
                    </div>

                    {item.poTag && (
                      <div className="text-[10px] bg-slate-50 border rounded px-1.5 py-0.5 font-semibold text-slate-600 flex justify-between">
                        <span className="truncate">{item.poTag}</span>
                      </div>
                    )}

                    <div className="flex justify-end pt-1 border-t border-slate-100">
                      <button
                        onClick={() => handleDeletePriority(item.id)}
                        className="text-red-500 hover:text-red-700 text-[10px] font-extrabold uppercase flex items-center gap-0.5 cursor-pointer"
                      >
                        <Trash className="w-3 h-3" /> Delete
                      </button>
                    </div>

                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
