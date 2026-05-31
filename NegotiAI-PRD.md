# Product Requirements Document (PRD)

## NegotiAI — AI-Powered B2B Negotiation Platform

---

| Field | Value |
|---|---|
| **Product Name** | NegotiAI |
| **Tagline** | Dari penawaran sampai sepakat, dalam hitungan jam bukan minggu. |
| **Version** | 1.0 (MVP) |
| **Document Owner** | Suryana Dhuchri |
| **Last Updated** | 30 Mei 2026 |
| **Status** | Draft for Hackathon |

---

## 1. Executive Summary

**NegotiAI** adalah platform negosiasi B2B berbasis AI agent yang memangkas proses tawar-menawar vendor↔user dari 4–12 minggu menjadi hitungan jam. Sistem ini menggunakan dua AI agent yang bernegosiasi otomatis dalam koridor (guardrail) yang ditentukan manusia, dengan human-in-the-loop di titik keputusan penting.

**Value Proposition:**
- **Untuk User (Procurement)**: Hemat 80–90% waktu negosiasi, tetap kontrol penuh atas keputusan akhir.
- **Untuk Vendor**: Respons cepat, proses transparan, dokumen otomatis.
- **Untuk Perusahaan**: Audit trail lengkap, compliance-ready, mempercepat cashflow.

---

## 2. Problem Statement

### 2.1 Current State

Proses pengadaan B2B di Indonesia (terutama di sektor regulated seperti perbankan) masih sangat manual:

1. Vendor mengirim penawaran via email/PDF
2. User review internal (Procurement, Finance, Legal) — biasanya 3–7 hari
3. User kirim counter-offer via email
4. Vendor adjust harga, kirim ulang — biasanya 2–5 hari per iterasi
5. Loop bisa terjadi 5–10 kali
6. **Total waktu: 4–12 minggu lebih**

### 2.2 Root Cause

Yang membunuh waktu **bukan** keputusan akhirnya, tapi:

- ❌ Menyusun email & dokumen counter-offer (manual)
- ❌ Menunggu balasan (asinkron tanpa SLA)
- ❌ Koordinasi internal multi-departemen
- ❌ Hitung ulang ROI / TCO setiap iterasi
- ❌ Klarifikasi miss-komunikasi

### 2.3 Impact

- **Cashflow tertunda** karena vendor terlambat onboarding
- **Project delay** menunggu kontrak ditandatangani
- **Opportunity cost** — staff procurement habis waktu di follow-up email
- **Tidak ada audit trail terpusat** — rekam jejak tersebar di email & WhatsApp

---

## 3. Goals & Non-Goals

### 3.1 Goals (MVP)

✅ **Mengotomasi 90% interaksi bolak-balik** dalam negosiasi vendor-user

✅ **Mempertahankan kontrol manusia** di titik keputusan yang mengikat (approval & dokumen final)

✅ **Audit trail lengkap** — setiap ronde, reasoning, dan keputusan tercatat

✅ **Mendukung asymmetric negotiation** — tiap pihak punya kepentingan & batas tersembunyi

✅ **Output legal-ready** — generate PDF kesepakatan otomatis

### 3.2 Non-Goals (MVP)

❌ Bukan untuk negosiasi tipe **lelang/tender publik** (sudah ada e-procurement pemerintah)

❌ Bukan untuk **transaksi consumer (B2C)** — fokus B2B procurement

❌ Tidak menggantikan **legal review** untuk kontrak kompleks

❌ Tidak menangani **eksekusi pembayaran** — hanya sampai kesepakatan harga

❌ Bukan **CRM/ERP** — fokus single use case: negosiasi harga

---

## 4. Target Users

### 4.1 Primary Users

#### Persona 1: Tim Procurement (Internal User)

| Field | Detail |
|---|---|
| **Role** | Procurement Officer / Manager |
| **Industry** | Banking, Manufacturing, Telco, Retail |
| **Pain Point** | Habis waktu di follow-up email, susah koordinasi internal |
| **Goal** | Selesaikan negosiasi cepat, dapat harga terbaik, audit trail rapi |
| **Tech-savvy** | Medium |

