"use client";
import { useEffect, useState, FormEvent } from "react";

interface Product {
  id: number;
  sku: string;
  name: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const fetchProducts = async () => {
    setLoading(true);
    setPageError("");
    try {
      const res = await fetch("http://localhost:8000/products");
      if (!res.ok) throw new Error("API Error");
      const json = await res.json();
      setProducts(json);
    } catch (err) {
      setPageError("Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");
    
    const trimmedName = name.trim();
    const trimmedSku = sku.trim();
    
    if (!trimmedName) {
      setFormError("Product name is required.");
      return;
    }
    if (!trimmedSku) {
      setFormError("SKU is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("http://localhost:8000/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, sku: trimmedSku }),
      });
      
      if (!res.ok) {
        if (res.status === 409) {
          throw new Error("A product with this SKU already exists.");
        }
        throw new Error("Unable to create product. Please try again.");
      }
      
      setName("");
      setSku("");
      setFormSuccess("Product created successfully!");
      fetchProducts();
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        setFormSuccess("");
      }, 3000);
    } catch (err: any) {
      // Catch network errors (TypeError in fetch)
      if (err.name === 'TypeError') {
        setFormError("Unable to connect to the server. Please try again.");
      } else {
        setFormError(err.message || "Unable to create product. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading && products.length === 0) {
    return (
      <div className="flex h-full min-h-[50vh] items-center justify-center">
        <div className="text-gray-500 animate-pulse font-medium">Loading products...</div>
      </div>
    );
  }

  if (pageError && products.length === 0) {
    return (
      <div className="flex flex-col h-full min-h-[50vh] items-center justify-center space-y-4">
        <div className="text-red-500 font-medium">{pageError}</div>
        <button onClick={fetchProducts} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Create Product Form */}
        <div className="w-full lg:w-1/3">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Product</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. MacBook Pro"
                  disabled={isSubmitting}
                />
              </div>
              
              <div>
                <label htmlFor="sku" className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                <input
                  id="sku"
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. MAC-PRO-2023"
                  disabled={isSubmitting}
                />
              </div>

              {formError && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{formError}</div>}
              {formSuccess && <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md">{formSuccess}</div>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition disabled:bg-blue-300 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Creating..." : "Create Product"}
              </button>
            </form>
          </div>
        </div>

        {/* Product Table */}
        <div className="w-full lg:w-2/3">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-500 whitespace-nowrap">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th scope="col" className="px-6 py-3 w-20">ID</th>
                    <th scope="col" className="px-6 py-3">Name</th>
                    <th scope="col" className="px-6 py-3">SKU</th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                        {loading ? "Loading..." : "No products yet. Create your first product."}
                      </td>
                    </tr>
                  ) : (
                    products.map((product) => (
                      <tr key={product.id} className="bg-white border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">{product.id}</td>
                        <td className="px-6 py-4">{product.name}</td>
                        <td className="px-6 py-4">{product.sku}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
