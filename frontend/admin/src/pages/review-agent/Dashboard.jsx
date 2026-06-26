import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import {
  HiStar,
  HiExclamationTriangle,
  HiInboxArrowDown,
  HiEnvelopeOpen,
  HiGlobeAlt,
} from 'react-icons/hi2';
import { getDashboardStats, getReviews } from '@/api/review-agent';
import { StatCard } from '@/components/ui/StatCard';
import { LoadingState } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/context/ToastContext';
import { fmtDate } from '@/utils/format';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
);

const PIE_COLORS = [
  '#10b981', // positive -> green
  '#f59e0b', // neutral -> amber
  '#ef4444', // negative -> red
  '#7f1d1d', // critical -> dark red
  '#64748b', // pending -> slate
];

export default function Dashboard() {
  const toast = useToast();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [recentReviews, setRecentReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsData, reviewsData] = await Promise.all([
          getDashboardStats(),
          getReviews({ limit: 5 }),
        ]);
        setStats(statsData.data);
        setRecentReviews(reviewsData.data.reviews || []);
      } catch (err) {
        toast.error('Failed to load dashboard: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <LoadingState message="Loading Review Agent dashboard…" />;

  const chartData = {
    labels: ['Positive', 'Neutral', 'Negative', 'Critical', 'Pending'],
    datasets: [{
      data: [
        stats?.positive || 0,
        stats?.neutral || 0,
        stats?.negative || 0,
        stats?.critical || 0,
        stats?.pending || 0,
      ],
      backgroundColor: PIE_COLORS,
      borderWidth: 0,
      hoverOffset: 6,
    }],
  };

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          boxWidth: 12,
          padding: 12,
          color: '#334155',
          font: { size: 12, weight: '500' }
        }
      },
    },
    cutout: '70%',
  };

  const getSourceBadge = (source) => {
    switch (source) {
      case 'google':
        return <Badge variant="blue">Google</Badge>;
      case 'reviewtreasures':
        return <Badge variant="purple">Treasures</Badge>;
      default:
        return <Badge variant="slate">{source}</Badge>;
    }
  };

  const getSentimentBadge = (sentiment) => {
    switch (sentiment) {
      case 'positive':
        return <Badge variant="emerald">Positive</Badge>;
      case 'neutral':
        return <Badge variant="amber">Neutral</Badge>;
      case 'negative':
        return <Badge variant="rose">Negative</Badge>;
      case 'critical':
        return <Badge variant="danger">Critical</Badge>;
      default:
        return <Badge variant="slate">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Reviews"
          value={stats?.totalReviews}
          sub="All sources"
          icon={HiGlobeAlt}
          gradient="bg-gradient-purple"
        />
        <StatCard
          label="Average Rating"
          value={`${stats?.averageRating || 0} / 5`}
          sub="Out of 5 stars"
          icon={HiStar}
          gradient="bg-gradient-amber"
        />
        <StatCard
          label="Pending Replies"
          value={stats?.pendingReplies}
          sub="Queued for auto-reply"
          icon={HiInboxArrowDown}
          gradient="bg-gradient-blue"
        />
        <StatCard
          label="Escalations"
          value={stats?.escalations}
          sub="Requires attention"
          icon={HiExclamationTriangle}
          gradient="bg-gradient-rose"
        />
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sentiment Breakdown Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-card flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-700 mb-1">Sentiment Analysis</h3>
            <p className="text-xs text-slate-400 mb-4">Breakdown of reviews by customer sentiment</p>
          </div>
          <div className="h-56 relative flex items-center justify-center">
            {stats?.totalReviews > 0 ? (
              <Doughnut data={chartData} options={chartOpts} />
            ) : (
              <p className="text-slate-400 text-sm">No review data available</p>
            )}
          </div>
        </div>

        {/* Recent Reviews Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-700">Recent Customer Reviews</h3>
                <p className="text-xs text-slate-400">Latest feedback fetched across all platforms</p>
              </div>
              <button
                onClick={() => navigate('/review-agent/reviews')}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors"
              >
                View All Reviews →
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Customer</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Platform</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Rating</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Sentiment</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentReviews.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-slate-400 text-sm">
                        No reviews imported yet.
                      </td>
                    </tr>
                  ) : (
                    recentReviews.map((review) => (
                      <tr
                        key={review.id}
                        className="border-t border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => navigate('/review-agent/reviews')}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            {review.profilePhotoUrl ? (
                              <img
                                src={review.profilePhotoUrl}
                                alt={review.authorName}
                                className="w-6 h-6 rounded-full object-cover border border-slate-100"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            ) : null}
                            <span className="font-semibold text-slate-700">{review.authorName}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">{getSourceBadge(review.source)}</td>
                        <td className="px-5 py-3.5 text-amber-500 font-bold">
                          {'★'.repeat(review.starRating)}{'☆'.repeat(5 - review.starRating)}
                        </td>
                        <td className="px-5 py-3.5">{getSentimentBadge(review.sentiment)}</td>
                        <td className="px-5 py-3.5 text-slate-400">{fmtDate(review.reviewCreatedAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
