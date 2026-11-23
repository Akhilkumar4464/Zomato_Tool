import React from 'react'

/**
 * ChartCard — Reusable white card wrapper for charts.
 * Renders a rounded, shadowed container with a title, optional subtitle,
 * and any chart children inside a padded body.
 */
export default function ChartCard({ title, subtitle, className = '', children }) {
  return (
    <div
      className={`bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden transition-shadow hover:shadow-lg ${className}`}
    >
      {/* Header */}
      {(title || subtitle) && (
        <div className="px-6 pt-5 pb-2">
          {title && <h3 className="text-lg font-semibold text-gray-800">{title}</h3>}
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      )}

      {/* Chart body */}
      <div className="px-4 pb-5">{children}</div>
    </div>
  )
}
