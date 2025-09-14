import React from "react"
import Header from "../components/Header"

export default function Shell({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Global Header */}
      <Header />

      {/* Main content */}
      <main
        role="main"
        className="flex-1 max-w-6xl w-full mx-auto px-6 py-10"
      >
        {children}
      </main>

      {/* Optional footer */}
      <footer className="bg-white border-t text-sm text-gray-500 py-4 text-center">
        © {new Date().getFullYear()} CivicReport · Municipal Issue Tracking
      </footer>
    </div>
  )
}
