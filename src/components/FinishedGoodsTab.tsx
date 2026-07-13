/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Settings } from "../types";
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  Plus, 
  Trash2, 
  Search, 
  FileText, 
  Filter, 
  CheckCircle, 
  AlertCircle 
} from "lucide-react";

interface FinishedGoodsItem {
  id: string;
  flavor: string;
  quantityMc: number;
  lastUpdated: string;
  category: string;
}

interface FinishedGoodsTabProps {
  settings: Settings;
}

const DEFAULT_FINISHED_GOODS: FinishedGoodsItem[] = [
  { id: "1", flavor: "Peppermint", quantityMc: 120, lastUpdated: "2026-07-08", category: "Gum Bag 12ct" },
  { id: "2", flavor: "Cinnamon", quantityMc: 85, lastUpdated: "2026-07-07", category: "Gum Bag 12ct" },
  { id: "3", flavor: "Fennel", quantityMc: 45, lastUpdated: "2026-07-08", category: "Gum 12pk 24ct" },
  { id: "4", flavor: "Ginger", quantityMc: 60, lastUpdated: "2026-07-06", category: "Gum 12pk 24ct" },
  { id: "5", flavor: "Cleanse", quantityMc: 30, lastUpdated: "2026-07-08", category: "Gum Bag 12ct" },
];

export const getUnitsPerMcForCategory = (cat: string): number => {
  const matchCt = cat.match(/(\d+)ct/i);
  if (matchCt) {
    return parseInt(matchCt[1], 10);
  }
  if (cat.includes("5.3")) return 12;
  if (cat.includes("1.8")) return 24;
  
  const matchNum = cat.match(/(\d+)/g);
  if (matchNum && matchNum.length > 0) {
    const lastNum = parseInt(matchNum[matchNum.length - 1], 10);
    if (lastNum > 0) return lastNum;
  }
  return 24; // fallback
};

