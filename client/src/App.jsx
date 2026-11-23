import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Sidebar from './components/Sidebar'
import UploadPage from './pages/UploadPage'
import DashboardPage from './pages/DashboardPage'
import AdminPage from './pages/AdminPage'
import PredictPage from './pages/PredictPage'

/**
 * Layout wrapper — renders Sidebar + page content when a dataset is active.
 */
function DashboardLayout({ datasetName, children }) {
  const { datasetId } = useParams()
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar datasetId={datasetId} datasetName={datasetName} />
      <main className="lg:ml-60 min-h-screen p-6 lg:p-8">{children}</main>
    </div>
  )
}

/**
 * App — Root component with React Router and global state.
 */
export default function App() {
  const [datasetId, setDatasetId] = useState(null)
  const [datasetName, setDatasetName] = useState('')

  const handleDatasetLoaded = (id, name) => {
    setDatasetId(id)
    setDatasetName(name || `Dataset ${id}`)
  }

  return (
    <BrowserRouter>
      {/* Toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { background: '#1f2937', color: '#fff', fontSize: '14px' },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />

      <Routes>
        {/* Landing / Upload */}
        <Route
          path="/"
          element={<UploadPage onDatasetLoaded={handleDatasetLoaded} />}
        />

        {/* Dashboard */}
        <Route
          path="/dashboard/:datasetId"
          element={
            <DashboardLayout datasetName={datasetName}>
              <DashboardPage />
            </DashboardLayout>
          }
        />

        {/* Predictions */}
        <Route
          path="/predict/:datasetId"
          element={
            <DashboardLayout datasetName={datasetName}>
              <PredictPage />
            </DashboardLayout>
          }
        />

        {/* Admin Panel */}
        <Route
          path="/admin/:datasetId"
          element={
            <DashboardLayout datasetName={datasetName}>
              <AdminPage />
            </DashboardLayout>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
