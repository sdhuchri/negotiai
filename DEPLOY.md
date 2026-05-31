# Deploy NegotiAI ke Railway

NegotiAI = **4 service** di Railway: `Postgres` (managed) + `agent` + `backend` + `frontend`.
Tiap service di-build dari subfolder repo via Dockerfile-nya. Repo sudah disiapkan
(production Dockerfile, bind `$PORT`, CORS via env, IPv6 untuk private networking).

```
Browser ──HTTPS──► frontend (public)
Browser ──HTTPS/SSE──► backend (public) ──private──► agent ──► AWS Bedrock
                         │                  │
                         └──► Postgres ◄─────┘ (backend only)
```

---

## 0) Prasyarat
- Akun Railway (ada trial credit; 3 service + Postgres muat di plan kecil).
- Repo sudah di GitHub: `sdhuchri/negotiai`.
- AWS Bedrock creds (akses model Kimi K2.5 / Claude) — atau pakai `NEGOTIAI_BRAIN=mock` untuk tanpa LLM.

## 1) Buat Project + Postgres
1. Railway → **New Project** → **Deploy from GitHub repo** → pilih `sdhuchri/negotiai`.
2. **+ New** → **Database** → **Add PostgreSQL**.

## 2) Buat 3 service dari repo (monorepo)
Untuk tiap service: **+ New → GitHub Repo → negotiai**, lalu di **Settings → Root Directory** set:

| Service (beri nama) | Root Directory |
|---|---|
| `agent` | `agent` |
| `backend` | `backend` |
| `frontend` | `frontend` |

Railway otomatis mendeteksi `Dockerfile` di tiap folder. *(Frontend pakai Dockerfile production; dev pakai `Dockerfile.dev`.)*

> Di **Settings → Deploy**, set **Replicas = 1** untuk `backend` & `agent` (state SSE hub & checkpoint masih in-memory).

## 3) Environment Variables

**agent** (Variables):
```
PORT=8000
NEGOTIAI_BRAIN=bedrock          # atau "mock" (tanpa creds)
BACKEND_INTERNAL_URL=http://backend.railway.internal:8080
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-southeast-3
BEDROCK_MODEL_ID=moonshotai.kimi-k2.5
```

**backend** (Variables):
```
PORT=8080
DATABASE_URL=${{Postgres.DATABASE_URL}}
AGENT_SERVICE_URL=http://agent.railway.internal:8000
UPLOAD_DIR=/data/uploads
ALLOWED_ORIGINS=https://<DOMAIN-FRONTEND>     # isi setelah langkah 4
```

**frontend** (Variables):
```
PORT=3000
NEXT_PUBLIC_BACKEND_URL=https://<DOMAIN-BACKEND>   # isi setelah langkah 4 (build-time!)
```

> `${{Postgres.DATABASE_URL}}` = reference variable Railway ke service Postgres.
> Hostname `*.railway.internal` = private networking antar-service (gratis, IPv6).

## 4) Generate domain (urutan penting)
1. **backend** → Settings → **Networking → Generate Domain** → catat URL-nya (mis. `https://backend-xxx.up.railway.app`).
2. **frontend** → Generate Domain → catat URL-nya.
3. **agent** → **tidak perlu** domain public (private-only).
4. Isi balik:
   - `backend.ALLOWED_ORIGINS` = URL frontend → backend redeploy.
   - `frontend.NEXT_PUBLIC_BACKEND_URL` = URL backend → **frontend rebuild** (variabel ini di-bake saat build).

## 5) Volume untuk file upload
- **backend** → Settings → **Volumes → Add Volume**, mount path: `/data/uploads`.
  (Tanpa ini, file intake yang di-upload hilang tiap redeploy.)

## 6) Deploy & cek
Urutan aman: **Postgres → agent → backend (generate domain) → frontend (set NEXT_PUBLIC_BACKEND_URL, build)**, lalu set `ALLOWED_ORIGINS` di backend & redeploy.

- Migrasi DB jalan otomatis saat backend boot (lihat Deploy Logs: `migrations applied`).
- Buka domain **frontend** → buat room → tes.
- Smoke test backend: `https://<DOMAIN-BACKEND>/health` → `{"status":"ok"}`.

---

## Troubleshooting
- **CORS error di browser** → `ALLOWED_ORIGINS` (backend) harus = URL frontend persis (https, tanpa trailing slash), lalu redeploy backend.
- **Frontend manggil `localhost:8090`** → `NEXT_PUBLIC_BACKEND_URL` belum kebake; set lalu **rebuild** frontend (bukan cuma restart).
- **Backend gagal start `DATABASE_URL is required`** → pastikan reference `${{Postgres.DATABASE_URL}}` benar.
- **Agent tak menerima event / negosiasi diam** → `BACKEND_INTERNAL_URL` & `AGENT_SERVICE_URL` pakai `*.railway.internal` + port yang sama dengan `PORT` masing-masing.
- **Bedrock error** → cek region & model enabled di akun AWS; atau set `NEGOTIAI_BRAIN=mock` dulu untuk memastikan pipeline jalan.

## Catatan
- `agent` & `backend` menyimpan sebagian state di memori (checkpoint LangGraph & SSE hub) → jaga **Replicas = 1**. Untuk scale: pindah ke PostgresSaver + Redis pub/sub (lihat ARCHITECTURE.md §10).
- Aset karakter/background olahan sudah ikut di repo (raw pack tidak) — tidak perlu langkah aset tambahan saat deploy.
