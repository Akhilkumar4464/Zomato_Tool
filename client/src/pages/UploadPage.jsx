import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import {
  Upload,
  FileSpreadsheet,
  BarChart3,
  Trash2,
  Loader2,
  ArrowRight,
  Database,
  Clock,
  Sparkles,
  TrendingUp,
  Brain,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  Layers,
  UtensilsCrossed,
  FileCheck2,
} from 'lucide-react'
import { uploadCSV, getDatasets, deleteDataset } from '../api'

/**
 * UploadPage — Premium Zomato Analytics & Predictive Modeling Landing Hub.
 * Features:
 * - Dynamic drag-and-drop CSV upload with real-time feedback
 * - 1-Click quick launch for preloaded sample dataset
 * - Detailed dataset gallery with metadata tags
 * - Interactive platform capability breakdown
 * - Dataset schema & column guide
 */
export default function UploadPage({ onDatasetLoaded }) {
  const navigate = useNavigate()
  const [datasets, setDatasets] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStep, setUploadStep] = useState('Uploading...')
  const [loadingDatasets, setLoadingDatasets] = useState(true)
  const [showGuide, setShowGuide] = useState(false)

  // Fetch existing datasets on mount
  useEffect(() => {
    fetchDatasets()
  }, [])

  const fetchDatasets = async () => {
    try {
      setLoadingDatasets(true)
      const res = await getDatasets()
      const payload = res.data?.data || res.data || {}
      const list = Array.isArray(payload)
        ? payload
        : payload.datasets || res.data?.datasets || []
      setDatasets(list)
    } catch {
      setDatasets([])
    } finally {
      setLoadingDatasets(false)
    }
  }

  // Handle file drop / selection
  const onDrop = useCallback(
    async (accepted) => {
      if (!accepted.length) return
      const file = accepted[0]

      if (!file.name.endsWith('.csv')) {
        toast.error('Please upload a valid .csv spreadsheet file')
        return
      }

      try {
        setUploading(true)
        setUploadProgress(15)
        setUploadStep('Reading spreadsheet file...')

        const step1 = setTimeout(() => {
          setUploadProgress(45)
          setUploadStep('Detecting numeric & categorical columns...')
        }, 300)

        const step2 = setTimeout(() => {
          setUploadProgress(75)
          setUploadStep('Cleaning rate formats & prices...')
        }, 700)

        const res = await uploadCSV(file)
        clearTimeout(step1)
        clearTimeout(step2)
        setUploadProgress(100)
        setUploadStep('Finalizing dashboard & analytics...')

        toast.success('Dataset uploaded & analyzed successfully!')
        const resData = res.data?.data || res.data || {}
        const id = resData.datasetId || resData.dataset_id || resData.id || res.data?.datasetId

        if (id) {
          if (onDatasetLoaded) onDatasetLoaded(id, file.name)
          setTimeout(() => navigate(`/dashboard/${id}`), 400)
        } else {
          toast.error('Upload succeeded but no dataset ID was generated.')
        }
      } catch (err) {
        toast.error(err?.response?.data?.error || 'Upload failed. Please check your CSV format.')
      } finally {
        setUploading(false)
        setUploadProgress(0)
      }
    },
    [navigate, onDatasetLoaded],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
    disabled: uploading,
  })

  // Delete a dataset
  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation()
    if (!window.confirm('Are you sure you want to delete this dataset?')) return
    try {
      await deleteDataset(id)
      toast.success('Dataset removed')
      fetchDatasets()
    } catch {
      toast.error('Failed to delete dataset')
    }
  }

  // Open an existing dataset
  const handleOpen = (ds, targetRoute = 'dashboard') => {
    const id = ds.id || ds.dataset_id
    if (onDatasetLoaded) onDatasetLoaded(id, ds.filename || ds.name)
    navigate(`/${targetRoute}/${id}`)
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* ── Top Brand Bar ── */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-black italic tracking-tighter text-[#E23744]">
              zomato
            </span>
            <span className="hidden sm:inline-block px-2.5 py-0.5 bg-red-50 text-red-700 text-xs font-bold rounded-full uppercase tracking-wider border border-red-100">
              Analytics &amp; Prediction Engine
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold">
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <HelpCircle size={15} />
              CSV Format Guide
            </button>
            {datasets.length > 0 && (
              <button
                onClick={() => handleOpen(datasets[0])}
                className="hidden md:flex items-center gap-1.5 px-3.5 py-1.5 bg-[#E23744] hover:bg-red-700 text-white rounded-lg transition-colors shadow-sm"
              >
                <Sparkles size={14} /> Open Latest Dataset
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero Section with Zomato Red Gradient ── */}
      <div className="bg-gradient-to-b from-[#E23744] via-[#ea3a47] to-[#d62837] text-white pt-16 pb-28 px-6 relative overflow-hidden">
        {/* Subtle decorative circles */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 right-1/4 w-96 h-96 bg-black/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold tracking-wider text-white border border-white/20 uppercase">
            <UtensilsCrossed size={14} /> Full-Featured MERN Data Analytics Suite
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
            Predictive Analytics &amp; Smart Dashboards for Zomato
          </h1>

          <p className="text-base sm:text-lg text-red-100 max-w-2xl mx-auto font-normal leading-relaxed">
            Upload your restaurant CSV data to generate auto-configured charts, solve all 6 core business questions, forecast growth, and simulate AI restaurant success.
          </p>

          {/* Value Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2 text-xs font-semibold text-white/90">
            <span className="px-3 py-1 bg-white/10 rounded-full border border-white/15 flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-white" /> Auto Column Type Detection
            </span>
            <span className="px-3 py-1 bg-white/10 rounded-full border border-white/15 flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-white" /> 6-Question Strategic Answers
            </span>
            <span className="px-3 py-1 bg-white/10 rounded-full border border-white/15 flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-white" /> Multivariate ML Predictions
            </span>
            <span className="px-3 py-1 bg-white/10 rounded-full border border-white/15 flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-white" /> Full Admin CRUD Operations
            </span>
          </div>
        </div>
      </div>

      {/* ── Main Container: Upload Card Floating Over Hero ── */}
      <main className="max-w-5xl mx-auto px-6 -mt-16 relative z-20 flex-1 w-full space-y-12">
        {/* Upload Zone Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-10 border border-gray-100">
          <div
            {...getRootProps()}
            className={`relative border-2 border-dashed rounded-2xl p-10 sm:p-14 text-center cursor-pointer transition-all duration-300 ${
              isDragActive
                ? 'border-[#E23744] bg-red-50/70 scale-[0.99] shadow-inner'
                : uploading
                ? 'border-gray-200 bg-gray-50/50 cursor-wait'
                : 'border-gray-200 hover:border-[#E23744] hover:bg-red-50/20'
            }`}
          >
            <input {...getInputProps()} />

            {uploading ? (
              <div className="space-y-4 max-w-sm mx-auto py-4">
                <Loader2 className="mx-auto text-[#E23744] animate-spin" size={48} />
                <div>
                  <p className="text-gray-800 font-bold text-base">{uploadStep}</p>
                  <p className="text-gray-400 text-xs mt-1">Please wait while the analytics engine processes your records</p>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden border border-gray-200">
                  <div
                    className="bg-gradient-to-r from-[#E23744] to-rose-500 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-gray-500">{uploadProgress}%</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-red-50 text-[#E23744] flex items-center justify-center shadow-sm border border-red-100/60 transition-transform hover:scale-105">
                  <Upload size={32} />
                </div>

                <div>
                  <p className="text-gray-800 font-bold text-xl sm:text-2xl">
                    {isDragActive ? 'Drop your CSV file here…' : 'Drop your CSV file here or browse'}
                  </p>
                  <p className="text-gray-400 text-sm mt-1 max-w-md mx-auto">
                    Drag and drop your Zomato restaurant dataset or click to select from your files
                  </p>
                </div>

                {/* File Specs Tags */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md text-[11px] font-medium">
                    .CSV files only
                  </span>
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md text-[11px] font-medium">
                    Auto cleans "4.1/5" rates
                  </span>
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md text-[11px] font-medium">
                    Auto removes commas in prices ("1,200" → 1200)
                  </span>
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md text-[11px] font-medium">
                    Up to 50 MB
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Demo Action Bar */}
          {datasets.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-xs text-gray-500 font-medium">
                  Pre-loaded dataset active: <strong className="text-gray-700">{datasets[0].filename}</strong> ({datasets[0].rowCount || '148'} records)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpen(datasets[0], 'dashboard')}
                  className="px-4 py-2 bg-red-50 text-[#E23744] hover:bg-red-100 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <BarChart3 size={14} /> Open Dashboard
                </button>
                <button
                  onClick={() => handleOpen(datasets[0], 'predict')}
                  className="px-4 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <Sparkles size={14} /> Run Predictions
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Optional CSV Format Guide Drawer ── */}
        {showGuide && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck2 className="text-[#E23744]" size={20} />
                <h3 className="font-bold text-gray-800 text-base">Recommended CSV Column Format</h3>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="text-xs font-semibold text-gray-400 hover:text-gray-600"
              >
                Close ✕
              </button>
            </div>

            <p className="text-xs text-gray-500">
              The tool automatically detects columns even if your headers have slight naming variations:
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase font-semibold">
                  <tr>
                    <th className="py-2 px-3">Column Name</th>
                    <th className="py-2 px-3">Detected Type</th>
                    <th className="py-2 px-3">Example Values</th>
                    <th className="py-2 px-3">Role in Platform</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold text-gray-900">name</td>
                    <td className="py-2 px-3 text-purple-600 font-semibold">Categorical</td>
                    <td className="py-2 px-3">"Jalsa", "Onesta"</td>
                    <td className="py-2 px-3 text-gray-500">Restaurant identifiers &amp; labels</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold text-gray-900">online_order</td>
                    <td className="py-2 px-3 text-purple-600 font-semibold">Categorical</td>
                    <td className="py-2 px-3">"Yes", "No"</td>
                    <td className="py-2 px-3 text-gray-500">Online vs Offline delivery comparison</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold text-gray-900">book_table</td>
                    <td className="py-2 px-3 text-purple-600 font-semibold">Categorical</td>
                    <td className="py-2 px-3">"Yes", "No"</td>
                    <td className="py-2 px-3 text-gray-500">Reservation feature &amp; rating influence</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold text-gray-900">rate</td>
                    <td className="py-2 px-3 text-blue-600 font-semibold">Numeric</td>
                    <td className="py-2 px-3">"4.1/5", "3.8", "NEW"</td>
                    <td className="py-2 px-3 text-gray-500">Target for prediction &amp; distribution charts</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold text-gray-900">votes</td>
                    <td className="py-2 px-3 text-blue-600 font-semibold">Numeric</td>
                    <td className="py-2 px-3">775, 2556, 166</td>
                    <td className="py-2 px-3 text-gray-500">Review popularity &amp; weight features</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold text-gray-900">approx_cost(for two people)</td>
                    <td className="py-2 px-3 text-blue-600 font-semibold">Numeric</td>
                    <td className="py-2 px-3">"800", "1,200", 600</td>
                    <td className="py-2 px-3 text-gray-500">Couple spending analysis &amp; price tuning</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold text-gray-900">listed_in(type)</td>
                    <td className="py-2 px-3 text-purple-600 font-semibold">Categorical</td>
                    <td className="py-2 px-3">"Dining", "Cafes", "Buffet"</td>
                    <td className="py-2 px-3 text-gray-500">Market segmentation &amp; offer targeting</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Active / Previous Datasets Gallery ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database size={20} className="text-[#E23744]" />
              <h2 className="text-xl font-bold text-gray-900">Available Datasets</h2>
            </div>
            <span className="text-xs text-gray-400 font-medium">
              {datasets.length} dataset{datasets.length === 1 ? '' : 's'} available
            </span>
          </div>

          {loadingDatasets ? (
            <div className="flex justify-center py-12">
              <Loader2 className="text-[#E23744] animate-spin" size={32} />
            </div>
          ) : datasets.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-2">
              <FileSpreadsheet className="mx-auto text-gray-300" size={48} />
              <p className="text-gray-700 font-bold text-base">No datasets uploaded yet</p>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Drag and drop any restaurant or business CSV file into the upload zone above to get started.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {datasets.map((ds) => {
                const id = ds.id || ds.dataset_id
                const rows = ds.rowCount ?? ds.rows?.length ?? ds.rows ?? '—'
                const formattedDate = ds.uploadedAt || ds.uploaded_at
                  ? new Date(ds.uploadedAt || ds.uploaded_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'Pre-loaded'

                return (
                  <div
                    key={id}
                    className="bg-white rounded-2xl shadow-sm border border-gray-200/80 p-5 hover:shadow-md hover:border-red-200 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Top Bar with Icon & Delete */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="w-11 h-11 rounded-xl bg-red-50 text-[#E23744] flex items-center justify-center flex-shrink-0 border border-red-100 group-hover:bg-[#E23744] group-hover:text-white transition-colors">
                          <FileSpreadsheet size={22} />
                        </div>

                        <button
                          onClick={(e) => handleDelete(id, e)}
                          title="Delete Dataset"
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Title & Metadata */}
                      <h4 className="font-bold text-gray-800 text-sm truncate" title={ds.filename || id}>
                        {ds.filename || id}
                      </h4>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mt-2 mb-4">
                        <span className="flex items-center gap-1 font-semibold text-gray-600 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                          <BarChart3 size={12} className="text-[#E23744]" />
                          {Number(rows).toLocaleString()} rows
                        </span>
                        <span className="flex items-center gap-1 text-[11px]">
                          <Clock size={11} /> {formattedDate}
                        </span>
                      </div>
                    </div>

                    {/* Dual Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => handleOpen(ds, 'dashboard')}
                        className="flex items-center justify-center gap-1 px-3 py-2 bg-[#E23744] hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                      >
                        Dashboard <ArrowRight size={12} />
                      </button>
                      <button
                        onClick={() => handleOpen(ds, 'predict')}
                        className="flex items-center justify-center gap-1 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl transition-colors"
                      >
                        <Sparkles size={12} /> Predict
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Capabilities / Feature Showcase ── */}
        <section className="space-y-6 pt-6 border-t border-gray-200">
          <div className="text-center max-w-xl mx-auto space-y-1">
            <h3 className="text-2xl font-bold text-gray-900">What This Platform Does</h3>
            <p className="text-xs text-gray-500">
              End-to-end data pipeline from raw CSV to live AI predictive modeling
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Pillar 1 */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm space-y-2">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <BarChart3 size={20} />
              </div>
              <h4 className="font-bold text-gray-800 text-sm">Dynamic Dashboards</h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                Auto-generates Recharts pie distributions, histograms, scatter plots, and correlation matrices for any CSV.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm space-y-2">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-[#E23744] flex items-center justify-center font-bold">
                <CheckCircle2 size={20} />
              </div>
              <h4 className="font-bold text-gray-800 text-sm">6 Core EDA Questions</h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                Directly answers the strategic Zomato questions: Popular types, vote counts, couple spending (₹510 avg), and discount targets.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm space-y-2">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <Brain size={20} />
              </div>
              <h4 className="font-bold text-gray-800 text-sm">Zomato AI Simulator</h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                Test restaurant parameters (Online Delivery, Tables, Cost) to project ratings, viability tiers, and AI suggestions.
              </p>
            </div>

            {/* Pillar 4 */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm space-y-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <ShieldCheck size={20} />
              </div>
              <h4 className="font-bold text-gray-800 text-sm">Admin Operations</h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                Full CRUD restaurant data table with pagination, search, sorting, row additions, and one-click CSV export.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="mt-20 border-t border-gray-200 bg-white py-8 px-6 text-center text-xs text-gray-400">
        <p className="font-medium text-gray-500">
          Zomato Analytics &amp; Prediction Tool &bull; MERN Stack Data Analyst Solution
        </p>
        <p className="mt-1">
          Built with React 18 &bull; Vite &bull; TailwindCSS &bull; Recharts &bull; Express.js &bull; Simple Statistics
        </p>
      </footer>
    </div>
  )
}