**User Story:**
> "Sebagai Procurement Officer, saya ingin mengatur batas budget & prioritas saya di awal, lalu membiarkan AI bernegosiasi dengan vendor sampai mendekati kesepakatan — sehingga saya cukup masuk untuk approval, bukan untuk setiap email."

#### Persona 2: Sales Representative (External Vendor)

| Field | Detail |
|---|---|
| **Role** | Sales / Account Executive |
| **Industry** | IT Vendor, Konstruksi, Supplier |
| **Pain Point** | Negosiasi lambat, sulit prediksi kapan deal closed |
| **Goal** | Respon cepat ke client, predictable timeline, less back-and-forth |
| **Tech-savvy** | Medium-High |

**User Story:**
> "Sebagai Sales, saya ingin mengupload penawaran sekali dan mendapatkan counter-offer otomatis dalam hitungan jam, bukan hari — sehingga saya bisa close deal lebih banyak per bulan."

### 4.2 Secondary Users

- **Finance Manager** — memberikan input batas budget di guardrail
- **Legal Counsel** — review PDF kesepakatan final
- **Procurement Director** — monitoring & approval untuk deal high-value

---

## 5. User Stories & Acceptance Criteria

### 5.1 Epic: Setup Negosiasi

#### US-01: User membuat sesi negosiasi baru

**As a** Procurement Officer
**I want to** memulai sesi negosiasi baru dengan menentukan vendor & item
**So that** sistem siap menerima penawaran

**Acceptance Criteria:**
- [ ] User bisa input judul negosiasi, nama vendor, deskripsi item
- [ ] User bisa rename agent (default: "Vendor Agent" & "User Agent")
- [ ] User bisa pilih avatar dari preset karakter
- [ ] Sistem generate unique negotiation ID
- [ ] Sesi tersimpan dengan status `draft`

---

#### US-02: User set koridor / guardrail

**As a** Procurement Officer
**I want to** menentukan batas budget, lead time, dan prioritas
**So that** AI agent bernegosiasi sesuai mandat saya

**Acceptance Criteria:**
- [ ] Input: max budget (mandatory), target price (optional)
- [ ] Input: max lead time dalam hari
- [ ] Input: priority (single select: price | lead_time | warranty | payment_terms)
- [ ] Input: preferensi termin pembayaran (DP, COD, NET 30, dll)
- [ ] Validasi: target_price < max_budget
- [ ] Guardrail tersimpan & terkunci setelah negosiasi mulai

---

### 5.2 Epic: Vendor Submission

#### US-03: Vendor upload penawaran

**As a** Vendor Sales Rep
**I want to** upload dokumen penawaran (PDF)
**So that** AI dapat mengekstrak detailnya otomatis

**Acceptance Criteria:**
- [ ] Support file: PDF, DOCX (max 10MB)
- [ ] Sistem ekstrak: price, qty, lead_time, warranty, payment_terms
- [ ] Hasil ekstraksi ditampilkan untuk konfirmasi vendor
- [ ] Vendor bisa edit hasil ekstraksi sebelum submit
- [ ] Setelah submit, status berubah ke `negotiating`

---

### 5.3 Epic: Negosiasi Otomatis

#### US-04: AI Agent bernegosiasi otomatis

**As a** sistem
**I want to** menjalankan loop negosiasi antar agent
**So that** mencapai kesepakatan dalam koridor

**Acceptance Criteria:**
- [ ] Vendor Agent & User Agent bertukar tawaran bergantian
- [ ] Maksimum 8 ronde negosiasi (configurable)
- [ ] Setiap agent mengeluarkan: public_message, internal_reasoning, offer, action
- [ ] Information asymmetry: vendor tidak tahu guardrail user, user tidak tahu floor vendor
- [ ] Sistem deteksi konvergensi (selisih < 5% dari target)
- [ ] Sistem deteksi deadlock (3 ronde tanpa pergerakan harga)

