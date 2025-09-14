// App.jsx
import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Shell from './layouts/Shell'

// Pages
import ReportPage from './pages/ReportPage'
import MapView from './pages/MapView'
import AdminDashboard from './pages/AdminDashboard'
import MapTest from './pages/MapTest'
import AdminLogin from './pages/AdminLogin' // Admin login page

export default function App() {
  return (
    <Shell>
      <Routes>
        {/* Home and reporting */}
        <Route index element={<ReportPage />} />
        <Route path="/report" element={<ReportPage />} />

        {/* Map views */}
        <Route path="/map" element={<MapView />} />
        <Route path="/maptest" element={<MapTest />} />

        {/* Admin pages */}
        {/* - /admin is the protected dashboard (expects admin token) */}
        {/* - /admin-login is the public login page for admin */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin-login" element={<AdminLogin />} />

        {/* Catch-all fallback */}
        <Route
          path="*"
          element={
            <div className="text-center text-gray-500 mt-20">
              <h2 className="text-2xl font-semibold mb-2">404 — Page Not Found</h2>
              <p>Sorry, the page you’re looking for doesn’t exist.</p>
            </div>
          }
        />
      </Routes>
    </Shell>
  )
}
