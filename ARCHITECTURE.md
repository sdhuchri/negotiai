# NegotiAI — Architecture & Decisions

> Dokumen acuan teknis. Membekukan keputusan arsitektur sebelum & selama implementasi.
> Pendamping: [NegotiAI-PRD.md](NegotiAI-PRD.md) (produk) dan [NegotiAI-project-brief.md](NegotiAI-project-brief.md) (ringkas).

| Field | Value |
|---|---|
| **Status** | Living document |
| **Last Updated** | 30 Mei 2026 |
| **Owner** | Suryana Dhuchri |
| **Mode MVP** | Auto-run (terlihat live), demo hackathon |

---

## 1. Ringkasan Sistem

NegotiAI = platform negosiasi B2B di mana **dua AI agent** (Vendor & User) bertukar tawaran otomatis **di dalam koridor (guardrail)** yang ditentukan manusia, dengan **human-in-the-loop** di titik mengikat. Tiga prinsip inti:

1. **Bounded Autonomy** — agent otonom di dalam pagar; manusia pegang keputusan mengikat.
2. **Information Asymmetry** — tiap agent hanya tahu batasnya sendiri, menebak lawan lewat sinyal.
3. **Asinkron tapi tampil live** — event-driven, dirender seolah realtime via SSE.

Tiga service + satu database bersama:

```
┌─────────────────────────────────────────────────────────┐
│  Next.js Frontend  (:3200)                               │
│  Vendor Avatar  ←  Chat  →  User Avatar                  │
│  [Approve] [Reject] [Adjust]  ← muncul saat interrupt    │
└───────────────┬───────────────────────▲─────────────────┘
          REST + SSE                     │ events
                │                         │
┌───────────────▼─────────────────────────┴───────────────┐
│  Go Backend  (:8090)   — auth · audit · PDF · SSE hub    │
│  in-memory pub/sub: map[negotiation_id] → []chan Event   │
└───────────────┬───────────────────────▲─────────────────┘
          HTTP (run/resume)              │ POST /internal/events
                │                         │
┌───────────────▼─────────────────────────┴───────────────┐
│  Python Agent  (:8000)  — FastAPI + LangGraph            │
│  NegotiationGraph (state machine) · PostgresSaver        │
│  BackgroundTask jalankan graph, emit event per ronde     │
└───────────────┬──────────────────────────────────────────┘
                │
   AWS Bedrock (Jakarta)        PostgreSQL "negotiai"
   (Claude / Kimi)              (host Postgres :5432)
```

---

## 2. Keputusan Arsitektur (terkunci)

Empat belas keputusan yang menjadi fondasi. Setiap perubahan harus melewati dokumen ini.

### #1 — Kepemilikan State (dua store, peran tegas)
Ada dua tempat penyimpanan. Perannya **dipisah keras** agar tidak drift:
- **LangGraph checkpoint** (`PostgresSaver`) = *state eksekusi* — kontrol alur graph, dipakai **hanya** untuk resume. Tidak pernah dibaca frontend.
- **Tabel bisnis Go** = *catatan kebenaran* — untuk UI, audit, PDF.
- Python **tidak** menulis tabel bisnis; ia emit event, Go yang persist.
- Kopling tunggal: **`thread_id` LangGraph = `negotiation_id`**.

> Prinsip: **Python tahu "cara menjalankan", Go tahu "apa yang terjadi".**

### #2 — Transport Event (Python → Go → Browser)
- Go `POST /negotiations/:id/run` → Python `POST /run` balas **202** & jalankan graph di **BackgroundTask** (async).
- Tiap node emit event → `POST /internal/events` ke Go.
- Go tulis ke DB + push ke **in-memory pub/sub** (`map[negotiation_id] → []chan Event`).
- Browser `GET /negotiations/:id/stream` (SSE) subscribe channel itu.
- Single-instance cukup untuk MVP; **Redis pub/sub = Phase 2**.

### #3 — Interrupt → Resume lintas service
- `interrupt()` mem-pause graph & persist checkpoint; BackgroundTask selesai natural.
- Interrupt **di-emit sebagai event** → Go set status `awaiting_approval`/`escalated`, frontend tampil modal.
- User memutuskan → Go `POST /:id/approve` → Go `POST /:id/resume` ke Python →
  `graph.invoke(Command(resume=decision), thread_id=negotiation_id)`.

### #4 — Granularitas Streaming
- **Per-event (per ronde)**, bukan per-token. Efek mengetik **disimulasikan di frontend**.
- Token-streaming asli = P1.

### #5 — Logika Negosiasi: LLM vs Deterministik
- **LLM hanya menghasilkan** `public_message` + `internal_reasoning` + `proposed_offer`, dikurung **JSON schema** (structured output).
- **Semua gating deterministik di kode** (edge graph), bukan LLM:
  - `in_corridor?`, `near_deal (<5%)?`, `deadlock (3 ronde stagnan)?`, `max_rounds`.
