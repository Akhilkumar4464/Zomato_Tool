import React, { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Plus, Edit, Trash2, Download, Search,
  ChevronLeft, ChevronRight, Loader2, X, Save, ArrowUpDown,
} from 'lucide-react'
import Modal from '../components/Modal'
import { getRows, addRow, updateRow, deleteRow, exportCSV, getSummary } from '../api'

/**
 * AdminPage — Full CRUD admin panel with paginated data table,
 * search/filter, sort, add/edit modals, and CSV export.
 */
export default function AdminPage() {
  const { datasetId } = useParams()

  const [loading, setLoading] = useState(true)
  const [columns, setColumns] = useState([])
  const [rows, setRows] = useState([])
  const [totalRows, setTotalRows] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState(null)
  const [sortAsc, setSortAsc] = useState(true)

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [editIdx, setEditIdx] = useState(null) // global row index
  const [formData, setFormData] = useState({})

  // ---- data loading ----
  const fetchMeta = async () => {
    try {
      const { data } = await getSummary(datasetId)
      setColumns(data.columns || [])
    } catch { /* columns will be derived from rows */ }
  }

  const fetchRows = async (p = page) => {
    try {
      setLoading(true)
      const { data } = await getRows(datasetId, p, limit)
      const r = data.rows || data.data || []
      setRows(r)
      setTotalRows(data.total ?? data.total_rows ?? r.length)
      if (!columns.length && r.length) setColumns(Object.keys(r[0]))
    } catch (err) {
      toast.error('Failed to load rows')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchMeta() }, [datasetId])
  useEffect(() => { fetchRows(page) }, [datasetId, page])

  // ---- search & sort (client-side on current page) ----
  const displayed = useMemo(() => {
    let result = [...rows]
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((row) =>
        Object.values(row).some((v) => String(v).toLowerCase().includes(q)),
      )
    }
    if (sortCol) {
      result.sort((a, b) => {
        const va = a[sortCol] ?? ''
        const vb = b[sortCol] ?? ''
        const na = Number(va)
        const nb = Number(vb)
        if (!isNaN(na) && !isNaN(nb)) return sortAsc ? na - nb : nb - na
        return sortAsc
          ? String(va).localeCompare(String(vb))
          : String(vb).localeCompare(String(va))
      })
    }
    return result
  }, [rows, search, sortCol, sortAsc])

  const totalPages = Math.max(1, Math.ceil(totalRows / limit))

  // ---- handlers ----
  const handleSort = (col) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc)
    } else {
      setSortCol(col)
      setSortAsc(true)
    }
  }

  const openAdd = () => {
    setFormData(columns.reduce((acc, c) => ({ ...acc, [c]: '' }), {}))
    setShowAddModal(true)
  }

  const openEdit = (row, idx) => {
    setFormData({ ...row })
    setEditIdx((page - 1) * limit + idx)
    setShowAddModal(true)
  }

  const handleSave = async () => {
    try {
      if (editIdx != null) {
        await updateRow(datasetId, editIdx, formData)
        toast.success('Row updated')
      } else {
        await addRow(datasetId, formData)
        toast.success('Row added')
      }
      setShowAddModal(false)
      setEditIdx(null)
      fetchRows(page)
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Save failed')
    }
  }

  const handleDelete = async (localIdx) => {
    if (!window.confirm('Delete this row?')) return
    const globalIdx = (page - 1) * limit + localIdx
    try {
      await deleteRow(datasetId, globalIdx)
      toast.success('Row deleted')
      fetchRows(page)
    } catch {
      toast.error('Delete failed')
    }
  }

  const handleExport = async () => {
    try {
      const res = await exportCSV(datasetId)
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `dataset_${datasetId}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('CSV exported')
    } catch {
      toast.error('Export failed')
    }
  }

  // ---- render ----
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">⚙️ Admin Panel</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {totalRows.toLocaleString()} rows · Page {page} of {totalPages}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-zomato-500 hover:bg-zomato-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={16} /> Add Row
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Search rows…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zomato-500/30 focus:border-zomato-400 transition"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="text-zomato-500 animate-spin" size={32} />
            </div>
          ) : displayed.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <p className="font-medium">No rows found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-10">#</th>
                  {columns.map((col) => (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none whitespace-nowrap"
                    >
                      <span className="flex items-center gap-1">
                        {col}
                        <ArrowUpDown size={12} className={sortCol === col ? 'text-zomato-500' : 'text-gray-300'} />
                      </span>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayed.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{(page - 1) * limit + i + 1}</td>
                    {columns.map((col) => (
                      <td key={col} className="px-4 py-2.5 text-gray-700 max-w-[200px] truncate" title={String(row[col] ?? '')}>
                        {row[col] != null ? String(row[col]) : <span className="text-gray-300 italic">null</span>}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => openEdit(row, i)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors">
                        <Edit size={15} />
                      </button>
                      <button onClick={() => handleDelete(i)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors ml-1">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
          <p className="text-xs text-gray-500">
            Showing {Math.min((page - 1) * limit + 1, totalRows)}–{Math.min(page * limit, totalRows)} of {totalRows.toLocaleString()}
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum
              if (totalPages <= 7) {
                pageNum = i + 1
              } else if (page <= 4) {
                pageNum = i + 1
              } else if (page >= totalPages - 3) {
                pageNum = totalPages - 6 + i
              } else {
                pageNum = page - 3 + i
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                    page === pageNum ? 'bg-zomato-500 text-white' : 'hover:bg-gray-200 text-gray-600'
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setEditIdx(null) }}
        title={editIdx != null ? 'Edit Row' : 'Add New Row'}
        maxWidth="max-w-2xl"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {columns.map((col) => (
            <div key={col}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{col}</label>
              <input
                type="text"
                value={formData[col] ?? ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, [col]: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zomato-500/30 focus:border-zomato-400 transition"
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={() => { setShowAddModal(false); setEditIdx(null) }}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 bg-zomato-500 hover:bg-zomato-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Save size={16} /> {editIdx != null ? 'Update' : 'Add'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
