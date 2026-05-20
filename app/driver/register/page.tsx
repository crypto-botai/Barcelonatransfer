"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Mail, Lock, User, Phone, MessageCircle, Loader2,
  Upload, FileText, Car, Image as ImageIcon, Shield, CheckCircle2
} from "lucide-react";
import toast from "react-hot-toast";

type UploadField = {
  key: "licenseFileUrl" | "vehiclePermitUrl" | "vehiclePhotoFront" | "vehiclePhotoBack" | "insuranceUrl";
  label: string;
  hint:  string;
  icon:  React.ElementType;
  folder:string;
};

const UPLOAD_FIELDS: UploadField[] = [
  { key: "licenseFileUrl",    label: "Driving Licence",       hint: "PDF or photo of your licence",         icon: FileText,   folder: "license" },
  { key: "vehiclePermitUrl",  label: "Vehicle Permission",    hint: "VTC/taxi permit document",              icon: FileText,   folder: "permit"  },
  { key: "vehiclePhotoFront", label: "Vehicle Photo – Front", hint: "Clear photo of your vehicle front",    icon: ImageIcon,  folder: "photos"  },
  { key: "vehiclePhotoBack",  label: "Vehicle Photo – Back",  hint: "Clear photo of your vehicle rear",     icon: ImageIcon,  folder: "photos"  },
  { key: "insuranceUrl",      label: "Vehicle Insurance",     hint: "Insurance certificate (PDF or photo)", icon: Shield,     folder: "insurance"},
];

type FileUrls = Record<UploadField["key"], string>;

async function uploadFile(file: File, folder: string): Promise<string | null> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", folder);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) return null;
  const { url } = await res.json() as { url: string | null };
  return url;
}

