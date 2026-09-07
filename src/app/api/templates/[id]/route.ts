import { NextResponse } from "next/server";
import { deleteTemplate, updateTemplate } from "@/lib/db/groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = (await request.json().catch(() => ({}))) as {
    name?: string;
    language?: string;
    subject?: string;
    body?: string;
  };
  const template = updateTemplate(id, b);
  if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });
  return NextResponse.json({ template });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!deleteTemplate(id)) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
