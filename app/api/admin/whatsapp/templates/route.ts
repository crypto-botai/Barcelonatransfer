import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/whatsapp-admin";
import { createWhatsAppTemplate, listWhatsAppTemplates } from "@/lib/whatsapp";
import { TEMPLATE_DEFS, templateProblems } from "@/lib/whatsapp-template-defs";

export const dynamic = "force-dynamic";

type Row = { name: string; to: "customer" | "driver" | "admin"; purpose: string; body: string; status: string; problem: string | null };

/** Where each template the site needs stands in Meta: approved, waiting, refused or not yet submitted. */
async function rows(): Promise<{ ok: true; rows: Row[] } | { ok: false; reason: string }> {
  const listed = await listWhatsAppTemplates();
  if (!listed.ok) return listed;
  return {
    ok: true,
    rows: TEMPLATE_DEFS.map((d) => {
      // The same name can exist in several languages; ours is the English one.
      const found = listed.templates.find((t) => t.name === d.name && t.language.startsWith("en")) ?? listed.templates.find((t) => t.name === d.name);
      return {
        name: d.name, to: d.to, purpose: d.purpose, body: d.body,
        status: found ? found.status : "MISSING",
        problem: found?.rejectedReason ?? null,
      };
    }),
  };
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const r = await rows();
  if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 502 });
  return NextResponse.json({ templates: r.rows });
}

/** Submit every template that does not exist yet. Existing ones, approved or not, are left alone. */
export async function POST() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const before = await rows();
  if (!before.ok) return NextResponse.json({ error: before.reason }, { status: 502 });

  const submitted: { name: string; ok: boolean; detail: string }[] = [];
  for (const row of before.rows.filter((r) => r.status === "MISSING")) {
    const def = TEMPLATE_DEFS.find((d) => d.name === row.name)!;
    const problems = templateProblems(def);
    if (problems.length) { submitted.push({ name: def.name, ok: false, detail: problems.join("; ") }); continue; }
    const r = await createWhatsAppTemplate(def);
    submitted.push({ name: def.name, ok: r.ok, detail: r.ok ? r.status : r.reason });
  }

  const after = await rows();
  return NextResponse.json({ submitted, templates: after.ok ? after.rows : before.rows });
}
