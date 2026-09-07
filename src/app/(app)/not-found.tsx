import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { NotFoundCopy } from "@/components/shared/not-found-copy";

export default function AppNotFound() {
  return (
    <div className="py-10">
      <NotFoundCopy />
    </div>
  );
}
