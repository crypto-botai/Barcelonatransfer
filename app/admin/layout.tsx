import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!session || user?.role !== "ADMIN") redirect("/auth/login");

  return (
    <div className="flex min-h-screen bg-[#050505]">
      <AdminSidebar />
      {/* Main content — offset on desktop for sidebar, full-width on mobile with bottom padding */}
      <div className="flex-1 overflow-auto min-w-0 pb-20 lg:pb-0">
        {children}
      </div>
    </div>
  );
}
