// src/pages/ReportPage.jsx
import React from "react"
import ReportForm from "../components/ReportForm"
import RecentReports from "../components/RecentReports"

export default function ReportPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Outer page container */}
        <div className="bg-white shadow-lg rounded-2xl p-6 md:p-10 border border-gray-200">
          <div className="grid grid-cols-1 gap-8">
            {/* Form area */}
            <section aria-labelledby="report-form-heading">
              <h2
                id="report-form-heading"
                className="text-2xl font-semibold text-gray-800 mb-4"
              >
                Submit a Report
              </h2>

              {/* Form itself */}
              <ReportForm />
            </section>

            <hr className="border-gray-100" />

            {/* Recent reports area */}
            <section aria-labelledby="recent-reports-heading">
              <h2
                id="recent-reports-heading"
                className="text-2xl font-semibold text-gray-800 mb-4"
              >
                Recent Community Reports
              </h2>

              {/* Inline list — no wrapper card */}
              <RecentReports inline limit={3} />
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
