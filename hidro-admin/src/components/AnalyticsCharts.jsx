import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export default function AnalyticsCharts({ kind, data }) {
  if (kind === 'pie') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={3}>
            {data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (kind === 'bar') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="#dfeaf9" strokeDasharray="4 4" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} />
          <YAxis axisLine={false} tickLine={false} />
          <Tooltip />
          <Bar dataKey="valor" radius={[10, 10, 0, 0]} fill="#53c18b" />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="revenueFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="5%" stopColor="#1f8fff" stopOpacity={0.42} />
            <stop offset="95%" stopColor="#1f8fff" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#dfeaf9" strokeDasharray="4 4" />
        <XAxis dataKey="name" axisLine={false} tickLine={false} />
        <YAxis axisLine={false} tickLine={false} />
        <Tooltip />
        <Area type="monotone" dataKey="valor" stroke="#1f8fff" fill="url(#revenueFill)" strokeWidth={3} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
