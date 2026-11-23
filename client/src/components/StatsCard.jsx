import React from 'react'

/**
 * StatsCard — Compact metric card with icon, label, value, and optional change badge.
 * Props:
 *   icon  — React node (lucide icon element)
 *   label — string description
 *   value — primary metric string / number
 *   change — optional "+12%" style string
 *   color — tailwind color key e.g. "red", "blue", "green", "yellow"
 */

const colorMap = {
  red:    { bg: 'bg-red-50',    text: 'text-red-600',    ring: 'ring-red-200' },
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-600',   ring: 'ring-blue-200' },
  green:  { bg: 'bg-green-50',  text: 'text-green-600',  ring: 'ring-green-200' },
  yellow: { bg: 'bg-yellow-50', text: 'text-yellow-600', ring: 'ring-yellow-200' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', ring: 'ring-purple-200' },
  cyan:   { bg: 'bg-cyan-50',   text: 'text-cyan-600',   ring: 'ring-cyan-200' },
}

export default function StatsCard({ icon, label, value, change, color = 'red' }) {
  const c = colorMap[color] || colorMap.red

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5 flex items-center gap-4 hover:shadow-lg transition-shadow">
      {/* Icon circle */}
      <div className={`flex-shrink-0 w-12 h-12 rounded-lg ${c.bg} ${c.text} ring-1 ${c.ring} flex items-center justify-center`}>
        {icon}
      </div>

      {/* Text */}
      <div className="min-w-0">
        <p className="text-sm text-gray-500 truncate">{label}</p>
        <p className="text-2xl font-bold text-gray-800 truncate">{value}</p>
        {change && (
          <span
            className={`text-xs font-medium ${
              change.startsWith('+') ? 'text-green-600' : change.startsWith('-') ? 'text-red-600' : 'text-gray-500'
            }`}
          >
            {change}
          </span>
        )}
      </div>
    </div>
  )
}
