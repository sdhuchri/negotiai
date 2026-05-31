// Package agentclient talks to the Python agent service (analyze / run / resume).
package agentclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Client struct {
	base string
	http *http.Client
}

func New(base string) *Client {
	return &Client{base: base, http: &http.Client{Timeout: 120 * time.Second}}
}

// AnalyzeResponse mirrors the agent's structured intake output. The fields are kept
// as raw JSON so they can be persisted and forwarded to /run unchanged.
type AnalyzeResponse struct {
	UserGuardrail json.RawMessage `json:"user_guardrail"`
	VendorPrivate json.RawMessage `json:"vendor_private"`
	VendorOffer   json.RawMessage `json:"vendor_offer"`
}

func (c *Client) post(ctx context.Context, path string, body any, out any) error {
	buf, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.base+path, bytes.NewReader(buf))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	data, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 300 {
		return fmt.Errorf("agent %s -> %d: %s", path, res.StatusCode, string(data))
	}
	if out != nil {
		return json.Unmarshal(data, out)
	}
	return nil
}

func (c *Client) Analyze(ctx context.Context, userText, vendorText string) (AnalyzeResponse, error) {
	var out AnalyzeResponse
	err := c.post(ctx, "/analyze", map[string]string{"user_text": userText, "vendor_text": vendorText}, &out)
	return out, err
}

type RunRequest struct {
	NegotiationID string          `json:"negotiation_id"`
	UserGuardrail json.RawMessage `json:"user_guardrail"`
	VendorPrivate json.RawMessage `json:"vendor_private"`
	VendorOffer   json.RawMessage `json:"vendor_offer"`
	MaxRounds     int             `json:"max_rounds"`
}

func (c *Client) Run(ctx context.Context, req RunRequest) error {
	return c.post(ctx, "/run", req, nil)
}

func (c *Client) Resume(ctx context.Context, negotiationID string, decision map[string]any) error {
	return c.post(ctx, "/resume", map[string]any{"negotiation_id": negotiationID, "decision": decision}, nil)
}
