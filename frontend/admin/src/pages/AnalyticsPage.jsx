import AdminHeader from '../components/AdminHeader'
import { PlatformComparisonChart, BranchDistributionChart, ActivityTrendChart } from '../components/PlatformCharts'

export default function AnalyticsPage() {
  return (
    <>
      <AdminHeader title="Analytics" breadcrumb="Overview" />
      <div className="page">
        <div className="grid-2">
          <PlatformComparisonChart data={null} />
          <BranchDistributionChart data={null} />
        </div>
        <ActivityTrendChart data={null} />
      </div>
    </>
  )
}
