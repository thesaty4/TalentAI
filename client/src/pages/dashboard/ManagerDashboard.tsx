import { KpiCard } from '../../components/Card';

export function ManagerDashboard() {
  return (
    <div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Open IRCs"        value="—" />
        <KpiCard label="AI Shortlisted"   value="—" />
        <KpiCard label="In Interview"     value="—" />
        <KpiCard label="Selected"         value="—" />
      </div>
    </div>
  );
}
