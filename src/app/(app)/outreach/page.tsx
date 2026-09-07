import { PageIntro } from "@/components/shared/page-intro";
import { OutreachWorkspace } from "@/components/outreach/outreach-workspace";

export const metadata = { title: "Outreach · Chest Blade Creator Hub" };
export const dynamic = "force-dynamic";

export default function OutreachPage() {
  return (
    <div className="space-y-5">
      <PageIntro titleKey="outreach.title" descriptionKey="outreach.subtitle" />
      <OutreachWorkspace />
    </div>
  );
}