- **LLM tidak pernah memutuskan "deal"** — graph yang memutuskan dari angka. Mitigasi halusinasi harga (Risk #1 PRD).

### #6 — Penegakan Information Asymmetry
- State memisahkan slice privat: `user_private` vs `vendor_private` vs `public_history`.
- Tiap node membangun prompt **hanya** dari slice-nya + `public_history`.
- **Enforce ganda**: (a) di node/prompt, (b) di API layer — `*_private` **tidak boleh** ikut response yang dilihat sisi lawan.
- **Unit test**: assert prompt vendor tidak memuat `max_price` user (dan sebaliknya).

### #7 — Asal "Floor" Vendor (model + skenario)
- **Model**: guardrail simetris saat setup — vendor punya `vendor_private` (`floor_price`, `target_margin`) seperti user punya `guardrails`. Floor jadi benar-benar non-derivable.
- **Skenario demo** = 3 konfigurasi **ZOPA** (Zone of Possible Agreement) via seed data:

  | Skenario | Konfigurasi | Hasil emergent |
  |---|---|---|
  | Cooperative | `max_price` ≫ `floor_price` (overlap lebar) | deal cepat |
  | Aggressive | overlap tipis | banyak ronde, deal di akhir |
  | Deadlock | `floor_price > max_price` (no overlap) | eskalasi ke manusia |

- ZOPA gating deterministik: deal layak ⇔ `max_price ≥ floor_price`.

### #8 — Mode Run
- **Auto-run kontinu**: sekali "Start", graph jalan sampai interrupt/deal; frontend lihat live.
- Async event-driven sungguhan (vendor upload kapan saja, notifikasi) = Phase 2.

### #9 — Character System (themeable, generik)
- Registry generik `{ key, label, biome, states{...} }` — **avatar = data, bukan hardcode**.
- Default skin = CraftPix (hewan). Swap/menambah pack hanya ubah manifest.

### #10 — Rendering Avatar
- **Sprite sheet hasil pipeline + CSS `steps()`** (GPU-friendly, no WebGL).
- Source = frame PNG individual → di-pack jadi strip WebP oleh pipeline.
- Spine (skeletal) = P1.

### #11 — Peta Animasi ↔ State Negosiasi
| State | Animasi sumber |
|---|---|
| `idle` | Idle |
| `counter` | Walk |
| `aggressive` | Throwing |
| `escalate` | Stuned / Confused* |
| `deal` | Jump |
| `walkaway` | Dead |

\* penguin pakai `Confused`, pack lain `Stuned` — diserap `STATE_ANIM` di pipeline.

### #12 — Avatar di Data Model
- `negotiations` menyimpan `vendor_avatar_id`, `user_avatar_id` (character key), + `background_key`.

### #13 — Picker
- Vendor & user masing-masing pilih karakter di form setup.

### #14 — Asset Pipeline
- `assets/` (raw, ~1.45 GB) → `frontend/public/{characters,backgrounds}` (~2.6 MB WebP).
- **Raw di-gitignore**; output olahan **di-commit** (`git clone` langsung jalan).
- Script: [frontend/scripts/build-assets.mjs](frontend/scripts/build-assets.mjs).

---

## 3. Alur Negosiasi (graph)

```
setup + guardrail (user)          vendor_private (floor/margin)
        └────────────┬──────────────────┘
                     ▼
        upload PDF → extract_offer (Vendor Agent)
                     ▼
              evaluate_offer (User Agent)  ── deterministik gating ──┐
                     │                                                │
        ┌────────────┼───────────────────────┐                       │
        ▼            ▼                         ▼                       │
   in_corridor   near_deal (<5%)        out_of_corridor               │
        │            │                         │                      │
   counter_offer  interrupt(approval)   interrupt(escalate)           │
        │            │                         │                      │
   vendor_respond    └──── event → Go modal ───┘                      │
        │                          │                                  │
        └──── loop (≤ max_rounds) ─┘     user decide → resume(Command)─┘
                                              ▼
                       approve → generate_contract → PDF → END
                       reject  → walked_away → END
                       adjust  → update guardrail → loop
```

Terminasi: `deal`, `walked_away`, atau `max_rounds` tercapai.

---

## 4. Skema Database (`negotiai`)

Tabel bisnis (dimiliki Go). LangGraph membuat tabel checkpoint sendiri (`checkpoints`, `checkpoint_blobs`, …) di DB yang sama via `PostgresSaver`.

```sql
-- Sesi negosiasi (+ avatar/tema, decision #12)
CREATE TABLE negotiations (
    id                UUID PRIMARY KEY,
    title             TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'draft',
        -- draft | negotiating | awaiting_approval | escalated | deal | walked_away
    vendor_agent_name TEXT,
    user_agent_name   TEXT,
    vendor_avatar_id  TEXT,            -- character key (registry)
    user_avatar_id    TEXT,
    background_key    TEXT,
    max_rounds        INT NOT NULL DEFAULT 8,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at        TIMESTAMPTZ
);

-- Koridor user (publik bagi user, RAHASIA bagi vendor)
CREATE TABLE guardrails (
    id                 UUID PRIMARY KEY,
    negotiation_id     UUID NOT NULL REFERENCES negotiations(id),
    max_price          NUMERIC NOT NULL,
    target_price       NUMERIC,
    max_lead_time_days INT,
    priority           TEXT,           -- price | lead_time | warranty | payment_terms
    payment_terms_pref TEXT,
    CHECK (target_price IS NULL OR target_price <= max_price)
);

-- Koridor RAHASIA vendor (decision #7) — JANGAN expose ke sisi user
CREATE TABLE vendor_private (
    id                 UUID PRIMARY KEY,
    negotiation_id     UUID NOT NULL REFERENCES negotiations(id),
    floor_price        NUMERIC NOT NULL,   -- vendor tak mau di bawah ini
    target_margin      NUMERIC,
    min_lead_time_days INT
);

-- Penawaran awal vendor (hasil ekstraksi dokumen)
CREATE TABLE vendor_offers (
    id               UUID PRIMARY KEY,
    negotiation_id   UUID NOT NULL REFERENCES negotiations(id),
    price            NUMERIC NOT NULL,
    qty              INT,
    lead_time_days   INT,
    warranty         TEXT,
    payment_terms    TEXT,
    raw_document_url TEXT
);

-- Tiap ronde tawar-menawar (audit trail, immutable)
CREATE TABLE rounds (
    id                 UUID PRIMARY KEY,
    negotiation_id     UUID NOT NULL REFERENCES negotiations(id),
    round_no           INT NOT NULL,
    actor              TEXT NOT NULL,     -- vendor | user
    public_message     TEXT,
    internal_reasoning TEXT,              -- "isi pikiran" agent
    offer_price        NUMERIC,
    offer_lead_time    INT,
    action             TEXT,              -- counter | accept | walk_away | escalate
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keputusan manusia (human-in-the-loop)
CREATE TABLE approvals (
    id             UUID PRIMARY KEY,
    negotiation_id UUID NOT NULL REFERENCES negotiations(id),
    round_id       UUID REFERENCES rounds(id),
    decided_by     TEXT NOT NULL,
    decision       TEXT NOT NULL,         -- approve | reject | adjust
    decided_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 5. LangGraph State (TypedDict)

Slice privat dipisah eksplisit untuk menegakkan asimetri (decision #6).

```python
from typing import TypedDict, Literal, Optional

class Offer(TypedDict):
    price: float
    lead_time_days: int
    qty: int
    payment_terms: str

class Turn(TypedDict):
    actor: Literal["vendor", "user"]
    public_message: str
    offer: Optional[Offer]

class UserGuardrail(TypedDict):   # privat — hanya dibaca node User Agent
    max_price: float
    target_price: Optional[float]
    max_lead_time_days: int
    priority: Literal["price", "lead_time", "warranty", "payment_terms"]

class VendorPrivate(TypedDict):   # privat — hanya dibaca node Vendor Agent
    floor_price: float
    target_margin: Optional[float]
    min_lead_time_days: int

class NegotiationState(TypedDict):
    negotiation_id: str
    round_no: int
    max_rounds: int

    # PUBLIK — terlihat kedua agent
    public_history: list[Turn]
    current_offer: Optional[Offer]
    last_actor: Literal["vendor", "user"]

    # PRIVAT — tiap node baca hanya slice-nya
    user_private: UserGuardrail
    vendor_private: VendorPrivate

    # KONTROL (deterministik)
    status: Literal["negotiating", "awaiting_approval", "escalated", "deal", "walked_away"]
    convergence_gap: Optional[float]   # |vendor - user| / target
    stagnant_rounds: int               # untuk deteksi deadlock
    human_decision: Optional[dict]     # payload resume dari Command
```

---

## 6. Struktur Folder

```
negotiai/
├── assets/                     # raw CraftPix packs — GITIGNORED (~1.45 GB)
│   ├── character/{6 hewan}/
│   └── background/{mountain,nature,snowy}/
├── frontend/                   # Next.js 16 (App Router, TS, Tailwind v4)
│   ├── app/                    # layout.tsx, page.tsx, globals.css
│   ├── components/             # SpriteAnimator, Stage
│   ├── lib/                    # characters.ts + asset-manifest.json (generated)
│   ├── public/                 # characters/, backgrounds/ (generated, COMMITTED)
│   ├── scripts/build-assets.mjs
│   └── Dockerfile
├── backend/                    # Go + Fiber/Chi + pgx        (menyusul)
│   ├── cmd/api/ · internal/{handler,service,repository} · migrations/
├── agent/                      # Python + FastAPI + LangGraph (menyusul)
│   ├── app/{graph,nodes,state,prompts}.py · main.py · requirements.txt
├── docker-compose.yml
├── .env.example
├── ARCHITECTURE.md             # ← dokumen ini
├── NegotiAI-PRD.md
└── NegotiAI-project-brief.md
```

---

## 7. Local Dev — Ports & Database

Setup dev ini memakai **Postgres yang sudah berjalan di host** (postgres:16, `:5432`) dan membuat **database `negotiai`** di dalamnya — **tidak** menjalankan service `db` sendiri di compose. Arahkan `DATABASE_URL` di `.env` ke instance Postgres-mu.

| Service | Host port | Container | Catatan |
|---|---|---|---|
| frontend | **3200** | 3000 | 3000/3001/3100 dipakai stack lain |
| backend (Go) | **8090** | 8080 | 8080/8081/8089 dipakai stack lain |
| agent (Python) | **8000** | 8000 | kosong |
| db | — | — | Postgres host via `host.docker.internal:5432` |

```bash
# 1) env
cp .env.example .env        # DB negotiai sudah dibuat di Postgres host

# 2) build & run (frontend aktif; backend/agent menyusul)
docker compose up -d --build frontend

# 3) buka
open http://localhost:3200

# 4) regenerate aset dari raw packs (opsional; output sudah di-commit)
docker compose run --rm frontend npm run assets:build
```

---

## 8. Asset Pipeline & Lisensi (penting untuk publish)

- **Pipeline**: pilih subset → downscale (frame H=256) → subsample (≤14 frame) → pack strip WebP → manifest JSON. 1.45 GB → ~2.6 MB.
- **Lisensi**: aset CraftPix **freebie** — komersial OK, **tanpa atribusi wajib** (credit dihargai). Larangan: redistribusi file grafis terpisah dari produk jadi; aplikasi yang membiarkan user export/edit artwork.
- **Implikasi repo publish**:
  - Kode → MIT (lihat brief).
  - **Raw `assets/` di-gitignore** (ukuran + hormati lisensi source).
  - Output olahan (`public/characters`, `public/backgrounds`) di-commit — kecil, turunan, bagian dari produk jadi.
  - **Tidak** menambah fitur export/edit artwork (agar tetap patuh lisensi).

---

## 9. Non-Functional (acuan, lihat PRD §7)

| Aspek | Target MVP |
|---|---|
| Latency per turn | < 8 dtk |
| Full negosiasi (8 ronde) | < 2 menit |
| Time-to-Deal (North Star) | < 2 jam (baseline 4–12 minggu) |
| LLM provider | AWS Bedrock Jakarta `ap-southeast-3`, Claude Sonnet |
| Audit | rounds + approvals immutable, reasoning tersimpan |

---

## 10. Status Implementasi

- [x] **The Negotiation Stage** — asset pipeline, character system, SpriteAnimator (CSS steps), Stage, halaman demo, Docker frontend `:3200`.
- [x] Database `negotiai` dibuat di Postgres host.
- [x] **Agent engine** (Python + LangGraph) — graph, ZOPA gating deterministik, asimetri, interrupt/resume, 3 skenario seed. 12/12 test + demo mock.
- [x] **Room lobby** — Go backend (rooms/seats, magic link), frontend create/join (karakter+nama+teks+file), presence polling.
- [x] **Intake analysis** — Bedrock/Mock analyzer: teks bebas/file → param terstruktur per sisi (asimetri).
- [x] **Live negotiation** — Go SSE hub + agent event webhook; frontend EventSource (Stage live + transcript), approval/escalation modal, interrupt→resume.
- [x] **Audit + PDF** — rounds/approvals/params persisted; PDF kesepakatan (go-pdf/fpdf).
- [x] Verified end-to-end (mock): lobby → start → analyze → negotiate → approve → deal → PDF.
- [x] **Verified end-to-end (Bedrock live)**: Moonshot **Kimi K2.5** (`moonshotai.kimi-k2.5`, region `ap-southeast-3`). JSON-mode structured output (bukan tool-calling — hindari bug Converse Kimi). Negosiasi 5 ronde, asimetri terbukti di reasoning, deal 835jt, PDF OK.
- [ ] PostgresSaver checkpoint (saat ini MemorySaver in-process), parse file PDF/DOCX, presence/transcript replay untuk late-join, SSE→Redis (multi-instance), intake default lead-time bila tak disebut.

---

## 11. Revision History

| Date | Changes |
|---|---|
| 2026-05-30 | Initial — 14 keputusan, skema DB refined, LangGraph state, port/DB reuse, lisensi publish. |
