/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Settings, PackSize, UnitConversion } from "../types";
import { Plus, Trash2, AlertCircle, Sparkles, Check, X, ShieldAlert } from "lucide-react";

interface SettingsTabProps {
  settings: Settings;
  onUpdateSettings: (newSettings: Settings) => void;
}

export default function SettingsTab({ settings, onUpdateSettings }: SettingsTabProps) {
  // Local state for adding lists
  const [newFlavor, setNewFlavor] = useState("");
  const [newEmployee, setNewEmployee] = useState("");
  const [bulkEmployees, setBulkEmployees] = useState("");
  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [newFillerProduct, setNewFillerProduct] = useState("");
  const [newFillerSize, setNewFillerSize] = useState("");
  
  // Local state for custom unit
  const [newUnitName, setNewUnitName] = useState("");
  const [newUnitLbs, setNewUnitLbs] = useState<number | "">("");

  // Local state for custom pack size
  const [newPackName, setNewPackName] = useState("");
  const [newPackMcHr, setNewPackMcHr] = useState<number | "">("");
  const [newPackLbsMc, setNewPackLbsMc] = useState<number | "">("");
  const [newPackUnitsMc, setNewPackUnitsMc] = useState<number | "">(144);

  // Expand states
  const [showComboGrid, setShowComboGrid] = useState(false);

  // General update wrapper
  const update = (changes: Partial<Settings>) => {
    onUpdateSettings({ ...settings, ...changes });
  };

  // Helper to check if any pack size has a placeholder
  const hasPlaceholders = settings.packSizes.some(p => p.isPlaceholder) || settings.isFillerPlaceholder;

  // --- Adders and Removers ---
  const handleAddFlavor = () => {
    const trimmed = newFlavor.trim();
    if (!trimmed) return;
    if (settings.flavors.includes(trimmed)) return;

    const updatedFlavors = [...settings.flavors, trimmed];
    // Update allowed combos and WIP records
    const updatedCombos = { ...settings.allowedCombos };
    settings.packSizes.forEach((p) => {
      updatedCombos[`${trimmed}|${p.id}`] = true;
    });

    const updatedWipCooked = { ...settings.openingWipCooked, [trimmed]: 0 };
    const updatedWipExtruded = { ...settings.openingWipExtruded, [trimmed]: 0 };
    const updatedWipCut = { ...settings.openingWipCut, [trimmed]: 0 };

    update({
      flavors: updatedFlavors,
      allowedCombos: updatedCombos,
      openingWipCooked: updatedWipCooked,
      openingWipExtruded: updatedWipExtruded,
      openingWipCut: updatedWipCut,
    });
    setNewFlavor("");
  };

  const handleRemoveFlavor = (flavor: string) => {
    const updatedFlavors = settings.flavors.filter((f) => f !== flavor);
    
    // Clean up combos
    const updatedCombos = { ...settings.allowedCombos };
    Object.keys(updatedCombos).forEach((key) => {
      if (key.startsWith(`${flavor}|`)) {
        delete updatedCombos[key];
      }
    });

    // Clean up WIP records
    const updatedWipCooked = { ...settings.openingWipCooked };
    delete updatedWipCooked[flavor];
    const updatedWipExtruded = { ...settings.openingWipExtruded };
    delete updatedWipExtruded[flavor];
    const updatedWipCut = { ...settings.openingWipCut };
    delete updatedWipCut[flavor];

    update({
      flavors: updatedFlavors,
      allowedCombos: updatedCombos,
      openingWipCooked: updatedWipCooked,
      openingWipExtruded: updatedWipExtruded,
      openingWipCut: updatedWipCut,
    });
  };

  const handleAddEmployee = () => {
    const trimmed = newEmployee.trim();
    if (!trimmed) return;
    if (settings.employees.includes(trimmed)) return;

    update({ employees: [...settings.employees, trimmed] });
    setNewEmployee("");
  };

  const handleRemoveEmployee = (emp: string) => {
    update({ employees: settings.employees.filter((e) => e !== emp) });
  };

  const handleBulkAddEmployees = () => {
    const lines = bulkEmployees.split(/\r?\n/);
    const newNames: string[] = [];
    lines.forEach((line) => {
      const name = line.trim();
      if (name && !settings.employees.includes(name) && !newNames.includes(name)) {
        newNames.push(name);
      }
    });
    if (newNames.length > 0) {
      update({ employees: [...settings.employees, ...newNames] });
    }
    setBulkEmployees("");
    setShowBulkPaste(false);
  };

  const handleAddPackSize = () => {
    const trimmedName = newPackName.trim();
    if (!trimmedName || newPackMcHr === "" || newPackLbsMc === "" || newPackUnitsMc === "") return;
    
    const id = trimmedName.toLowerCase().replace(/\s+/g, "_");
    if (settings.packSizes.some(p => p.id === id)) return;

    const newPack: PackSize = {
      id,
      name: trimmedName,
      mcPerHour: Number(newPackMcHr),
      lbsPerMc: Number(newPackLbsMc),
      isPlaceholder: false, // User added directly, so not default placeholder
      unitsPerMc: Number(newPackUnitsMc),
    };

    // Update combos for this new pack size
    const updatedCombos = { ...settings.allowedCombos };
    settings.flavors.forEach((f) => {
      updatedCombos[`${f}|${id}`] = true;
    });

    update({
      packSizes: [...settings.packSizes, newPack],
      allowedCombos: updatedCombos
    });

    setNewPackName("");
    setNewPackMcHr("");
    setNewPackLbsMc("");
    setNewPackUnitsMc(144);
  };

  const handleRemovePackSize = (id: string) => {
    // Prevent removing all pack sizes
    if (settings.packSizes.length <= 1) return;

    const updatedPacks = settings.packSizes.filter((p) => p.id !== id);
    
    // Clean combos
    const updatedCombos = { ...settings.allowedCombos };
    Object.keys(updatedCombos).forEach((key) => {
      if (key.endsWith(`|${id}`)) {
        delete updatedCombos[key];
      }
    });

    // Also clean custom units linked to this pack size
    const updatedUnits = settings.customUnits.filter(u => u.isLinkedToPackSizeId !== id);

    update({
      packSizes: updatedPacks,
      allowedCombos: updatedCombos,
      customUnits: updatedUnits,
    });
  };

  const handleAddUnit = () => {
    const trimmed = newUnitName.trim();
    if (!trimmed || newUnitLbs === "" || Number(newUnitLbs) <= 0) return;

    const newUnit: UnitConversion = {
      id: trimmed.toLowerCase().replace(/\s+/g, "_"),
      name: trimmed,
      lbsPerUnit: Number(newUnitLbs)
    };

    update({ customUnits: [...settings.customUnits, newUnit] });
    setNewUnitName("");
    setNewUnitLbs("");
  };

  const handleRemoveUnit = (id: string) => {
    // Protect core LB and Loaf units
    if (id === "lb" || id === "loaf") return;
    update({ customUnits: settings.customUnits.filter((u) => u.id !== id) });
  };



  return (
    <div className="space-y-8" id="settings-tab-view">
      {/* Visual Header / Banner */}
      <div className="glass p-6 relative overflow-hidden" id="settings-banner">
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-yellow-500 animate-pulse" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Factory Parameters & References</h1>
          </div>
          <p className="text-slate-600 text-sm mt-2 max-w-2xl">
            Configure rates, allowed flavors, packers, and pack sizes here. Changes immediately propagate across the rolling calendar computations.
          </p>
        </div>

        {/* Placeholder Warning Badge */}
        {hasPlaceholders && (
          <div className="mt-4 flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-900 px-4 py-3 rounded-lg text-xs" id="placeholders-alert">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <span className="font-semibold">Placeholder Values Active:</span> Some pack sizes or the filler rate are still at default placeholders. Customize them below to clear the flags.
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="settings-grid">
        {/* LEFT COLUMN: Rates and Pack Sizes */}
        <div className="lg:col-span-8 space-y-8" id="left-settings-column">
          
          {/* 1. MACHINE RATES & SHIFT HOURS */}
          <div className="glass p-6 space-y-6" id="machine-rates-card">
            <h2 className="text-lg font-semibold text-slate-800 border-b border-white/20 pb-3">Department Rates & General Settings</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Shift Hours */}
              <div className="space-y-1.5" id="field-shift-hours">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Shift Hours / Day</label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="24"
                    step="0.5"
                    className="w-full bg-slate-50 text-slate-800 font-medium px-3.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all text-sm"
                    value={settings.shiftHours}
                    onChange={(e) => update({ shiftHours: Math.max(1, Number(e.target.value)) })}
                  />
                  <span className="absolute right-3.5 top-2 text-xs text-slate-400 font-medium">hrs</span>
                </div>
              </div>

              {/* Cooking Big */}
              <div className="space-y-1.5" id="field-cooking-big">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cooking Big (per round)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="w-full bg-slate-50 text-slate-800 font-medium px-3.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all text-sm"
                    value={settings.cookingBigLbsPerRound}
                    onChange={(e) => update({ cookingBigLbsPerRound: Math.max(0, Number(e.target.value)) })}
                  />
                  <span className="absolute right-3.5 top-2 text-xs text-slate-400 font-medium">lbs</span>
                </div>
                <p className="text-[11px] text-slate-400">Cycle: 70 min</p>
              </div>

              {/* Cooking Small */}
              <div className="space-y-1.5" id="field-cooking-small">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cooking Small (per round)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="w-full bg-slate-50 text-slate-800 font-medium px-3.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all text-sm"
                    value={settings.cookingSmallLbsPerRound}
                    onChange={(e) => update({ cookingSmallLbsPerRound: Math.max(0, Number(e.target.value)) })}
                  />
                  <span className="absolute right-3.5 top-2 text-xs text-slate-400 font-medium">lbs</span>
                </div>
                <p className="text-[11px] text-slate-400">Cycle: 40 min</p>
              </div>

              {/* Ex1 */}
              <div className="space-y-1.5" id="field-ex1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Extruder Ex1 Rate</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    className="w-full bg-slate-50 text-slate-800 font-medium px-3.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all text-sm"
                    value={settings.ex1LbsPerHour}
                    onChange={(e) => update({ ex1LbsPerHour: Math.max(0, Number(e.target.value)) })}
                  />
                  <span className="absolute right-3.5 top-2 text-xs text-slate-400 font-medium">lbs/hr</span>
                </div>
              </div>

              {/* Ex2 */}
              <div className="space-y-1.5" id="field-ex2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Extruder Ex2 Rate</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    className="w-full bg-slate-50 text-slate-800 font-medium px-3.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all text-sm"
                    value={settings.ex2LbsPerHour}
                    onChange={(e) => update({ ex2LbsPerHour: Math.max(0, Number(e.target.value)) })}
                  />
                  <span className="absolute right-3.5 top-2 text-xs text-slate-400 font-medium">lbs/hr</span>
                </div>
              </div>

              {/* Ex3 */}
              <div className="space-y-1.5" id="field-ex3">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Extruder Ex3 Rate</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    className="w-full bg-slate-50 text-slate-800 font-medium px-3.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all text-sm"
                    value={settings.ex3LbsPerHour}
                    onChange={(e) => update({ ex3LbsPerHour: Math.max(0, Number(e.target.value)) })}
                  />
                  <span className="absolute right-3.5 top-2 text-xs text-slate-400 font-medium">lbs/hr</span>
                </div>
              </div>

              {/* Cutting Rate */}
              <div className="space-y-1.5" id="field-cutting">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cutting Rate (per person)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="w-full bg-slate-50 text-slate-800 font-medium px-3.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all text-sm"
                    value={settings.cuttingLbsPerHourPerPerson}
                    onChange={(e) => update({ cuttingLbsPerHourPerPerson: Math.max(0, Number(e.target.value)) })}
                  />
                  <span className="absolute right-3.5 top-2 text-xs text-slate-400 font-medium">lbs/hr</span>
                </div>
              </div>

              {/* Filler Rate */}
              <div className="space-y-1.5" id="field-filler">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Filler Rate</label>
                  {settings.isFillerPlaceholder && (
                    <span className="bg-amber-100 text-amber-700 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tight">Placeholder</span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className={`w-full font-medium px-3.5 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all text-sm ${
                      settings.isFillerPlaceholder
                        ? "bg-amber-50/50 border-amber-300 text-slate-800"
                        : "bg-slate-50 border-slate-200 text-slate-800"
                    }`}
                    value={settings.fillerLbsPerRound}
                    onChange={(e) =>
                      update({
                        fillerLbsPerRound: Math.max(0, Number(e.target.value)),
                        isFillerPlaceholder: false,
                      })
                    }
                  />
                  <span className="absolute right-3.5 top-2 text-xs text-slate-400 font-medium">lbs/rd</span>
                </div>
              </div>
            </div>

            <h3 className="text-sm font-semibold text-slate-700 pt-4 border-t border-slate-100 uppercase tracking-wider">Roster & Headcount Capacities</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Cutters AM */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cutters Limit (AM Shift)</label>
                <input
                  type="number"
                  min="0"
                  className="w-full bg-slate-50 text-slate-800 font-medium px-3.5 py-2 rounded-lg border border-slate-200 focus:outline-none text-sm"
                  value={settings.cuttersHeadcountAM}
                  onChange={(e) => update({ cuttersHeadcountAM: Math.max(0, Number(e.target.value)) })}
                />
              </div>

              {/* Cutters PM */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cutters Limit (PM Shift)</label>
                <input
                  type="number"
                  min="0"
                  className="w-full bg-slate-50 text-slate-800 font-medium px-3.5 py-2 rounded-lg border border-slate-200 focus:outline-none text-sm"
                  value={settings.cuttersHeadcountPM}
                  onChange={(e) => update({ cuttersHeadcountPM: Math.max(0, Number(e.target.value)) })}
                />
              </div>

              {/* Packers Limit */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Packers Staffing Limit</label>
                <input
                  type="number"
                  min="0"
                  className="w-full bg-slate-50 text-slate-800 font-medium px-3.5 py-2 rounded-lg border border-slate-200 focus:outline-none text-sm"
                  value={settings.packersHeadcount}
                  onChange={(e) => update({ packersHeadcount: Math.max(0, Number(e.target.value)) })}
                />
              </div>

              {/* Filler Operators */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Filler Operators Limit</label>
                <input
                  type="number"
                  min="0"
                  className="w-full bg-slate-50 text-slate-800 font-medium px-3.5 py-2 rounded-lg border border-slate-200 focus:outline-none text-sm"
                  value={settings.fillerOperatorsHeadcount}
                  onChange={(e) => update({ fillerOperatorsHeadcount: Math.max(0, Number(e.target.value)) })}
                />
              </div>

              {/* Amazon Logistics staff */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Amazon Team Headcount</label>
                <input
                  type="number"
                  min="0"
                  className="w-full bg-slate-50 text-slate-800 font-medium px-3.5 py-2 rounded-lg border border-slate-200 focus:outline-none text-sm"
                  value={settings.amazonHeadcount}
                  onChange={(e) => update({ amazonHeadcount: Math.max(0, Number(e.target.value)) })}
                />
              </div>
            </div>
          </div>

          {/* 2. PACK SIZE MANAGEMENT TABLE */}
          <div className="glass p-6 space-y-6" id="pack-sizes-card">
            <h2 className="text-lg font-semibold text-slate-800 border-b border-white/20 pb-3">Packing Rates & Master Case Configurations</h2>
            
            <div className="overflow-x-auto" id="pack-sizes-table-container">
              <table className="w-full text-left border-collapse" id="pack-sizes-table">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="pb-3 pr-4">Pack Size</th>
                    <th className="pb-3 px-4">Rate (MC/hr per packer)</th>
                    <th className="pb-3 px-4">Lbs per Master Case (MC)</th>
                    <th className="pb-3 px-4">Units per Master Case</th>
                    <th className="pb-3 pl-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700" id="pack-sizes-table-body">
                  {settings.packSizes.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 pr-4 font-semibold text-slate-800">{p.name}</td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-24 bg-transparent border-b border-dashed border-slate-200 hover:border-slate-500 focus:border-slate-900 focus:outline-none py-0.5 text-slate-800"
                          value={p.mcPerHour}
                          onChange={(e) => {
                            const updated = settings.packSizes.map((ps) =>
                              ps.id === p.id ? { ...ps, mcPerHour: Math.max(0, Number(e.target.value)) } : ps
                            );
                            update({ packSizes: updated });
                          }}
                        />
                      </td>
                      <td className="py-3 px-4 flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          step="0.5"
                          className={`w-24 bg-transparent border-b border-dashed focus:outline-none py-0.5 text-slate-800 ${
                            p.isPlaceholder
                              ? "border-amber-400 text-amber-700 font-bold bg-amber-50/30 px-1 rounded"
                              : "border-slate-200 hover:border-slate-500 focus:border-slate-900"
                          }`}
                          value={p.lbsPerMc}
                          onChange={(e) => {
                            const val = Math.max(1, Number(e.target.value));
                            const updated = settings.packSizes.map((ps) =>
                              ps.id === p.id ? { ...ps, lbsPerMc: val, isPlaceholder: false } : ps
                            );
                            
                            // Keep linked custom units in sync
                            const updatedCustomUnits = settings.customUnits.map(unit => {
                              if (unit.isLinkedToPackSizeId === p.id) {
                                  return { ...unit, lbsPerUnit: val };
                              }
                              return unit;
                            });

                            update({ packSizes: updated, customUnits: updatedCustomUnits });
                          }}
                        />
                        {p.isPlaceholder && (
                          <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded shrink-0 uppercase tracking-tight">Placeholder</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          min="1"
                          className="w-24 bg-transparent border-b border-dashed border-slate-200 hover:border-slate-500 focus:border-slate-900 focus:outline-none py-0.5 text-slate-800"
                          value={p.unitsPerMc || 0}
                          onChange={(e) => {
                            const val = Math.max(1, Number(e.target.value));
                            const updated = settings.packSizes.map((ps) =>
                              ps.id === p.id ? { ...ps, unitsPerMc: val } : ps
                            );
                            update({ packSizes: updated });
                          }}
                        />
                      </td>
                      <td className="py-3 pl-4 text-right">
                        <button
                          onClick={() => handleRemovePackSize(p.id)}
                          className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-all cursor-pointer"
                          title="Remove pack size"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Form to add pack size */}
            <div className="bg-white/60 border border-white/40 shadow-xs backdrop-blur-xs p-4 rounded-xl space-y-4" id="add-pack-size-form">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Add Custom Pack Size</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400">Name (e.g. 10 Pack)</label>
                  <input
                    type="text"
                    placeholder="e.g. 10 Pack"
                    className="w-full bg-white px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                    value={newPackName}
                    onChange={(e) => setNewPackName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400">Rate (MC/hr per packer)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 0.8"
                    className="w-full bg-white px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                    value={newPackMcHr}
                    onChange={(e) => setNewPackMcHr(e.target.value === "" ? "" : Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400">Lbs per Master Case</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 12"
                    className="w-full bg-white px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                    value={newPackLbsMc}
                    onChange={(e) => setNewPackLbsMc(e.target.value === "" ? "" : Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400">Units per Master Case</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 144"
                    className="w-full bg-white px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                    value={newPackUnitsMc}
                    onChange={(e) => setNewPackUnitsMc(e.target.value === "" ? "" : Number(e.target.value))}
                  />
                </div>
                <div>
                  <button
                    onClick={handleAddPackSize}
                    className="w-full bg-slate-950 text-white font-medium hover:bg-slate-800 text-xs px-4 py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Add Pack Size
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 3. FLAVOR x PACK-SIZE ALLOWED GRID */}
          <div className="glass p-6 space-y-4" id="combo-grid-card">
            <div className="flex items-center justify-between border-b border-white/20 pb-3">
              <h2 className="text-lg font-semibold text-slate-800">Flavor × Pack Size Allowed Combinations</h2>
              <button
                onClick={() => setShowComboGrid(!showComboGrid)}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer"
              >
                {showComboGrid ? "Hide Grid" : "Show / Edit Grid"}
              </button>
            </div>

            {showComboGrid ? (
              <div className="space-y-3" id="combo-grid-inner">
                <p className="text-xs text-slate-400">
                  Unchecking a combination makes it invalid on the planning entry cells. If scheduled, it will prompt an immediate warning in the daily sheet.
                </p>
                <div className="overflow-x-auto border border-slate-100 rounded-lg" id="combo-grid-table-container">
                  <table className="w-full text-left text-xs border-collapse" id="combo-grid-table">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-2.5 px-3">Flavor</th>
                        {settings.packSizes.map((p) => (
                          <th key={p.id} className="py-2.5 px-3 text-center">{p.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium" id="combo-grid-table-body">
                      {settings.flavors.map((f) => (
                        <tr key={f} className="hover:bg-slate-50/30 transition-colors">
                          <td className="py-2 px-3 font-semibold text-slate-800">{f}</td>
                          {settings.packSizes.map((p) => {
                            const key = `${f}|${p.id}`;
                            const isAllowed = settings.allowedCombos[key] !== false; // Default allowed (true)
                            return (
                              <td key={p.id} className="py-2 px-3 text-center">
                                <input
                                  type="checkbox"
                                  className="w-4.5 h-4.5 text-slate-900 border-slate-300 rounded focus:ring-slate-900 accent-slate-950 cursor-pointer"
                                  checked={isAllowed}
                                  onChange={() => {
                                    const updated = { ...settings.allowedCombos };
                                    updated[key] = !isAllowed;
                                    update({ allowedCombos: updated });
                                  }}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">All combinations allowed by default. Click to configure limits.</p>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Lists & Unit Conversions */}
        <div className="lg:col-span-4 space-y-8" id="right-settings-column">
          


          {/* 2. CUSTOM FLAVOR LIST */}
          <div className="glass p-6 space-y-4" id="flavors-card">
            <h2 className="text-lg font-semibold text-slate-800 border-b border-white/20 pb-3">Flavor Definitions</h2>
            
            <div className="flex gap-2" id="flavor-form">
              <input
                type="text"
                placeholder="New flavor..."
                className="flex-1 bg-slate-50 px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
                value={newFlavor}
                onChange={(e) => setNewFlavor(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddFlavor()}
              />
              <button
                onClick={handleAddFlavor}
                className="bg-slate-950 text-white p-2 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
                title="Add flavor"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-[160px] overflow-y-auto" id="flavor-tags-list">
              {settings.flavors.map((flavor) => (
                <span
                  key={flavor}
                  className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 text-xs font-semibold px-2.5 py-1 rounded-full border border-slate-200/40"
                >
                  {flavor}
                  <button
                    onClick={() => handleRemoveFlavor(flavor)}
                    className="text-slate-400 hover:text-red-500 rounded-full focus:outline-none"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* 3. CUSTOM EMPLOYEE LIST */}
          <div className="glass p-6 space-y-4" id="employees-card">
            <h2 className="text-lg font-semibold text-slate-800 border-b border-white/20 pb-3">Department Colors</h2>
            <div className="divide-y divide-slate-100">
              {Object.entries(settings.departmentColors).map(([dept, currentColor]) => {
                const colorPalette = [
                  { id: "blue", name: "Blue", bg: "bg-blue-500", border: "border-blue-600" },
                  { id: "amber", name: "Amber", bg: "bg-amber-500", border: "border-amber-600" },
                  { id: "emerald", name: "Emerald", bg: "bg-emerald-500", border: "border-emerald-600" },
                  { id: "purple", name: "Purple", bg: "bg-purple-500", border: "border-purple-600" },
                  { id: "rose", name: "Rose", bg: "bg-rose-500", border: "border-rose-600" },
                  { id: "slate", name: "Slate", bg: "bg-slate-500", border: "border-slate-600" },
                ];
                return (
                  <div key={dept} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <span className="text-sm font-semibold text-slate-700 capitalize">{dept}</span>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-2">
                        {colorPalette.map((cp) => {
                          const isSelected = currentColor === cp.id;
                          return (
                            <button
                              key={cp.id}
                              title={cp.name}
                              type="button"
                              onClick={() => {
                                update({
                                  departmentColors: {
                                    ...settings.departmentColors,
                                    [dept]: cp.id,
                                  },
                                });
                              }}
                              className={`w-6 h-6 rounded-full ${cp.bg} border ${
                                isSelected ? "ring-2 ring-slate-900 ring-offset-2 scale-110" : "opacity-60 hover:opacity-100"
                              } transition-all relative flex items-center justify-center cursor-pointer`}
                            >
                              {isSelected && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <div className="w-px h-5 bg-slate-200" />

                      <div className="relative flex items-center gap-1.5">
                        <button
                          type="button"
                          title="Custom Color Wheel Picker"
                          onClick={() => {
                            document.getElementById(`color-picker-${dept}`)?.click();
                          }}
                          className={`w-6 h-6 rounded-full bg-[conic-gradient(red,yellow,lime,aqua,blue,magenta,red)] border ${
                            currentColor.startsWith("#") ? "ring-2 ring-slate-900 ring-offset-2 scale-110" : "opacity-60 hover:opacity-100"
                          } transition-all relative flex items-center justify-center cursor-pointer`}
                        >
                          {currentColor.startsWith("#") && (
                            <div className="w-2.5 h-2.5 rounded-full bg-white border border-slate-300 shadow-xs" style={{ backgroundColor: currentColor }} />
                          )}
                        </button>
                        <input
                          id={`color-picker-${dept}`}
                          type="color"
                          value={currentColor.startsWith("#") ? currentColor : "#3b82f6"}
                          onChange={(e) => {
                            update({
                              departmentColors: {
                                ...settings.departmentColors,
                                [dept]: e.target.value,
                              },
                            });
                          }}
                          className="sr-only"
                        />
                        {currentColor.startsWith("#") && (
                          <span className="text-[10px] font-mono text-slate-500 uppercase">
                            {currentColor}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass p-6 space-y-4" id="employees-card">
            <h2 className="text-lg font-semibold text-slate-800 border-b border-white/20 pb-3">Employee Roster</h2>
            
            <div className="flex gap-2" id="employee-form">
              <input
                type="text"
                placeholder="Employee initials..."
                className="flex-1 bg-slate-50 px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
                value={newEmployee}
                onChange={(e) => setNewEmployee(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddEmployee()}
              />
              <button
                onClick={handleAddEmployee}
                className="bg-slate-950 text-white p-2 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
                title="Add employee"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setShowBulkPaste(!showBulkPaste)}
                className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
              >
                {showBulkPaste ? "Hide Bulk Import" : "Bulk Paste from Spreadsheet..."}
              </button>
              {showBulkPaste && (
                <div className="mt-2 space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <textarea
                    rows={4}
                    placeholder="Paste list here (one name per line, e.g. copied from Excel/Sheets column)..."
                    className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    value={bulkEmployees}
                    onChange={(e) => setBulkEmployees(e.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setBulkEmployees("");
                        setShowBulkPaste(false);
                      }}
                      className="text-xs px-2.5 py-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkAddEmployees}
                      className="bg-slate-950 text-white text-xs px-3 py-1 rounded hover:bg-slate-800"
                    >
                      Import Employees
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-[160px] overflow-y-auto" id="employee-tags-list">
              {settings.employees.map((emp) => (
                <span
                  key={emp}
                  className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 text-xs font-semibold px-2.5 py-1 rounded-full border border-slate-200/40"
                >
                  {emp}
                  <button
                    onClick={() => handleRemoveEmployee(emp)}
                    className="text-slate-400 hover:text-red-500 rounded-full focus:outline-none"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Filler Products and Sizes Configuration */}
          <div className="glass p-6 space-y-4" id="filler-config-card">
            <h2 className="text-lg font-semibold text-slate-800 border-b border-white/20 pb-3">Filler Configurations</h2>
            
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Filler Products</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Sour, Peach..."
                  className="flex-1 bg-slate-50 px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
                  value={newFillerProduct}
                  onChange={(e) => setNewFillerProduct(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newFillerProduct.trim()) {
                      const trimmed = newFillerProduct.trim();
                      if (!settings.fillerProducts.includes(trimmed)) {
                        update({ fillerProducts: [...settings.fillerProducts, trimmed] });
                      }
                      setNewFillerProduct("");
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const trimmed = newFillerProduct.trim();
                    if (trimmed && !settings.fillerProducts.includes(trimmed)) {
                      update({ fillerProducts: [...settings.fillerProducts, trimmed] });
                    }
                    setNewFillerProduct("");
                  }}
                  className="bg-slate-950 text-white p-2 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {settings.fillerProducts.map((p) => (
                  <span key={p} className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 text-xs font-semibold px-2.5 py-1 rounded-full border">
                    {p}
                    <button
                      onClick={() => {
                        update({ fillerProducts: settings.fillerProducts.filter(item => item !== p) });
                      }}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-3 border-t border-slate-100 pt-3">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Filler Sizes</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. 1.8 oz, 5.3 oz..."
                  className="flex-1 bg-slate-50 px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
                  value={newFillerSize}
                  onChange={(e) => setNewFillerSize(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newFillerSize.trim()) {
                      const trimmed = newFillerSize.trim();
                      if (!settings.fillerSizes.includes(trimmed)) {
                        update({ fillerSizes: [...settings.fillerSizes, trimmed] });
                      }
                      setNewFillerSize("");
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const trimmed = newFillerSize.trim();
                    if (trimmed && !settings.fillerSizes.includes(trimmed)) {
                      update({ fillerSizes: [...settings.fillerSizes, trimmed] });
                    }
                    setNewFillerSize("");
                  }}
                  className="bg-slate-950 text-white p-2 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {settings.fillerSizes.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 text-xs font-semibold px-2.5 py-1 rounded-full border">
                    {s}
                    <button
                      onClick={() => {
                        update({ fillerSizes: settings.fillerSizes.filter(item => item !== s) });
                      }}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 4. DISPLAY UNIT SYSTEM */}
          <div className="glass p-6 space-y-4" id="unit-system-card">
            <h2 className="text-lg font-semibold text-slate-800 border-b border-white/20 pb-3">Unit Conversion Reference</h2>
            <p className="text-xs text-slate-400">
              Define the lbs weight equivalents for all custom metric views across the sheets.
            </p>

            <div className="space-y-3" id="units-list">
              {settings.customUnits.map((u) => (
                <div key={u.id} className="flex items-center justify-between text-xs font-medium border-b border-slate-50 py-1.5" id={`unit-item-${u.id}`}>
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                    {u.name}
                    {u.isLinkedToPackSizeId && (
                      <span className="text-[9px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded uppercase">Linked</span>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    {u.isLinkedToPackSizeId ? (
                      // Dynamic link display
                      <span className="text-slate-400 font-medium">
                        Synced with {settings.packSizes.find(ps => ps.id === u.isLinkedToPackSizeId)?.name}
                      </span>
                    ) : (
                      // Editable numeric reference
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        disabled={u.id === "lb"} // LB is base 1 and cannot be edited
                        className={`w-16 p-1 text-right bg-slate-50 rounded border ${
                          u.id === "lb" ? "border-transparent text-slate-400" : "border-slate-200 hover:border-slate-300"
                        } ${u.isPlaceholder ? "border-amber-300 font-bold bg-amber-50/20" : ""}`}
                        value={u.lbsPerUnit}
                        onChange={(e) => {
                          const updated = settings.customUnits.map((item) =>
                            item.id === u.id ? { ...item, lbsPerUnit: Math.max(0.01, Number(e.target.value)), isPlaceholder: false } : item
                          );
                          update({ customUnits: updated });
                        }}
                      />
                    )}
                    <span className="text-slate-400 w-5">lbs</span>
                    {u.id !== "lb" && u.id !== "loaf" && !u.isLinkedToPackSizeId && (
                      <button
                        onClick={() => handleRemoveUnit(u.id)}
                        className="text-slate-400 hover:text-red-500 rounded p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Form to add custom unit */}
            <div className="bg-white/60 border border-white/40 shadow-xs backdrop-blur-xs p-3 rounded-lg space-y-2" id="add-unit-form">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Add Unit Conversion</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Unit e.g. Pack"
                  className="w-1/2 bg-white px-2.5 py-1.5 border border-slate-200 rounded text-xs"
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                />
                <input
                  type="number"
                  placeholder="Lbs/unit"
                  className="w-1/4 bg-white px-2.5 py-1.5 border border-slate-200 rounded text-xs"
                  value={newUnitLbs}
                  onChange={(e) => setNewUnitLbs(e.target.value === "" ? "" : Number(e.target.value))}
                />
                <button
                  onClick={handleAddUnit}
                  className="bg-slate-950 hover:bg-slate-800 text-white px-2.5 rounded text-xs font-semibold cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
