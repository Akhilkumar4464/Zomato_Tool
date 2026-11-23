import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import {
  Loader2, TrendingUp, TrendingDown, Minus, Sparkles, Activity, Brain,
} from 'lucide-react'
import ChartCard from '../components/ChartCard'
import { getSummary, predictLinear, getTrends, classify } from '../api'

const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

/**
 * PredictPage — Three prediction/ML sections:
 *  1. Linear Regression Predictor
 *  2. Trend Analysis
 *  3. Classification
 */
export default function PredictPage() {
  const { datasetId } = useParams()

  const [loading, setLoading] = useState(true)
  const [numericCols, setNumericCols] = useState([])
  const [catCols, setCatCols] = useState([])

  // ── Section 1: Linear Regression ──
  const [lrTarget, setLrTarget] = useState('')
  const [lrFeatures, setLrFeatures] = useState([])
  const [lrInputs, setLrInputs] = useState({})
  const [lrResult, setLrResult] = useState(null)
  const [lrLoading, setLrLoading] = useState(false)

  // ── Section 2: Trends ──
  const [trendCol, setTrendCol] = useState('')
  const [trendData, setTrendData] = useState(null)
  const [trendLoading, setTrendLoading] = useState(false)

  // ── Section 3: Classification ──
  const [clsTarget, setClsTarget] = useState('')
  const [clsFeatures, setClsFeatures] = useState([])
  const [clsInputs, setClsInputs] = useState({})
  const [clsResult, setClsResult] = useState(null)
  const [clsLoading, setClsLoading] = useState(false)

  // ---- fetch column info ----
  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        const { data } = await getSummary(datasetId)
        const numStats = data.numeric_summary || data.numeric || {}
        const catStats = data.categorical_summary || data.categorical || {}
        const nCols = Object.keys(numStats)
        const cCols = Object.keys(catStats)
        setNumericCols(nCols)
        setCatCols(cCols)
        if (nCols.length) { setLrTarget(nCols[0]); setTrendCol(nCols[0]) }
        if (cCols.length) setClsTarget(cCols[0])
      } catch {
        toast.error('Failed to load dataset info')
      } finally {
        setLoading(false)
      }
    })()
  }, [datasetId])

  // ── handlers ──

  const toggleLrFeature = (col) => {
    setLrFeatures((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    )
  }

  const handlePredict = async () => {
    if (!lrTarget || !lrFeatures.length) {
      toast.error('Select a target and at least one feature')
      return
    }
    try {
      setLrLoading(true)
      const body = {
        target: lrTarget,
        features: lrFeatures,
        input: lrFeatures.reduce((acc, f) => ({ ...acc, [f]: Number(lrInputs[f]) || 0 }), {}),
      }
      const { data } = await predictLinear(datasetId, body)
      setLrResult(data)
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Prediction failed')
    } finally {
      setLrLoading(false)
    }
  }

  const handleTrend = async () => {
    if (!trendCol) return
    try {
      setTrendLoading(true)
      const { data } = await getTrends(datasetId, trendCol)
      setTrendData(data)
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Trend analysis failed')
    } finally {
      setTrendLoading(false)
    }
  }

  const toggleClsFeature = (col) => {
    setClsFeatures((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    )
  }

  const handleClassify = async () => {
    if (!clsTarget || !clsFeatures.length) {
      toast.error('Select a target and at least one feature')
      return
    }
    try {
      setClsLoading(true)
      const body = {
        target: clsTarget,
        features: clsFeatures,
        input: clsFeatures.reduce((acc, f) => ({ ...acc, [f]: Number(clsInputs[f]) || 0 }), {}),
      }
      const { data } = await classify(datasetId, body)
      setClsResult(data)
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Classification failed')
    } finally {
      setClsLoading(false)
    }
  }

  // ---- loading ----
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <Loader2 className="text-zomato-500 animate-spin" size={40} />
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">🔮 Predictions</h2>
        <p className="text-sm text-gray-500 mt-0.5">Machine learning predictions &amp; trend analysis</p>
      </div>

      {/* ═══════ Section 1: Linear Regression ═══════ */}
      <section className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <TrendingUp size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">Linear Regression Predictor</h3>
            <p className="text-xs text-gray-400">Predict a numeric value based on selected features</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Config */}
          <div className="space-y-4">
            {/* Target */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Target Column</label>
              <select
                value={lrTarget}
                onChange={(e) => setLrTarget(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              >
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Feature checkboxes */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Feature Columns</label>
              <div className="flex flex-wrap gap-2">
                {numericCols
                  .filter((c) => c !== lrTarget)
                  .map((c) => (
                    <label key={c} className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={lrFeatures.includes(c)}
                        onChange={() => toggleLrFeature(c)}
                        className="rounded border-gray-300 text-zomato-500 focus:ring-zomato-500"
                      />
                      {c}
                    </label>
                  ))}
              </div>
            </div>

            {/* Input fields for selected features */}
            {lrFeatures.length > 0 && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-500">Feature Values</label>
                {lrFeatures.map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-28 truncate">{f}</span>
                    <input
                      type="number"
                      value={lrInputs[f] ?? ''}
                      onChange={(e) => setLrInputs((p) => ({ ...p, [f]: e.target.value }))}
                      className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handlePredict}
              disabled={lrLoading}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {lrLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Predict
            </button>
          </div>

          {/* Results */}
          <div>
            {lrResult ? (
              <div className="space-y-4">
                {/* Predicted value card */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 text-center">
                  <p className="text-xs font-medium text-blue-500 uppercase tracking-wider">Predicted {lrTarget}</p>
                  <p className="text-4xl font-bold text-blue-700 mt-1">
                    {typeof lrResult.prediction === 'number' ? lrResult.prediction.toFixed(2) : lrResult.prediction}
                  </p>
                  {lrResult.r2 != null && (
                    <p className="text-sm text-blue-400 mt-2">
                      R² Score: <span className="font-semibold">{(lrResult.r2 * 100).toFixed(1)}%</span>
                    </p>
                  )}
                </div>

                {/* Feature importance */}
                {lrResult.coefficients && (
                  <ChartCard title="Feature Importance" subtitle="Regression coefficients">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={Object.entries(lrResult.coefficients).map(([k, v]) => ({ name: k, value: Math.abs(v), raw: v }))}
                        layout="vertical"
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                        <Tooltip formatter={(v, _, p) => [p.payload.raw.toFixed(4), 'Coefficient']} />
                        <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-300">
                <div className="text-center">
                  <Brain size={48} className="mx-auto mb-2" />
                  <p className="text-sm">Configure and run a prediction</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════ Section 2: Trend Analysis ═══════ */}
      <section className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-9 h-9 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
            <Activity size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">Trend Analysis</h3>
            <p className="text-xs text-gray-400">Analyse trends, moving averages &amp; forecasts</p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Column</label>
            <select
              value={trendCol}
              onChange={(e) => setTrendCol(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400"
            >
              {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button
            onClick={handleTrend}
            disabled={trendLoading}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {trendLoading ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16} />}
            Analyze
          </button>
        </div>

        {trendData ? (
          <div className="space-y-4">
            {/* Trend indicator */}
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                {(trendData.trend || trendData.direction) === 'increasing' ? (
                  <span className="flex items-center gap-1 text-green-600 font-semibold text-sm"><TrendingUp size={18} /> Increasing</span>
                ) : (trendData.trend || trendData.direction) === 'decreasing' ? (
                  <span className="flex items-center gap-1 text-red-600 font-semibold text-sm"><TrendingDown size={18} /> Decreasing</span>
                ) : (
                  <span className="flex items-center gap-1 text-gray-500 font-semibold text-sm"><Minus size={18} /> Stable</span>
                )}
              </div>
              {trendData.slope != null && (
                <span className="text-xs text-gray-400">Slope: <span className="font-medium text-gray-600">{Number(trendData.slope).toFixed(4)}</span></span>
              )}
              {trendData.r2 != null && (
                <span className="text-xs text-gray-400">R²: <span className="font-medium text-gray-600">{(Number(trendData.r2) * 100).toFixed(1)}%</span></span>
              )}
            </div>

            {/* Chart */}
            <ChartCard title={`${trendCol} Trend`} subtitle="Actual values, moving average & forecast">
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={
                  Array.isArray(trendData.data || trendData.values)
                    ? (trendData.data || trendData.values).map((item, i) => {
                        if (typeof item === 'object') return { ...item, idx: i }
                        return { idx: i, value: item }
                      })
                    : []
                }>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="idx" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="value" name="Actual" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="moving_avg" name="Moving Avg" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                  <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="8 4" />
                  <Line type="monotone" dataKey="trend_line" name="Trend" stroke="#8b5cf6" strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-300">
            <Activity size={48} className="mx-auto mb-2" />
            <p className="text-sm">Select a column and click Analyze</p>
          </div>
        )}
      </section>

      {/* ═══════ Section 3: Classification ═══════ */}
      <section className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
            <Brain size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">Classification</h3>
            <p className="text-xs text-gray-400">Classify a categorical target using numeric features</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Config */}
          <div className="space-y-4">
            {/* Target */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Target Column (categorical)</label>
              <select
                value={clsTarget}
                onChange={(e) => setClsTarget(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
              >
                {catCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Feature checkboxes */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Feature Columns (numeric)</label>
              <div className="flex flex-wrap gap-2">
                {numericCols.map((c) => (
                  <label key={c} className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={clsFeatures.includes(c)}
                      onChange={() => toggleClsFeature(c)}
                      className="rounded border-gray-300 text-purple-500 focus:ring-purple-500"
                    />
                    {c}
                  </label>
                ))}
              </div>
            </div>

            {/* Input fields */}
            {clsFeatures.length > 0 && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-500">Feature Values</label>
                {clsFeatures.map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-28 truncate">{f}</span>
                    <input
                      type="number"
                      value={clsInputs[f] ?? ''}
                      onChange={(e) => setClsInputs((p) => ({ ...p, [f]: e.target.value }))}
                      className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleClassify}
              disabled={clsLoading}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {clsLoading ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} />}
              Classify
            </button>
          </div>

          {/* Results */}
          <div>
            {clsResult ? (
              <div className="space-y-4">
                {/* Predicted class */}
                <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 rounded-xl p-5 text-center">
                  <p className="text-xs font-medium text-purple-500 uppercase tracking-wider">Predicted Class</p>
                  <p className="text-3xl font-bold text-purple-700 mt-1">
                    {clsResult.prediction ?? clsResult.predicted_class ?? '—'}
                  </p>
                </div>

                {/* Confidence meter */}
                {clsResult.confidence != null && (
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Confidence</span>
                      <span className="font-medium">{(clsResult.confidence * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-purple-500 to-fuchsia-500 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(clsResult.confidence * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Nearest neighbors */}
                {clsResult.neighbors && clsResult.neighbors.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Nearest Neighbors</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-100">
                            {Object.keys(clsResult.neighbors[0]).map((k) => (
                              <th key={k} className="px-2 py-1.5 text-left font-medium text-gray-500">{k}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {clsResult.neighbors.slice(0, 5).map((n, i) => (
                            <tr key={i}>
                              {Object.values(n).map((v, j) => (
                                <td key={j} className="px-2 py-1.5 text-gray-600">{String(v)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-300">
                <div className="text-center">
                  <Brain size={48} className="mx-auto mb-2" />
                  <p className="text-sm">Configure and run classification</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
