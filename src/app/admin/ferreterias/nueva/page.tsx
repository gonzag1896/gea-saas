import { NuevaFerreteriaFormClient } from "./NuevaFerreteriaFormClient";

// La guardia de sesión/isSuperAdmin vive en el layout de /admin.
export default function NuevaFerreteriaPage() {
  return <NuevaFerreteriaFormClient />;
}
