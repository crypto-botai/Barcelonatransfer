import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getLearningDashboardData } from "@/lib/ai/learning";
import { ApprovalActions } from "./ApprovalActions";
import { TriggerReviewButton } from "./TriggerReviewButton";
import Link from "next/link";
import { Brain, AlertTriangle, Lightbulb, MapPin, ArrowLeft, Clock } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agent Learning | Admin", robots: { index: false } };

function timeAgo(d: Date) {
  const diff = Date.now() - d.getTime();
  const h    = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const TYPE_META: Record<string, { label: string; colorClass: string; icon: React.ElementType }> = {
  PRICE_FLAG:  { label: "Price Flag",   colorClass: "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",  icon: AlertTriangle },
  IMPROVEMENT: { label: "Improvement",  colorClass: "text-blue-400 border-blue-400/30 bg-blue-400/5",        icon: Lightbulb },
  GEO_FLAG:    { label: "Geo Flag",     colorClass: "text-orange-400 border-orange-400/30 bg-orange-400/5",  icon: MapPin },
};

const AGENTS = ["support", "booking", "seo", "analytics", "health"];

export default async function LearningPage() {
  const session = await getServerSession(authOptions);
  const user    = session?.user as { role?: string } | undefined;
  if (!session || user?.role !== "ADMIN") redirect("/auth/login");

  const { pending, recentObservations } = await getLearningDashboardData();

  const improvements = pending.filter((p) => p.type === "IMPROVEMENT");
  const priceFlags   = pending.filter((p) => p.type === "PRICE_FLAG");
  const geoFlags     = pending.filter((p) => p.type === "GEO_FLAG");
  const otherPending = pending.filter((p) => !["IMPROVEMENT", "PRICE_FLAG", "GEO_FLAG"].includes(p.type));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin/hq" className="text-dark-500 hover:text-dark-300 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <Brain size={20} className="text-[#c9a84c]" />
        <div>
          <h1 className="text-xl font-display text-white">Agent Learning Dashboard</h1>
          <p className="text-dark-500 text-xs mt-0.5">Pending flags, improvement proposals, and agent observations.</p>
        </div>
        {pending.length > 0 && (
          <span className="ml-auto px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-semibold">
            {pending.length} pending
          </span>
        )}
      </div>

      {/* Manual review trigger */}
      <div className="mb-6 bg-dark-900 border border-white/[0.07] rounded-xl p-4 flex items-start gap-4">
        <Brain size={16} className="text-[#c9a84c] mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-white text-sm font-medium mb-1">Run Agent Review</p>
          <p className="text-dark-500 text-xs mb-3">Trigger a manual 24-hour review. Proposals appear below within ~30 seconds.</p>
          <div className="flex flex-wrap gap-2">
            {AGENTS.map((a) => <TriggerReviewButton key={a} agentName={a} />)}
          </div>
        </div>
      </div>

      {/* Price Flags */}
      <PendingSection title="Price Discrepancies" count={priceFlags.length} icon={<AlertTriangle size={14} className="text-yellow-400" />}>
        {priceFlags.map((item) => <PendingCard key={item.id} item={item} />)}
      </PendingSection>

      {/* Geo Flags */}
      <PendingSection title="Geocoding Flags" count={geoFlags.length} icon={<MapPin size={14} className="text-orange-400" />}>
        {geoFlags.map((item) => <PendingCard key={item.id} item={item} />)}
      </PendingSection>

      {/* Improvement Proposals */}
      <PendingSection title="Improvement Proposals" count={improvements.length} icon={<Lightbulb size={14} className="text-blue-400" />}>
        {improvements.map((item) => <PendingCard key={item.id} item={item} />)}
      </PendingSection>

      {/* Other */}
      <PendingSection title="Other" count={otherPending.length} icon={<Brain size={14} className="text-dark-400" />}>
        {otherPending.map((item) => <PendingCard key={item.id} item={item} />)}
      </PendingSection>

      {pending.length === 0 && (
        <div className="bg-dark-900 border border-white/[0.07] rounded-xl p-10 text-center text-dark-500">
          No pending items — all caught up.
        </div>
      )}

      {/* Recent agent observations */}
      {recentObservations.length > 0 && (
        <section className="mt-8">
          <h2 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
            <Brain size={14} className="text-purple-400" /> Recent Agent Observations
          </h2>
          <div className="bg-dark-900 border border-white/[0.07] rounded-xl divide-y divide-white/[0.04]">
            {recentObservations.map((obs) => (
              <div key={obs.id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">observation</span>
                  <span className="text-dark-600 text-[10px] flex items-center gap-1">
                    <Clock size={9} /> {timeAgo(obs.createdAt)}
                  </span>
                </div>
                <p className="text-white text-sm">{obs.title}</p>
                <p className="text-dark-400 text-xs mt-0.5 line-clamp-2">{obs.content}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function PendingSection({
  title, count, icon, children,
}: { title: string; count: number; icon: React.ReactNode; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <section className="mb-6">
      <h2 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
        {icon} {title} ({count})
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

// ─── Pending item card ────────────────────────────────────────────────────────

function PendingCard({ item }: {
  item: {
    id: string; type: string; title: string; preview: string;
    diffBefore?: string | null; diffAfter: string; createdAt: Date;
  };
}) {
  const meta = TYPE_META[item.type] ?? { label: item.type, colorClass: "text-dark-400 border-white/10 bg-white/[0.03]", icon: Brain };
  const Icon = meta.icon;

  return (
    <div className={`rounded-xl border p-4 ${meta.colorClass}`}>
      <div className="flex items-start gap-3">
        <Icon size={14} className="mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{meta.label}</span>
            <span className="text-dark-600 text-[10px] flex items-center gap-1">
              <Clock size={9} /> {timeAgo(item.createdAt)}
            </span>
          </div>
          <p className="text-white text-sm font-medium">{item.title}</p>
          <pre className="text-dark-400 text-[11px] mt-1.5 whitespace-pre-wrap font-mono leading-relaxed">{item.preview}</pre>
          {item.diffBefore && (
            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
              <div className="rounded p-2 bg-red-500/5 border border-red-500/20">
                <p className="text-red-400 font-semibold mb-0.5">Current</p>
                <p className="text-dark-400">{item.diffBefore}</p>
              </div>
              <div className="rounded p-2 bg-green-500/5 border border-green-500/20">
                <p className="text-green-400 font-semibold mb-0.5">Proposed</p>
                <p className="text-dark-400">{item.diffAfter.slice(0, 200)}</p>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <ApprovalActions itemId={item.id} />
      </div>
    </div>
  );
}
