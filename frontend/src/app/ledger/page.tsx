"use client";
import { useEffect, useState } from "react";

interface Product {
  id: number;
  name: string;
  sku: string;
}

interface Location {
  id: number;
  name: string;
  type: string;
}

interface Move {
  id: number;
  reference: string;
  type: string;
  product_id: number;
  source_location_id: number;
  dest_location_id: number;
  qty: number;
  status: string;
  created_at?: string;
}

export default function LedgerPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [ledger, setLedger] = useState<Move[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [pageError, setPageError] = useState("");

  const [filterType, setFilterType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = async () => {
    setLoadingData(true);
    setPageError("");
    try {
      const headers = { "Authorization": `Bearer ${localStorage.getItem("token")}` };
      const [prodRes, locRes, ledgerRes] = await Promise.all([
        fetch("http://localhost:8000/products", { headers }),
        fetch("http://localhost:8000/locations", { headers }),
        fetch("http://localhost:8000/ledger", { headers })
      ]);

      if (!prodRes.ok || !locRes.ok || !ledgerRes.ok) {
        throw new Error("API Error");
      }

      setProducts(await prodRes.json());
      setLocations(await locRes.json());
      setLedger(await ledgerRes.json());
    } catch (err) {
      setPageError("Unable to load ledger. Please try again.");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getProductName = (id: number) => products.find(p => p.id === id)?.name || `Product #${id}`;
  const getProductSku = (id: number) => products.find(p => p.id === id)?.sku || "";
  const getLocationName = (id: number) => locations.find(l => l.id === id)?.name || `Loc #${id}`;

  const typeLabels: Record<string, string> = {
    receipt: "Receipt",
    transfer: "Transfer",
    delivery: "Delivery",
    adjustment: "Adjustment"
  };

  const filteredLedger = ledger.filter(move => {
    // Type filter
    if (filterType !== "all" && move.type !== filterType) {
      return false;
    }

    // Search query filter (case-insensitive)
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const pName = getProductName(move.product_id).toLowerCase();
      const pSku = getProductSku(move.product_id).toLowerCase();
      const ref = move.reference.toLowerCase();

      if (!ref.includes(q) && !pName.includes(q) && !pSku.includes(q)) {
        return false;
      }
    }

    return true;
  });

  if (loadingData) {
    return (
      <div className="flex h-full min-h-[50vh] items-center justify-center">
        <div className="text-gray-500 animate-pulse font-medium">Loading ledger data...</div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="flex flex-col h-full min-h-[50vh] items-center justify-center space-y-4">
        <div className="text-red-500 font-medium">{pageError}</div>
        <button onClick={fetchData} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ledger</h1>
        <p className="text-sm text-gray-500 mt-1">Complete history of inventory movements</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-full">
        {/* Filter Bar */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-gray-50 rounded-t-xl">
          <div className="flex gap-2">
            <select 
              value={filterType} 
              onChange={e => setFilterType(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="all">All Types</option>
              <option value="receipt">Receipts</option>
              <option value="transfer">Transfers</option>
              <option value="delivery">Deliveries</option>
              <option value="adjustment">Adjustments</option>
            </select>
          </div>
          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Search reference, product, SKU..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto whitespace-nowrap">
          {ledger.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No inventory movements yet.
            </div>
          ) : filteredLedger.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No movements match your search.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-sm border-b border-gray-100">
                  <th className="p-4 font-semibold">Reference</th>
                  <th className="p-4 font-semibold">Type</th>
                  <th className="p-4 font-semibold">Product</th>
                  <th className="p-4 font-semibold">SKU</th>
                  <th className="p-4 font-semibold text-right">Qty</th>
                  <th className="p-4 font-semibold">Source</th>
                  <th className="p-4 font-semibold">Destination</th>
                  <th className="p-4 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLedger.map((move) => (
                  <tr key={move.id} className="hover:bg-gray-50 transition-colors text-sm">
                    <td className="p-4 font-medium text-gray-900">{move.reference}</td>
                    <td className="p-4 text-gray-600">{typeLabels[move.type] || move.type}</td>
                    <td className="p-4 text-gray-900 font-medium">{getProductName(move.product_id)}</td>
                    <td className="p-4 text-gray-500">{getProductSku(move.product_id)}</td>
                    <td className="p-4 text-right font-medium text-gray-900">{move.qty}</td>
                    <td className="p-4 text-gray-600">{getLocationName(move.source_location_id)}</td>
                    <td className="p-4 text-gray-600">{getLocationName(move.dest_location_id)}</td>
                    <td className="p-4 text-center">
                      {move.status === "done" ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 uppercase tracking-wide">
                          Done
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 uppercase tracking-wide">
                          {move.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
