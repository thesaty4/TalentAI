import { KpiCard } from '../../components/Card';

export function HRDashboard() {
  return (
    <div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Total Employees"  value="—" />
        <KpiCard label="On Bench"         value="—" />
        <KpiCard label="Active Pipelines" value="—" />
        <KpiCard label="Open IRCs"        value="—" />
      </div>
    </div>
  );
}
