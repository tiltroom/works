export type QueryToastVariant = "success" | "error";

export function withQueryToast(target: string, variant: QueryToastVariant, message: string) {
  const [pathname, query = ""] = target.split("?");
  const searchParams = new URLSearchParams(query);

  searchParams.set("toast", variant);
  searchParams.set("toastMessage", message);

  const nextQuery = searchParams.toString();
  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}
