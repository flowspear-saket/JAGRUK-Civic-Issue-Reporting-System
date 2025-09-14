// src/components/Header.jsx
import React from "react"
import { NavLink } from "react-router-dom"
// Optional: lucide-react gives nicer icons. If you don't have it, the fallback SVG is used.
let RotateIcon = null
try {
  // dynamic require so build won't fail if lucide-react isn't installed in some environments
  // (Vite may tree-shake; if this causes issues, install lucide-react or replace below)
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  RotateIcon = require("lucide-react").RotateCcw
} catch (e) {
  RotateIcon = null
}

function FallbackRotate({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M21 12a9 9 0 10-2.4 6.03" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M21 3v6h-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function Header({ onRefresh } = {}) {
  const links = [
    { path: "/report", label: "Report Issue" },
    { path: "/map", label: "Map View" },
    { path: "/admin", label: "Admin Portal" },
  ]

  const handleRefresh = () => {
    if (typeof onRefresh === "function") return onRefresh()
    // default: soft reload using history replace to current location to avoid full reload unless necessary
    try {
      // try a soft reload by reloading the page state; fallback to full reload
      window.location.reload()
    } catch (e) {
      window.location.href = window.location.href
    }
  }

  return (
    <header className="bg-white border-b shadow-sm">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo + Subtitle */}
        <div className="flex items-baseline gap-3">
          <div className="text-2xl font-bold text-blue-600">CivicReport</div>
          <span className="text-sm text-gray-500">Municipal Issue Tracking</span>
        </div>

        {/* Navigation */}
        <nav aria-label="Main navigation">
          <ul className="flex items-center gap-2">
            {links.map(({ path, label }) => (
              <li key={path}>
                <NavLink
                  to={path}
                  end={path === "/"} // only exact match for root
                  className={({ isActive }) =>
                    `px-4 py-2 rounded-full text-sm transition-colors ${
                      isActive ? "bg-blue-100 text-blue-700 font-medium" : "hover:bg-gray-100 text-gray-700"
                    }`
                  }
                  title={label}
                  aria-current={undefined}
                >
                  {label}
                </NavLink>
              </li>
            ))}

            {/* Refresh button */}
            <li>
              <button
                title="Refresh page"
                aria-label="Refresh page"
                onClick={handleRefresh}
                className="ml-2 w-9 h-9 rounded-full border flex items-center justify-center hover:bg-gray-100 transition-colors"
                type="button"
              >
                {RotateIcon ? <RotateIcon size={18} /> : <FallbackRotate size={18} />}
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  )
}