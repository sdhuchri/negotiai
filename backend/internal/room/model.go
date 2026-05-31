package room

// Seat is the public-facing presence of one side (no private intake text).
type Seat struct {
	Name     string `json:"name"`
	AvatarID string `json:"avatar_id"`
	Ready    bool   `json:"ready"`
}

// View is the asymmetry-safe public state of a room. It never includes either
// side's raw intake text.
type View struct {
	ID            string `json:"id"`
	Title         string `json:"title"`
	Status        string `json:"status"`
	BackgroundKey string `json:"background_key,omitempty"`
	ShareToken    string `json:"share_token"`
	User          Seat   `json:"user"`
	Vendor        Seat   `json:"vendor"`
}

// CreateRoomRequest — the user creates a room (their seat).
type CreateRoomRequest struct {
	Title         string `json:"title"`
	Name          string `json:"name"`
	AvatarID      string `json:"avatar_id"`
	BackgroundKey string `json:"background_key"`
	RawText       string `json:"raw_text"`
}

// CreateRoomResponse returns the room plus the creator's private seat token and
// the share token to invite the vendor.
type CreateRoomResponse struct {
	View      View   `json:"room"`
	UserToken string `json:"user_token"`
}

// JoinRoomRequest — vendor joins via the share link.
type JoinRoomRequest struct {
	Name     string `json:"name"`
	AvatarID string `json:"avatar_id"`
	RawText  string `json:"raw_text"`
}

// JoinRoomResponse returns the room plus the vendor's private seat token.
type JoinRoomResponse struct {
	View        View   `json:"room"`
	VendorToken string `json:"vendor_token"`
}
