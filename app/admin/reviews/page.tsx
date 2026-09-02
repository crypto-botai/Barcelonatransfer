import ReviewsEditor from "./ReviewsEditor";

export const dynamic = "force-dynamic";

export default function AdminReviewsPage() {
  return (
    <div className="p-4 pt-16 lg:pt-6 lg:p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-white">Reviews</h1>
        <p className="text-dark-400 mt-1 max-w-2xl">
          Paste reviews from your Google profile and they appear on the homepage exactly as written.
          Changes go live on save.
        </p>
      </div>
      <ReviewsEditor />
    </div>
  );
}
