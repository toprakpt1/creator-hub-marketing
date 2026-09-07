import { NextResponse } from "next/server";
import { createTemplate, listTemplates } from "@/lib/db/groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ templates: listTemplates() });
}

export async function POST(request: Request) {
  const b = (await request.json().catch(() => ({}))) as {
    name?: string;
    language?: string;
    subject?: string;
    body?: string;
  };
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return NextResponse.json({ error: "A template needs a name." }, { status: 400 });

  return NextResponse.json({
    template: createTemplate(
      name,
      b.language?.trim() || "English",
      b.subject?.trim() || "",
      b.body ?? ""
    ),
  });
}
