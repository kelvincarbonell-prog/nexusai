"use client";

import { useState, useTransition } from "react";
import { Building2, UserRoundPlus } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function SelfServeRegisterForm() {
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setMessage("");
    startTransition(async () => {
      const email = String(formData.get("email") ?? "");
      const password = String(formData.get("password") ?? "");
      const name = String(formData.get("name") ?? "");
      const businessName = String(formData.get("businessName") ?? "");
      const nif = String(formData.get("nif") ?? "");
      const accountType = String(formData.get("accountType") ?? "empresa");
      const supabase = createBrowserSupabase();

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            business_name: businessName,
            nif,
            account_type: accountType,
            onboarding_source: "self_serve",
          },
        },
      });

      if (error) {
        setMessage("No se pudo crear la cuenta. Revisa los datos o intenta de nuevo.");
        return;
      }

      if (!data.session || !data.user) {
        setMessage("Cuenta creada. Revisa tu email para confirmar el acceso y vuelve al login.");
        return;
      }

      await supabase.from("perfiles").upsert({
        id: data.user.id,
        email,
        nombre: name,
        rol: "portal_cliente",
        nombre_gestoria: null,
      });

      await supabase.from("empresas").insert({
        owner_user_id: data.user.id,
        razon_social: businessName,
        nif,
        account_type: accountType,
        onboarding_source: "self_serve",
        estado: "activo",
      });

      setMessage("Cuenta creada. Ya puedes acceder a tu panel.");
    });
  }

  return (
    <form action={submit} className="login-card form">
      <Building2 size={28} color="#145c4a" />
      <div>
        <h2>Registro independiente</h2>
        <p className="muted">Para autónomos y empresas que usarán NexusAI sin depender de una gestoría.</p>
      </div>
      <input className="input" name="name" placeholder="Nombre de contacto" required />
      <input className="input" name="businessName" placeholder="Nombre fiscal / razón social" required />
      <input className="input" name="nif" placeholder="NIF / CIF" required />
      <select className="input" name="accountType" defaultValue="empresa">
        <option value="autonomo">Autónomo</option>
        <option value="empresa">Empresa</option>
      </select>
      <input className="input" name="email" type="email" placeholder="Email" autoComplete="email" required />
      <input className="input" name="password" type="password" placeholder="Contraseña" autoComplete="new-password" required />
      <button className="button" type="submit" disabled={isPending}>
        <UserRoundPlus size={17} />
        {isPending ? "Creando..." : "Crear cuenta"}
      </button>
      {message ? <p className="muted">{message}</p> : null}
    </form>
  );
}
