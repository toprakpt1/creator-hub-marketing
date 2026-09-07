import { PageIntro } from "@/components/shared/page-intro";
import { TemplatesWorkspace } from "@/components/templates/templates-workspace";
import { listCreators } from "@/lib/db/creators";
import { listTemplates } from "@/lib/db/groups";

export const metadata = { title: "Email Templates · Chest Blade Creator Hub" };
export const dynamic = "force-dynamic";

export default function TemplatesPage() {
  // Preview against a real saved creator when one exists, so the rendered
  // variables show real numbers rather than invented ones.
  const sample = listCreators().find((c) => c.videosAnalyzed > 0) ?? listCreators()[0] ?? null;

  return (
    <div className="space-y-5">
      <PageIntro titleKey="templates.title" descriptionKey="templates.subtitle" />
      <TemplatesWorkspace templates={listTemplates()} sampleCreator={sample} />
    </div>
  );
}
