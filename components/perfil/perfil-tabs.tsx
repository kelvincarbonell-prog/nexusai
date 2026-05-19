"use client";

import { useState } from "react";
import { User, Users, Eye, Briefcase } from "lucide-react";
import { PerfilForm } from "@/components/perfil/perfil-form";
import { EquipoPanel } from "@/components/perfil/equipo-panel";
import { VistaConfigPanel } from "@/components/perfil/vista-config-panel";

type Perfil = Parameters<typeof PerfilForm>[0]["initial"];
type Tab = "perfil" | "equipo" | "cliente" | "asesores";
type Especialidad = "generalista" | "laboral" | "fiscal";

const ESPECIALIDADES: Array<{ key: Especialidad; label: string; descripcion: string }> = [
  { key: "generalista", label: "Generalista", descripcion: "Asesores que combinan fiscal + laboral." },
  { key: "laboral", label: "Laboral", descripcion: "Asesores especializados en nóminas y SS." },
  { key: "fiscal", label: "Fiscal", descripcion: "Asesores especializados en impuestos y contabilidad." },
];

/**
 * Página /perfil con 4 pestañas:
 *   - Mi perfil — datos personales del usuario logado
 *   - Equipo — gestionar asesores invitados (solo admin/gestor)
 *   - Configuración cliente — qué módulos ven los clientes en su portal
 *   - Configuración asesores — qué módulos ven los asesores, con sub-tabs
 *     por especialidad (generalista / laboral / fiscal)
 */
export function PerfilTabs({ perfil, canManage }: { perfil: Perfil; canManage: boolean }) {
  const [tab, setTab] = useState<Tab>("perfil");
  const [especialidad, setEspecialidad] = useState<Especialidad>("generalista");

  const tabs: Array<{ key: Tab; label: string; icon: React.ReactNode; visible: boolean }> = [
    { key: "perfil", label: "Mi perfil", icon: <User size={14} />, visible: true },
    { key: "equipo", label: "Equipo", icon: <Users size={14} />, visible: canManage },
    { key: "cliente", label: "Configuración cliente", icon: <Eye size={14} />, visible: canManage },
    { key: "asesores", label: "Configuración asesores", icon: <Briefcase size={14} />, visible: canManage },
  ];

  return (
    <section style={{ display: "grid", gap: 18 }}>
      <nav
        role="tablist"
        aria-label="Configuración"
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--line, #e5e7eb)",
          overflowX: "auto",
          flexWrap: "nowrap",
        }}
      >
        {tabs.filter((t) => t.visible).map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 14px",
                background: "transparent",
                border: 0,
                borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                color: active ? "var(--ink)" : "var(--muted)",
                fontWeight: active ? 600 : 500,
                fontSize: 13,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "color 0.15s, border-color 0.15s",
              }}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </nav>

      {tab === "perfil" ? <PerfilForm initial={perfil} /> : null}

      {tab === "equipo" && canManage ? <EquipoPanel /> : null}

      {tab === "cliente" && canManage ? (
        <VistaConfigPanel alcance="cliente" />
      ) : null}

      {tab === "asesores" && canManage ? (
        <div style={{ display: "grid", gap: 14 }}>
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            Cada asesor verá la configuración que coincide con su especialidad asignada en
            la pestaña <strong>Equipo</strong>. Si no tiene especialidad, se aplica la de «Generalista».
          </p>
          <div role="tablist" aria-label="Especialidad" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {ESPECIALIDADES.map((e) => {
              const active = especialidad === e.key;
              return (
                <button
                  key={e.key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setEspecialidad(e.key)}
                  title={e.descripcion}
                  className={`button compact ${active ? "" : "ghost"}`}
                >
                  {e.label}
                </button>
              );
            })}
          </div>
          <VistaConfigPanel key={especialidad} alcance="asesor" especialidad={especialidad} />
        </div>
      ) : null}
    </section>
  );
}
