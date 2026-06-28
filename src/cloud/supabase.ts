/**
 * Subida manual de sesiones a Supabase (base de datos en la nube).
 *
 * Las credenciales (URL del proyecto y "anon key") se guardan en el dispositivo
 * (tabla app_config), NO en el repositorio. La anon key es una clave pública
 * pensada para clientes; aun así no se versiona para mayor privacidad.
 *
 * Tabla esperada en Supabase (ver instrucciones): public.sessions
 */
import { getConfig, setConfig } from "@/db/database";
import type { SessionPayload } from "@/analysis/persist";

const KEY_URL = "supabase_url";
const KEY_ANON = "supabase_anon";

export interface CloudConfig {
  url: string;
  anonKey: string;
}

export async function getCloudConfig(): Promise<CloudConfig | null> {
  const url = await getConfig(KEY_URL);
  const anonKey = await getConfig(KEY_ANON);
  if (url && anonKey) return { url: url.replace(/\/+$/, ""), anonKey };
  return null;
}

export async function setCloudConfig(url: string, anonKey: string): Promise<void> {
  await setConfig(KEY_URL, url.trim());
  await setConfig(KEY_ANON, anonKey.trim());
}

/** Sube una sesión con el nombre dado. Lanza error con mensaje legible si falla. */
export async function uploadSession(name: string, payload: SessionPayload): Promise<void> {
  const cfg = await getCloudConfig();
  if (!cfg) throw new Error("Configura la nube primero (URL y clave).");

  const a = payload.aggregates;
  const body = {
    name,
    started_at: payload.startedAtMs,
    rep_count: a.repCount,
    quality_index: a.qualityIndex,
    arm_peak_best_dps: a.armPeakBestDps,
    sequencing_ok_pct: a.sequencingOkPct,
    session_load: a.load,
    payload,
  };

  const res = await fetch(`${cfg.url}/rest/v1/sessions`, {
    method: "POST",
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${cfg.anonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Error ${res.status}: ${txt || res.statusText}`);
  }
}