---

#### US-05: User memantau negosiasi real-time

**As a** Procurement Officer
**I want to** melihat progress negosiasi secara live
**So that** saya bisa intervensi kalau perlu

**Acceptance Criteria:**
- [ ] Dashboard 3 kolom: Vendor Avatar | Chat | User Avatar
- [ ] Streaming pesan bertahap via SSE (efek mengetik)
- [ ] Reasoning panel menampilkan "isi pikiran" tiap agent
- [ ] Grafik harga per ronde update real-time
- [ ] Status badge: 🟢 Negotiating | 🟡 Awaiting Approval | 🔴 Escalated

---

### 5.4 Epic: Human-in-the-Loop

#### US-06: Sistem minta approval saat tercapai deal

**As a** sistem
**I want to** pause negosiasi & minta approval saat dekat kesepakatan
**So that** keputusan akhir tetap di manusia

**Acceptance Criteria:**
- [ ] Saat agent mencapai konvergensi, graph interrupt
- [ ] Modal approval muncul dengan summary: harga, qty, lead_time, termin
- [ ] User bisa pilih: [Approve] | [Reject] | [Adjust Guardrail]
- [ ] Pilihan Approve → lanjut ke generate PDF
- [ ] Pilihan Reject → status `walked_away`
- [ ] Pilihan Adjust → user update guardrail, negosiasi lanjut

---

#### US-07: Sistem eskalasi saat keluar koridor

**As a** sistem
**I want to** stop & eskalasi saat tawaran vendor di luar batas user
**So that** manusia bisa decide naik batas atau tolak

**Acceptance Criteria:**
- [ ] Trigger: vendor offer > max_budget user
- [ ] Trigger: 3 ronde tanpa konvergensi
- [ ] Sistem kirim notifikasi (in-app + email)
- [ ] Modal eskalasi dengan opsi: Naikkan Batas | Tolak | Negosiasi Manual

---

### 5.5 Epic: Output & Audit

#### US-08: Generate PDF kesepakatan

**As a** User & Vendor
**I want to** menerima dokumen kesepakatan resmi
**So that** bisa langsung diarsipkan & ditandatangani

**Acceptance Criteria:**
- [ ] PDF berisi: judul, parties, item detail, harga final, lead_time, termin, garansi
- [ ] Include: tanggal kesepakatan, negotiation ID, audit summary
- [ ] Branding: logo perusahaan user (configurable)
- [ ] Tersedia untuk download oleh kedua pihak
- [ ] PDF disimpan ke storage (S3 atau local)

---

#### US-09: Audit trail lengkap

**As a** Compliance Officer
**I want to** melihat seluruh riwayat negosiasi
**So that** bisa audit & investigate jika diperlukan

**Acceptance Criteria:**
- [ ] Setiap ronde tersimpan dengan timestamp
- [ ] Reasoning AI tersimpan (tidak hanya output publik)
- [ ] Setiap keputusan manusia tercatat: siapa, kapan, apa
- [ ] Export ke CSV/JSON
- [ ] Tidak bisa dihapus/diubah (immutable log)

---

## 6. Functional Requirements

### 6.1 Core Features (P0 — Must Have)

| ID | Feature | Description |
|---|---|---|
| F-01 | **Negotiation Setup** | Create session, name agents, set guardrails |
| F-02 | **Document Upload & Parsing** | Vendor upload PDF, AI extract structured data |
| F-03 | **Autonomous Negotiation Loop** | LangGraph-based agent loop, max 8 rounds |
| F-04 | **Information Asymmetry** | Hidden agenda per agent, enforced at node level |
| F-05 | **Real-time Streaming UI** | SSE-based live updates of negotiation |
| F-06 | **Reasoning Visibility** | Show internal reasoning of each agent |
| F-07 | **Price Tracker Chart** | Visualize price convergence per round |
| F-08 | **Human Approval Interrupt** | Pause at convergence, request approval |
| F-09 | **Escalation Mechanism** | Stop & notify when out of corridor |
| F-10 | **PDF Generation** | Auto-generate agreement document |
| F-11 | **Audit Trail** | Immutable log of all rounds & decisions |

