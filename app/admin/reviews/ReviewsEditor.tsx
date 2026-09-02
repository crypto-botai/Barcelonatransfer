"use client";

import { useEffect, useState } from "react";
import {
  Loader2, Save, Plus, Trash2, Star, BadgeCheck, RotateCcw, ClipboardPaste, X,
} from "lucide-react";
import toast from "react-hot-toast";

interface Review {
  author: string;
  rating: number;
  when: string;
  text?: string;
  verified: boolean;
}

interface Profile {
  name: string;
  cid: string;
  rating: number;
  count: number;
}

const BLANK: Review = { author: "", rating: 5, when: "", text: "", verified: true };

/**
 * Where the owner keeps the Google reviews up to date.
 *
 * The paste box is the reason this exists. Copying a review off the profile
 * gives you a block of text, not a form, so the box takes that block and works
 * out the name, the star rating, the age and the wording — and then shows what
 * it found for correction rather than saving it. Anything it gets wrong is one
 * click from being fixed, which is a better trade than a strict format nobody
 * can remember.
 *
 * The wording is never tidied. What Google shows is what a reader of the site
 * would have seen, spelling and all.
 */
export default function ReviewsEditor() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updated, setUpdated] = useState<string | null>(null);
  const [source, setSource] = useState<"built-in" | "saved">("built-in");
  const [paste, setPaste] = useState("");
  const [showPaste, setShowPaste] = useState(false);

  useEffect(() => {
    fetch("/api/admin/reviews")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Could not load the reviews"))))
      .then((d) => {
        setProfile(d.profile);
        setReviews(d.reviews ?? []);
        setUpdated(d.updatedAt ?? null);
        setSource(d.updatedAt ? "saved" : "built-in");
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  function setReview(i: number, patch: Partial<Review>) {
    setReviews((rs) => rs.map((r, n) => (n === i ? { ...r, ...patch } : r)));
  }

  /**
   * Reads a review pasted straight off the Google profile.
   *
   * Google's own layout puts the name on its own line, the rating and the age
   * on the next, then the wording. Anything that does not fit that shape still
   * lands as text on a new card, which is recoverable — dropping the paste
   * because it was not formatted as expected is not.
   */
  function parsePaste() {
    const blocks = paste.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
    if (blocks.length === 0) { toast.error("Nothing to read in that paste"); return; }

    const found: Review[] = [];
    for (const block of blocks) {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) continue;

      let author = lines[0].replace(/\s*\d+\s*reviews?.*$/i, "").trim();
      let rating = 5;
      let when = "";
      const body: string[] = [];

      for (const line of lines.slice(1)) {
        const stars = line.match(/([1-5])\s*(?:\/\s*5|stars?|★|⭐)/i) ?? line.match(/^(★+)/);
        const ago = line.match(/\b((?:an?|\d+)\s+(?:minute|hour|day|week|month|year)s?\s+ago)\b/i);
        const onlyMeta = /^[★⭐\s]*$/.test(line) || (!!ago && line.replace(ago[0], "").trim().length < 4);

        if (stars) rating = stars[1].startsWith("★") ? stars[1].length : Number(stars[1]);
        if (ago) when = ago[1];
        if (!onlyMeta && !stars && !ago) body.push(line);
        else if (!onlyMeta && ago) {
          const rest = line.replace(ago[0], "").replace(/^[\s·|,-]+/, "").trim();
          if (rest.length > 3) body.push(rest);
        }
      }

      if (!author) author = "Google reviewer";
      found.push({ author, rating, when, text: body.join(" ").trim() || undefined, verified: true });
    }

    setReviews((rs) => [...found, ...rs]);
    setPaste("");
    setShowPaste(false);
    toast.success(`${found.length} review${found.length === 1 ? "" : "s"} added — check them before saving`);
  }

  async function save() {
    if (!profile) return;
    const bad = reviews.findIndex((r) => !r.author.trim());
    if (bad >= 0) { toast.error(`Review ${bad + 1} has no name`); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: { ...profile, rating: Number(profile.rating), count: Number(profile.count) },
          reviews: reviews.map((r) => ({
            author: r.author.trim(),
            rating: Number(r.rating),
            when: r.when?.trim() ?? "",
            text: r.text?.trim() || undefined,
            verified: !!r.verified,
          })),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Could not save");
      setUpdated(d.updatedAt);
      setSource("saved");
      toast.success("Saved — live on the site now");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save", { duration: 8000 });
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!confirm("Discard the saved reviews and go back to the 16 built into the site?")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/reviews", { method: "DELETE" });
      if (!res.ok) throw new Error("Could not reset");
      toast.success("Back to the built-in reviews");
      setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reset");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-dark-400 text-sm">
        <Loader2 size={14} className="animate-spin" /> Loading reviews…
      </div>
    );
  }
  if (!profile) return <p className="text-red-400 text-sm">Could not load the reviews.</p>;

  return (
    <div className="space-y-6">
      {/* Profile totals — these feed the star rating Google shows for the site */}
      <section className="glass-card rounded-xl p-5">
        <h2 className="text-white text-sm font-medium mb-1">Google profile</h2>
        <p className="text-dark-400 text-xs mb-4 leading-relaxed">
          The rating and total below are what the site claims in its search-result stars, so they
          have to match the profile exactly. The total is every review on Google, which is not the
          same as the number of cards shown here.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="text-dark-500 text-[11px] uppercase tracking-wider">Profile name</span>
            <input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="mt-1 w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm" />
          </label>
          <label className="block">
            <span className="text-dark-500 text-[11px] uppercase tracking-wider">Average rating</span>
            <input type="number" step="0.1" min="0" max="5" value={profile.rating}
              onChange={(e) => setProfile({ ...profile, rating: Number(e.target.value) })}
              className="mt-1 w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm tabular-nums" />
          </label>
          <label className="block">
            <span className="text-dark-500 text-[11px] uppercase tracking-wider">Total on Google</span>
            <input type="number" min="0" value={profile.count}
              onChange={(e) => setProfile({ ...profile, count: Number(e.target.value) })}
              className="mt-1 w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm tabular-nums" />
          </label>
          <label className="block">
            <span className="text-dark-500 text-[11px] uppercase tracking-wider">Profile CID</span>
            <input value={profile.cid} onChange={(e) => setProfile({ ...profile, cid: e.target.value })}
              className="mt-1 w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm" />
          </label>
        </div>
      </section>

      {/* Paste box */}
      <section className="glass-card rounded-xl p-5">
        <div className="flex items-center justify-between gap-3 mb-1">
          <h2 className="text-white text-sm font-medium">Paste from Google</h2>
          <button onClick={() => setShowPaste((s) => !s)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold-500/15 border border-gold-500/30 text-gold-300 hover:bg-gold-500/25 text-xs font-medium">
            {showPaste ? <X size={12} /> : <ClipboardPaste size={12} />}
            {showPaste ? "Close" : "Paste reviews"}
          </button>
        </div>
        <p className="text-dark-400 text-xs leading-relaxed">
          Copy one or more reviews off your Google profile and paste them here. Separate each review
          with a blank line. Nothing is saved until you press Save — the cards appear first so you
          can correct anything read wrongly.
        </p>
        {showPaste && (
          <div className="mt-3">
            <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={8}
              placeholder={"Maria Gonzalez\n5 stars · 2 weeks ago\nExcellent service, driver was waiting at arrivals with a tablet. Very clean car.\n\nJohn Smith\n5 stars · a month ago\nOn time and professional."}
              className="w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm font-mono leading-relaxed" />
            <button onClick={parsePaste} disabled={!paste.trim()}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gold-500/15 border border-gold-500/30 text-gold-300 hover:bg-gold-500/25 text-xs font-medium disabled:opacity-40">
              <Plus size={12} /> Read them
            </button>
          </div>
        )}
      </section>

      {/* The reviews */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-white text-sm font-medium">
            Reviews on the site <span className="text-dark-500">({reviews.length})</span>
          </h2>
          <button onClick={() => setReviews((rs) => [{ ...BLANK }, ...rs])}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.1] text-dark-300 hover:text-white hover:border-white/20 text-xs">
            <Plus size={12} /> Add one by hand
          </button>
        </div>

        {reviews.map((r, i) => (
          <article key={i} className="glass-card rounded-xl p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-end">
              <label className="block">
                <span className="text-dark-500 text-[11px] uppercase tracking-wider">Name</span>
                <input value={r.author} onChange={(e) => setReview(i, { author: e.target.value })}
                  className="mt-1 w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm" />
              </label>
              <label className="block">
                <span className="text-dark-500 text-[11px] uppercase tracking-wider">Stars</span>
                <select value={r.rating} onChange={(e) => setReview(i, { rating: Number(e.target.value) })}
                  className="mt-1 bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm">
                  {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-dark-500 text-[11px] uppercase tracking-wider">When</span>
                <input value={r.when} onChange={(e) => setReview(i, { when: e.target.value })}
                  placeholder="2 weeks ago"
                  className="mt-1 w-36 bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm" />
              </label>
              <label className="flex items-center gap-2 pb-2.5 cursor-pointer">
                <input type="checkbox" checked={r.verified}
                  onChange={(e) => setReview(i, { verified: e.target.checked })}
                  className="accent-[#c9a84c] w-4 h-4" />
                <span className="text-dark-300 text-xs inline-flex items-center gap-1">
                  <BadgeCheck size={12} className="text-gold-400" /> On Google
                </span>
              </label>
              <button onClick={() => setReviews((rs) => rs.filter((_, n) => n !== i))}
                aria-label={`Remove the review from ${r.author || "this reviewer"}`}
                className="pb-2.5 text-dark-500 hover:text-red-400 transition-colors justify-self-start">
                <Trash2 size={14} />
              </button>
            </div>
            <label className="block mt-3">
              <span className="text-dark-500 text-[11px] uppercase tracking-wider">
                What they wrote <span className="normal-case tracking-normal">— leave empty for a rating with no words</span>
              </span>
              <textarea value={r.text ?? ""} onChange={(e) => setReview(i, { text: e.target.value })} rows={3}
                className="mt-1 w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm leading-relaxed" />
            </label>
            <div className="flex items-center gap-1 mt-2" aria-hidden="true">
              {Array.from({ length: 5 }, (_, n) => (
                <Star key={n} size={11}
                  className={n < r.rating ? "text-gold-400 fill-gold-400" : "text-dark-600"} />
              ))}
            </div>
          </article>
        ))}
      </section>

      {/* Save bar */}
      <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/[0.08] flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gold-500 text-black text-sm font-semibold disabled:opacity-40">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save &amp; publish
        </button>
        {source === "saved" && (
          <button onClick={reset} disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/[0.1] text-dark-400 hover:text-white text-xs">
            <RotateCcw size={12} /> Reset to built-in
          </button>
        )}
        <span className="text-dark-500 text-xs">
          {source === "built-in"
            ? "Showing the 16 reviews built into the site. Saving takes over from them."
            : updated ? `Last saved ${new Date(updated).toLocaleString("en-GB")}` : ""}
        </span>
      </div>
    </div>
  );
}
