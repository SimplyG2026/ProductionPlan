/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Settings } from "../types";
import { initializeApp, getApp, getApps } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User, 
  signOut 
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";
import { 
  FileSpreadsheet, 
  Key, 
  LogOut, 
  RefreshCw, 
  Database, 
  ArrowRight, 
  Check, 
  HelpCircle,
  Play
} from "lucide-react";

// Initialize Firebase App if not already initialized
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

// Sheets ReadOnly Scope
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

interface ProductionNeedsRow {
  flavor: string;
  packSizeName: string;
  casesNeeded: number;
  notes: string;
}

interface ProductionNeedsTabProps {
  settings: Settings;
  onImportToPriorities?: (needs: { flavor: string; packSizeId: string; mcsNeeded: number }[]) => void;
}

function findBestFlavor(raw: string, flavors: string[]) {
  if (!raw) return null;
  const clean = raw.toLowerCase().replace(/\bgum\b/g, "").replace(/\s+/g, "").trim();
  for (const f of flavors) {
    const fClean = f.toLowerCase().replace(/\s+/g, "").trim();
    if (clean === fClean || clean.includes(fClean) || fClean.includes(clean)) {
      return f;
    }
  }
  return null;
}

function findBestPackSize(raw: string, packSizes: any[]) {
  if (!raw) return null;
  const clean = raw.toLowerCase().replace(/\bpacks?\b/g, "pack").replace(/\s+/g, "").trim();
  for (const ps of packSizes) {
    const psClean = ps.name.toLowerCase().replace(/\bpacks?\b/g, "pack").replace(/\s+/g, "").trim();
    const psIdClean = ps.id.toLowerCase().replace(/\s+/g, "").trim();
    if (clean.includes(psClean) || psClean.includes(clean) || clean.includes(psIdClean) || psIdClean.includes(clean)) {
      return ps;
    }
  }
  // Fallbacks: e.g. "bag mc" matches "Bag 70ct" (id contains "bag")
  if (clean.includes("bag") || clean.includes("bg")) {
    const bagPs = packSizes.find(ps => ps.id.includes("bag") || ps.name.toLowerCase().includes("bag"));
    if (bagPs) return bagPs;
  }
  if (clean.includes("bulk")) {
    const bulkPs = packSizes.find(ps => ps.id.includes("bulk") || ps.name.toLowerCase().includes("bulk"));
    if (bulkPs) return bulkPs;
  }
  // Try checking numeric parts like "12" in both
  const digits = clean.match(/\d+/);
  if (digits) {
    const numStr = digits[0];
    for (const ps of packSizes) {
      if (ps.name.toLowerCase().includes(numStr) || ps.id.toLowerCase().includes(numStr)) {
        return ps;
      }
    }
  }
  return null;
}

