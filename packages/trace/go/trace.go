// Package trace records HTTP traffic as Events and streams them over SSE.
package trace

// Event mirrors the TypeScript TraceEvent. Res.Headers values are string, or
// []string for set-cookie.
type Event struct {
	ID         string `json:"id"`
	Ts         string `json:"ts"`
	Lab        string `json:"lab"`
	Impl       string `json:"impl"`
	Role       string `json:"role"`
	Req        Req    `json:"req"`
	Res        Res    `json:"res"`
	DurationMs int64  `json:"durationMs"`
}

type Req struct {
	Method  string            `json:"method"`
	Path    string            `json:"path"`
	Query   string            `json:"query"`
	Headers map[string]string `json:"headers"`
	Body    string            `json:"body,omitempty"`
}

type Res struct {
	Status  int            `json:"status"`
	Headers map[string]any `json:"headers"`
	Body    string         `json:"body,omitempty"`
}
