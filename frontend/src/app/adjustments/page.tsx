"use client";
import { useEffect, useState, FormEvent } from "react";

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

export default function AdjustmentsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [ledger, setLedger] = useState<Move[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [pageError, setPageError] = useState("");

  const [productId, setProductId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [countedQty, setCountedQty] = useState("");
  const [recordedStock, setRecordedStock] = useState<number | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

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
      setPageError("Unable to connect to the server. Please try again.");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const fetchStock = async () => {
      if (productId && locationId) {
        try {
          const res = await fetch(`http://localhost:8000/stock/${productId}/${locationId}`, {
            headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
          });
          if (res.ok) {
            const data = await res.json();
            setRecordedStock(data.qty);
          }
        } catch (e) {
          console.error(e);
        }
      } else {
        setRecordedStock(null);
      }
    };
    fetchStock();
  }, [productId, locationId]);

  const internalLocations = locations.filter(l => l.type === "internal");
  const adjustmentHistory = ledger.filter(m => m.type === "adjustment");

  const difference = (recordedStock !== null && countedQty !== "") ? (Number(countedQty) - recordedStock) : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!productId) return setFormError("Please select a product.");
    if (!locationId) return setFormError("Please select an internal location.");
    if (countedQty === "" || Number(countedQty) < 0) return setFormError("Physical count must be 0 or greater.");
    if (difference === 0) return setFormSuccess("No adjustment needed. Physical count matches recorded stock.");

    setIsSubmitting(true);
    try {
      const res = await fetch("http://localhost:8000/adjustments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          product_id: Number(productId),
          location_id: Number(locationId),
          counted_qty: Number(countedQty)
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.detail || "Failed to process adjustment.");
      } else {
        setFormSuccess(data.message || "Adjustment successful.");
        setCountedQty("");
        setRecordedStock(null); // will be refreshed by useEffect if inputs remain
        fetchData(); // refresh ledger and stock implicitly
      }
    } catch (err) {
      setFormError("Unable to connect to the server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex h-full min-h-[50vh] items-center justify-center">
        <div className="text-gray-500 animate-pulse font-medium">Loading adjustments...</div>
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
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Adjustments</h1>
          <p className="text-gray-500 text-sm mt-1">Reconcile recorded stock with physical count.</p>
        </div>
        <button onClick={fetchData} className="text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-1 bg-blue-50 hover:bg-blue-100 rounded-md transition">
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-6 border-b border-gray-100 pb-4">New Adjustment</h2>

        {formError && (
          <div className="mb-6 p-4 rounded-md bg-red-50 border border-red-100 text-sm text-red-600 flex items-start">
            <span className="mr-2">⚠</span>
            <span>{formError}</span>
          </div>
        )}

        {formSuccess && (
          <div className="mb-6 p-4 rounded-md bg-green-50 border border-green-100 text-sm text-green-700 flex items-start">
            <span className="mr-2">✓</span>
            <span>{formSuccess}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                disabled={isSubmitting}
              >
                <option value="">Select a product...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>[{p.sku}] {p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Internal Location</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                disabled={isSubmitting}
              >
                <option value="">Select internal location...</option>
                {internalLocations.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-gray-50">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Recorded Stock</label>
              <div className="w-full border border-gray-200 bg-gray-50 text-gray-600 rounded-md px-3 py-2 text-sm">
                {recordedStock !== null ? recordedStock : "-"}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Physical Count</label>
              <input
                type="number"
                min="0"
                value={countedQty}
                onChange={(e) => setCountedQty(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter physical count"
                disabled={isSubmitting || recordedStock === null}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Calculated Adjustment</label>
              <div className={`w-full border rounded-md px-3 py-2 text-sm font-medium ${
                difference === null ? 'border-gray-200 bg-gray-50 text-gray-500' :
                difference > 0 ? 'border-green-200 bg-green-50 text-green-700' :
                difference < 0 ? 'border-red-200 bg-red-50 text-red-700' :
                'border-gray-300 bg-gray-100 text-gray-700'
              }`}>
                {difference === null ? "-" : difference > 0 ? `+${difference}` : difference}
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || recordedStock === null}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md transition disabled:bg-blue-300 flex items-center shadow-sm"
            >
              {isSubmitting ? "Processing..." : "Validate Adjustment"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-6">Recent Adjustments</h2>

        {adjustmentHistory.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-slate-500 text-sm">No adjustments have been recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source Loc</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dest Loc</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty Adjusted</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {adjustmentHistory.slice(0, 10).map((move) => {
                  const product = products.find(p => p.id === move.product_id);
                  const source = locations.find(l => l.id === move.source_location_id);
                  const dest = locations.find(l => l.id === move.dest_location_id);

                  return (
                    <tr key={move.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{move.reference}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{product ? `[${product.sku}] ${product.name}` : `ID: ${move.product_id}`}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{source?.name || `ID: ${move.source_location_id}`}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{dest?.name || `ID: ${move.dest_location_id}`}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium text-right">{move.qty}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          {move.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
