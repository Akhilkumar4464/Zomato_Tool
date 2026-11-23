import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Sparkles,
  Settings,
  Upload,
  Menu,
  X,
  ChevronLeft,
  Database,
} from 'lucide-react'

/**
 * Sidebar — Fixed left navigation bar.
 * Shows Zomato branding, dataset name, and nav links.
 * Collapsible on mobile via hamburger toggle.
 */
export default function Sidebar({ datasetId, datasetName }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const links = [
    { to: `/dashboard/${datasetId}`, label: 'Dashboard', icon: <BarChart3 size={20} /> },
    { to: `/predict/${datasetId}`, label: 'Predictions', icon: <Sparkles size={20} /> },
    { to: `/admin/${datasetId}`, label: 'Admin Panel', icon: <Settings size={20} /> },
    { to: '/', label: 'Upload New', icon: <Upload size={20} /> },
  ]

  const navContent = (
    <>
      {/* Brand */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🍽️</span>
          <h1 className="text-xl font-bold text-white tracking-tight">Zomato</h1>
        </div>
        <p className="text-xs text-gray-400 mt-1">Analytics & Prediction Tool</p>
      </div>

      {/* Dataset badge */}
      {datasetName && (
        <div className="mx-4 mb-4 px-3 py-2 rounded-lg bg-gray-800/60 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-300">
            <Database size={14} />
            <span className="text-xs font-medium truncate">{datasetName}</span>
          </div>
        </div>
      )}

      {/* Nav links */}
      <nav className="flex-1 px-3 space-y-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-zomato-600 text-white shadow-lg shadow-zomato-600/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`
            }
          >
            {link.icon}
            {link.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-800">
        <p className="text-xs text-gray-500">© 2024 Zomato Analytics</p>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-gray-900 text-white rounded-lg shadow-lg"
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed top-0 left-0 h-full w-60 bg-gray-900 z-40 flex flex-col transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        {navContent}
      </aside>
    </>
  )
}