### 6.2 Enhancement Features (P1 — Should Have)

| ID | Feature | Description |
|---|---|---|
| F-12 | **Multi-stakeholder Internal** | Finance + Legal + Ops agent collaboration |
| F-13 | **Personality Presets** | Aggressive / Cooperative / Neutral agent styles |
| F-14 | **Email Notifications** | Notify user when approval needed |
| F-15 | **Negotiation Templates** | Reusable guardrail templates per category |
| F-16 | **Analytics Dashboard** | Avg deal time, savings, success rate |

### 6.3 Future Features (P2 — Could Have)

| ID | Feature | Description |
|---|---|---|
| F-17 | **Human vs Agent Mode** | User play as one party for training |
| F-18 | **Multi-vendor Concurrent** | Negotiate with N vendors in parallel |
| F-19 | **Voice Negotiation** | Audio mode using Nova Sonic |
| F-20 | **Mobile App** | Native iOS/Android client |
| F-21 | **ERP Integration** | Sync with SAP, Oracle, Mekari Jurnal |

---

## 7. Non-Functional Requirements

### 7.1 Performance

| Metric | Target |
|---|---|
| Latency per agent turn | < 8 detik |
| Full negotiation (8 rounds) | < 2 menit |
| UI streaming delay | < 500ms |
| PDF generation | < 5 detik |
| Concurrent negotiations | 50+ |

### 7.2 Reliability

- Uptime target: **99.5%** (untuk MVP), 99.9% production
- Auto-retry pada Bedrock failure (3x dengan exponential backoff)
- Graceful degradation: jika agent service down, simpan state & resume later
- Database backup harian

### 7.3 Security

- 🔐 **Authentication**: JWT-based, integrate dengan SSO enterprise
- 🔐 **Authorization**: Role-based (Procurement, Vendor, Admin, Auditor)
- 🔐 **Data encryption**: TLS in-transit, AES-256 at-rest
- 🔐 **PII Protection**: nama vendor, harga, kontrak — masked di log
- 🔐 **Audit log**: immutable, signed dengan timestamp

### 7.4 Compliance

- ✅ **ISO 27001 ready**: control mapping untuk A.5, A.8, A.12
- ✅ **OJK compliance**: hosted di AWS Jakarta region (`ap-southeast-3`)
- ✅ **UU PDP (Pelindungan Data Pribadi)**: data residency di Indonesia
- ✅ **Audit trail**: immutable, 7 tahun retention

### 7.5 Usability

- Bahasa default: **Bahasa Indonesia**, dengan toggle ke English
- Mobile-responsive (tablet & phone)
- Accessibility: WCAG 2.1 Level AA
- Onboarding tour untuk user baru (< 3 menit selesai)

### 7.6 Scalability

- Horizontal scaling: Go backend & Python agent service stateless
- Database: Postgres dengan read replica untuk analytics
- Caching: Redis untuk session state (Phase 2)
- Queue: untuk async heavy task (PDF gen, notifications)

---

## 8. Technical Architecture

### 8.1 Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | Next.js + TypeScript + Tailwind CSS | 16.2+ |
| Backend API | Go + Fiber/Chi + pgx (no ORM) | 1.22+ |
| Agent Engine | Python + LangGraph + FastAPI | 3.11+ |
| LLM Provider | AWS Bedrock (Claude / Nova) | Jakarta region |
| Database | PostgreSQL | 15+ |
| File Storage | S3 / Local filesystem | - |
| Containerization | Docker + Docker Compose | latest |
| Realtime | Server-Sent Events (SSE) | - |

### 8.2 High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Next.js Frontend                            │
│   Vendor Avatar  ←  Chat  →  User Avatar                 │
│   [Approve] [Reject] [Adjust]  ← interrupt UI            │
└──────────────────┬───────────────▲──────────────────────┘
              REST + SSE            │
                   │                 │
