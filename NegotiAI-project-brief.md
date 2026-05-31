# NegotiAI 🤝

> **Dari penawaran sampai sepakat, dalam hitungan jam bukan minggu.**

Aplikasi negosiasi B2B otomatis berbasis AI agent. Memangkas proses tawar-menawar vendor↔user yang biasanya 4–12 minggu menjadi hitungan jam, tanpa menghilangkan kontrol manusia di titik keputusan penting.

---

## 📋 Daftar Isi

- [Latar Belakang](#latar-belakang)
- [Konsep Inti](#konsep-inti)
- [Fitur Utama](#fitur-utama)
- [Tech Stack](#tech-stack)
- [Arsitektur](#arsitektur)
- [Alur Negosiasi](#alur-negosiasi)
- [Skema Database](#skema-database)
- [Desain UI](#desain-ui)
- [Scope MVP](#scope-mvp-hackathon)
- [Roadmap](#roadmap)
- [Setup Development](#setup-development)

---

## Latar Belakang

Negosiasi pengadaan B2B di Indonesia masih sangat manual:

- Vendor kirim penawaran via email/PDF
- User review, lalu kirim counter-offer
- Vendor adjust harga, kirim ulang
- User review lagi, nego lagi
- **Total waktu: 4–12 minggu lebih**

Yang membunuh waktu **bukan** keputusan akhirnya, tapi proses bolak-balik di tengah: nyusun email, nunggu balasan, hitung ulang, klarifikasi.

**NegotiAI** menyelesaikan masalah ini dengan AI agent yang bernegosiasi otomatis **di dalam koridor yang ditentukan manusia**, dan berhenti untuk approval di titik-titik kunci.

---

## Konsep Inti

### Bounded Autonomy

Agent otonom **di dalam pagar**, manusia pegang **keputusan yang mengikat**.

| Zona Otomatis (Agent) | Zona Persetujuan (Manusia) |
|---|---|
| Ekstraksi dokumen penawaran | Set koridor/guardrail di awal |
| Analisa terhadap koridor user | Approval saat tercapai kesepakatan |
| Counter-offer dalam batas | Keputusan eskalasi (naikkan batas/tolak) |
| Bolak-balik tawar-menawar | Tanda tangan dokumen final |

### Information Asymmetry

Tiap agent **tidak tahu batas lawan**, harus menebak lewat sinyal — meniru negosiasi nyata.

- **Vendor Agent**: tahu harga pokok (floor) & margin yang diinginkan
- **User Agent**: tahu budget maksimal, target harga, dan prioritas

### Asinkron, Bukan Realtime

Vendor & user **tidak duduk bersamaan**. Sistem event-driven:

1. Vendor upload → memicu Vendor Agent
2. Hasil masuk ke "meja" User Agent
3. User Agent counter-offer (dalam koridor) → kembali ke Vendor
4. Notifikasi saat butuh perhatian manusia

> **Note**: Untuk demo hackathon, tampilan dibuat "live streaming" via SSE biar terasa realtime, padahal arsitekturnya asinkron.

---

## Fitur Utama

### 1. Upload Penawaran Vendor

- Vendor upload dokumen (PDF/DOCX) lewat aplikasi
- Vendor Agent ekstrak otomatis: harga, qty, lead time, termin pembayaran, garansi

### 2. Set Koridor User (Guardrail)

User tentukan di awal:

- 💰 Budget maksimal & target harga ideal
- ⏱️ Maksimum lead time
- 📊 Prioritas (harga vs waktu vs garansi vs termin)
- 💳 Preferensi termin pembayaran

### 3. Negosiasi Otomatis Multi-Ronde

- Bolak-balik tawar-menawar otomatis dalam koridor
- Reasoning panel: lihat "isi pikiran" tiap agent
- Real-time visual: grafik harga vendor vs target user

### 4. Human-in-the-Loop

- **Auto-pause** saat tercapai kesepakatan → minta approval
- **Auto-escalate** saat keluar koridor → tanyakan ke user
- Audit trail lengkap (siapa setuju kapan)

### 5. Generate Dokumen Kesepakatan

- PDF kesepakatan otomatis berisi: harga final, qty, lead time, termin, tanda tangan digital
- Format yang siap untuk arsip dan compliance

---

## Tech Stack

| Layer | Pilihan | Catatan |
|---|---|---|
| **Frontend** | Next.js 16.2+ (App Router) | TypeScript, Tailwind CSS |
| **Realtime UI** | Server-Sent Events (SSE) | Streaming server → client |
| **Backend API** | Go (Fiber atau Chi) | Tanpa ORM, pakai `pgx` langsung |
| **Agent Engine** | Python + LangGraph | State machine + checkpoint |
| **LLM** | AWS Bedrock (Jakarta `ap-southeast-3`) | Cross-region inference profile |
| **Database** | PostgreSQL 15+ | Data bisnis + LangGraph checkpoint |
| **Containerization** | Docker + Docker Compose | 4 service: frontend, backend, agent, db |

### Kenapa LangGraph?

Negosiasi secara hakikat adalah **state machine**:

- ✅ State eksplisit yang berubah tiap ronde
- ✅ Transisi bersyarat (in_corridor / out_of_corridor / deal)
- ✅ Cycle (bolak-balik sampai konvergen)
- ✅ Interrupt-resume untuk human-in-the-loop
- ✅ Checkpoint ke Postgres → audit trail otomatis (penting untuk banking/enterprise)

---

## Arsitektur

```
┌─────────────────────────────────────────────────────────┐
│              Next.js Frontend                            │
│   Vendor Avatar  ←  Chat  →  User Avatar                 │
│   reasoning panel        reasoning panel                  │
│   [Approve] [Reject] [Adjust]  ← muncul saat interrupt   │
└──────────────────┬───────────────▲──────────────────────┘
              REST + SSE            │
                   │                 │
┌──────────────────▼─────────────────┴────────────────────┐
│        Go Backend (Fiber/Chi + pgx)                      │
│  • POST /negotiations (start)                            │
│  • POST /negotiations/:id/approve  (resume interrupt)    │
│  • GET  /negotiations/:id/stream   (SSE)                 │
│  • Auth, audit, PDF generation                           │
└──────────────────┬─────────────────▲────────────────────┘
            HTTP   │                 │  events
                   │                 │
┌──────────────────▼─────────────────┴────────────────────┐
│   Python Agent Service (FastAPI + LangGraph)             │
│   ┌────────────────────────────────────────────────┐     │
│   │             NegotiationGraph                    │     │
│   │  extract → evaluate → [counter|approve|escalate]│    │
│   │            → ... cycle                           │    │
│   │  Checkpoint: PostgresSaver                      │     │
│   └────────────────────────────────────────────────┘     │
│                       │                                   │
│              AWS Bedrock (Jakarta)                        │
└──────────────────────────────────────────────────────────┘
```

---

## Alur Negosiasi

```
              ┌──────────────────┐
              │   START          │
              │ (upload dokumen) │
              └────────┬─────────┘
                       ▼
              ┌──────────────────┐
              │ extract_offer    │  ← parse PDF vendor
              │ (Vendor Agent)   │     jadi structured offer
              └────────┬─────────┘
                       ▼
              ┌──────────────────┐
              │ evaluate_offer   │  ← cek terhadap guardrail user
              │ (User Agent)     │
              └────────┬─────────┘
                       │
            ┌──────────┼──────────┐
            ▼          ▼          ▼
      [in_corridor] [near_deal] [out_of_corridor]
            │          │          │
            ▼          ▼          ▼
       counter_     request_   escalate_
       offer        approval   to_human
       (User)       (interrupt) (interrupt)
            │          │          │
            ▼          ▼          ▼
       vendor_      generate_   wait_human_
       respond      contract    decision
       (Vendor)         │          │
            │           ▼          ▼
            └──→ loop  END    (resume / abort)
```

---

## Skema Database

5 tabel inti untuk MVP:

```sql
-- Sesi negosiasi
CREATE TABLE negotiations (
    id UUID PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT NOT NULL,  -- negotiating | awaiting_approval | deal | walked_away
    vendor_agent_name TEXT,
    user_agent_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    settled_at TIMESTAMPTZ
);

-- Koridor/guardrail yang di-set user di awal
CREATE TABLE guardrails (
    id UUID PRIMARY KEY,
    negotiation_id UUID REFERENCES negotiations(id),
    max_price NUMERIC NOT NULL,
    target_price NUMERIC,
    max_lead_time_days INT,
    priority TEXT,  -- price | lead_time | warranty | payment_terms
    payment_terms_pref TEXT
);

-- Penawaran awal vendor (hasil ekstraksi dokumen)
CREATE TABLE vendor_offers (
    id UUID PRIMARY KEY,
    negotiation_id UUID REFERENCES negotiations(id),
    price NUMERIC NOT NULL,
    qty INT,
    lead_time_days INT,
    warranty TEXT,
    payment_terms TEXT,
    raw_document_url TEXT
);

-- Tiap ronde tawar-menawar
CREATE TABLE rounds (
    id UUID PRIMARY KEY,
    negotiation_id UUID REFERENCES negotiations(id),
    round_no INT NOT NULL,
    actor TEXT NOT NULL,  -- vendor | user
    public_message TEXT,
    internal_reasoning TEXT,
    offer_price NUMERIC,
    offer_lead_time INT,
    action TEXT,  -- counter | accept | walk_away | escalate
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Keputusan manusia (human-in-the-loop)
CREATE TABLE approvals (
    id UUID PRIMARY KEY,
    negotiation_id UUID REFERENCES negotiations(id),
    round_id UUID REFERENCES rounds(id),
    decided_by TEXT NOT NULL,
    decision TEXT NOT NULL,  -- approve | reject | adjust
    decided_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Catatan**: LangGraph akan membuat tabel checkpoint sendiri (`checkpoints`, `checkpoint_blobs`, dll) di Postgres yang sama via `PostgresSaver`.

---

## Desain UI

### Layout 3 Kolom

```
┌────────────┬─────────────────────┬────────────┐
│            │                     │            │
│  Vendor    │   Chat Publik       │   User     │
│  Avatar    │   (bergantian)      │   Avatar   │
│            │                     │            │
│  💭 isi    │   "Harga 920jt"     │   💭 isi   │
│  pikiran   │   ↓                 │   pikiran  │
│            │   "Bisa 850jt?"     │            │
│  Tawaran:  │   ↓                 │  Koridor:  │
│  920jt     │   "880jt final"     │  Max 900jt │
│            │                     │  Target    │
│            │                     │  870jt     │
├────────────┴─────────────────────┴────────────┤
│                                                │
│   📊 Grafik Harga per Ronde                    │
│   (vendor turun, user naik, sampai ketemu)     │
│                                                │
└────────────────────────────────────────────────┘
```

### Status Visual

- **🟢 Negotiating** — agent aktif bertukar pesan
- **🟡 Awaiting Approval** — kartu approval muncul di tengah
- **🔴 Escalated** — eskalasi ke manusia, butuh keputusan
- **✅ Deal** — kesepakatan tercapai, PDF generated
- **⚫ Walked Away** — negosiasi buntu

### Avatar Karakter

Karakter pixel-art bergaya 8-bit (referensi: tema departemen — Procurement, Finance, Legal, dll). Tiap negosiasi user bisa rename agent (misal "Pak Budi - PT Vendor" vs "Tim Procurement BSYA").

---

## Scope MVP (Hackathon)

### ✅ Wajib Ada (Core)

- [ ] Upload dokumen penawaran vendor (PDF)
- [ ] Form set guardrail user di awal
- [ ] Vendor Agent + User Agent dengan LangGraph
- [ ] Loop negosiasi otomatis dengan max ronde (misal 8)
- [ ] Information asymmetry (hidden agenda per agent)
- [ ] UI 3 kolom: chat + reasoning + grafik harga
- [ ] Interrupt untuk approval & escalation
- [ ] Generate PDF kesepakatan
- [ ] SSE streaming ke frontend

### 💎 Nice-to-Have (Kalau Waktu Sisa)

- [ ] Multi-stakeholder internal (Finance + Legal + Ops)
- [ ] Personality preset (vendor agresif vs kooperatif)
- [ ] Mode "human vs agent" — user jadi salah satu pihak
- [ ] Leaderboard: jalankan banyak ronde, lihat strategi terbaik
- [ ] Email notification saat butuh approval
- [ ] Dashboard analytics: rata-rata waktu deal, savings, dll

### 🚫 Jangan Disentuh Dulu (Jebakan Waktu)

- ❌ Integrasi sistem procurement nyata
- ❌ Multi-tenancy & RBAC kompleks
- ❌ Multi-produk dalam 1 negosiasi
- ❌ Voice/audio interface
- ❌ Mobile app native

---

## Roadmap

### Fase 1: Hackathon MVP (Minggu 1-2)

- Setup project structure & docker-compose
- Implement LangGraph negotiation graph
- Build Next.js UI dengan SSE streaming
- Basic guardrail logic & PDF generation
- Demo end-to-end

### Fase 2: Refinement (Pasca-hackathon)

- Multi-stakeholder internal (CrewAI atau LangGraph subgraph)
- Better document extraction (table, complex PDF)
- Authentication & multi-user
- Audit trail UI
- Deploy ke staging

### Fase 3: Production-Ready

- Integration dengan sistem procurement existing
- Advanced analytics & reporting
- Compliance: ISO 27001, audit log immutable
- Multi-vendor concurrent negotiation
- Mobile app

---

## Setup Development

### Prerequisites

- Node.js 20+
- Go 1.22+
- Python 3.11+
- Docker & Docker Compose
- AWS credentials dengan akses Bedrock Jakarta

### Struktur Folder

```
sepakat/
├── frontend/              # Next.js app
│   ├── app/
│   ├── components/
│   └── package.json
├── backend/               # Go API
│   ├── cmd/api/
│   ├── internal/
│   │   ├── handler/
│   │   ├── service/
│   │   └── repository/
│   ├── migrations/
│   └── go.mod
├── agent/                 # Python LangGraph
│   ├── app/
│   │   ├── graph.py       # NegotiationGraph definition
│   │   ├── nodes.py       # All node functions
│   │   ├── state.py       # State TypedDict
│   │   └── prompts.py     # Agent system prompts
│   ├── main.py            # FastAPI entrypoint
│   └── requirements.txt
├── docker-compose.yml
├── .env.example
└── README.md
```

### Environment Variables

```bash
# .env.example

# AWS Bedrock
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=ap-southeast-3
BEDROCK_MODEL_ID=apac.anthropic.claude-sonnet-4-20250514-v1:0

# Database
POSTGRES_USER=sepakat
POSTGRES_PASSWORD=changeme
POSTGRES_DB=sepakat
DATABASE_URL=postgres://sepakat:changeme@db:5432/sepakat?sslmode=disable

# Services
BACKEND_PORT=8080
AGENT_PORT=8000
FRONTEND_PORT=3000

# Agent Service URL (Go → Python)
AGENT_SERVICE_URL=http://agent:8000
```

### Quick Start

```bash
# Clone repository
git clone https://github.com/sdhuchri/sepakat.git
cd sepakat

# Copy env file
cp .env.example .env
# Edit .env dengan AWS credentials

# Start all services
docker-compose up -d

# Apply database migrations
docker-compose exec backend ./migrate up

# Open browser
open http://localhost:3000
```

---

## Pitch Singkat

> "Negosiasi B2B di Indonesia masih manual, lewat email dan WhatsApp, makan waktu 4–12 minggu. **NegotiAI** memangkasnya jadi hitungan jam dengan AI agent yang bernegosiasi otomatis di dalam koridor yang Anda tentukan. Manusia tetap pegang keputusan akhir — tapi tidak lagi terjebak di kerja bolak-balik yang melelahkan."

---

## Tim & Kontak

**Developer**: Suryana Dhuchri
**Portfolio**: [suryanadhuchri.dev](https://suryanadhuchri.dev)
**GitHub**: [@sdhuchri](https://github.com/sdhuchri)

---

## Lisensi

MIT License — silakan fork & adaptasi untuk kebutuhanmu.

---

*Built with ❤️ for Indonesian businesses tired of waiting 12 weeks for a deal.*
