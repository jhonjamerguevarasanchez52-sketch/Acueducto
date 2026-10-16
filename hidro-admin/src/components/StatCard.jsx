export default function StatCard({ title, value, detail, icon: Icon, tone }) {
  return (
    <article className="stat-card">
      <div className="stat-card-header">
        <span>{title}</span>
        <div className={`stat-icon ${tone}`}>
          <Icon size={18} />
        </div>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}
