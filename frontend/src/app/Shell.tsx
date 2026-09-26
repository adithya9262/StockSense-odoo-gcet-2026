"use client";
import { useState } from "react";
import Link from "next/link";

export default function Shell({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  // Link items. Disabled items are not clickable.
  const navItems = [
    { name: "Dashboard", href: "/", disabled: false },
    { name: "Products", href: "#", disabled: true },
    { name: "Receipts", href: "#", disabled: true },
    { name: "Deliveries", href: "#", disabled: true },
    { name: "Transfers", href: "#", disabled: true },
    { name: "Ledger", href: "#", disabled: true },
  ];

  return (
    <div className="flex h-screen overflow-hidden w-full">
      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 md:hidden" 
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 flex flex-col shrink-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
          <span className="font-bold text-xl text-blue-600">StockSense</span>
          <button className="md:hidden p-2 text-gray-500 hover:text-gray-700" onClick={() => setIsOpen(false)}>✕</button>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            item.disabled ? (
              <span key={item.name} className="block px-4 py-2 rounded-md text-gray-400 cursor-not-allowed">
                {item.name}
              </span>
            ) : (
              <Link key={item.name} href={item.href} onClick={() => setIsOpen(false)} className="block px-4 py-2 rounded-md bg-blue-50 text-blue-700 font-medium">
                {item.name}
              </Link>
            )
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden w-full">
        {/* Top bar (mobile) */}
        <header className="md:hidden shrink-0 h-16 bg-white border-b border-gray-200 flex items-center px-4 justify-between">
          <div className="font-bold text-lg text-blue-600">StockSense</div>
          <button className="p-2 text-gray-600 hover:text-gray-900" onClick={() => setIsOpen(true)}>☰</button>
        </header>
        
        {/* Top bar (desktop) */}
        <header className="hidden md:flex shrink-0 h-16 bg-white border-b border-gray-200 items-center px-8 justify-end">
          <div className="text-sm font-medium text-gray-500">Admin User</div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
