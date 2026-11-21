package trace

import (
	"net/http"
	"sync"
	"time"
)

const subBuffer = 64

// Hub keeps a ring buffer of recent events and fans out to subscribers.
type Hub struct {
	mu   sync.Mutex
	cap  int
	buf  []Event
	subs map[chan Event]struct{}
}

func NewHub(capacity int) *Hub {
	if capacity <= 0 {
		capacity = 200
	}
	return &Hub{cap: capacity, subs: map[chan Event]struct{}{}}
}

// Publish never blocks: a subscriber whose buffer is full misses the event.
func (h *Hub) Publish(e Event) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.buf = append(h.buf, e)
	if len(h.buf) > h.cap {
		h.buf = h.buf[len(h.buf)-h.cap:]
	}
	for ch := range h.subs {
		select {
		case ch <- e:
		default:
		}
	}
}

func (h *Hub) Recent() []Event {
	h.mu.Lock()
	defer h.mu.Unlock()
	return append([]Event(nil), h.buf...)
}

// Subscribe atomically snapshots recent events and registers a live channel.
func (h *Hub) Subscribe() (replay []Event, live <-chan Event, cancel func()) {
	h.mu.Lock()
	defer h.mu.Unlock()
	ch := make(chan Event, subBuffer)
	h.subs[ch] = struct{}{}
	var once sync.Once
	return append([]Event(nil), h.buf...), ch, func() {
		once.Do(func() {
			h.mu.Lock()
			delete(h.subs, ch)
			h.mu.Unlock()
		})
	}
}

// SSE serves GET /__trace: replay, then live events, with a ping every 15s.
func (h *Hub) SSE() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		fl, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming unsupported", http.StatusInternalServerError)
			return
		}
		replay, live, cancel := h.Subscribe()
		defer cancel()
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.WriteHeader(http.StatusOK)
		fl.Flush()
		if !writeEvent(w, fl, replay...) {
			return
		}
		tick := time.NewTicker(15 * time.Second)
		defer tick.Stop()
		for {
			select {
			case <-r.Context().Done():
				return
			case e := <-live:
				if !writeEvent(w, fl, e) {
					return
				}
			case <-tick.C:
				if _, err := w.Write([]byte(": ping\n\n")); err != nil {
					return
				}
				fl.Flush()
			}
		}
	}
}