function parseRowsToNeeds(rows: string[][], settings: Settings): ProductionNeedsRow[] {
  if (rows.length === 0) return [];

  // Detect Matrix/Crosstab format:
  // First row has flavors. Let's count how many headers after column 0 match any of our flavors.
  let matchedFlavorsCount = 0;
  for (let c = 1; c < rows[0].length; c++) {
    const val = rows[0][c] || "";
    if (findBestFlavor(val, settings.flavors)) {
      matchedFlavorsCount++;
    }
  }

  const isMatrix = matchedFlavorsCount >= 2;

  if (isMatrix) {
    const parsedNeeds: ProductionNeedsRow[] = [];
    const columnFlavors: (string | null)[] = [null]; // pad first col
    for (let c = 1; c < rows[0].length; c++) {
      const val = rows[0][c] || "";
      columnFlavors.push(findBestFlavor(val, settings.flavors));
    }

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (row.length === 0) continue;
      const rawPackName = row[0] || "";
      const bestPack = findBestPackSize(rawPackName, settings.packSizes);
      if (!bestPack) {
        // Skip non-matching rows like totals or logs
        continue;
      }

      for (let c = 1; c < row.length; c++) {
        const flavor = columnFlavors[c];
        if (!flavor) continue;

        const rawVal = row[c] || "";
        const casesNeeded = parseFloat(rawVal.replace(/,/g, ""));
        if (!isNaN(casesNeeded) && casesNeeded > 0) {
          parsedNeeds.push({
            flavor,
            packSizeName: bestPack.name,
            casesNeeded,
            notes: `Matrix: ${rawPackName}`,
          });
        }
      }
    }
    return parsedNeeds;
  } else {
    // Normal vertical tabular format
    let flavorCol = 0;
    let packCol = 1;
    let needCol = 2;
    let notesCol = 3;

    const header = rows[0].map((h) => h.toLowerCase());
    const hasHeaders = header.some((h) => h.includes("flavor") || h.includes("product") || h.includes("pack") || h.includes("need") || h.includes("case"));

    if (hasHeaders) {
      const foundFlavor = header.findIndex((h) => h.includes("flavor") || h.includes("product"));
      const foundPack = header.findIndex((h) => h.includes("pack") || h.includes("size"));
      const foundNeed = header.findIndex((h) => h.includes("need") || h.includes("case") || h.includes("qty"));
      const foundNotes = header.findIndex((h) => h.includes("note") || h.includes("desc"));

      if (foundFlavor !== -1) flavorCol = foundFlavor;
      if (foundPack !== -1) packCol = foundPack;
      if (foundNeed !== -1) needCol = foundNeed;
      if (foundNotes !== -1) notesCol = foundNotes;
    }

    const parsedNeeds: ProductionNeedsRow[] = [];
    const startIndex = hasHeaders ? 1 : 0;

    for (let i = startIndex; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 2) continue;

      const rawFlavor = row[flavorCol] || "";
      const rawPack = row[packCol] || "";
      const rawQty = parseFloat((row[needCol] || "0").replace(/,/g, ""));
      const rawNotes = row[notesCol] || "";

      // Attempt to map raw flavor name to real settings flavor
      const matchedFlavor = findBestFlavor(rawFlavor, settings.flavors) || rawFlavor;
      const matchedPack = findBestPackSize(rawPack, settings.packSizes);
      const packName = matchedPack ? matchedPack.name : rawPack;

      if (matchedFlavor && !isNaN(rawQty) && rawQty > 0) {
        parsedNeeds.push({
          flavor: matchedFlavor,
          packSizeName: packName,
          casesNeeded: rawQty,
          notes: rawNotes,
        });
      }
    }
    return parsedNeeds;
  }
}

const DEFAULT_SPREADSHEET_ID = "1BxiMVs0XRA5nFMdKvBdBZjgmUUYptlbs74OgvE2upms"; // Google Sheets standard example
const DEFAULT_RANGE = "Class Data!A2:E30";

