"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fullNumber } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizes = [25, 50, 100],
  itemLabel,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizes?: number[];
  itemLabel?: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const t = useT();
  const label = itemLabel ?? t("common.creators");
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        {t("common.showingRange", { from, to, total, item: label })}
      </p>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">{t("common.rows")}</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              onPageSizeChange(Number(v));
              onPageChange(1);
            }}
          >
            <SelectTrigger className="h-8 w-[74px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizes.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page <= 1}
            onClick={() => onPageChange(1)}
            aria-label={t("common.firstPage")}
          >
            <ChevronsLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label={t("common.previousPage")}
          >
            <ChevronLeft />
          </Button>
          <span className="px-2 text-xs tabular text-muted-foreground">
            {page} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
            aria-label={t("common.nextPage")}
          >
            <ChevronRight />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page >= pageCount}
            onClick={() => onPageChange(pageCount)}
            aria-label={t("common.lastPage")}
          >
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
