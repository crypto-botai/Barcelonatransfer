import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) {
    return new NextResponse(unsubHtml("Invalid link — email missing."), { headers: { "Content-Type": "text/html" } });
  }

  try {
    await prisma.newsletterSubscriber.updateMany({
      where: { email },
      data:  { isActive: false, unsubscribedAt: new Date() },
    });
    return new NextResponse(unsubHtml("You've been unsubscribed successfully.", true), { headers: { "Content-Type": "text/html" } });
  } catch {
    return new NextResponse(unsubHtml("Something went wrong. Please try again."), { headers: { "Content-Type": "text/html" } });
  }
}

function unsubHtml(message: string, success = false): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Unsubscribe</title></head>
  <body style="font-family:Georgia,serif;background:#050505;color:#d0d0d0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
    <div style="text-align:center;max-width:400px;padding:40px;">
      <p style="font-size:40px;margin-bottom:16px;">${success ? "✓" : "✗"}</p>
      <h2 style="color:${success ? "#c9a84c" : "#ff6b6b"};margin-bottom:12px;">${success ? "Unsubscribed" : "Error"}</h2>
      <p style="color:#888;">${message}</p>
      <a href="https://www.elitebcn.info" style="display:inline-block;margin-top:24px;color:#c9a84c;text-decoration:none;border:1px solid #c9a84c;padding:10px 24px;border-radius:6px;">Back to Website</a>
    </div>
  </body></html>`;
}
