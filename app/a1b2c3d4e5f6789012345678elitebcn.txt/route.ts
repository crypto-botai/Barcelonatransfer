import { NextResponse } from "next/server";

export async function GET() {
  return new NextResponse("a1b2c3d4e5f6789012345678elitebcn", {
    headers: { "Content-Type": "text/plain" },
  });
}
