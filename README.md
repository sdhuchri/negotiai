# NegotiAI 🤝

> **Dari penawaran sampai sepakat, dalam hitungan jam bukan minggu.**

Platform negosiasi **B2B berbasis AI agent**. Dua AI agent bernegosiasi otomatis di dalam
**koridor (guardrail)** yang ditentukan manusia, dengan **human-in-the-loop** di titik keputusan
penting — memangkas tawar-menawar vendor↔procurement dari **4–12 minggu** menjadi **hitungan jam**.

<p>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black?logo=next.js">
  <img alt="Go" src="https://img.shields.io/badge/Go-1.26-00ADD8?logo=go&logoColor=white">
  <img alt="Python" src="https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white">
  <img alt="LangGraph" src="https://img.shields.io/badge/LangGraph-state%20machine-1C3C3C">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white">
  <img alt="AWS Bedrock" src="https://img.shields.io/badge/AWS%20Bedrock-Claude%20%2F%20Kimi-FF9900?logo=amazonaws&logoColor=white">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-green">
</p>

---

## ✨ Fitur

- 🏠 **Ruang negosiasi** — buat room, pilih karakter & nama, bagikan link ke pihak lawan (magic link, tanpa login).
- 📝 **Intake bebas (teks/file)** — tiap pihak menjelaskan kebutuhan/penawaran dalam bahasa natural; **AI mengekstraknya** jadi parameter terstruktur.
- 🤖 **Negosiasi otomatis** — dua agent (pembeli & penjual) tawar-menawar bergiliran, live di panggung beranimasi.
- 🧠 **Reasoning transparan** — "isi pikiran" tiap agent ikut ditampilkan & tersimpan untuk audit.
- 🙋 **Human-in-the-loop** — pause minta **approval** saat tercapai kesepakatan; **eskalasi** saat buntu (pembeli naikkan budget *atau* penjual turunkan penawaran — keduanya muncul sebagai chat).
- 📄 **Output & audit** — generate **PDF kesepakatan** otomatis + audit trail immutable di database.

---

## 🧠 Konsep inti

| Konsep | Penjelasan |
|---|---|
| **Bounded Autonomy** | Agent otonom **di dalam pagar**; manusia pegang keputusan mengikat. |
| **Information Asymmetry** | Tiap agent hanya tahu batasnya sendiri (budget vs floor), menebak lawan lewat sinyal — ditegakkan di level node + unit test. |
| **ZOPA gating** | Konvergensi, deadlock, & "deal" diputuskan **kode deterministik** (Zone of Possible Agreement), bukan LLM — anti halusinasi harga. |

---

## 🏗️ Arsitektur

```
┌─────────────────────────────────────────────┐
│  Next.js Frontend  (:3200)                   │
│  Lobby · Live Stage (SSE) · Approval modal   │
└───────────────┬───────────────▲──────────────┘
          REST + SSE             │ events
┌───────────────▼───────────────┴──────────────┐
│  Go Backend  (:8090)  — Chi + pgx (no ORM)    │
│  rooms/seats · SSE hub · audit · PDF          │
└───────────────┬───────────────▲──────────────┘
          HTTP   │               │ webhook
┌───────────────▼───────────────┴──────────────┐
│  Python Agent  (:8000)  — FastAPI + LangGraph │
│  NegotiationGraph · intake analysis · brain   │
└───────────────┬───────────────────────────────┘
        AWS Bedrock (Claude / Kimi)   ·   PostgreSQL
```

Detail lengkap & 14 keputusan arsitektur → **[ARCHITECTURE.md](ARCHITECTURE.md)**.

---

## 🔄 Alur singkat

1. **Pembeli** buat room → pilih karakter, tulis kebutuhan (+budget) → dapat **link**.
2. **Penjual** buka link → pilih karakter, tulis/upload penawaran.
3. **AI menganalisa** input kedua pihak → parameter negosiasi (rahasia per sisi).
4. **Dua agent bernegosiasi** live di panggung → konvergen / buntu.
5. Manusia **setujui / tolak / intervensi** → **Deal + PDF** atau walked away.

---

## 🧩 Tech stack

| Layer | Teknologi |
|---|---|
| Frontend | Next.js 16 (App Router) · TypeScript · Tailwind v4 · SSE |
| Backend | Go · Chi · pgx (tanpa ORM) · go-pdf/fpdf |
| Agent | Python 3.12 · FastAPI · LangGraph |
| LLM | AWS Bedrock — **Kimi K2.5** / Claude Sonnet (atau mode `mock` tanpa creds) |
| Database | PostgreSQL 16 |
| Infra | Docker Compose |

---

## 🚀 Jalankan lokal

**Prasyarat:** Docker, dan sebuah PostgreSQL yang bisa diakses (lokal/host).

```bash
# 1) Siapkan env
cp .env.example .env
#   - set DATABASE_URL ke Postgres-mu
#   - isi AWS creds + BEDROCK_MODEL_ID, ATAU set NEGOTIAI_BRAIN=mock untuk tes tanpa LLM

# 2) Buat database
#   createdb negotiai   (atau: CREATE DATABASE negotiai; via klien favoritmu)

# 3) Jalankan
docker compose up -d --build

# 4) Buka
open http://localhost:3200
```

> **Mode mock** (`NEGOTIAI_BRAIN=mock`): negosiasi deterministik tanpa API key — enak untuk eksplorasi & test.

Regenerasi sprite/aset dari raw pack (opsional; output sudah ikut di repo):
```bash
docker compose run --rm frontend npm run assets:build
```

---

## 🗂️ Struktur

```
negotiai/
├── frontend/   # Next.js — UI lobby, live stage, komponen
├── backend/    # Go — API rooms/seats, SSE hub, audit, PDF
├── agent/      # Python + LangGraph — graph, gating, intake, brain
├── doc/        # dokumen penawaran dummy untuk testing
├── docker-compose.yml
├── ARCHITECTURE.md · NegotiAI-PRD.md · NegotiAI-project-brief.md
```

---

## 🎨 Aset & Lisensi

- **Kode**: [MIT](#-lisensi).
- **Aset karakter & background**: freebies dari [CraftPix](https://craftpix.net/freebies/). Raw pack **tidak** disertakan (besar & lisensi source); hanya output olahan yang dipakai aplikasi.

### Lisensi
MIT © Suryana Dhuchri

---

## 👤 Author

**Suryana Dhuchri** — [@sdhuchri](https://github.com/sdhuchri)

*Built for Indonesian businesses tired of waiting 12 weeks for a deal.*
