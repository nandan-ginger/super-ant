import { useState, useEffect } from 'react';
import {
  HiMagnifyingGlass,
  HiXMark,
  HiStar,
  HiSparkles,
  HiArrowPath,
  HiPaperAirplane,
  HiExclamationTriangle,
  HiCheckCircle,
  HiChevronRight,
  HiCalendar,
} from 'react-icons/hi2';
import { getReviews, postReply, reprocessReview } from '@/api/review-agent';
import { Modal } from '@/components/ui/Modal';
import { LoadingState } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { useToast } from '@/context/ToastContext';
import { fmtDate } from '@/utils/format';

const LIMIT = 20;

// ── Review Detail Modal (Reused) ────────────────────────────────────────────────
function ReviewDetailModal({ review: initialReview, open, onClose, onUpdate }) {
  const toast = useToast();
  const [review, setReview] = useState(initialReview);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);

  useEffect(() => {
    setReview(initialReview);
    if (initialReview) {
      setReplyText(initialReview.generatedReply || '');
    }
  }, [initialReview]);

  if (!review) return null;

  const handleReprocess = async () => {
    setReprocessing(true);
    try {
      const res = await reprocessReview(review.id || review._id);
      if (res.success) {
        setReview(res.data);
        setReplyText(res.data.generatedReply || '');
        toast.success('Review reprocessed successfully!');
        if (onUpdate) onUpdate(res.data);
      }
    } catch (err) {
      toast.error('Reprocess failed: ' + err.message);
    } finally {
      setReprocessing(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim()) {
      toast.error('Reply text cannot be empty.');
      return;
    }
    setSubmittingReply(true);
    try {
      const res = await postReply(review.id || review._id, replyText);
      if (res.success) {
        toast.success('Reply posted successfully!');
        const updated = { ...review, replyPosted: true, replyPostedAt: new Date(), generatedReply: replyText };
        setReview(updated);
        if (onUpdate) onUpdate(updated);
      }
    } catch (err) {
      toast.error('Failed to post reply: ' + err.message);
    } finally {
      setSubmittingReply(false);
    }
  };

  const starRating = review.starRating || 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Review Details & Escalation Action"
      size="lg"
      footer={
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
        >
          Close
        </button>
      }
    >
      <div className="space-y-6">
        {/* Customer Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-red-50/50 p-4 rounded-xl border border-red-100">
          <div className="flex items-center gap-3">
            {review.profilePhotoUrl ? (
              <img
                src={review.profilePhotoUrl}
                alt={review.authorName}
                className="w-10 h-10 rounded-full object-cover border border-slate-205 shadow-sm"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold uppercase">
                {review.authorName?.slice(0, 1)}
              </div>
            )}
            <div>
              <h4 className="font-bold text-slate-800 text-base">{review.authorName}</h4>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                <span className="capitalize">{review.source} Platform</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <HiCalendar className="w-3.5 h-3.5" />
                  {fmtDate(review.reviewCreatedAt)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-amber-500 font-bold text-lg flex">
              {'★'.repeat(starRating)}{'☆'.repeat(5 - starRating)}
            </span>
          </div>
        </div>

        {/* Alarm Banner */}
        <div className="flex gap-3 bg-red-50 border border-red-200 p-4 rounded-xl text-red-800 text-sm leading-relaxed">
          <HiExclamationTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Escalated Review Alert</p>
            <p className="mt-0.5 text-xs text-red-700">
              This review has been flagged as critical/negative and automatic response has been bypassed. Support notifications have been dispatched.
            </p>
          </div>
        </div>

        {/* Review Comment Box */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Review Content</span>
          <div className="bg-slate-50 border-l-4 border-red-500 p-4 rounded-r-xl">
            <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
              {review.comment || <em className="text-slate-400">No review text was provided.</em>}
            </p>
          </div>
        </div>

        {/* AI Analysis Row */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI Analysis</span>
            <button
              onClick={handleReprocess}
              disabled={reprocessing}
              className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50 transition-colors"
            >
              <HiArrowPath className={`w-3.5 h-3.5 ${reprocessing ? 'animate-spin' : ''}`} />
              Re-analyze with Gemini
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex flex-col justify-between">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Sentiment</span>
              <span className="mt-1 text-sm font-bold text-red-700 capitalize">{review.sentiment}</span>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex flex-col justify-between">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Concern Detected</span>
              <span className="mt-1">
                <Badge variant="rose">Yes</Badge>
              </span>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex flex-col justify-between">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Concern Type</span>
              <span className="mt-1 text-sm font-bold text-slate-700 capitalize">{review.concernType || 'none'}</span>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex flex-col justify-between">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Email Notification</span>
              <span className="mt-1">
                {review.escalationNotified ? (
                  <Badge variant="emerald">Sent ✓</Badge>
                ) : (
                  <Badge variant="slate">Pending</Badge>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Reply Ingestion / Response Box */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Manual Response</span>
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              {review.replyPosted ? (
                <span className="text-emerald-600 flex items-center gap-1">
                  <HiCheckCircle className="w-4 h-4" /> Posted {review.replyPostedAt && fmtDate(review.replyPostedAt)}
                </span>
              ) : (
                <span className="text-rose-600 flex items-center gap-1">
                  <HiExclamationTriangle className="w-4 h-4" /> Actions Required
                </span>
              )}
            </div>
          </div>

          {review.replyPosted ? (
            <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl">
              <p className="text-slate-700 text-sm leading-relaxed">{review.generatedReply}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-brand-50 border border-brand-100 p-2.5 rounded-lg">
                <HiSparkles className="w-4 h-4 text-brand-600 flex-shrink-0" />
                <span>Submit a personalized apology or solution. Posting a response will clear the pending status.</span>
              </div>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your official response to post to Google My Business..."
                rows={4}
                className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all leading-relaxed text-slate-700"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleSendReply}
                  disabled={submittingReply || !replyText.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-all disabled:opacity-50 shadow-sm"
                >
                  <HiPaperAirplane className="w-3.5 h-3.5 rotate-90" />
                  Post Apology Reply
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ── Escalations Page Component ──────────────────────────────────────────────────
export default function Escalations() {
  const toast = useToast();

  const [reviews, setReviews] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [replyFilter, setReplyFilter] = useState('');

  const [selectedReview, setSelectedReview] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const load = async (newOffset = 0) => {
    setLoading(true);
    try {
      const page = Math.floor(newOffset / LIMIT) + 1;
      const params = {
        page,
        limit: LIMIT,
        requiresEscalation: 'true', // locked to escalations
      };

      if (sentimentFilter) params.sentiment = sentimentFilter;
      if (sourceFilter) params.source = sourceFilter;
      if (replyFilter) params.replyPosted = replyFilter;

      const res = await getReviews(params);
      if (res.success) {
        setReviews(res.data.reviews || []);
        setTotal(res.data.pagination.totalCount || 0);
        setOffset(newOffset);
      }
    } catch (err) {
      toast.error('Failed to load escalations: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(0);
  }, [sentimentFilter, sourceFilter, replyFilter]);

  const filtered = search
    ? reviews.filter(
        (r) =>
          (r.authorName || '').toLowerCase().includes(search.toLowerCase()) ||
          (r.comment || '').toLowerCase().includes(search.toLowerCase())
      )
    : reviews;

  const handleUpdate = (updatedReview) => {
    setReviews((prev) =>
      prev.map((r) => ((r.id || r._id) === (updatedReview.id || updatedReview._id) ? updatedReview : r))
    );
    if (selectedReview && (selectedReview.id || selectedReview._id) === (updatedReview.id || updatedReview._id)) {
      setSelectedReview(updatedReview);
    }
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
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search escalated reviews..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <HiXMark className="w-4 h-4" />
            </button>
          )}
        </div>

        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
        >
          <option value="">All Platforms</option>
          <option value="google">Google Reviews</option>
          <option value="reviewtreasures">Review Treasures</option>
        </select>

        <select
          value={sentimentFilter}
          onChange={(e) => setSentimentFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
        >
          <option value="">All Sentiments</option>
          <option value="negative">Negative</option>
          <option value="critical">Critical</option>
        </select>

        <select
          value={replyFilter}
          onChange={(e) => setReplyFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
        >
          <option value="">All Action Status</option>
          <option value="true">Apology Posted</option>
          <option value="false">Unresolved</option>
        </select>
      </div>

      {/* Escalations Table */}
      <div className="bg-white rounded-2xl border border-red-100 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-red-50/20 border-b border-red-50">
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-red-500 uppercase tracking-wide whitespace-nowrap">
                  Customer
                </th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-red-500 uppercase tracking-wide whitespace-nowrap">
                  Platform
                </th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-red-500 uppercase tracking-wide whitespace-nowrap">
                  Rating
                </th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-red-500 uppercase tracking-wide whitespace-nowrap">
                  Issue Description
                </th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-red-500 uppercase tracking-wide whitespace-nowrap">
                  Sentiment
                </th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-red-500 uppercase tracking-wide whitespace-nowrap">
                  Resolution
                </th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-red-500 uppercase tracking-wide whitespace-nowrap">
                  Date
                </th>
                <th className="px-5 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8}>
                    <LoadingState />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      icon={HiExclamationTriangle}
                      title="No escalated reviews"
                      description="Outstanding job! All high-priority feedback is resolved."
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={r.id || r._id}
                    onClick={() => {
                      setSelectedReview(r);
                      setDetailOpen(true);
                    }}
                    className="border-t border-slate-50 hover:bg-red-50/10 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-4 font-semibold text-slate-800">
                      <div className="flex items-center gap-2">
                        {r.profilePhotoUrl ? (
                          <img
                            src={r.profilePhotoUrl}
                            alt={r.authorName}
                            className="w-5.5 h-5.5 rounded-full object-cover border border-slate-100"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : null}
                        <span>{r.authorName || 'Anonymous'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">{getSourceBadge(r.source)}</td>
                    <td className="px-5 py-4 text-amber-500 font-semibold whitespace-nowrap">
                      {'★'.repeat(r.starRating || 0)}{'☆'.repeat(5 - (r.starRating || 0))}
                    </td>
                    <td className="px-5 py-4 text-slate-500 max-w-[240px] truncate">
                      {r.comment || <em className="text-slate-350 font-normal">Rating only</em>}
                    </td>
                    <td className="px-5 py-4">{getSentimentBadge(r.sentiment)}</td>
                    <td className="px-5 py-4">
                      {r.replyPosted ? (
                        <span className="text-emerald-600 font-semibold flex items-center gap-1">
                          <HiCheckCircle className="w-3.5 h-3.5" /> Resolved
                        </span>
                      ) : (
                        <span className="text-rose-600 font-bold flex items-center gap-1 animate-pulse">
                          <HiExclamationTriangle className="w-3.5 h-3.5" /> Pending Action
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-400 whitespace-nowrap">
                      {fmtDate(r.reviewCreatedAt)}
                    </td>
                    <td className="px-5 py-4 text-slate-400">
                      <HiChevronRight className="w-4 h-4" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination total={total} limit={LIMIT} offset={offset} onPageChange={load} />
      </div>

      <ReviewDetailModal
        review={selectedReview}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onUpdate={handleUpdate}
      />
    </div>
  );
}
