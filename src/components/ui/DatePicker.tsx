import { forwardRef, type InputHTMLAttributes } from "react";
import { Input } from "./Input";

// Envoltorio fino sobre el <input type="date"> nativo — ya es accesible,
// funciona en todos los navegadores soportados y no exige sumar una
// librería de calendario para algo que el propio browser resuelve bien.
export const DatePicker = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type">>(
  (props, ref) => <Input ref={ref} type="date" {...props} />,
);
DatePicker.displayName = "DatePicker";
