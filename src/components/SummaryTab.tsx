/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Settings, DailySummary } from "../types";
import { convertValue, getUnitLabel } from "../calculations";
import { AlertCircle, HelpCircle, ArrowRight, Table, Layers, FileSpreadsheet, Eye, BarChart3 } from "lucide-react";

interface SummaryTabProps {
  dates: string[];
  summaries: DailySummary[];
  settings: Settings;
  cookingUnitId: string;
  extrudingUnitId: string;
  cuttingUnitId: string;
  packingUnitId: string;
  fillerUnitId: string;
}

export default function SummaryTab({
  dates,
  summaries,
  settings,
  cookingUnitId,
  extrudingUnitId,
  cuttingUnitId,
  packingUnitId,
  fillerUnitId,
}: SummaryTabProps) {
  // Currently selected date for the Flavor Matrix
  const [selectedDate, setSelectedDate] = useState<string>(dates[0] || "");
  const [selectedFlavorFilter, setSelectedFlavorFilter] = useState<string>("All");

  // Format date helper: "Mon 7/8"
  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return { weekday: "", monthDay: "" };
    const d = new Date(dateStr + "T12:00:00");
    const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
    const monthDay = d.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
    return { weekday, monthDay };
  };

  const currentSummary = summaries.find((s) => s.date === selectedDate);

  // CSV Export of Daily Summary
  const handleExportCSV = () => {
    if (summaries.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Department,Scheduled,WIP Available,Suggested,Unit\n";

    summaries.forEach((s) => {
      const depts = [
        { name: "Cooking", metrics: s.departments.cooking, unitId: cookingUnitId },
        { name: "Extruding", metrics: s.departments.extruding, unitId: extrudingUnitId },
        { name: "Cutting", metrics: s.departments.cutting, unitId: cuttingUnitId },
        { name: "Packing", metrics: s.departments.packing, unitId: packingUnitId },
        { name: "Filler", metrics: s.departments.filler, unitId: fillerUnitId },
      ];

      depts.forEach((d) => {
        const sched = convertValue(d.metrics.scheduled, d.unitId, settings);
        const wip = convertValue(d.metrics.wipAvailable, d.unitId, settings);
        const sug = convertValue(d.metrics.suggested, d.unitId, settings);
        const uLabel = getUnitLabel(d.unitId, settings);
        csvContent += `${s.date},${d.name},${sched.toFixed(1)},${wip.toFixed(1)},${sug.toFixed(1)},${uLabel}\n`;
      });
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `production_summary.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-10" id="summary-tab-view">
      
      {/* 1. TOP OVERVIEW PANEL */}
      <div className="glass p-6 flex flex-col md:flex-row md:items-center justify-between gap-4" id="summary-banner">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Production Summary & Bottleneck Analysis</h2>
          </div>
          <p className="text-slate-600 text-xs max-w-2xl">
            Constrained outputs computed chronologically. Highlighted items indicate departments where operations are bottlenecked due to insufficient upstream work-in-progress stock.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={summaries.length === 0}
          className="bg-slate-900 hover:bg-slate-950 text-white font-semibold text-xs px-4.5 py-2 rounded-xl shadow-md transition-all flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50 border border-white/10"
        >
          <FileSpreadsheet className="w-4 h-4" /> Export CSV Summary
        </button>
      </div>

      {/* 2. CHRONOLOGICAL WIDGETS SECTION */}
      <div className="space-y-4" id="chronological-widgets">
        <div className="flex items-center gap-2">
          <Layers className="w-4.5 h-4.5 text-slate-500" />
          <h3 className="font-bold text-slate-800 text-sm">Chronological Flow per Department</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6" id="chronological-grid">
          {summaries.map((s) => {
            const { weekday, monthDay } = formatDateLabel(s.date);
            const isDateSelected = selectedDate === s.date;

            // Check if any department has a bottleneck on this day
            const hasAnyBottleneck =
              s.departments.extruding.bottleneck ||
              s.departments.cutting.bottleneck ||
              s.departments.packing.bottleneck;

            return (
              <div
                key={s.date}
                onClick={() => setSelectedDate(s.date)}
                className={`cursor-pointer transition-all flex flex-col justify-between hover:shadow-md rounded-xl p-4 ${
                  isDateSelected
                    ? "glass bg-white/70 shadow-md ring-2 ring-slate-900/80 border-transparent"
                    : "glass hover:bg-white/55 border-white/30"
                }`}
                id={`summary-card-${s.date}`}
              >
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{weekday}</span>
                      <span className="text-sm font-bold text-slate-800">{monthDay}</span>
                    </div>
                    {hasAnyBottleneck && (
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-amber-600" /> Bottleneck
                      </span>
                    )}
                  </div>

                  <div className="space-y-2.5 text-xs" id={`summary-card-depts-${s.date}`}>
                    {/* Cooking */}
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Cooking</span>
                      <span className="font-bold text-slate-800">
                        {convertValue(s.departments.cooking.suggested, cookingUnitId, settings).toLocaleString(undefined, { maximumFractionDigits: 1 })} {getUnitLabel(cookingUnitId, settings)}
                      </span>
                    </div>

                    {/* Extruding */}
                    <div className={`flex justify-between items-center rounded px-1.5 py-0.5 ${
                      s.departments.extruding.bottleneck ? "bg-amber-50 text-amber-900 font-semibold" : "text-slate-600"
                    }`}>
                      <span>Extruding</span>
                      <span className="font-bold text-slate-800">
                        {convertValue(s.departments.extruding.suggested, extrudingUnitId, settings).toLocaleString(undefined, { maximumFractionDigits: 1 })} {getUnitLabel(extrudingUnitId, settings)}
                      </span>
                    </div>

                    {/* Cutting */}
                    <div className={`flex justify-between items-center rounded px-1.5 py-0.5 ${
                      s.departments.cutting.bottleneck ? "bg-amber-50 text-amber-900 font-semibold" : "text-slate-600"
                    }`}>
                      <span>Cutting</span>
                      <span className="font-bold text-slate-800">
                        {convertValue(s.departments.cutting.suggested, cuttingUnitId, settings).toLocaleString(undefined, { maximumFractionDigits: 1 })} {getUnitLabel(cuttingUnitId, settings)}
                      </span>
                    </div>

                    {/* Packing */}
                    <div className={`flex justify-between items-center rounded px-1.5 py-0.5 ${
                      s.departments.packing.bottleneck ? "bg-amber-50 text-amber-900 font-semibold" : "text-slate-600"
                    }`}>
                      <span>Packing</span>
                      <span className="font-bold text-slate-800">
                        {convertValue(s.departments.packing.suggested, packingUnitId, settings).toLocaleString(undefined, { maximumFractionDigits: 1 })} {getUnitLabel(packingUnitId, settings)}
                      </span>
                    </div>

                    {/* Filler */}
                    <div className="flex justify-between items-center text-slate-600 border-t border-dashed border-slate-100 pt-1.5">
                      <span>Filler (Para)</span>
                      <span className="font-bold text-slate-800">
                        {convertValue(s.departments.filler.suggested, fillerUnitId, settings).toLocaleString(undefined, { maximumFractionDigits: 1 })} {getUnitLabel(fillerUnitId, settings)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 text-center">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider hover:text-slate-900 transition-colors flex items-center justify-center gap-1">
                    <Eye className="w-3 h-3" /> View flavor matrix
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. WORK-IN-PROGRESS METRICS & FLAVOR MATRIX DETAIL */}
      {currentSummary && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="summary-details-section">
          
          {/* DETAILED DAILY METRICS */}
          <div className="lg:col-span-5 space-y-6" id="daily-metrics-panel">
            <div className="glass p-6 space-y-4" id="wip-metrics-box">
              <div className="flex items-center justify-between border-b border-white/20 pb-3">
                <div className="flex flex-col">
                  <h3 className="text-base font-bold text-slate-800">Department WIP Breakdown</h3>
                  <p className="text-xs text-slate-500">{formatDateLabel(currentSummary.date).weekday} {formatDateLabel(currentSummary.date).monthDay} status</p>
                </div>
              </div>

              <div className="space-y-4 text-xs" id="wip-flow-list">
                {/* Cooking */}
                <div className="p-3.5 bg-white/60 border border-white/40 shadow-xs rounded-lg space-y-1 backdrop-blur-xs">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>1. Cooking Output</span>
                    <span>
                      {convertValue(currentSummary.departments.cooking.suggested, cookingUnitId, settings).toLocaleString(undefined, { maximumFractionDigits: 1 })} {getUnitLabel(cookingUnitId, settings)}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500">Yield directly adds to Extruding's WIP stock for subsequent days.</div>
                </div>

                {/* Extruding */}
                <div className={`p-3.5 rounded-lg space-y-2 border ${
                  currentSummary.departments.extruding.bottleneck
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-900"
                    : "bg-white/60 border-white/40 shadow-xs backdrop-blur-xs text-slate-800"
                }`}>
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>2. Extruding Department</span>
                    <span>
                      {convertValue(currentSummary.departments.extruding.suggested, extrudingUnitId, settings).toLocaleString(undefined, { maximumFractionDigits: 1 })} {getUnitLabel(extrudingUnitId, settings)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px] font-semibold text-slate-500 pt-1.5 border-t border-slate-200/40">
                    <div>
                      <span className="block text-[9px] text-slate-400 uppercase">WIP On Hand</span>
                      <span className="text-slate-800">
                        {convertValue(currentSummary.departments.extruding.wipAvailable, extrudingUnitId, settings).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-400 uppercase">Scheduled</span>
                      <span className="text-slate-800">
                        {convertValue(currentSummary.departments.extruding.scheduled, extrudingUnitId, settings).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-400 uppercase">Suggested</span>
                      <span className={currentSummary.departments.extruding.bottleneck ? "text-amber-700 font-bold" : "text-slate-800"}>
                        {convertValue(currentSummary.departments.extruding.suggested, extrudingUnitId, settings).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </span>
                    </div>
                  </div>
                  {currentSummary.departments.extruding.bottleneck && (
                    <div className="text-[10px] text-amber-800 font-semibold bg-amber-500/10 p-1.5 rounded flex items-center gap-1 border border-amber-500/25">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Bottleneck: Upstream stock limits this day's extrusion output.</span>
                    </div>
                  )}
                </div>

                {/* Cutting */}
                <div className={`p-3.5 rounded-lg space-y-2 border ${
                  currentSummary.departments.cutting.bottleneck
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-900"
                    : "bg-white/60 border-white/40 shadow-xs backdrop-blur-xs text-slate-800"
                }`}>
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>3. Cutting Department</span>
                    <span>
                      {convertValue(currentSummary.departments.cutting.suggested, cuttingUnitId, settings).toLocaleString(undefined, { maximumFractionDigits: 1 })} {getUnitLabel(cuttingUnitId, settings)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px] font-semibold text-slate-500 pt-1.5 border-t border-slate-200/40">
                    <div>
                      <span className="block text-[9px] text-slate-400 uppercase">WIP On Hand</span>
                      <span className="text-slate-800">
                        {convertValue(currentSummary.departments.cutting.wipAvailable, cuttingUnitId, settings).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-400 uppercase">Scheduled</span>
                      <span className="text-slate-800">
                        {convertValue(currentSummary.departments.cutting.scheduled, cuttingUnitId, settings).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-400 uppercase">Suggested</span>
                      <span className={currentSummary.departments.cutting.bottleneck ? "text-amber-700 font-bold" : "text-slate-800"}>
                        {convertValue(currentSummary.departments.cutting.suggested, cuttingUnitId, settings).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </span>
                    </div>
                  </div>
                  {currentSummary.departments.cutting.bottleneck && (
                    <div className="text-[10px] text-amber-800 font-semibold bg-amber-500/10 p-1.5 rounded flex items-center gap-1 border border-amber-500/25">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Bottleneck: Extruded stock limits this day's cutting.</span>
                    </div>
                  )}
                </div>

                {/* Packing */}
                <div className={`p-3.5 rounded-lg space-y-2 border ${
                  currentSummary.departments.packing.bottleneck
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-900"
                    : "bg-white/60 border-white/40 shadow-xs backdrop-blur-xs text-slate-800"
                }`}>
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>4. Packing Department</span>
                    <span>
                      {convertValue(currentSummary.departments.packing.suggested, packingUnitId, settings).toLocaleString(undefined, { maximumFractionDigits: 1 })} {getUnitLabel(packingUnitId, settings)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px] font-semibold text-slate-500 pt-1.5 border-t border-slate-200/40">
                    <div>
                      <span className="block text-[9px] text-slate-400 uppercase">WIP On Hand</span>
                      <span className="text-slate-800">
                        {convertValue(currentSummary.departments.packing.wipAvailable, packingUnitId, settings).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-400 uppercase">Scheduled</span>
                      <span className="text-slate-800">
                        {convertValue(currentSummary.departments.packing.scheduled, packingUnitId, settings).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-400 uppercase">Suggested</span>
                      <span className={currentSummary.departments.packing.bottleneck ? "text-amber-700 font-bold" : "text-slate-800"}>
                        {convertValue(currentSummary.departments.packing.suggested, packingUnitId, settings).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </span>
                    </div>
                  </div>
                  
                  {/* Master Cases Output - Packing specific requirement */}
                  <div className="bg-white/80 p-2 rounded border border-slate-200 text-[11px] font-semibold text-slate-700 flex justify-between">
                    <span>Master Cases (MC) Output:</span>
                    <span className="text-slate-900 font-bold">
                      Sched: {currentSummary.departments.packing.scheduled > 0 
                        ? (currentSummary.departments.packing.scheduled / 10).toFixed(1) 
                        : "0.0"} | Sug: {currentSummary.flavorOutputs ? Object.values(currentSummary.flavorOutputs).reduce((sum, item)=> sum + (item.packingSuggestedMc || 0), 0).toFixed(1) : "0.0"} MC
                    </span>
                  </div>

                  {currentSummary.departments.packing.bottleneck && (
                    <div className="text-[10px] text-amber-800 font-semibold bg-amber-500/10 p-1.5 rounded flex items-center gap-1 border border-amber-500/25">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Bottleneck: Cut stock hand-off limits packing rate.</span>
                    </div>
                  )}
                </div>

                {/* Filler */}
                <div className="p-3.5 bg-white/60 border border-white/40 shadow-xs rounded-lg space-y-1 backdrop-blur-xs">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>5. Filler (Parallel Output)</span>
                    <span>
                      {convertValue(currentSummary.departments.filler.suggested, fillerUnitId, settings).toLocaleString(undefined, { maximumFractionDigits: 1 })} {getUnitLabel(fillerUnitId, settings)}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500">Filler line operates independently of the core upstream cooking WIP stock constraints.</div>
                </div>
              </div>
            </div>
          </div>

          {/* FLAVOR × DEPARTMENT MATRIX */}
          <div className="lg:col-span-7 space-y-6" id="flavor-matrix-panel">
            <div className="glass p-6 space-y-4" id="flavor-matrix-box">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/20 pb-3">
                <div className="flex items-center gap-1.5">
                  <Table className="w-4.5 h-4.5 text-slate-700" />
                  <h3 className="text-base font-bold text-slate-800">Flavor × Department Matrix</h3>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-semibold text-slate-500">Filter Flavor:</span>
                  <select
                    className="bg-white/60 border border-white/40 text-xs font-semibold rounded px-2 py-1 text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-slate-900"
                    value={selectedFlavorFilter}
                    onChange={(e) => setSelectedFlavorFilter(e.target.value)}
                  >
                    <option value="All">All Flavors</option>
                    {settings.flavors.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto" id="flavor-matrix-table-container">
                <table className="w-full text-left text-xs border-collapse" id="flavor-matrix-table">
                  <thead>
                    <tr className="bg-white/40 border-b border-white/20 text-[10px] font-bold text-slate-400 uppercase tracking-wider backdrop-blur-xs">
                      <th className="py-2.5 px-3">Flavor</th>
                      <th className="py-2.5 px-3 text-right">Cooking</th>
                      <th className="py-2.5 px-3 text-right">Extruding (Sug / Sched)</th>
                      <th className="py-2.5 px-3 text-right">Cutting (Sug / Sched)</th>
                      <th className="py-2.5 px-3 text-right">Packing (Sug / Sched)</th>
                      <th className="py-2.5 px-3 text-right">Filler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/20 text-slate-700 font-medium" id="flavor-matrix-table-body">
                    {settings.flavors
                      .filter((f) => selectedFlavorFilter === "All" || f === selectedFlavorFilter)
                      .map((flavor) => {
                        const outputs = currentSummary.flavorOutputs[flavor] || {
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

                        const hasData =
                          outputs.cooking > 0 ||
                          outputs.extrudingScheduled > 0 ||
                          outputs.cuttingScheduled > 0 ||
                          outputs.packingScheduled > 0 ||
                          outputs.filler > 0;

                        // Display empty cells blank as requested: "Fully derived from entries; zero values shown blank."
                        const formatCellVal = (val: number, unitId: string) => {
                          if (val <= 0) return "";
                          const converted = convertValue(val, unitId, settings);
                          return converted.toLocaleString(undefined, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 1,
                          });
                        };

                        const renderSchedSugRange = (sug: number, sched: number, unitId: string) => {
                          if (sched <= 0) return "";
                          const sugC = formatCellVal(sug, unitId) || "0";
                          const schedC = formatCellVal(sched, unitId) || "0";
                          if (sug < sched) {
                            return (
                              <span className="text-amber-700 font-bold" title="Bottleneck constraint applied">
                                {sugC} <span className="text-slate-300 font-normal">/ {schedC}</span>
                              </span>
                            );
                          }
                          return sugC;
                        };

                        return (
                          <tr
                            key={flavor}
                            className={`hover:bg-slate-50/50 transition-all ${
                              hasData ? "opacity-100" : "opacity-40"
                            }`}
                          >
                            <td className="py-3 px-3 font-bold text-slate-800">{flavor}</td>
                            
                            <td className="py-3 px-3 text-right font-semibold text-slate-700">
                              {formatCellVal(outputs.cooking, cookingUnitId)}
                            </td>
                            
                            <td className="py-3 px-3 text-right font-semibold text-slate-700">
                              {renderSchedSugRange(outputs.extrudingSuggested, outputs.extrudingScheduled, extrudingUnitId)}
                            </td>
                            
                            <td className="py-3 px-3 text-right font-semibold text-slate-700">
                              {renderSchedSugRange(outputs.cuttingSuggested, outputs.cuttingScheduled, cuttingUnitId)}
                            </td>
                            
                            <td className="py-3 px-3 text-right font-semibold text-slate-700">
                              {renderSchedSugRange(outputs.packingSuggested, outputs.packingScheduled, packingUnitId)}
                              {outputs.packingSuggested > 0 && (
                                <div className="text-[10px] text-slate-400 font-medium">
                                  ({outputs.packingSuggestedMc.toFixed(1)} MC)
                                </div>
                              )}
                            </td>
                            
                            <td className="py-3 px-3 text-right font-semibold text-slate-700">
                              {formatCellVal(outputs.filler, fillerUnitId)}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">
                * Note: Matrix displays <span className="text-slate-800 font-bold">Suggested / Scheduled</span> capacity where shortage occurs. Unscheduled flavors are visually greyed out.
              </p>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
