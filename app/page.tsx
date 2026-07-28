import { redirect } from "next/navigation";
import { defaultLocale } from "@/lib/i18n";

// Norwegian bokmål is the default locale (01-design-spec.md).
export default function RootRedirect() {
  redirect(`/${defaultLocale}`);
}
