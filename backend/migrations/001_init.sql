-- NegotiAI initial schema. Idempotent (safe to re-run).
-- Business tables owned by Go (source of truth for UI/audit/PDF). LangGraph creates
-- its own checkpoint tables in the same database.

-- Room = negotiation session. The room-flow fields (share/seat tokens, ready flags)
-- extend the base negotiation model.
CREATE TABLE IF NOT EXISTS negotiations (
    id                UUID PRIMARY KEY,
    title             TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'draft',
        -- draft | ready | negotiating | awaiting_approval | escalated | deal | walked_away
    background_key    TEXT,
    max_rounds        INT NOT NULL DEFAULT 8,

    -- seats (the "name" a human enters is their agent name)
    user_agent_name   TEXT,
    user_avatar_id    TEXT,
    user_ready        BOOLEAN NOT NULL DEFAULT FALSE,
    vendor_agent_name TEXT,
    vendor_avatar_id  TEXT,
    vendor_ready      BOOLEAN NOT NULL DEFAULT FALSE,

    -- magic-link tokens (no login MVP)
    share_token       TEXT UNIQUE NOT NULL,  -- invite link -> vendor seat
    user_token        TEXT NOT NULL,         -- creator's private seat token
    vendor_token      TEXT,                  -- assigned when vendor joins

    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at        TIMESTAMPTZ
);

-- Raw intake per seat: free-form text and/or uploaded file. Analyzed by AI later
-- (step 2) into structured guardrails/offer. PRIVATE to each seat.
CREATE TABLE IF NOT EXISTS room_inputs (
    id             UUID PRIMARY KEY,
    negotiation_id UUID NOT NULL REFERENCES negotiations(id) ON DELETE CASCADE,
    seat           TEXT NOT NULL,            -- user | vendor
    raw_text       TEXT,
    file_name      TEXT,
    file_path      TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User's corridor (PRIVATE to User Agent) — produced by AI intake analysis.
CREATE TABLE IF NOT EXISTS guardrails (
    id                 UUID PRIMARY KEY,
    negotiation_id     UUID NOT NULL REFERENCES negotiations(id) ON DELETE CASCADE,
    max_price          NUMERIC,
    target_price       NUMERIC,
    max_lead_time_days INT,
    priority           TEXT,
    payment_terms_pref TEXT
);

-- Vendor's secret corridor (PRIVATE to Vendor Agent) — produced by AI intake analysis.
CREATE TABLE IF NOT EXISTS vendor_private (
    id                 UUID PRIMARY KEY,
    negotiation_id     UUID NOT NULL REFERENCES negotiations(id) ON DELETE CASCADE,
    floor_price        NUMERIC,
    target_margin      NUMERIC,
    min_lead_time_days INT
);

-- Vendor's public opening offer (extracted from intake).
CREATE TABLE IF NOT EXISTS vendor_offers (
    id               UUID PRIMARY KEY,
    negotiation_id   UUID NOT NULL REFERENCES negotiations(id) ON DELETE CASCADE,
    price            NUMERIC,
    qty              INT,
    lead_time_days   INT,
    warranty         TEXT,
    payment_terms    TEXT,
    raw_document_url TEXT
);

-- Audit trail: each round (immutable).
CREATE TABLE IF NOT EXISTS rounds (
    id                 UUID PRIMARY KEY,
    negotiation_id     UUID NOT NULL REFERENCES negotiations(id) ON DELETE CASCADE,
    round_no           INT NOT NULL,
    actor              TEXT NOT NULL,
    public_message     TEXT,
    internal_reasoning TEXT,
    offer_price        NUMERIC,
    offer_lead_time    INT,
    action             TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Human-in-the-loop decisions.
CREATE TABLE IF NOT EXISTS approvals (
    id             UUID PRIMARY KEY,
    negotiation_id UUID NOT NULL REFERENCES negotiations(id) ON DELETE CASCADE,
    round_id       UUID REFERENCES rounds(id),
    decided_by     TEXT NOT NULL,
    decision       TEXT NOT NULL,
    decided_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rounds_negotiation ON rounds(negotiation_id);
CREATE INDEX IF NOT EXISTS idx_room_inputs_negotiation ON room_inputs(negotiation_id);