export default function ProductionNeedsTab({ 
  settings, 
  onImportToPriorities 
}: ProductionNeedsTabProps) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sheets configuration
  const [sheetUrlOrId, setSheetUrlOrId] = useState<string>("");
  const [range, setRange] = useState<string>("Sheet1!A1:D20");

  // Fetched Needs Data
  const [productionNeeds, setProductionNeeds] = useState<ProductionNeedsRow[]>([]);
  
  // Demo Mode toggle
  const [isDemoMode, setIsDemoMode] = useState(true);

  // Loaded rows raw representation
  const [rawRows, setRawRows] = useState<string[][]>([]);

  // Listen to Firebase auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setAccessToken(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Helper to extract Spreadsheet ID
  const getSpreadsheetId = (input: string): string => {
    const trimmed = input.trim();
    if (trimmed.includes("docs.google.com/spreadsheets")) {
      const matches = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
      return matches ? matches[1] : trimmed;
    }
    return trimmed || DEFAULT_SPREADSHEET_ID;
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope(SHEETS_SCOPE);
      
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setAccessToken(credential.accessToken);
        setIsDemoMode(false);
        showSuccess("Successfully connected to Google Workspace!");
      } else {
        throw new Error("No Google access token received from login.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Google login failed: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setAccessToken(null);
      setUser(null);
      setRawRows([]);
      setProductionNeeds([]);
      showSuccess("Signed out of Google account.");
    } catch (err: any) {
      setErrorMsg("Signout failed.");
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Fetch from Google Sheet
  const handleFetchSheet = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const spreadsheetId = getSpreadsheetId(sheetUrlOrId);

    if (isDemoMode) {
      setLoading(true);
      setTimeout(() => {
        let rowsToUse: string[][];
        const upperRange = range.toUpperCase();
        if (upperRange.includes("A4:P11") || upperRange.includes("WHAT TO COOK") || sheetUrlOrId.toUpperCase().includes("A4:P11")) {
          // Matrix Mode matching user's spreadsheet screenshot exactly
          rowsToUse = [
            [
              "",
              "Peppermint Gum",
              "Cinnamon Gum",
              "Ginger Gum",
              "Fennel Gum",
              "Coffee Gum",
              "Maple Gum",
              "Cleanse Gum",
              "Spearmint Gum",
              "Trader Joe's Gum",
              "SF Peppermint Gum",
              "SF Bubblegum Gum",
              "SF Spearmint Gum",
              "Pumpkin Spice Gum",
              "Wintergreen Gum"
            ],
            ["MCs on Sales Order Log", "253", "14", "5", "0", "0", "0", "252", "349", "540", "1", "94", "136", "0", "110"],
            ["12 Packs MC", "119", "14", "5", "0", "0", "0", "20", "38", "540", "", "", "", "", ""],
            ["6 Packs MC", "", "", "", "", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"],
            ["3 Packs MC", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
            ["Bulk MC", "", "", "", "", "", "", "11", "14", "", "0", "62", "90", "", ""],
            ["Bag MC", "670", "", "", "", "", "", "1075", "1451", "", "", "", "", "", "515"]
          ];
        } else {
          // Standard demo rows
          rowsToUse = [
            ["Flavor/Product", "Pack Size", "Needed (MC)", "Notes"],
            ["Peppermint", "Bag 70ct", "150", "Amazon replenishment"],
            ["Cinnamon", "Bag 70ct", "95", "Retail PO #44102"],
            ["Fennel", "10 Pack", "40", "Distributor replenishment"],
            ["Ginger", "10 Pack", "65", "Urgent Out-of-Stock alert"],
            ["Cleanse", "Bag 70ct", "25", "Backlog backlog clearing"],
          ];
        }

        setRawRows(rowsToUse);
        const parsed = parseRowsToNeeds(rowsToUse, settings);
        setProductionNeeds(parsed);
        setLoading(false);
        showSuccess(`Successfully fetched and parsed ${parsed.length} production needs (Demo Mode)!`);
      }, 700);
      return;
    }

    if (!accessToken) {
      setErrorMsg("Please sign in with Google to query real spreadsheet data.");
      return;
    }

    setLoading(true);
    try {
      const cleanRange = encodeURIComponent(range.trim() || "Sheet1!A1:D20");
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${cleanRange}`;
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `HTTP ${response.status} Error`);
      }

      const data = await response.json();
      const rows: string[][] = data.values || [];

      if (rows.length === 0) {
        throw new Error("No cell data found in selected sheet and range.");
      }

      setRawRows(rows);
      const parsed = parseRowsToNeeds(rows, settings);
      setProductionNeeds(parsed);
      showSuccess(`Successfully imported ${parsed.length} production needs from Google Sheet!`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Failed to query Google Sheet: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Automatically fetch demo sheet on component load
  useEffect(() => {
    if (isDemoMode && productionNeeds.length === 0) {
      handleFetchSheet();
    }
  }, [isDemoMode]);

  // Handle push to planning priorities
  const handleApplyToPriorities = () => {
    if (!onImportToPriorities || productionNeeds.length === 0) return;

    // Map needs list to Priority structure
    const importList = productionNeeds.map((need) => {
      // Find pack size ID
      const matchedPs = settings.packSizes.find(
        (ps) => ps.name.toLowerCase() === need.packSizeName.toLowerCase() || ps.id === need.packSizeName.toLowerCase()
      ) || settings.packSizes[0];

      return {
        flavor: need.flavor,
        packSizeId: matchedPs ? matchedPs.id : "bag_70ct",
        mcsNeeded: need.casesNeeded,
      };
    });

    onImportToPriorities(importList);
    showSuccess("Successfully imported spreadsheet needs into weekly packing schedule priorities!");
  };

  return (
    <div className="space-y-8" id="production-needs-view">
      {/* 1. Header */}
      <div className="glass p-6 flex flex-col md:flex-row md:items-center justify-between gap-4" id="needs-banner">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Google Sheets Production Needs</h2>
          </div>
          <p className="text-slate-600 text-xs max-w-2xl">
            Integrate directly with sales spreadsheets, ERP demands, or logistics sheets. Authenticate with Google to fetch real-time demand lists directly into your planner.
          </p>
        </div>

        {/* Demo Mode Toggle or Auth Status */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setIsDemoMode(!isDemoMode)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              isDemoMode
                ? "bg-indigo-50 border-indigo-200 text-indigo-800"
                : "bg-white border-slate-200 text-slate-600 hover:border-slate-400"
            }`}
          >
            {isDemoMode ? "🟢 Demo Sheets Mode Active" : "🛠️ Use Google Sign-In"}
          </button>

          {user ? (
            <div className="flex items-center gap-2 bg-slate-900 text-white px-3 py-1.5 rounded-xl border border-white/10 text-xs font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="max-w-[120px] truncate">{user.displayName || user.email}</span>
              <button
                onClick={handleSignOut}
                className="text-slate-400 hover:text-rose-400 transition-colors ml-1 cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            !isDemoMode && (
              <button
                onClick={handleGoogleSignIn}
                className="bg-slate-950 hover:bg-black text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 shadow-md cursor-pointer transition-all border border-white/10"
              >
                <Key className="w-3.5 h-3.5" /> Google Login
              </button>
            )
          )}
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl text-xs flex items-center gap-2 animate-fadeIn">
          <Check className="w-4.5 h-4.5 text-emerald-500" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs flex items-center gap-2 animate-fadeIn">
          <HelpCircle className="w-4.5 h-4.5 text-rose-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        
        {/* Settings Column */}
        <div className="xl:col-span-1 space-y-4">
          <div className="glass p-5 space-y-4">
            <div className="border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-slate-400" /> Sheet Properties
              </h3>
            </div>

            {/* URL/ID Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Spreadsheet ID or URL</label>
              <input
                type="text"
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-slate-400"
                placeholder={DEFAULT_SPREADSHEET_ID}
                value={sheetUrlOrId}
                onChange={(e) => setSheetUrlOrId(e.target.value)}
              />
              <p className="text-[9px] text-slate-400">Pasting full browser URL works too!</p>
            </div>

            {/* Range */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Sheet Range</label>
              <input
                type="text"
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-slate-400"
                placeholder="e.g. Sheet1!A1:D20"
                value={range}
                onChange={(e) => setRange(e.target.value)}
              />
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  setRange("'WHAT TO COOK'!A4:P11");
                  showSuccess("Loaded 'WHAT TO COOK'!A4:P11 matrix range preset.");
                }}
                className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold underline cursor-pointer"
              >
                👉 Load "'WHAT TO COOK'!A4:P11" matrix preset
              </button>
            </div>

            <button
              onClick={handleFetchSheet}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Fetch Sheets Data
            </button>
          </div>

          {/* Instructions Box */}
          <div className="bg-slate-50 border border-slate-200 p-4.5 rounded-2xl space-y-2">
            <h4 className="text-xs font-bold text-slate-800">Integration Guidelines</h4>
            <ul className="text-[11px] text-slate-500 space-y-1.5 list-disc pl-4">
              <li>Supports both <strong>standard vertical lists</strong> and <strong>transposed matrix layouts</strong> (flavors up top, pack sizes on left) automatically!</li>
              <li>Must share the target spreadsheet as "Anyone with link can view" or authorize the signed-in Google account.</li>
              <li>Toggle "Demo Mode" in the header to preview spreadsheet connections instantly!</li>
            </ul>
          </div>
        </div>

        {/* Display Column */}
        <div className="xl:col-span-3 space-y-4">
          
          <div className="glass p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Retrieved Sheets Demands</h3>
                <p className="text-[11px] text-slate-500">Live grid mapping retrieved from Google Sheets rows into the planner.</p>
              </div>

              {productionNeeds.length > 0 && onImportToPriorities && (
                <button
                  onClick={handleApplyToPriorities}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
                >
                  <ArrowRight className="w-4 h-4" /> Import to Weekly Packing priorities
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-700">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="pb-3 pr-4">Flavor / Product</th>
                    <th className="pb-3 px-4">Pack Size Required</th>
                    <th className="pb-3 px-4 text-right">Needed Cases (MC)</th>
                    <th className="pb-3 px-4">Notes / Destination</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productionNeeds.length > 0 ? (
                    productionNeeds.map((need, index) => (
                      <tr key={index} className="hover:bg-slate-50/50">
                        <td className="py-3 pr-4 font-bold text-slate-800">{need.flavor}</td>
                        <td className="py-3 px-4 text-slate-600">{need.packSizeName}</td>
                        <td className="py-3 px-4 text-right font-semibold text-indigo-700">
                          {need.casesNeeded} MC
                        </td>
                        <td className="py-3 px-4 text-slate-400 italic">{need.notes || "No notes"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-slate-400">
                        {loading ? "Fetching data from Google Sheets..." : "No data retrieved yet. Enter a Google Sheet parameters and range, then click Fetch!"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Raw Cells Preview (Collapsible / Advanced) */}
          {rawRows.length > 0 && (
            <div className="glass p-5 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Raw Cells Table Grid</h4>
              <div className="overflow-x-auto max-h-48 scrollbar-thin">
                <table className="w-full text-[10px] text-left text-slate-500 border-collapse">
                  <tbody>
                    {rawRows.map((row, rIdx) => (
                      <tr key={rIdx} className="border-b border-slate-100">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="py-1 px-2 border-r border-slate-50 font-mono text-slate-600 truncate max-w-[150px]">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