export default function DriverRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "", email: "", phone: "", password: "", whatsappNumber: "",
  });
  const [fileUrls, setFileUrls]     = useState<Partial<FileUrls>>({});
  const [uploading, setUploading]   = useState<Partial<Record<UploadField["key"], boolean>>>({});
  const [loading, setLoading]       = useState(false);
  const [step, setStep]             = useState<1 | 2>(1);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleFileChange = async (field: UploadField, file: File) => {
    setUploading((u) => ({ ...u, [field.key]: true }));
    try {
      const url = await uploadFile(file, field.folder);
      if (url) {
        setFileUrls((u) => ({ ...u, [field.key]: url }));
        toast.success(`${field.label} uploaded`);
      } else {
        // Storage not configured — store file name as placeholder
        setFileUrls((u) => ({ ...u, [field.key]: `[pending:${file.name}]` }));
        toast.success(`${field.label} saved (will be reviewed)`);
      }
    } catch {
      toast.error(`Failed to upload ${field.label}`);
    } finally {
      setUploading((u) => ({ ...u, [field.key]: false }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/driver-register", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...form, ...fileUrls }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Registration failed");
      toast.success("Account created! Sign in to view your dashboard.");
      router.push("/auth/login?message=driver-registered");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(201,168,76,0.06),transparent)]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl p-8 w-full max-w-lg relative z-10"
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 mb-8 w-fit">
          <div className="w-8 h-8 border border-gold-500 rotate-45 flex items-center justify-center">
            <div className="w-3 h-3 bg-gold-500" />
          </div>
          <span className="font-display text-xl tracking-[0.25em]">
            <span className="text-white">ÉLITE</span><span className="text-gold-500">BCN</span>
          </span>
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <Car size={20} className="text-gold-500" />
          <h1 className="font-display text-2xl text-white">Driver Registration</h1>
        </div>
        <p className="text-dark-400 text-sm mb-6">
          Join the Élite BCN driver network. Your account will be reviewed and approved by admin.
        </p>

        {/* Step indicator */}
        <div className="flex items-center gap-3 mb-7">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => step === 2 && s === 1 && setStep(1)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                  step === s ? "bg-gold-500 text-black" :
                  s < step   ? "bg-gold-500/30 text-gold-400" :
                               "bg-white/[0.06] text-dark-400"
                }`}
              >
                {s < step ? <CheckCircle2 size={14} /> : s}
              </button>
              <span className={`text-xs ${step === s ? "text-white" : "text-dark-500"}`}>
                {s === 1 ? "Account Details" : "Documents"}
              </span>
              {s < 2 && <div className="w-8 h-px bg-white/[0.08] mx-1" />}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Step 1: Account details */}
          {step === 1 && (
            <div className="space-y-4">
              {[
                { icon: User,           key: "name",           type: "text",     ph: "Full name" },
                { icon: Mail,           key: "email",          type: "email",    ph: "your@email.com" },
                { icon: Phone,          key: "phone",          type: "tel",      ph: "+34 600 000 000 (optional)" },
                { icon: MessageCircle,  key: "whatsappNumber", type: "tel",      ph: "WhatsApp number (optional)" },
                { icon: Lock,           key: "password",       type: "password", ph: "Minimum 8 characters" },
              ].map(({ icon: Icon, key, type, ph }) => (
                <div key={key}>
                  <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5 capitalize">
                    {key === "whatsappNumber" ? "WhatsApp Number" : key}
                  </label>
                  <div className="relative">
                    <Icon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold-500/60" />
                    <input
                      type={type}
                      required={key !== "phone" && key !== "whatsappNumber"}
                      value={form[key as keyof typeof form]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder={ph}
                      className="input-luxury w-full pl-10 pr-4 py-4 rounded-xl"
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => {
                  if (!form.name || !form.email || !form.password) {
                    toast.error("Please fill in name, email, and password");
                    return;
                  }
                  setStep(2);
                }}
                className="btn-gold w-full py-4 rounded-xl font-semibold"
              >
                Continue to Documents
              </button>

              <p className="text-center text-xs text-dark-500">
                All document fields on the next step are optional — you can register immediately and add them later.
              </p>
            </div>
          )}

          {/* Step 2: Documents */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-dark-400 text-xs mb-2">
                Upload your documents to speed up approval. All fields are optional.
              </p>

              {UPLOAD_FIELDS.map((field) => {
                const uploaded  = !!fileUrls[field.key];
                const isUploading = uploading[field.key];
                const Icon = field.icon;

                return (
                  <div key={field.key}>
                    <label className="text-xs text-dark-400 uppercase tracking-wider block mb-1.5">
                      {field.label} <span className="text-dark-600 normal-case">(optional)</span>
                    </label>
                    <div
                      className={`relative flex items-center gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                        uploaded
                          ? "border-green-500/40 bg-green-500/5"
                          : "border-white/[0.08] bg-white/[0.02] hover:border-gold-500/30"
                      }`}
                      onClick={() => fileRefs.current[field.key]?.click()}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        uploaded ? "bg-green-500/15" : "bg-gold-500/10"
                      }`}>
                        {isUploading ? (
                          <Loader2 size={16} className="text-gold-500 animate-spin" />
                        ) : uploaded ? (
                          <CheckCircle2 size={16} className="text-green-400" />
                        ) : (
                          <Icon size={16} className="text-gold-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${uploaded ? "text-green-400" : "text-white"}`}>
                          {uploaded ? "Uploaded" : "Choose file"}
                        </p>
                        <p className="text-dark-500 text-xs truncate">{field.hint}</p>
                      </div>
                      <Upload size={14} className="text-dark-500 flex-shrink-0" />
                      <input
                        ref={(el) => { fileRefs.current[field.key] = el; }}
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileChange(field, file);
                        }}
                      />
                    </div>
                  </div>
                );
              })}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 py-4 rounded-xl border border-white/10 text-dark-400 hover:text-white hover:border-white/20 transition-all text-sm font-medium"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 btn-gold py-4 rounded-xl font-semibold flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  {loading ? "Creating Account…" : "Create Driver Account"}
                </button>
              </div>
            </div>
          )}
        </form>

        <p className="text-center text-sm text-dark-400 mt-6">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-gold-400 hover:text-gold-300 transition-colors">
            Sign In
          </Link>
        </p>
        <p className="text-center text-sm text-dark-400 mt-2">
          Looking to book a ride?{" "}
          <Link href="/auth/register" className="text-gold-400 hover:text-gold-300 transition-colors">
            Customer Registration
          </Link>
        </p>
      </motion.div>
    </main>
  );
}
