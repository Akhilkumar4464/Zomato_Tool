import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import {
  Loader2, TrendingUp, TrendingDown, Minus, Sparkles, Activity, Brain,
  Award, CheckCircle2, AlertCircle, ArrowUpRight, UtensilsCrossed,
} from 'lucide-react'
import ChartCard from '../components/ChartCard'
import { getSummary, predictLinear, getTrends, classify, predictZomato } from '../api'

const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

/**
 * PredictPage — Advanced Predictive Modeling & Future Forecasting for Zomato:
 *  1. Zomato AI Restaurant Rating & Success Predictor (Domain Specific)
 *  2. Multivariate Linear Regression Predictor
 *  3. Time-Series Trend Analysis & 10-Step Future Forecasting
 *  4. K-Nearest Neighbors Classification
 */
export default function PredictPage() {
  const { datasetId } = useParams()

  const [loading, setLoading] = useState(true)
  const [numericCols, setNumericCols] = useState([])
  const [catCols, setCatCols] = useState([])
  const [rawSummary, setRawSummary] = useState(null)

  // ── Zomato AI Predictor State ──
  const [zomatoForm, setZomatoForm] = useState({
    type: 'Dining',
    online_order: 'Yes',
    book_table: 'No',
    approx_cost: 600,
    votes: 250,
  })
  const [zomatoResult, setZomatoResult] = useState(null)
  const [zomatoLoading, setZomatoLoading] = useState(false)

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

  // ---- Fetch metadata & auto-initialize defaults ----
  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        const res = await getSummary(datasetId)
        const data = res.data?.data || res.data || {}
        setRawSummary(data)

        const numStats = data.numeric_summary || data.numeric || {}
        const catStats = data.categorical_summary || data.categorical || {}
        const nCols = Object.keys(numStats)
        const cCols = Object.keys(catStats)

        setNumericCols(nCols)
        setCatCols(cCols)

        if (nCols.length > 0) {
          const defaultTarget = nCols[0]
          setLrTarget(defaultTarget)
          setTrendCol(defaultTarget)

          // Default features: remaining numeric columns (or the first if only 1)
          const defaultFeatures = nCols.filter((c) => c !== defaultTarget).slice(0, 3)
          const activeFeatures = defaultFeatures.length ? defaultFeatures : [defaultTarget]
          setLrFeatures(activeFeatures)

          // Seed default inputs with column means
          const initialInputs = {}
          activeFeatures.forEach((f) => {
            initialInputs[f] = Math.round(numStats[f]?.mean || 100)
          })
          setLrInputs(initialInputs)

          // Auto-trigger initial trend analysis
          loadTrend(defaultTarget)
        }

        if (cCols.length > 0) {
          setClsTarget(cCols[0])
          const defaultClsFeatures = nCols.slice(0, 2)
          setClsFeatures(defaultClsFeatures)

          const clsInit = {}
          defaultClsFeatures.forEach((f) => {
            clsInit[f] = Math.round(numStats[f]?.mean || 100)
          })
          setClsInputs(clsInit)
        }

        // Run initial Zomato prediction
        runZomatoPredict({
          type: 'Dining',
          online_order: 'Yes',
          book_table: 'No',
          approx_cost: 600,
          votes: 250,
        })
      } catch (err) {
        toast.error('Failed to load dataset metadata')
        console.error(err)
      } finally {
        setLoading(false)
      }
    })()
  }, [datasetId])

  // ── Zomato AI Predictor Handler ──
  const runZomatoPredict = async (formData = zomatoForm) => {
    try {
      setZomatoLoading(true)
      const res = await predictZomato(datasetId, formData)
      setZomatoResult(res.data?.data || res.data)
    } catch (err) {
      console.warn('Zomato predictor note:', err)
    } finally {
      setZomatoLoading(false)
    }
  }

  // ── Linear Regression Handlers ──
  const toggleLrFeature = (col) => {
    setLrFeatures((prev) => {
      const next = prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
      if (!lrInputs[col] && rawSummary?.numeric_summary?.[col]?.mean) {
        setLrInputs((p) => ({ ...p, [col]: Math.round(rawSummary.numeric_summary[col].mean) }))
      }
      return next
    })
  }

  const handlePredict = async () => {
    if (!lrTarget || !lrFeatures.length) {
      toast.error('Select a target column and at least one feature')
      return
    }
    try {
      setLrLoading(true)
      const body = {
        target: lrTarget,
        features: lrFeatures,
        input: lrFeatures.reduce((acc, f) => ({ ...acc, [f]: Number(lrInputs[f]) || 0 }), {}),
      }
      const res = await predictLinear(datasetId, body)
      const resData = res.data?.data || res.data
      setLrResult(resData)
      toast.success('Regression computed!')
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Prediction calculation failed')
    } finally {
      setLrLoading(false)
    }
  }

  // ── Trend Analysis Handlers ──
  const loadTrend = async (col) => {
    if (!col) return
    try {
      setTrendLoading(true)
      const res = await getTrends(datasetId, col)
      setTrendData(res.data?.data || res.data)
    } catch (err) {
      console.warn('Trend load warning:', err)
    } finally {
      setTrendLoading(false)
    }
  }

  const handleTrend = () => {
    loadTrend(trendCol)
  }

  // ── Classification Handlers ──
  const toggleClsFeature = (col) => {
    setClsFeatures((prev) => {
      const next = prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
      if (!clsInputs[col] && rawSummary?.numeric_summary?.[col]?.mean) {
        setClsInputs((p) => ({ ...p, [col]: Math.round(rawSummary.numeric_summary[col].mean) }))
      }
      return next
    })
  }

  const handleClassify = async () => {
    if (!clsTarget || !clsFeatures.length) {
      toast.error('Select a target column and at least one feature')
      return
    }
    try {
      setClsLoading(true)
      const body = {
        target: clsTarget,
        features: clsFeatures,
        input: clsFeatures.reduce((acc, f) => ({ ...acc, [f]: Number(clsInputs[f]) || 0 }), {}),
      }
      const res = await classify(datasetId, body)
      setClsResult(res.data?.data || res.data)
      toast.success('Classification completed!')
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Classification failed')
    } finally {
      setClsLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="text-center space-y-3">
          <Loader2 className="mx-auto text-zomato-500 animate-spin" size={40} />
          <p className="text-gray-500 font-medium">Loading prediction engine…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-12">
      {/* Page Title */}
      <div>
        <div className="flex items-center gap-2">
          <span className="p-2 bg-red-100 text-red-600 rounded-lg">
            <Sparkles size={24} />
          </span>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">🔮 Predictions & Future Forecasting</h2>
            <p className="text-sm text-gray-500">
              Machine learning models, restaurant success predictions, and trend projections
            </p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════════
          SECTION 0: ZOMATO AI RESTAURANT SUCCESS PREDICTOR (DOMAIN SPECIFIC)
         ══════════════════════════════════════════════════════════════════════════════ */}
      <section className="bg-gradient-to-br from-red-500 via-rose-600 to-red-700 rounded-2xl shadow-xl p-6 sm:p-8 text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-red-400/40">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
              <UtensilsCrossed size={14} /> Zomato AI Engine
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Predict Restaurant Rating & Future Market Fit
            </h3>
            <p className="text-red-100 text-sm mt-1 max-w-2xl">
              Simulate restaurant configurations (Online Delivery, Table Booking, Cost for Two, Votes) to project predicted ratings and algorithmic success.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Simulation Controls */}
          <div className="lg:col-span-5 bg-white/10 backdrop-blur-md p-5 rounded-xl border border-white/20 space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-wider text-red-100">Restaurant Parameters</h4>

            {/* Type */}
            <div>
              <label className="block text-xs font-medium text-red-100 mb-1">Restaurant Type</label>
              <select
                value={zomatoForm.type}
                onChange={(e) => setZomatoForm({ ...zomatoForm, type: e.target.value })}
                className="w-full px-3 py-2 bg-white text-gray-800 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-300"
              >
                <option value="Dining">Dining</option>
                <option value="Cafes">Cafes</option>
                <option value="Buffet">Buffet</option>
                <option value="other">Other / Fast Food</option>
              </select>
            </div>

            {/* Online Order & Table Booking in 2 cols */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-red-100 mb-1">Online Ordering</label>
                <select
                  value={zomatoForm.online_order}
                  onChange={(e) => setZomatoForm({ ...zomatoForm, online_order: e.target.value })}
                  className="w-full px-3 py-2 bg-white text-gray-800 rounded-lg text-sm font-medium focus:outline-none"
                >
                  <option value="Yes">Yes (Enabled)</option>
                  <option value="No">No (Offline Only)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-red-100 mb-1">Table Booking</label>
                <select
                  value={zomatoForm.book_table}
                  onChange={(e) => setZomatoForm({ ...zomatoForm, book_table: e.target.value })}
                  className="w-full px-3 py-2 bg-white text-gray-800 rounded-lg text-sm font-medium focus:outline-none"
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>
            </div>

            {/* Approx Cost (for 2) */}
            <div>
              <div className="flex justify-between text-xs text-red-100 mb-1">
                <span>Approx Cost for Two (₹)</span>
                <span className="font-bold text-white">₹{zomatoForm.approx_cost}</span>
              </div>
              <input
                type="range"
                min="100"
                max="2500"
                step="50"
                value={zomatoForm.approx_cost}
                onChange={(e) => setZomatoForm({ ...zomatoForm, approx_cost: Number(e.target.value) })}
                className="w-full accent-white cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-red-200 mt-0.5">
                <span>₹100 (Budget)</span>
                <span>₹800 (Casual)</span>
                <span>₹2500+ (Fine Dining)</span>
              </div>
            </div>

            {/* Expected Votes */}
            <div>
              <div className="flex justify-between text-xs text-red-100 mb-1">
                <span>Expected Customer Reviews / Votes</span>
                <span className="font-bold text-white">{zomatoForm.votes} votes</span>
              </div>
              <input
                type="range"
                min="0"
                max="3000"
                step="50"
                value={zomatoForm.votes}
                onChange={(e) => setZomatoForm({ ...zomatoForm, votes: Number(e.target.value) })}
                className="w-full accent-white cursor-pointer"
              />
            </div>

            <button
              onClick={() => runZomatoPredict(zomatoForm)}
              disabled={zomatoLoading}
              className="w-full py-2.5 bg-white text-red-600 hover:bg-red-50 font-bold rounded-lg transition-all shadow-md flex items-center justify-center gap-2 text-sm"
            >
              {zomatoLoading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              Recalculate Prediction
            </button>
          </div>

          {/* Results Showcase */}
          <div className="lg:col-span-7 space-y-4">
            {zomatoResult ? (
              <div className="space-y-4">
                {/* Big Metric Box */}
                <div className="bg-white text-gray-900 rounded-xl p-6 shadow-lg grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
                  <div className="sm:col-span-2 space-y-1">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Predicted Rating
                    </span>
                    <div className="flex items-baseline gap-3">
                      <span className="text-5xl font-black text-gray-900">
                        ⭐ {zomatoResult.predictedRating}
                      </span>
                      <span className="text-sm font-semibold text-gray-500">/ 5.0</span>
                    </div>
                    <p className="text-xs font-medium text-gray-600">
                      {zomatoResult.deltaFromAverage >= 0 ? (
                        <span className="text-green-600 font-bold">
                          +{zomatoResult.deltaFromAverage} higher
                        </span>
                      ) : (
                        <span className="text-red-500 font-bold">
                          {zomatoResult.deltaFromAverage} lower
                        </span>
                      )}{' '}
                      than city average ({zomatoResult.baseRating || '3.63'})
                    </p>
                  </div>

                  {/* Success Score Badge */}
                  <div className="text-center p-4 bg-red-50 rounded-xl border border-red-100">
                    <span className="text-xs font-bold text-red-600 uppercase">Success Score</span>
                    <div className="text-3xl font-extrabold text-red-600 mt-1">
                      {zomatoResult.successScore}%
                    </div>
                    <span className="text-[11px] font-medium text-red-400">Market Viability</span>
                  </div>
                </div>

                {/* Tier Badge */}
                <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/20 flex items-center gap-3">
                  <Award className="text-yellow-300" size={24} />
                  <div>
                    <span className="text-[11px] text-red-100 uppercase tracking-wider block font-medium">
                      Projected Placement Tier
                    </span>
                    <span className="font-bold text-white text-base">
                      {zomatoResult.tier}
                    </span>
                  </div>
                </div>

                {/* AI Recommendations */}
                {zomatoResult.recommendations?.length > 0 && (
                  <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 space-y-2">
                    <span className="text-xs font-bold text-red-100 uppercase tracking-wider block">
                      💡 Strategic Recommendations
                    </span>
                    <ul className="space-y-1.5 text-xs text-red-50">
                      {zomatoResult.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 size={14} className="mt-0.5 text-green-300 flex-shrink-0" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-red-200">
                <Loader2 className="animate-spin" size={32} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════════════
          SECTION 1: MULTIVARIATE LINEAR REGRESSION
         ══════════════════════════════════════════════════════════════════════════════ */}
      <section className="bg-white rounded-xl shadow-md border border-gray-100 p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <TrendingUp size={22} />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-lg">Linear Regression Engine</h3>
              <p className="text-xs text-gray-400">
                Ordinary Least Squares multivariate prediction with R² score and feature importance
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Controls */}
          <div className="lg:col-span-5 space-y-4">
            {/* Target Select */}
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Target Variable (Y)
              </label>
              <select
                value={lrTarget}
                onChange={(e) => {
                  const newTarget = e.target.value
                  setLrTarget(newTarget)
                  setLrFeatures((prev) => prev.filter((f) => f !== newTarget))
                }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              >
                {numericCols.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Feature Checkboxes */}
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Predictor Features (X)
              </label>
              <div className="flex flex-wrap gap-2">
                {numericCols
                  .filter((c) => c !== lrTarget)
                  .map((c) => (
                    <label
                      key={c}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
                        lrFeatures.includes(c)
                          ? 'bg-blue-50 border-blue-400 text-blue-700'
                          : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={lrFeatures.includes(c)}
                        onChange={() => toggleLrFeature(c)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      {c}
                    </label>
                  ))}
              </div>
            </div>

            {/* Inputs for selected features */}
            {lrFeatures.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <span className="block text-xs font-bold text-gray-600 uppercase">Input Values</span>
                {lrFeatures.map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-600 w-36 truncate" title={f}>
                      {f}
                    </span>
                    <input
                      type="number"
                      value={lrInputs[f] ?? ''}
                      onChange={(e) => setLrInputs({ ...lrInputs, [f]: e.target.value })}
                      className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      placeholder="Enter value"
                    />
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handlePredict}
              disabled={lrLoading || !lrFeatures.length}
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors shadow-sm"
            >
              {lrLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Compute Regression
            </button>
          </div>

          {/* Results Showcase */}
          <div className="lg:col-span-7">
            {lrResult ? (
              <div className="space-y-5">
                {/* Result Card */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-6 text-center">
                  <p className="text-xs font-bold text-blue-500 uppercase tracking-wider">
                    Predicted {lrTarget}
                  </p>
                  <p className="text-4xl sm:text-5xl font-black text-blue-700 mt-2">
                    {typeof lrResult.prediction === 'number'
                      ? lrResult.prediction.toLocaleString(undefined, { maximumFractionDigits: 2 })
                      : lrResult.prediction}
                  </p>
                  {(lrResult.r2 != null || lrResult.model?.rSquared != null) && (
                    <div className="inline-block mt-3 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                      Model Goodness of Fit (R²):{' '}
                      <span className="font-black">
                        {(Number(lrResult.r2 ?? lrResult.model?.rSquared) * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Feature Importance / Coefficients */}
                {(lrResult.coefficients || lrResult.model?.coefficients) && (
                  <ChartCard title="Feature Importance" subtitle="Standardized impact of each predictor">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={Object.entries(lrResult.coefficients || lrResult.model?.coefficients || {})
                          .filter(([k]) => k !== 'intercept')
                          .map(([name, val]) => ({
                            name,
                            importance: Math.abs(Number(val)),
                            coefficient: Number(val).toFixed(4),
                          }))}
                        layout="vertical"
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                        <Tooltip formatter={(v, _, p) => [p.payload.coefficient, 'Weight']} />
                        <Bar dataKey="importance" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 p-6 text-center">
                <Brain size={48} className="text-gray-300 mb-2" />
                <p className="text-sm font-medium">Ready to run regression</p>
                <p className="text-xs text-gray-400 mt-1">Select features and click Compute Regression</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════════════
          SECTION 2: TREND ANALYSIS & TIME-SERIES FORECASTING
         ══════════════════════════════════════════════════════════════════════════════ */}
      <section className="bg-white rounded-xl shadow-md border border-gray-100 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Activity size={22} />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-lg">Trend Analysis & 10-Step Future Forecast</h3>
              <p className="text-xs text-gray-400">
                Rolling moving averages and linear trend extrapolation for upcoming restaurants
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={trendCol}
              onChange={(e) => {
                setTrendCol(e.target.value)
                loadTrend(e.target.value)
              }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            >
              {numericCols.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button
              onClick={handleTrend}
              disabled={trendLoading}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors shadow-sm"
            >
              {trendLoading ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16} />}
              Refresh
            </button>
          </div>
        </div>

        {trendData ? (
          <div className="space-y-6">
            {/* Trend Indicator Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-xs text-gray-400 font-medium uppercase">Overall Trajectory</span>
                <div className="mt-1 flex items-center gap-1.5">
                  {(trendData.trend || trendData.direction) === 'increasing' ? (
                    <span className="flex items-center gap-1 text-emerald-600 font-bold text-base">
                      <TrendingUp size={20} /> Upward (Growing)
                    </span>
                  ) : (trendData.trend || trendData.direction) === 'decreasing' ? (
                    <span className="flex items-center gap-1 text-red-600 font-bold text-base">
                      <TrendingDown size={20} /> Downward (Declining)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-blue-600 font-bold text-base">
                      <Minus size={20} /> Stable (Balanced)
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-xs text-gray-400 font-medium uppercase">Trend Slope</span>
                <p className="text-base font-bold text-gray-800 mt-1">
                  {trendData.slope != null ? Number(trendData.slope).toFixed(4) : '—'}
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-xs text-gray-400 font-medium uppercase">Trend Confidence (R²)</span>
                <p className="text-base font-bold text-gray-800 mt-1">
                  {trendData.r2 != null ? `${(Number(trendData.r2) * 100).toFixed(1)}%` : '—'}
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-xs text-gray-400 font-medium uppercase">Forecast Window</span>
                <p className="text-base font-bold text-gray-800 mt-1">Next 10 Data Points</p>
              </div>
            </div>

            {/* Continuous Unified Line Chart */}
            <ChartCard
              title={`${trendCol} Forecast Progression`}
              subtitle="Solid Green: Historical Records | Dashed Orange: Moving Avg | Dashed Red: Projected Future"
            >
              <ResponsiveContainer width="100%" height={340}>
                <LineChart data={trendData.data || trendData.values || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    name="Historical Actual"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="moving_avg"
                    name="5-Point Rolling Avg"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    name="Future Projection"
                    stroke="#ef4444"
                    strokeWidth={3}
                    strokeDasharray="3 3"
                    dot={{ r: 4, fill: '#ef4444' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 text-gray-400">
            <p className="text-sm">Select a column to generate trend insights.</p>
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════════════════════
          SECTION 3: K-NEAREST NEIGHBORS CLASSIFICATION
         ══════════════════════════════════════════════════════════════════════════════ */}
      <section className="bg-white rounded-xl shadow-md border border-gray-100 p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Brain size={22} />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-lg">K-Nearest Neighbors Classifier</h3>
              <p className="text-xs text-gray-400">
                Classify categorical attributes (e.g., Restaurant Type or Online Delivery) from continuous metrics
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Controls */}
          <div className="lg:col-span-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Target Category (Y)
              </label>
              <select
                value={clsTarget}
                onChange={(e) => setClsTarget(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              >
                {catCols.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Metric Predictors (X)
              </label>
              <div className="flex flex-wrap gap-2">
                {numericCols.map((c) => (
                  <label
                    key={c}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
                      clsFeatures.includes(c)
                        ? 'bg-purple-50 border-purple-400 text-purple-700'
                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={clsFeatures.includes(c)}
                      onChange={() => toggleClsFeature(c)}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    {c}
                  </label>
                ))}
              </div>
            </div>

            {clsFeatures.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <span className="block text-xs font-bold text-gray-600 uppercase">Input Metrics</span>
                {clsFeatures.map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-600 w-36 truncate">{f}</span>
                    <input
                      type="number"
                      value={clsInputs[f] ?? ''}
                      onChange={(e) => setClsInputs({ ...clsInputs, [f]: e.target.value })}
                      className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleClassify}
              disabled={clsLoading || !clsFeatures.length}
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors shadow-sm"
            >
              {clsLoading ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} />}
              Run Classification
            </button>
          </div>

          {/* Results Showcase */}
          <div className="lg:col-span-7">
            {clsResult ? (
              <div className="space-y-5">
                {/* Predicted Class Card */}
                <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 border border-purple-100 rounded-xl p-6 text-center">
                  <p className="text-xs font-bold text-purple-500 uppercase tracking-wider">
                    Predicted Classification
                  </p>
                  <p className="text-3xl sm:text-4xl font-black text-purple-700 mt-2">
                    {clsResult.prediction ?? clsResult.predicted_class ?? '—'}
                  </p>

                  {/* Confidence Bar */}
                  {clsResult.confidence != null && (
                    <div className="mt-4 max-w-xs mx-auto">
                      <div className="flex justify-between text-xs font-semibold text-purple-700 mb-1">
                        <span>Prediction Confidence</span>
                        <span>{(clsResult.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-purple-200 rounded-full h-2.5">
                        <div
                          className="bg-purple-600 h-2.5 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(clsResult.confidence * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Nearest Neighbors Table */}
                {(clsResult.nearestNeighbors || clsResult.neighbors)?.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <p className="text-xs font-bold text-gray-600 uppercase mb-3">
                      Nearest Matching Restaurants (K=5)
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b border-gray-100 text-gray-400">
                            <th className="pb-2 font-semibold">Matched Category</th>
                            <th className="pb-2 font-semibold">Similarity Distance</th>
                            <th className="pb-2 font-semibold">Restaurant Name</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {(clsResult.nearestNeighbors || clsResult.neighbors).slice(0, 5).map((n, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="py-2 font-bold text-purple-700">
                                {n.label || n[clsTarget]}
                              </td>
                              <td className="py-2 text-gray-500">
                                {Number(n.distance).toFixed(2)}
                              </td>
                              <td className="py-2 text-gray-700 font-medium">
                                {n.row?.name || n.name || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 p-6 text-center">
                <Brain size={48} className="text-gray-300 mb-2" />
                <p className="text-sm font-medium">Configure classification</p>
                <p className="text-xs text-gray-400 mt-1">Select target category and predictor metrics</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
