import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getHQData } from "@/lib/ai/hqData";
import OfficeCanvas from "@/components/hq/OfficeCanvas";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "AI Headquarters | Élite BCN Admin",
  robots: { index: false, follow: false },
};

export default async function HQPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!session || user?.role !== "ADMIN") redirect("/auth/login");

  const data = await getHQData();
  return (
    <div style={{ minHeight: "100vh", background: "#030303" }}>
      <OfficeCanvas initialData={data} />
    </div>
  );
}
