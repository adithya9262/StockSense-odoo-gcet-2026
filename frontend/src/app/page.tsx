"use client";
import { useEffect, useState } from "react";

interface DashboardData {
  total_products: number;
  total_stock: number;
  low_stock: number;
  pending_receipts: number;
  pending_deliveries: number;
  pending_transfers: number;
}

function KpiCard({ title, value, type = "default" }: { title: string, value: string | number, type?: "default" | "warning" }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 flex flex-col">
      <h3 className="text-sm font-medium text-gray-500 mb-2">{title}</h3>
      <div className={`text-3xl font-semibold ${type === "warning" && Number(value) > 0 ? "text-red-600" : "text-gray-900"}`}>
        {value}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("http://localhost:8000/dashboard", {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      if (!res.ok) throw new Error("API Error");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex h-full min-h-[50vh] items-center justify-center">
        <div className="text-gray-500 animate-pulse font-medium">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full min-h-[50vh] items-center justify-center space-y-4">
        <div className="text-red-500 font-medium">Unable to load dashboard. Please try again.</div>
        <button onClick={fetchDashboard} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition">
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <button onClick={fetchDashboard} className="text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-1 bg-blue-50 hover:bg-blue-100 rounded-md transition">
          Refresh
        </button>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <KpiCard title="Total Products" value={data.total_products} />
        <KpiCard title="Total Stock" value={data.total_stock} />
        <KpiCard title="Low Stock (≤10)" value={data.low_stock} type="warning" />
        <KpiCard title="Pending Receipts" value={data.pending_receipts} />
        <KpiCard title="Pending Deliveries" value={data.pending_deliveries} />
        <KpiCard title="Pending Transfers" value={data.pending_transfers} />
      </div>
    </div>
  );
}
