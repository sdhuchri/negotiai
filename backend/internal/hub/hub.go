// Package hub is a tiny in-memory pub/sub for SSE fan-out, keyed by negotiation id.
// Single-instance MVP (decision #2); Redis pub/sub is the Phase-2 swap.
package hub

import "sync"

type Hub struct {
	mu     sync.RWMutex
	topics map[string]map[chan []byte]struct{}
}

func New() *Hub {
	return &Hub{topics: make(map[string]map[chan []byte]struct{})}
}

func (h *Hub) Subscribe(id string) chan []byte {
	ch := make(chan []byte, 32)
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.topics[id] == nil {
		h.topics[id] = make(map[chan []byte]struct{})
	}
	h.topics[id][ch] = struct{}{}
	return ch
}

func (h *Hub) Unsubscribe(id string, ch chan []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if subs := h.topics[id]; subs != nil {
		delete(subs, ch)
		if len(subs) == 0 {
			delete(h.topics, id)
		}
	}
	close(ch)
}

// Publish delivers to all subscribers; drops the message for a subscriber whose
// buffer is full rather than blocking the negotiation.
func (h *Hub) Publish(id string, msg []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for ch := range h.topics[id] {
		select {
		case ch <- msg:
		default:
		}
	}
}
