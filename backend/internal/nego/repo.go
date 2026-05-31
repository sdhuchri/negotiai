// Package nego orchestrates the negotiation: intake -> run -> stream -> approve.
package nego

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repo struct{ pool *pgxpool.Pool }

func NewRepo(pool *pgxpool.Pool) *Repo { return &Repo{pool: pool} }

// RoomMeta is the minimal room info the orchestrator needs.
type RoomMeta struct {
	ID         string
	Title      string
	Status     string
	UserName   string
	VendorName string
	UserReady  bool
	VendorRdy  bool
	DealPrice  *float64
	DealLead   *int
}

func (r *Repo) Meta(ctx context.Context, id string) (RoomMeta, error) {
	var m RoomMeta
	err := r.pool.QueryRow(ctx, `
		SELECT id, title, status,
		       COALESCE(user_agent_name,''), COALESCE(vendor_agent_name,''),
		       user_ready, vendor_ready, deal_price, deal_lead_time_days
		FROM negotiations WHERE id=$1`, id,
	).Scan(&m.ID, &m.Title, &m.Status, &m.UserName, &m.VendorName, &m.UserReady, &m.VendorRdy, &m.DealPrice, &m.DealLead)
	if err == pgx.ErrNoRows {
		return m, fmt.Errorf("room not found")
	}
	return m, err
}

// Inputs returns the user/vendor intake text, appending readable text-file contents.
func (r *Repo) Inputs(ctx context.Context, negID string) (userText, vendorText string, err error) {
	rows, err := r.pool.Query(ctx,
		`SELECT seat, COALESCE(raw_text,''), COALESCE(file_path,'') FROM room_inputs WHERE negotiation_id=$1`, negID)
	if err != nil {
		return "", "", err
	}
	defer rows.Close()
	for rows.Next() {
		var seat, raw, fpath string
		if err := rows.Scan(&seat, &raw, &fpath); err != nil {
			return "", "", err
		}
		text := raw
		if fpath != "" {
			if extra := readTextFile(fpath); extra != "" {
				text = strings.TrimSpace(text + "\n" + extra)
			}
		}
		if seat == "user" {
			userText = text
		} else if seat == "vendor" {
			vendorText = text
		}
	}
	return userText, vendorText, rows.Err()
}

func readTextFile(path string) string {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".txt", ".md", ".csv", ".json":
		if b, err := os.ReadFile(path); err == nil && len(b) < 200_000 {
			return string(b)
		}
	}
	return "" // PDF/DOCX/binary parsing not yet supported
}

func (r *Repo) SetStatus(ctx context.Context, negID, status string) error {
	_, err := r.pool.Exec(ctx, `UPDATE negotiations SET status=$1 WHERE id=$2`, status, negID)
	return err
}

// SaveParams persists the analyzed (private) params for audit.
func (r *Repo) SaveParams(ctx context.Context, negID string, guardrail, vendorPriv, vendorOffer json.RawMessage) error {
	var g struct {
		MaxPrice         *float64 `json:"max_price"`
		TargetPrice      *float64 `json:"target_price"`
		MaxLeadTimeDays  *int     `json:"max_lead_time_days"`
		Priority         *string  `json:"priority"`
		PaymentTermsPref *string  `json:"payment_terms_pref"`
	}
	var vp struct {
		FloorPrice      *float64 `json:"floor_price"`
		TargetMargin    *float64 `json:"target_margin"`
		MinLeadTimeDays *int     `json:"min_lead_time_days"`
	}
	var vo struct {
		Price        *float64 `json:"price"`
		LeadTimeDays *int     `json:"lead_time_days"`
	}
	_ = json.Unmarshal(guardrail, &g)
	_ = json.Unmarshal(vendorPriv, &vp)
	_ = json.Unmarshal(vendorOffer, &vo)

	b := &pgx.Batch{}
	b.Queue(`INSERT INTO guardrails (id, negotiation_id, max_price, target_price, max_lead_time_days, priority) VALUES ($1,$2,$3,$4,$5,$6)`,
		uuid.NewString(), negID, g.MaxPrice, g.TargetPrice, g.MaxLeadTimeDays, g.Priority)
	b.Queue(`INSERT INTO vendor_private (id, negotiation_id, floor_price, target_margin, min_lead_time_days) VALUES ($1,$2,$3,$4,$5)`,
		uuid.NewString(), negID, vp.FloorPrice, vp.TargetMargin, vp.MinLeadTimeDays)
	b.Queue(`INSERT INTO vendor_offers (id, negotiation_id, price, lead_time_days) VALUES ($1,$2,$3,$4)`,
		uuid.NewString(), negID, vo.Price, vo.LeadTimeDays)
	return r.pool.SendBatch(ctx, b).Close()
}

// RoundData is one negotiation round emitted by the agent.
type RoundData struct {
	RoundNo           int     `json:"round_no"`
	Actor             string  `json:"actor"`
	PublicMessage     string  `json:"public_message"`
	InternalReasoning string  `json:"internal_reasoning"`
	Price             float64 `json:"price"`
	LeadTime          int     `json:"lead_time"`
	Action            string  `json:"action"`
}

func (r *Repo) SaveRound(ctx context.Context, negID string, d RoundData) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO rounds (id, negotiation_id, round_no, actor, public_message, internal_reasoning, offer_price, offer_lead_time, action)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		uuid.NewString(), negID, d.RoundNo, d.Actor, d.PublicMessage, d.InternalReasoning, d.Price, d.LeadTime, d.Action)
	return err
}

func (r *Repo) SaveApproval(ctx context.Context, negID, decidedBy, decision string) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO approvals (id, negotiation_id, decided_by, decision) VALUES ($1,$2,$3,$4)`,
		uuid.NewString(), negID, decidedBy, decision)
	return err
}

func (r *Repo) SetDeal(ctx context.Context, negID string, price float64, leadTime int) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE negotiations SET status='deal', deal_price=$1, deal_lead_time_days=$2, settled_at=NOW() WHERE id=$3`,
		price, leadTime, negID)
	return err
}
