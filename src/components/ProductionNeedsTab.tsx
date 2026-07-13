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
      // Simulated sheets pull
      setLoading(true);
      setTimeout(() => {
        const demoData: ProductionNeedsRow[] = [
          { flavor: "Peppermint", packSizeName: "Bag 70ct", casesNeeded: 150, notes: "Amazon replenishment" },
          { flavor: "Cinnamon", packSizeName: "Bag 70ct", casesNeeded: 95, notes: "Retail PO #44102" },
          { flavor: "Fennel", packSizeName: "10 Pack", casesNeeded: 40, notes: "Distributor replenishment" },
          { flavor: "Ginger", packSizeName: "10 Pack", casesNeeded: 65, notes: "Urgent Out-of-Stock alert" },
          { flavor: "Cleanse", packSizeName: "Bag 70ct", casesNeeded: 25, notes: "Backlog backlog clearing" },
        ];
        setProductionNeeds(demoData);
        setRawRows([
          ["Flavor/Product", "Pack Size", "Needed (MC)", "Notes"],
          ["Peppermint", "Bag 70ct", "150", "Amazon replenishment"],
          ["Cinnamon", "Bag 70ct", "95", "Retail PO #44102"],
          ["Fennel", "10 Pack", "40", "Distributor replenishment"],
          ["Ginger", "10 Pack", "65", "Urgent Out-of-Stock alert"],
          ["Cleanse", "Bag 70ct", "25", "Backlog backlog clearing"],
        ]);
        setLoading(false);
        showSuccess("Fetched 5 rows of production needs (Demo Sheet Mode).");
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

      // Simple heuristic parsing to ProductionNeedsRow
      // Headers in first row or try to auto-match columns
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
        const rawQty = parseFloat(row[needCol] || "0");
        const rawNotes = row[notesCol] || "";

        // Attempt to map raw flavor name to real settings flavor
        const matchedFlavor = settings.flavors.find(
          (f) => f.toLowerCase() === rawFlavor.toLowerCase()
        ) || rawFlavor;

        parsedNeeds.push({
          flavor: matchedFlavor,
          packSizeName: rawPack,
          casesNeeded: isNaN(rawQty) ? 0 : rawQty,
          notes: rawNotes,
        });
      }

      setProductionNeeds(parsedNeeds);
      showSuccess(`Successfully imported ${parsedNeeds.length} production needs from Google Sheet!`);
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
                disabled={isDemoMode}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-slate-400 disabled:opacity-60"
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
                disabled={isDemoMode}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-slate-400 disabled:opacity-60"
                placeholder="e.g. Sheet1!A1:D20"
                value={range}
                onChange={(e) => setRange(e.target.value)}
              />
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
              <li>Must share the target spreadsheet as "Anyone with link can view" or authorize the signed-in Google account.</li>
              <li>Expected format columns: <strong>Flavor</strong>, <strong>Pack Size</strong>, <strong>Needed Cases</strong>, and optionally <strong>Notes</strong>.</li>
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
