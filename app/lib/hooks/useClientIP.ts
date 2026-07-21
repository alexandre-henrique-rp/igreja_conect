/**
 * Hook para detectar o IP público do cliente via serviço externo.
 *
 * Usa o ipify.org (gratuito, sem necessidade de API key) para obter
 * o IP público do dispositivo. Usado para rate limit e auditoria quando
 * o servidor não consegue determinar o IP via headers (ex: desenvolvimento).
 *
 * Fallback: retorna "unknown" se o serviço falhar ou estiver indisponível.
 */
import { useState, useEffect } from "react";

const IPIFY_URL = "https://api.ipify.org?format=json";
const TIMEOUT_MS = 3000;

export function useClientIP(): string {
  const [ip, setIp] = useState("unknown");

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    fetch(IPIFY_URL, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (data?.ip) setIp(data.ip);
      })
      .catch(() => {
        // Serviço indisponível ou timeout — mantém "unknown"
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, []);

  return ip;
}
