"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DismissibleToast } from "@/components/ui/dismissible-toast";

interface QueryToastProps {
  variant: "success" | "error";
  message: string;
  closeLabel: string;
}

export function QueryToast({ variant, message, closeLabel }: QueryToastProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleClose = useCallback(() => {
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.delete("toast");
    nextSearchParams.delete("toastMessage");

    const query = nextSearchParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  return <DismissibleToast variant={variant} message={message} closeLabel={closeLabel} onClose={handleClose} />;
}