┌──────────────────▼─────────────────┴────────────────────┐
│        Go Backend (Fiber/Chi + pgx)                      │
│  • API publik & SSE hub                                  │
│  • State management & audit log                          │
│  • PDF generation                                        │
│  • Auth & authorization                                  │
└──────────────────┬─────────────────▲────────────────────┘
            HTTP   │                 │  events
                   │                 │
┌──────────────────▼─────────────────┴────────────────────┐
│   Python Agent Service (FastAPI + LangGraph)             │
│   • NegotiationGraph (state machine)                     │
│   • PostgresSaver checkpoint                             │
│   • Bedrock integration                                  │
└──────────────────────────────────────────────────────────┘
                       │
              AWS Bedrock (Jakarta)
              + PostgreSQL (shared)
```

### 8.3 Data Flow

1. User create negotiation → Go backend → simpan ke Postgres
2. User set guardrail → Go backend → simpan
3. Vendor upload PDF → Go backend → forward ke Python agent (extract)
4. Hasil extract balik ke Go → simpan → trigger graph
5. Python agent jalankan loop:
   - Tiap node → call Bedrock → return state baru
   - State di-checkpoint ke Postgres (LangGraph PostgresSaver)
   - Setiap pergerakan → emit event ke Go via webhook
6. Go forward event ke frontend via SSE
7. Saat interrupt → frontend tampilkan modal approval
8. User klik approve → Go → Python resume graph
9. Saat deal → Go generate PDF → store → notify both parties

---

## 9. Success Metrics

### 9.1 North Star Metric

**Time-to-Deal**: rata-rata durasi dari upload penawaran sampai PDF kesepakatan ter-generate.

- 🎯 **Target MVP**: < 2 jam (dari baseline 4–12 minggu)
- 🎯 **Target Production**: < 30 menit

### 9.2 Secondary Metrics

| Metric | Target |
|---|---|
| Deal closure rate | > 70% (deal tercapai dalam koridor) |
| User intervention rate | < 30% (mayoritas selesai otomatis) |
| Cost saving vs initial offer | > 8% average |
| User satisfaction (NPS) | > 40 |
| AI reasoning quality (manual eval) | > 4/5 rating |
| System uptime | > 99.5% |

### 9.3 Hackathon-Specific Metrics

- ✅ End-to-end demo berhasil (start → deal → PDF)
- ✅ Min 3 skenario negosiasi berbeda (cooperative, aggressive, deadlock)
- ✅ Reasoning panel terlihat & make sense
- ✅ Interrupt-resume flow berfungsi mulus

---

## 10. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LLM hallucinasi harga | Medium | High | JSON schema validation + deterministic price check |
| Latency Bedrock tinggi | Medium | Medium | Caching, parallel calls where possible, streaming |
| Agent stuck in loop | Low | High | Hard max round limit (8), deadlock detection |
| Demo gagal saat hackathon | Medium | Critical | Recorded fallback demo, simplified happy-path scenario |
| Information leak antar agent | Medium | High | Enforce di node level, unit test untuk verify |
| Adoption resistance (user ga percaya AI) | High | Medium | Reasoning transparency, easy override |
| Compliance issue di banking | Medium | High | Audit trail immutable, human approval mandatory |

---

## 11. Dependencies

### 11.1 External Dependencies

- ✅ **AWS Bedrock** access di Jakarta region
- ✅ **AWS IAM** credentials dengan permission Bedrock InvokeModel
- ✅ Domain & hosting (untuk demo public)

### 11.2 Internal Dependencies

- Tim 1 developer (full-stack) — Suryana
- Design assets: avatar pixel-art, logo
- Sample PDF dokumen penawaran (untuk testing)

### 11.3 Library Dependencies

**Frontend:**
- `next` ^14.0.0
- `tailwindcss` ^3.4.0
- `recharts` (untuk grafik harga)
- `lucide-react` (icons)

**Backend (Go):**
- `github.com/gofiber/fiber/v2` atau `github.com/go-chi/chi`
- `github.com/jackc/pgx/v5`
- `github.com/jung-kurt/gofpdf` (PDF generation)
- `github.com/golang-jwt/jwt/v5`

**Agent (Python):**
- `langgraph` ^0.2.0
- `langchain-aws` (Bedrock integration)
- `fastapi` ^0.110.0
- `psycopg2-binary` (Postgres untuk checkpoint)
- `pydantic` ^2.0

---

## 12. Timeline & Milestones (Hackathon)

### Week 1: Foundation

| Day | Tasks |
|---|---|
| 1 | Setup repo, docker-compose, database schema |
| 2 | Go backend skeleton + basic API endpoints |
| 3 | Python LangGraph skeleton + state definition |
| 4 | LLM integration (Bedrock) + first agent node |
| 5 | Connect Go ↔ Python via HTTP |

### Week 2: Build & Demo

| Day | Tasks |
|---|---|
| 6 | Complete negotiation graph (all nodes & edges) |
| 7 | Frontend layout 3-column + SSE streaming |
| 8 | Document upload & extraction |
| 9 | Interrupt-resume flow & approval UI |
| 10 | PDF generation + audit log view |
| 11 | Polish UI, avatar character, animations |
| 12 | Testing 3 scenarios + bug fixes |
| 13 | Demo recording + presentation prep |
| 14 | **Hackathon Day** 🎉 |

---

## 13. Out of Scope (For MVP)

Yang **tidak akan dikerjakan** di MVP hackathon:

- ❌ Multi-tenant & organization management
- ❌ Vendor onboarding flow (vendor pakai magic link saja)
- ❌ Email integration (notifications via in-app only)
- ❌ Multi-language LLM output (Indonesian only)
- ❌ Voice/audio interface
- ❌ Mobile native app
- ❌ Advanced analytics
- ❌ Payment processing
- ❌ Vendor rating/review
- ❌ Multi-currency support

---

## 14. Open Questions

1. **Model selection**: Claude Sonnet 4 vs Nova Pro untuk vendor agent? Perlu A/B test.
2. **Pricing model**: kalau jadi produk, per-negotiation atau subscription?
3. **PDF signing**: butuh integrasi e-signature (PrivyID, Mekari Sign) atau manual?
4. **Data retention**: berapa lama log negotiation disimpan? (default 7 tahun untuk compliance)
5. **Multi-vendor scenario**: kalau 1 RFQ dengan 5 vendor, apakah parallel atau sequential?

---

## 15. Appendix

### 15.1 Glossary

| Term | Definition |
|---|---|
| **Guardrail** | Koridor / batas yang ditentukan user untuk membatasi ruang gerak agent |
| **Bounded Autonomy** | Agent otonom dalam pagar yang ditentukan manusia |
| **Information Asymmetry** | Kondisi di mana tiap agent tidak tahu batas lawan |
| **Interrupt** | Mekanisme LangGraph untuk pause graph & tunggu input eksternal |
| **Checkpoint** | Snapshot state graph yang tersimpan persist (Postgres) |
| **HITL** | Human-in-the-Loop, mekanisme intervensi manusia di proses otomatis |
| **Convergence** | Kondisi di mana harga vendor & target user mendekati (< 5% selisih) |
| **Deadlock** | Kondisi negosiasi macet — N ronde tanpa pergerakan |

### 15.2 References

- LangGraph docs: https://langchain-ai.github.io/langgraph/
- AWS Bedrock Jakarta region: https://aws.amazon.com/about-aws/global-infrastructure/
- Pengalaman lapangan BCA Syariah procurement process

### 15.3 Revision History

| Date | Version | Changes | Author |
|---|---|---|---|
| 2026-05-30 | 1.0 | Initial draft for hackathon | Suryana Dhuchri |

---

## Approval

| Role | Name | Date | Signature |
|---|---|---|---|
| Product Owner | Suryana Dhuchri | - | - |
| Tech Lead | Suryana Dhuchri | - | - |
| Stakeholder | TBD | - | - |

---

*This is a living document. Updates will be reflected in the revision history above.*
