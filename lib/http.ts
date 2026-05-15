import { NextResponse } from "next/server";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export function refId() {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = crypto.getRandomValues(new Uint8Array(3));
  const hex = Array.from(rnd).map((n) => n.toString(16).padStart(2, "0")).join("").slice(0, 4).toUpperCase();
  return `NX-${ts}-${hex}`;
}