export default function FinishedGoodsTab({ settings }: FinishedGoodsTabProps) {
  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem("sg_fg_categories");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error loading categories:", e);
      }
    }
    return [
      "Gum 12pk 24ct",
      "Gum 6pk 96ct",
      "Gum 6pk 24ct",
      "Gum Bulk 20ct",
      "Gum Bag 12ct",
      "Fruit Bites 5.3",
      "Fruit Bites 1.8"
    ];
  });

  const [inventory, setInventory] = useState<FinishedGoodsItem[]>(() => {
    const saved = localStorage.getItem("sg_finished_goods");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure imported old inventory matches new simplified schema with category
        return parsed.map((item: any) => ({
          id: item.id || String(Math.random()),
          flavor: item.flavor,
          quantityMc: Number(item.quantityMc || 0),
          lastUpdated: item.lastUpdated || new Date().toISOString().split("T")[0],
          category: item.category || (item.packSizeId === "12pk" ? "Gum 12pk 24ct" : "Gum Bag 12ct"),
        }));
      } catch (e) {
        console.error("Error loading finished goods:", e);
      }
    }
    return DEFAULT_FINISHED_GOODS;
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [flavorFilter, setFlavorFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  
  // Add item form state
  const [addFlavor, setAddFlavor] = useState(settings.flavors[0] || "");
  const [addCategory, setAddCategory] = useState(categories[0] || "");
  const [addQtyMc, setAddQtyMc] = useState<number | "">("");
  const [newCategoryInput, setNewCategoryInput] = useState("");

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state to local storage
  useEffect(() => {
    localStorage.setItem("sg_finished_goods", JSON.stringify(inventory));
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem("sg_fg_categories", JSON.stringify(categories));
  }, [categories]);

  // Keep dropdown form selections in sync with settings & categories
  useEffect(() => {
    if (settings.flavors.length > 0 && !settings.flavors.includes(addFlavor)) {
      setAddFlavor(settings.flavors[0]);
    }
  }, [settings.flavors]);

  useEffect(() => {
    if (categories.length > 0 && !categories.includes(addCategory)) {
      setAddCategory(categories[0]);
    }
  }, [categories]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 4000);
  };

  const getCategoryForItem = (item: FinishedGoodsItem): string => {
    return item.category || categories[0] || "Gum 12pk 24ct";
  };

  const handleAddCategory = () => {
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) {
      showError("Category already exists.");
      return;
    }
    setCategories((prev) => [...prev, trimmed]);
    setNewCategoryInput("");
    showSuccess(`Category "${trimmed}" successfully added.`);
  };

  const handleRemoveCategory = (catToRemove: string) => {
    if (categories.length <= 1) {
      showError("Must have at least one category left.");
      return;
    }
    setCategories((prev) => prev.filter((cat) => cat !== catToRemove));
    showSuccess(`Category "${catToRemove}" removed.`);
  };

  const handleAddRow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFlavor || !addCategory || addQtyMc === "") {
      showError("Please fill out Flavor, Category, and Quantity.");
      return;
    }

    const newItem: FinishedGoodsItem = {
      id: String(Date.now()),
      flavor: addFlavor,
      quantityMc: Number(addQtyMc),
      lastUpdated: new Date().toISOString().split("T")[0],
      category: addCategory,
    };

    setInventory((prev) => [newItem, ...prev]);
    setAddQtyMc("");
    showSuccess(`Successfully added inventory for ${addFlavor}.`);
  };

  const handleRemoveRow = (id: string) => {
    setInventory((prev) => prev.filter((item) => item.id !== id));
    showSuccess("Inventory row removed.");
  };

  const handleClearInventory = () => {
    if (window.confirm("Are you sure you want to clear your entire Finished Goods inventory? This cannot be undone.")) {
      setInventory([]);
      showSuccess("Inventory cleared.");
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,Flavor,Category,Quantity (MC)\nPeppermint,Gum Bag 12ct,120\nCinnamon,Gum 12pk 24ct,50\n";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "finished_goods_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,Flavor,Category,Quantity (MC),Total Units,Last Updated\n";
    inventory.forEach((item) => {
      const cat = getCategoryForItem(item);
      const unitsPerMc = getUnitsPerMcForCategory(cat);
      const totalUnits = item.quantityMc * unitsPerMc;
      csvContent += `"${item.flavor}","${cat}",${item.quantityMc},${totalUnits},${item.lastUpdated}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "finished_goods_inventory.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      try {
        const lines = content.split(/\r?\n/).filter((l) => l.trim() !== "");
        if (lines.length < 2) {
          showError("CSV file appears to be empty or has no entries.");
          return;
        }

        const newItems: FinishedGoodsItem[] = [];
        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
        
        let flavorIdx = headers.findIndex((h) => h.includes("flavor") || h.includes("product"));
        let catIdx = headers.findIndex((h) => h.includes("category") || h.includes("group") || h.includes("type"));
        let qtyIdx = headers.findIndex((h) => h.includes("quantity") || h.includes("qty") || h.includes("mc"));

        if (flavorIdx === -1) flavorIdx = 0;
        if (catIdx === -1) catIdx = 1;
        if (qtyIdx === -1) qtyIdx = 2;

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",").map((c) => c.replace(/^["']|["']$/g, "").trim());
          if (cols.length < 2) continue;

          const rawFlavor = cols[flavorIdx] || "";
          const rawCat = catIdx !== -1 ? cols[catIdx] : "";
          const rawQty = cols[qtyIdx] ? parseFloat(cols[qtyIdx]) : 0;

          const matchedFlavor = settings.flavors.find(
            (f) => f.toLowerCase() === rawFlavor.toLowerCase()
          ) || rawFlavor || settings.flavors[0];

          let matchedCat = categories.find((c) => c.toLowerCase() === rawCat.toLowerCase());
          if (!matchedCat) {
            matchedCat = rawCat || categories[0] || "Gum 12pk 24ct";
          }

          if (matchedFlavor) {
            newItems.push({
              id: String(Date.now() + i),
              flavor: matchedFlavor,
              quantityMc: isNaN(rawQty) ? 0 : rawQty,
              lastUpdated: new Date().toISOString().split("T")[0],
              category: matchedCat,
            });
          }
        }

        if (newItems.length > 0) {
          setInventory((prev) => [...newItems, ...prev]);
          showSuccess(`Successfully imported ${newItems.length} items from CSV.`);
        } else {
          showError("Could not parse any valid rows from CSV.");
        }
      } catch (err) {
        console.error(err);
        showError("Failed to parse CSV. Please ensure standard CSV formatting.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = ""; // Clear file selector
  };

  const filteredInventory = inventory.filter((item) => {
    const matchesSearch = item.flavor.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFlavor = flavorFilter === "All" || item.flavor === flavorFilter;
    const itemCat = getCategoryForItem(item);
    const matchesCategory = categoryFilter === "All" || itemCat === categoryFilter;
    
    return matchesSearch && matchesFlavor && matchesCategory;
  });

  return (
    <div className="space-y-8" id="finished-goods-view">
      {/* Banner */}
      <div className="glass p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4" id="finished-goods-banner">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Finished Goods Inventory</h2>
          </div>
          <p className="text-slate-600 text-xs max-w-2xl">
            Import warehouse stock lists via CSV or manage cases directly. Integrates units per Master Case to compute total active retail units automatically.
          </p>
        </div>

        {/* Global CSV Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={handleDownloadTemplate}
            className="bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs border border-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-4 h-4 text-slate-400" /> Template CSV
          </button>
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-4 h-4" /> Import CSV List
          </button>
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleCSVUpload}
            className="hidden"
          />

          <button
            onClick={handleExportCSV}
            disabled={inventory.length === 0}
            className="bg-slate-900 hover:bg-slate-950 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Export CSV Inventory
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle className="w-4.5 h-4.5 text-emerald-500" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs flex items-center gap-2 animate-fadeIn">
          <AlertCircle className="w-4.5 h-4.5 text-rose-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        
        {/* Left Column: Add Row Form & Category Management */}
        <div className="xl:col-span-1 space-y-6">
          <form onSubmit={handleAddRow} className="glass p-5 space-y-4" id="fg-add-row-form">
            <div className="border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Plus className="w-3.5 h-3.5 text-slate-400" /> Manual Addition
              </h3>
            </div>

            {/* Flavor */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Flavor / Product</label>
              <select
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
                value={addFlavor}
                onChange={(e) => setAddFlavor(e.target.value)}
              >
                {settings.flavors.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Category</label>
              <select
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none font-bold text-indigo-700"
                value={addCategory}
                onChange={(e) => setAddCategory(e.target.value)}
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Qty in MC */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Quantity (Master Cases)</label>
              <input
                type="number"
                min="0"
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
                placeholder="e.g. 50"
                value={addQtyMc}
                onChange={(e) => setAddQtyMc(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-950 text-white font-semibold text-xs py-2 rounded-xl transition-all cursor-pointer shadow-xs"
            >
              Add To Inventory
            </button>
          </form>

          {/* Option to Add More Categories */}
          <div className="glass p-5 space-y-4" id="fg-manage-categories">
            <div className="border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-slate-400" /> Manage Categories
              </h3>
            </div>

            <div className="space-y-3">
              <div className="flex gap-1.5">
                <input
                  type="text"
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-slate-400"
                  placeholder="New category..."
                  value={newCategoryInput}
                  onChange={(e) => setNewCategoryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCategory();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  className="bg-slate-900 hover:bg-black text-white font-black text-xs px-3.5 py-1.5 rounded-lg cursor-pointer transition-colors"
                >
                  Add
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 pr-1 border border-slate-100 rounded-lg p-1 bg-white/40">
                {categories.map((cat) => (
                  <div key={cat} className="flex items-center justify-between py-1.5 px-2 text-[11px] font-semibold hover:bg-slate-100/50 rounded transition-colors">
                    <span className="text-slate-700">{cat}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCategory(cat)}
                      className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title={`Delete Category "${cat}"`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Inventory List & Search */}
        <div className="xl:col-span-3 space-y-4">
          
          {/* Controls */}
          <div className="glass p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search flavor..."
                className="w-full bg-white border border-slate-200 pl-9 pr-3 py-1.5 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-slate-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none"
                  value={flavorFilter}
                  onChange={(e) => setFlavorFilter(e.target.value)}
                >
                  <option value="All">All Flavors</option>
                  {settings.flavors.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-indigo-400" />
                <select
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="All">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {inventory.length > 0 && (
                <button
                  onClick={handleClearInventory}
                  className="text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 px-3 py-1 bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer transition-all border border-rose-100"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear All
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="glass p-5 overflow-x-auto" id="inventory-list-table">
            <table className="w-full text-xs text-left text-slate-700">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="pb-3 pr-4">Flavor</th>
                  <th className="pb-3 px-4">Category</th>
                  <th className="pb-3 px-4 text-right">Qty (MC)</th>
                  <th className="pb-3 px-4 text-right">Retail Units</th>
                  <th className="pb-3 px-4">Last Updated</th>
                  <th className="pb-3 pl-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInventory.length > 0 ? (
                  filteredInventory.map((item) => {
                    const cat = getCategoryForItem(item);
                    const unitsPerMc = getUnitsPerMcForCategory(cat);
                    const totalUnits = item.quantityMc * unitsPerMc;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="py-3 pr-4 font-bold text-slate-800">{item.flavor}</td>
                        <td className="py-3 px-4">
                          <select
                            className="bg-transparent border-b border-dashed border-slate-200 focus:border-slate-800 focus:outline-none text-slate-600 text-xs font-semibold cursor-pointer"
                            value={cat}
                            onChange={(e) => {
                              const val = e.target.value;
                              setInventory((prev) =>
                                prev.map((inv) =>
                                  inv.id === item.id ? { ...inv, category: val, lastUpdated: new Date().toISOString().split("T")[0] } : inv
                                )
                              );
                            }}
                          >
                            {categories.map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </td>
                        
                        {/* Qty MC Input */}
                        <td className="py-3 px-4 text-right">
                          <input
                            type="number"
                            min="0"
                            className="w-16 bg-transparent border-b border-dashed border-slate-200 focus:border-slate-800 focus:outline-none text-right font-semibold text-slate-800"
                            value={item.quantityMc}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value));
                              setInventory((prev) =>
                                prev.map((inv) =>
                                  inv.id === item.id ? { ...inv, quantityMc: val, lastUpdated: new Date().toISOString().split("T")[0] } : inv
                                )
                              );
                            }}
                          />
                        </td>

                        <td className="py-3 px-4 text-right font-semibold text-slate-500">
                          {totalUnits.toLocaleString()} units
                        </td>

                        <td className="py-3 px-4 text-slate-400">{item.lastUpdated}</td>
                        
                        <td className="py-3 pl-4 text-right">
                          <button
                            onClick={() => handleRemoveRow(item.id)}
                            className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Delete Row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400">
                      No finished goods matching your query found. Click "Add To Inventory" or upload a CSV!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>

    </div>
  );
}
