import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
  ScatterChart, Scatter, AreaChart, Area, LineChart, Line,
} from 'recharts'
import {
  RefreshCw, Loader2, Rows3, Hash, Type, TrendingUp,
} from 'lucide-react'
import ChartCard from '../components/ChartCard'
import StatsCard from '../components/StatsCard'
import { getSummary, getDistribution, getCorrelation, getGrouped, getCompare, getZomatoInsights } from '../api'

/** Colour palette used across all charts */
const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

/**
 * DashboardPage — Auto-generated interactive analytics dashboard.
 *
 * On mount it fetches the dataset summary, identifies column types,
 * then loads distributions, groupings, correlations, and comparisons
 * to render an array of responsive Recharts visualizations.
 */
export default function DashboardPage() {
  const { datasetId } = useParams()

  // ---- state ----
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState(null)
  const [numericCols, setNumericCols] = useState([])
  const [catCols, setCatCols] = useState([])
  const [distributions, setDistributions] = useState({})   // col -> data[]
  const [groupedData, setGroupedData] = useState(null)      // { col, data }
  const [compareData, setCompareData] = useState(null)       // { x, y, data }
  const [correlationData, setCorrelationData] = useState(null)
  const [selectedCols, setSelectedCols] = useState([])       // user-selected filter

  // Zomato-specific detections
  const [zomatoCharts, setZomatoCharts] = useState([])
  const [zomatoInsights, setZomatoInsights] = useState(null)

  // ---- data loading ----
  const load = async () => {
    try {
      setLoading(true)
      const res = await getSummary(datasetId)
      const data = res.data?.data || res.data || {}
      setSummary(data)

      const numStats = data.numeric_summary || data.numeric || {}
      const catStats = data.categorical_summary || data.categorical || {}
      const cols = data.columns || [...Object.keys(numStats), ...Object.keys(catStats)]

      const nCols = Object.keys(numStats)
      const cCols = Object.keys(catStats)
      setNumericCols(nCols)
      setCatCols(cCols)
      setSelectedCols([...nCols, ...cCols])

      // Fetch Zomato business insights (Answers to 6 Questions)
      try {
        const insightsRes = await getZomatoInsights(datasetId)
        if (insightsRes.data?.data) {
          setZomatoInsights(insightsRes.data.data)
        }
      } catch (err) {
        console.warn('Zomato insights fetch error:', err)
      }

      // Fetch distributions in parallel
      const distEntries = await Promise.allSettled(
        [...nCols.slice(0, 6), ...cCols.slice(0, 6)].map(async (col) => {
          const r = await getDistribution(datasetId, col)
          return [col, r.data?.data || r.data]
        }),
      )
      const dists = {}
      distEntries.forEach((r) => { if (r.status === 'fulfilled') { const [k, v] = r.value; dists[k] = v } })
      setDistributions(dists)

      // Grouped: first cat × first num
      if (cCols.length && nCols.length) {
        try {
          const r = await getGrouped(datasetId, cCols[0], nCols[0])
          setGroupedData({ cat: cCols[0], num: nCols[0], data: r.data?.data || r.data })
        } catch { /* skip */ }
      }

      // Compare: first two numerics
      if (nCols.length >= 2) {
        try {
          const r = await getCompare(datasetId, nCols[0], nCols[1])
          setCompareData({ x: nCols[0], y: nCols[1], data: r.data?.data || r.data })
        } catch { /* skip */ }
      }

      // Correlation
      if (nCols.length >= 2) {
        try {
          const r = await getCorrelation(datasetId)
          setCorrelationData(r.data?.data || r.data)
        } catch { /* skip */ }
      }

      // Zomato-specific detections
      const zCharts = []
      const findCol = (keywords) => cols.find((c) => keywords.some((k) => c.toLowerCase().includes(k)))

      const typeCol = findCol(['listed_in(type)', 'listed_in', 'rest_type', 'restaurant type'])
      const votesCol = findCol(['votes', 'vote'])
      const rateCol = findCol(['rate', 'rating', 'aggregate_rating'])
      const costCol = findCol(['approx_cost', 'cost', 'average_cost'])
      const onlineCol = findCol(['online_order', 'online', 'has_online_delivery'])

      if (typeCol) {
        try {
          const r = await getDistribution(datasetId, typeCol)
          zCharts.push({ id: 'type', title: 'Orders by Restaurant Type', col: typeCol, data: r.data?.data || r.data, type: 'bar' })
        } catch { /* skip */ }
      }
      if (votesCol && typeCol) {
        try {
          const r = await getGrouped(datasetId, typeCol, votesCol, 'sum')
          zCharts.push({ id: 'votes', title: 'Total Votes by Type', col: votesCol, data: r.data?.data || r.data, type: 'bar' })
        } catch { /* skip */ }
      }
      if (rateCol) {
        try {
          const r = await getDistribution(datasetId, rateCol)
          zCharts.push({ id: 'rate', title: 'Rating Distribution', col: rateCol, data: r.data?.data || r.data, type: 'area' })
        } catch { /* skip */ }
      }
      if (costCol) {
        try {
          const r = await getDistribution(datasetId, costCol)
          zCharts.push({ id: 'cost', title: 'Spending Analysis', col: costCol, data: r.data?.data || r.data, type: 'bar' })
        } catch { /* skip */ }
      }
      if (onlineCol) {
        try {
          const r = await getDistribution(datasetId, onlineCol)
          zCharts.push({ id: 'online', title: 'Online vs Offline Orders', col: onlineCol, data: r.data?.data || r.data, type: 'pie' })
        } catch { /* skip */ }
      }
      setZomatoCharts(zCharts)
    } catch (err) {
      toast.error('Failed to load dashboard data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [datasetId])

  // ---- helpers ----
  const fmtNum = (v) => {
    if (v == null) return '—'
    const n = Number(v)
    if (isNaN(n)) return String(v)
    return n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M' : n >= 1_000 ? (n / 1_000).toFixed(1) + 'K' : n % 1 === 0 ? n.toLocaleString() : n.toFixed(2)
  }

  const normalizeDistData = (raw) => {
    if (!raw) return []
    if (raw.data) return normalizeDistData(raw.data)
    if (raw.bins && Array.isArray(raw.bins)) {
      return raw.bins.map((b) => ({ name: String(b.bin), value: Number(b.count) }))
    }
    if (raw.distribution && Array.isArray(raw.distribution)) {
      return raw.distribution.map((d) => ({ name: String(d.value), value: Number(d.count) }))
    }
    if (Array.isArray(raw)) {
      return raw.map((item) => {
        if (typeof item === 'object' && item !== null) {
          const name = item.name ?? item.group ?? item.bin ?? item.rating ?? item.value ?? Object.values(item)[0]
          const value = item.value ?? item.count ?? item.totalVotes ?? Object.values(item)[1] ?? 0
          return { name: String(name), value: Number(value) }
        }
        return { name: String(item), value: 1 }
      })
    }
    return Object.entries(raw).map(([k, v]) => ({
      name: String(k),
      value: typeof v === 'object' && v !== null ? Number(v.count || v.value || 0) : Number(v) || 0,
    }))
  }

  // ---- loading state ----
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="text-center space-y-3">
          <Loader2 className="mx-auto text-zomato-500 animate-spin" size={40} />
          <p className="text-gray-500 font-medium">Generating dashboard…</p>
        </div>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <p className="text-gray-400">No data available. Please upload a dataset first.</p>
      </div>
    )
  }

  const totalRows = summary.total_rows ?? summary.rows ?? '—'
  const firstNumericMean = numericCols.length
    ? (summary.numeric_summary || summary.numeric || {})[numericCols[0]]?.mean
    : null

  // ---- render ----
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">📊 Dashboard</h2>
          <p className="text-sm text-gray-500 mt-0.5">Auto-generated analytics for your dataset</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard icon={<Rows3 size={22} />} label="Total Rows" value={fmtNum(totalRows)} color="red" />
        <StatsCard icon={<Hash size={22} />} label="Numeric Columns" value={numericCols.length} color="blue" />
        <StatsCard icon={<Type size={22} />} label="Categorical Columns" value={catCols.length} color="green" />
        <StatsCard
          icon={<TrendingUp size={22} />}
          label={numericCols[0] ? `Avg ${numericCols[0]}` : 'Avg'}
          value={firstNumericMean != null ? fmtNum(firstNumericMean) : '—'}
          color="yellow"
        />
      </div>

      {/* Column selector */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <p className="text-sm font-medium text-gray-600 mb-2">Show charts for:</p>
        <div className="flex flex-wrap gap-2">
          {[...numericCols, ...catCols].map((col) => (
            <button
              key={col}
              onClick={() =>
                setSelectedCols((prev) =>
                  prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
                )
              }
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedCols.includes(col)
                  ? 'bg-zomato-500 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {col}
            </button>
          ))}
        </div>
      </div>

      {/* ── Auto-generated Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categorical distributions → Pie */}
        {catCols
          .filter((c) => selectedCols.includes(c) && distributions[c])
          .map((col) => {
            const data = normalizeDistData(distributions[col]).slice(0, 10)
            return (
              <ChartCard key={col} title={col} subtitle="Category distribution">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {data.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            )
          })}

        {/* Numeric distributions → Bar histogram */}
        {numericCols
          .filter((c) => selectedCols.includes(c) && distributions[c])
          .map((col) => {
            const data = normalizeDistData(distributions[col])
            return (
              <ChartCard key={col} title={col} subtitle="Value distribution">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )
          })}

        {/* Grouped bar: first cat × first num */}
        {groupedData && (
          <ChartCard
            title={`${groupedData.num} by ${groupedData.cat}`}
            subtitle="Grouped average"
          >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={normalizeDistData(groupedData.data).slice(0, 15)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Scatter: first two numerics */}
        {compareData && (
          <ChartCard
            title={`${compareData.x} vs ${compareData.y}`}
            subtitle="Scatter comparison"
          >
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="x" name={compareData.x} tick={{ fontSize: 11 }} />
                <YAxis dataKey="y" name={compareData.y} tick={{ fontSize: 11 }} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter
                  data={
                    Array.isArray(compareData.data)
                      ? compareData.data.slice(0, 500)
                      : []
                  }
                  fill="#8b5cf6"
                  opacity={0.6}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Correlation heatmap */}
        {correlationData && (() => {
          const matrix = correlationData.matrix || correlationData
          const labels = correlationData.columns || correlationData.labels || numericCols
          if (!Array.isArray(matrix) || !labels.length) return null

          return (
            <ChartCard title="Correlation Matrix" subtitle="Pairwise Pearson correlations" className="lg:col-span-2">
              <div className="overflow-x-auto">
                <table className="mx-auto text-xs">
                  <thead>
                    <tr>
                      <th></th>
                      {labels.map((l) => (
                        <th key={l} className="px-2 py-1 font-medium text-gray-500 max-w-[80px] truncate">{l}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {labels.map((rowLabel, ri) => (
                      <tr key={rowLabel}>
                        <td className="px-2 py-1 font-medium text-gray-500 text-right max-w-[80px] truncate">{rowLabel}</td>
                        {labels.map((_, ci) => {
                          const val = matrix[ri]?.[ci] ?? 0
                          const absVal = Math.abs(val)
                          const bg =
                            val > 0
                              ? `rgba(239,68,68,${absVal * 0.7})`
                              : `rgba(59,130,246,${absVal * 0.7})`
                          return (
                            <td
                              key={ci}
                              className="px-2 py-1 text-center rounded"
                              style={{ background: bg, color: absVal > 0.5 ? '#fff' : '#374151' }}
                              title={`${rowLabel} × ${labels[ci]}: ${val.toFixed(2)}`}
                            >
                              {val.toFixed(2)}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          )
        })()}
      </div>

      {/* ── Zomato Core Business Questions (Answers to the 6 EDA Questions) ── */}
      {zomatoInsights && (
        <div className="space-y-6 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <span className="inline-block px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full uppercase tracking-wider mb-1">
                Zomato Business Intelligence
              </span>
              <h3 className="text-xl font-bold text-gray-800">
                🎯 Core EDA & Strategic Business Answers
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Q1 Card */}
            {zomatoInsights.q1 && (
              <div className="bg-white p-5 rounded-xl border border-red-100 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-red-500 uppercase">Q1: Majority Restaurant Type</span>
                  <h4 className="text-sm text-gray-600 mt-1">What type of restaurant do majority order from?</h4>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-gray-900">{zomatoInsights.q1.majorityType}</span>
                    <span className="text-xs font-medium text-gray-500">({zomatoInsights.q1.majorityCount} restaurants)</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3 pt-2 border-t border-gray-100">
                  Target popular categories for featured banner placements.
                </p>
              </div>
            )}

            {/* Q3 Card */}
            {zomatoInsights.q3 && (
              <div className="bg-white p-5 rounded-xl border border-red-100 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-red-500 uppercase">Q3: Most Common Rating</span>
                  <h4 className="text-sm text-gray-600 mt-1">Ratings majority of restaurants received</h4>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-gray-900">⭐ {zomatoInsights.q3.majorityRating}</span>
                    <span className="text-xs font-medium text-gray-500">(Avg: {zomatoInsights.q3.averageRating || '—'})</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3 pt-2 border-t border-gray-100">
                  Majority restaurants cluster around {zomatoInsights.q3.majorityRating} / 5.0.
                </p>
              </div>
            )}

            {/* Q4 Card */}
            {zomatoInsights.q4 && (
              <div className="bg-white p-5 rounded-xl border border-red-100 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-red-500 uppercase">Q4: Online Couple Spending</span>
                  <h4 className="text-sm text-gray-600 mt-1">Average spending on online orders for two</h4>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-gray-900">
                      ₹{zomatoInsights.q4.averageSpending != null ? zomatoInsights.q4.averageSpending : '—'}
                    </span>
                    <span className="text-xs font-medium text-gray-500">per order</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3 pt-2 border-t border-gray-100">
                  Couples spend avg ₹{zomatoInsights.q4.averageSpending} when ordering online.
                </p>
              </div>
            )}

            {/* Q5 Card */}
            {zomatoInsights.q5 && (
              <div className="bg-white p-5 rounded-xl border border-red-100 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-red-500 uppercase">Q5: Highest Rating Mode</span>
                  <h4 className="text-sm text-gray-600 mt-1">Which mode received higher rating?</h4>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-green-600">{zomatoInsights.q5.winner}</span>
                    <span className="text-xs font-medium text-gray-500">
                      (Online: {zomatoInsights.q5.online?.average} vs Offline: {zomatoInsights.q5.offline?.average})
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3 pt-2 border-t border-gray-100">
                  {zomatoInsights.q5.winner} ordering experiences hold higher consumer satisfaction.
                </p>
              </div>
            )}

            {/* Q6 Card */}
            {zomatoInsights.q6 && (
              <div className="bg-white p-5 rounded-xl border border-red-100 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-red-500 uppercase">Q6: Target for Discounts</span>
                  <h4 className="text-sm text-gray-600 mt-1">Type with most offline orders to convert</h4>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-orange-600">{zomatoInsights.q6.targetType}</span>
                    <span className="text-xs font-medium text-gray-500">({zomatoInsights.q6.count} offline outlets)</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3 pt-2 border-t border-gray-100">
                  Target {zomatoInsights.q6.targetType} with onboarding discounts to convert offline demand!
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Zomato-specific Section ── */}
      {zomatoCharts.length > 0 && (
        <>
          <h3 className="text-xl font-bold text-gray-800 mt-4">🍽️ Zomato Insights</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {zomatoCharts.map((chart) => {
              const data = normalizeDistData(chart.data).slice(0, 15)
              if (chart.type === 'pie') {
                return (
                  <ChartCard key={chart.id} title={chart.title} subtitle={`Based on ${chart.col}`}>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )
              }
              if (chart.type === 'area') {
                return (
                  <ChartCard key={chart.id} title={chart.title} subtitle={`Based on ${chart.col}`}>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="value" stroke="#ef4444" fill="#fee2e2" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )
              }
              // default: bar
              return (
                <ChartCard key={chart.id} title={chart.title} subtitle={`Based on ${chart.col}`}>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#dc2626" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
