package nego

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/sdhuchri/negotiai/backend/internal/agentclient"
	"github.com/sdhuchri/negotiai/backend/internal/hub"
)

const maxRounds = 8

type Handler struct {
	repo  *Repo
	hub   *hub.Hub
	agent *agentclient.Client
}

func NewHandler(repo *Repo, h *hub.Hub, agent *agentclient.Client) *Handler {
	return &Handler{repo: repo, hub: h, agent: agent}
}

func (h *Handler) Routes(api chi.Router) {
	api.Post("/rooms/{id}/start", h.start)
	api.Get("/rooms/{id}/stream", h.stream)
	api.Post("/rooms/{id}/approve", h.approve)
	api.Get("/rooms/{id}/agreement.pdf", h.agreement)
}

func (h *Handler) Internal(r chi.Router) {
	r.Post("/internal/events", h.events)
}

func (h *Handler) publish(id string, v any) {
	b, _ := json.Marshal(v)
	h.hub.Publish(id, b)
}

func (h *Handler) fail(id string, err error) {
	_ = h.repo.SetStatus(context.Background(), id, "ready")
	h.publish(id, map[string]any{"type": "error", "message": err.Error()})
}

// start kicks off intake analysis + the negotiation run (async).
func (h *Handler) start(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	meta, err := h.repo.Meta(r.Context(), id)
	if err != nil {
		writeErr(w, http.StatusNotFound, "room not found")
		return
	}
	if !(meta.UserReady && meta.VendorRdy) {
		writeErr(w, http.StatusConflict, "kedua pihak belum siap")
		return
	}
	if meta.Status == "negotiating" {
		writeErr(w, http.StatusConflict, "negosiasi sudah berjalan")
		return
	}
	if err := h.repo.SetStatus(r.Context(), id, "negotiating"); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	go h.orchestrate(id)
	writeJSON(w, http.StatusAccepted, map[string]string{"status": "negotiating"})
}

func (h *Handler) orchestrate(id string) {
	ctx := context.Background()
	h.publish(id, map[string]any{"type": "phase", "phase": "analyzing"})

	userText, vendorText, err := h.repo.Inputs(ctx, id)
	if err != nil {
		h.fail(id, fmt.Errorf("baca input: %w", err))
		return
	}
	ar, err := h.agent.Analyze(ctx, userText, vendorText)
	if err != nil {
		h.fail(id, fmt.Errorf("analisa: %w", err))
		return
	}
	_ = h.repo.SaveParams(ctx, id, ar.UserGuardrail, ar.VendorPrivate, ar.VendorOffer)

	h.publish(id, map[string]any{"type": "phase", "phase": "negotiating"})
	if err := h.agent.Run(ctx, agentclient.RunRequest{
		NegotiationID: id,
		UserGuardrail: ar.UserGuardrail,
		VendorPrivate: ar.VendorPrivate,
		VendorOffer:   ar.VendorOffer,
		MaxRounds:     maxRounds,
	}); err != nil {
		h.fail(id, fmt.Errorf("jalankan: %w", err))
	}
}

// events receives agent webhooks, persists, and relays to SSE subscribers.
func (h *Handler) events(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	var e struct {
		NegotiationID string         `json:"negotiation_id"`
		Type          string         `json:"type"`
		Round         *RoundData     `json:"round"`
		Result        map[string]any `json:"result"`
		Interrupt     map[string]any `json:"interrupt"`
	}
	if err := json.Unmarshal(body, &e); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	ctx := r.Context()
	switch e.Type {
	case "round":
		if e.Round != nil {
			_ = h.repo.SaveRound(ctx, e.NegotiationID, *e.Round)
		}
	case "interrupt":
		status := "awaiting_approval"
		if t, _ := e.Interrupt["type"].(string); t == "escalation" {
			status = "escalated"
		}
		_ = h.repo.SetStatus(ctx, e.NegotiationID, status)
	case "settled":
		status, _ := e.Result["status"].(string)
		if status == "deal" {
			price, _ := e.Result["price"].(float64)
			lead, _ := e.Result["lead_time_days"].(float64)
			_ = h.repo.SetDeal(ctx, e.NegotiationID, price, int(lead))
		} else {
			_ = h.repo.SetStatus(ctx, e.NegotiationID, status)
		}
	}
	h.hub.Publish(e.NegotiationID, body)
	w.WriteHeader(http.StatusNoContent)
}

// stream is the SSE endpoint the room page subscribes to.
func (h *Handler) stream(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeErr(w, http.StatusInternalServerError, "streaming unsupported")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	ch := h.hub.Subscribe(id)
	defer h.hub.Unsubscribe(id, ch)

	if meta, err := h.repo.Meta(r.Context(), id); err == nil {
		snap, _ := json.Marshal(map[string]any{"type": "status", "status": meta.Status})
		fmt.Fprintf(w, "data: %s\n\n", snap)
		flusher.Flush()
	}

	ping := time.NewTicker(25 * time.Second)
	defer ping.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case <-ping.C:
			fmt.Fprint(w, ": ping\n\n")
			flusher.Flush()
		case msg, ok := <-ch:
			if !ok {
				return
			}
			fmt.Fprintf(w, "data: %s\n\n", msg)
			flusher.Flush()
		}
	}
}

// approve resumes the graph after a human decision.
func (h *Handler) approve(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		Decision      string   `json:"decision"`
		By            string   `json:"by"`
		NewMaxPrice   *float64 `json:"new_max_price"`
		NewFloorPrice *float64 `json:"new_floor_price"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Decision == "" {
		writeErr(w, http.StatusBadRequest, "decision required")
		return
	}
	by := req.By
	if by == "" {
		by = "user"
	}
	_ = h.repo.SaveApproval(r.Context(), id, by, req.Decision)
	_ = h.repo.SetStatus(r.Context(), id, "negotiating")

	decision := map[string]any{"decision": req.Decision}
	if req.NewMaxPrice != nil {
		decision["new_max_price"] = *req.NewMaxPrice
	}
	if req.NewFloorPrice != nil {
		decision["new_floor_price"] = *req.NewFloorPrice
	}
	if err := h.agent.Resume(r.Context(), id, decision); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "resumed"})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
