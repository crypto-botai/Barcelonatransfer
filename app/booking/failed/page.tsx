import Link from "next/link";
import { XCircle, ArrowLeft, MessageCircle } from "lucide-react";
import Navbar from "@/components/layout/Navbar";

export default function FailedPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
        <div className="glass-card rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-6">
            <XCircle size={36} className="text-red-400" />
          </div>
          <h1 className="font-display text-3xl text-white mb-2">Payment Failed</h1>
          <p className="text-dark-400 mb-8">
            Your payment could not be processed. No charge was made. Please try again or use a different payment method.
          </p>
          <div className="flex flex-col gap-3">
            <Link href="/book" className="btn-gold w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2">
              <ArrowLeft size={16} /> Try Again
            </Link>
            <a href="https://wa.me/34635383712" target="_blank" rel="noreferrer"
              className="btn-outline-gold w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2">
              <MessageCircle size={16} /> Pay via WhatsApp
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
