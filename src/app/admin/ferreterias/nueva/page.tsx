import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { NuevaFerreteriaFormClient } from "./NuevaFerreteriaFormClient";

export default async function NuevaFerreteriaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.isSuperAdmin) redirect("/dashboard");

  return <NuevaFerreteriaFormClient />;
}
