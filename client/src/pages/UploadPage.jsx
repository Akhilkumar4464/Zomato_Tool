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
} from 'lucide-react'
import { uploadCSV, getDatasets, deleteDataset } from '../api'

/**
 * UploadPage — Landing page with hero section, drag-and-drop CSV upload,
 * and a gallery of previously uploaded datasets.
 */
export default function UploadPage({ onDatasetLoaded }) {
  const navigate = useNavigate()
  const [datasets, setDatasets] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [loadingDatasets, setLoadingDatasets] = useState(true)

  // Fetch existing datasets on mount
  useEffect(() => {
    fetchDatasets()
  }, [])

  const fetchDatasets = async () => {
    try {
      setLoadingDatasets(true)
      const { data } = await getDatasets()
      setDatasets(data.datasets || [])
    } catch {
      // silently ignore — may be first visit
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
        toast.error('Please upload a CSV file')
        return
      }

      try {
        setUploading(true)
        setUploadProgress(0)

        // Simulate progress then upload
        const progressInterval = setInterval(() => {
          setUploadProgress((p) => (p < 90 ? p + 10 : p))
        }, 200)

        const { data } = await uploadCSV(file)
        clearInterval(progressInterval)
        setUploadProgress(100)

        toast.success('Dataset uploaded successfully!')
        const id = data.dataset_id || data.id
        if (onDatasetLoaded) onDatasetLoaded(id, file.name)

        setTimeout(() => navigate(`/dashboard/${id}`), 400)
      } catch (err) {
        toast.error(err?.response?.data?.error || 'Upload failed')
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
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this dataset?')) return
    try {
      await deleteDataset(id)
      toast.success('Dataset deleted')
      fetchDatasets()
    } catch {
      toast.error('Failed to delete dataset')
    }
  }

  // Open an existing dataset
  const handleOpen = (ds) => {
    const id = ds.id || ds.dataset_id
    if (onDatasetLoaded) onDatasetLoaded(id, ds.filename || ds.name)
    navigate(`/dashboard/${id}`)
  }

  return (
    <div className="min-h-screen">
      {/* ── Hero Section ── */}
      <div className="bg-gradient-to-br from-zomato-600 via-zomato-500 to-zomato-400 text-white">
        <div className="max-w-5xl mx-auto px-6 py-20 text-center">
          <span className="text-5xl mb-4 block">🍽️</span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Zomato Analytics &amp; Prediction Tool
          </h1>
          <p className="mt-4 text-lg text-red-100 max-w-2xl mx-auto">
            Upload your CSV data to generate interactive dashboards, predictions &amp; insights
          </p>
        </div>
      </div>

      {/* ── Upload Section ── */}
      <div className="max-w-5xl mx-auto px-6 -mt-10 relative z-10">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200 ${
              isDragActive
                ? 'border-zomato-500 bg-zomato-50'
                : uploading
                ? 'border-gray-300 bg-gray-50 cursor-wait'
                : 'border-gray-300 hover:border-zomato-400 hover:bg-red-50/30'
            }`}
          >
            <input {...getInputProps()} />

            {uploading ? (
              <div className="space-y-4">
                <Loader2 className="mx-auto text-zomato-500 animate-spin" size={48} />
                <p className="text-gray-600 font-medium">Uploading…</p>
                {/* Progress bar */}
                <div className="w-64 mx-auto bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-zomato-500 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="w-16 h-16 mx-auto rounded-full bg-zomato-50 flex items-center justify-center mb-4">
                  <Upload className="text-zomato-500" size={28} />
                </div>
                <p className="text-gray-700 font-semibold text-lg">
                  {isDragActive ? 'Drop your CSV here…' : 'Drop CSV here or click to browse'}
                </p>
                <p className="text-sm text-gray-400 mt-1">Only .csv files are accepted</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Previous Datasets ── */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <Database size={22} className="text-zomato-500" />
          Previous Datasets
        </h2>

        {loadingDatasets ? (
          <div className="flex justify-center py-16">
            <Loader2 className="text-zomato-500 animate-spin" size={32} />
          </div>
        ) : datasets.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-100">
            <FileSpreadsheet className="mx-auto text-gray-300 mb-3" size={48} />
            <p className="text-gray-400 font-medium">No datasets uploaded yet</p>
            <p className="text-sm text-gray-300 mt-1">Upload a CSV above to get started</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {datasets.map((ds) => {
              const id = ds.id || ds.dataset_id
              return (
                <div
                  key={id}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow flex flex-col"
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-zomato-50 flex items-center justify-center flex-shrink-0">
                      <FileSpreadsheet className="text-zomato-500" size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-800 truncate">
                        {ds.filename || ds.name || id}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                        {ds.rows != null && (
                          <span className="flex items-center gap-1">
                            <BarChart3 size={12} /> {Number(ds.rows).toLocaleString()} rows
                          </span>
                        )}
                        {ds.uploaded_at && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} /> {new Date(ds.uploaded_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-auto">
                    <button
                      onClick={() => handleOpen(ds)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-zomato-500 hover:bg-zomato-600 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Open Dashboard <ArrowRight size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
