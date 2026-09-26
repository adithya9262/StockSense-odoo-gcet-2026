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

export default function DeliveriesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [ledger, setLedger] = useState<Move[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [pageError, setPageError] = useState("");

  const [productId, setProductId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [destId, setDestId] = useState("");
  const [qty, setQty] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const [currentDraft, setCurrentDraft] = useState<Move | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const fetchData = async () => {
    setLoadingData(true);
    setPageError("");
    try {
      const [prodRes, locRes, ledgerRes] = await Promise.all([
        fetch("http://localhost:8000/products"),
        fetch("http://localhost:8000/locations"),
        fetch("http://localhost:8000/ledger")
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

  const internalLocations = locations.filter(l => l.type === "internal");
  const customerLocations = locations.filter(l => l.type === "customer");
  const deliveryHistory = ledger.filter(m => m.type === "delivery");

  const handleCreateDraft = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!productId) return setFormError("Please select a product.");
    if (!sourceId) return setFormError("Please select a source location.");
    if (!destId) return setFormError("Please select a destination.");
    if (!qty || Number(qty) <= 0) return setFormError("Quantity must be greater than 0.");

    // The backend checks if source is internal and dest is customer.
    // We already filter dropdowns but just to be completely safe based on prompt instructions:
    const sourceLoc = locations.find(l => l.id === Number(sourceId));
    if (sourceLoc?.type !== "internal") return setFormError("Source must be an internal location.");

    setIsSubmitting(true);
    try {
      const shortId = window.crypto.randomUUID().slice(0, 6).toUpperCase();
      const ref = `WH/OUT/${Date.now()}-${shortId}`;
      
      const payload = [{
        reference: ref,
        type: "delivery",
        product_id: Number(productId),
        source_location_id: Number(sourceId),
        dest_location_id: Number(destId),
        qty: Number(qty)
      }];

      const res = await fetch("http://localhost:8000/moves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Unable to create delivery draft. Please try again.");
      }

      const createdMoves = await res.json();
      setCurrentDraft(createdMoves[0]);
      
      // Reset form
      setProductId("");
      setSourceId("");
      setDestId("");
      setQty("");
      
    } catch (err: any) {
      if (err.name === 'TypeError') {
        setFormError("Unable to connect to the server. Please try again.");
      } else {
        setFormError(err.message || "Unable to create delivery. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleValidate = async () => {
    if (!currentDraft) return;
    setFormError("");
    setFormSuccess("");
    setIsValidating(true);
    
    try {
      const res = await fetch(`http://localhost:8000/moves/${encodeURIComponent(currentDraft.reference)}/validate`, {
        method: "POST"
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Unable to validate delivery. Please try again.");
      }

      setFormSuccess("Delivery validated successfully. Stock has been updated.");
      setCurrentDraft(null);
      await fetchData();
      
      setTimeout(() => {
        setFormSuccess("");
      }, 5000);
    } catch (err: any) {
      if (err.name === 'TypeError') {
        setFormError("Unable to connect to the server. Please try again.");
      } else {
        setFormError(err.message || "Unable to validate delivery. Please try again.");
      }
    } finally {
      setIsValidating(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex h-full min-h-[50vh] items-center justify-center">
        <div className="text-gray-500 animate-pulse font-medium">Loading deliveries data...</div>
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
        <h1 className="text-2xl font-bold text-gray-900">Deliveries</h1>
        <p className="text-sm text-gray-500 mt-1">Send stock from your inventory to customers</p>
      </div>

      {formError && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-100">{formError}</div>}
      {formSuccess && <div className="text-sm text-green-700 bg-green-50 p-3 rounded-md border border-green-200">{formSuccess}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT: Create Delivery */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col h-full">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Delivery</h2>
          <form onSubmit={handleCreateDraft} className="space-y-4 flex-1">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product <span className="text-red-500">*</span></label>
              <select 
                value={productId} onChange={e => setProductId(e.target.value)} disabled={isSubmitting || isValidating || currentDraft !== null}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">Select a product...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source Internal Location <span className="text-red-500">*</span></label>
              <select 
                value={sourceId} onChange={e => setSourceId(e.target.value)} disabled={isSubmitting || isValidating || currentDraft !== null}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">Select source...</option>
                {internalLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Location <span className="text-red-500">*</span></label>
              <select 
                value={destId} onChange={e => setDestId(e.target.value)} disabled={isSubmitting || isValidating || currentDraft !== null}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">Select customer...</option>
                {customerLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity <span className="text-red-500">*</span></label>
              <input
                type="number" min="1"
                value={qty} onChange={e => setQty(e.target.value)} disabled={isSubmitting || isValidating || currentDraft !== null}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g. 10"
              />
            </div>

            <div className="pt-4 mt-auto">
              <button
                type="submit"
                disabled={isSubmitting || isValidating || currentDraft !== null}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition disabled:bg-blue-300 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Creating..." : "Create Draft"}
              </button>
            </div>
          </form>
        </div>

        {/* CENTER: Current Draft */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col h-full">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Draft</h2>
          {currentDraft ? (
            <div className="flex-1 flex flex-col">
              <div className="space-y-3 flex-1">
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-sm text-gray-500">Reference</span>
                  <span className="text-sm font-medium text-gray-900">{currentDraft.reference}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-sm text-gray-500">Product</span>
                  <span className="text-sm font-medium text-gray-900">{products.find(p => p.id === currentDraft.product_id)?.name || currentDraft.product_id}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-sm text-gray-500">Source</span>
                  <span className="text-sm font-medium text-gray-900">{locations.find(l => l.id === currentDraft.source_location_id)?.name || currentDraft.source_location_id}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-sm text-gray-500">Destination</span>
                  <span className="text-sm font-medium text-gray-900">{locations.find(l => l.id === currentDraft.dest_location_id)?.name || currentDraft.dest_location_id}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-sm text-gray-500">Quantity</span>
                  <span className="text-sm font-medium text-gray-900">{currentDraft.qty}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Status</span>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-800 uppercase tracking-wide">
                    {currentDraft.status}
                  </span>
                </div>
              </div>
              
              <div className="pt-4 mt-auto">
                <button
                  onClick={handleValidate}
                  disabled={isValidating}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition disabled:bg-green-300 disabled:cursor-not-allowed"
                >
                  {isValidating ? "Validating..." : "Validate Delivery"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400 border-2 border-dashed border-gray-100 rounded-lg p-6 text-center">
              Create a delivery draft to proceed.
            </div>
          )}
        </div>

        {/* RIGHT: Delivery History */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col h-full lg:max-h-[600px]">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Delivery History</h2>
          <div className="flex-1 overflow-y-auto pr-2">
            {deliveryHistory.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-8">
                No completed deliveries yet.
              </div>
            ) : (
              <div className="space-y-4">
                {deliveryHistory.map(move => (
                  <div key={move.id} className="p-3 border border-gray-100 rounded-lg bg-gray-50">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-sm text-gray-900">{move.reference}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                        DONE
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mb-1">
                      {products.find(p => p.id === move.product_id)?.name || `Product #${move.product_id}`}
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span className="text-red-600 font-medium">-{move.qty}</span>
                      <span>→ {locations.find(l => l.id === move.dest_location_id)?.name || `Loc #${move.dest_location_id}`}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
