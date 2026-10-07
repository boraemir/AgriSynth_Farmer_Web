// middleware.js
import { NextResponse } from "next/server";

// ... (BYPASS_ROUTES ve classifyEdgeThreat aynı kalacak) ...

async function generateAdvancedFingerprint(req, ip) {
  const ua = req.headers.get("user-agent") || "";
  // X-Forwarded-For IP'sini de parmak izine dahil et ki aynı ağdan gelenler ayrışsın
  const rawFingerprint = `${ip}|${ua}|${req.headers.get("sec-ch-ua")}`;

  const encoded = new TextEncoder().encode(rawFingerprint);
  const hashBuf = await crypto.subtle.digest("SHA-256", encoded);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  const hex = hashArr.map((b) => b.toString(16).padStart(2, "0")).join("");
  
  return `FH-DEV-${hex.slice(0, 16).toUpperCase()}`;
}

export async function middleware(req, event) {
  const url = new URL(req.url);
  if (BYPASS_ROUTES.some((p) => url.pathname.startsWith(p))) return NextResponse.next();

  // Gerçek IP'yi Vercel'den al
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
  const deviceId = await generateAdvancedFingerprint(req, ip);

  // ... (SOC Ban kontrolü aynı kalacak) ...

  if (threat.type !== "BENIGN") {
    event.waitUntil(
      fetch(`${SOC_API_BASE}/api/trigger-alert`, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "x-forwarded-for": ip // API'ye gerçek IP'yi buradan taşıyoruz
        },
        body: JSON.stringify({
          source_ip: ip,
          destination_ip: req.headers.get("host"),
          threat_type: threat.type,
          confidence: threat.conf,
          device_id: deviceId
        })
      }).catch(() => {})
    );
  }
  return NextResponse.next();
}
