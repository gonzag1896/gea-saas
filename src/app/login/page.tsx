import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main style={{ padding: 40 }}>
      <h1>Ingresar a GEA</h1>
      <LoginForm />
    </main>
  );
}
