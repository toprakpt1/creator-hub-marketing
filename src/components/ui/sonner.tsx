"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      theme="light"
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast bg-popover text-foreground border border-border shadow-2xl rounded-lg",
          description: "text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-secondary text-secondary-foreground",
          closeButton: "bg-secondary text-muted-foreground border-border",
        },
      }}
    />
  );
}

export { toast } from "sonner";
