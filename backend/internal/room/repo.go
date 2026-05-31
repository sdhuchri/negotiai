package room

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound      = errors.New("room not found")
	ErrVendorPresent = errors.New("room already has a vendor")
)

// FileUpload is an optional intake document attached to a seat.
type FileUpload struct {
	Filename string
	Data     []byte
}

type Repo struct {
	pool      *pgxpool.Pool
	uploadDir string
}

func NewRepo(pool *pgxpool.Pool, uploadDir string) *Repo {
	return &Repo{pool: pool, uploadDir: uploadDir}
}

func token() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// saveFile writes an upload to uploadDir/{negID}/{seat}-{filename} and returns
// the stored name and relative path (or empty strings when no file).
func (r *Repo) saveFile(negID, seat string, f *FileUpload) (string, string, error) {
	if f == nil || f.Filename == "" || len(f.Data) == 0 {
		return "", "", nil
	}
	dir := filepath.Join(r.uploadDir, negID)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", "", fmt.Errorf("mkdir uploads: %w", err)
	}
	name := seat + "-" + filepath.Base(f.Filename)
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, f.Data, 0o644); err != nil {
		return "", "", fmt.Errorf("write file: %w", err)
	}
	return f.Filename, path, nil
}

func (r *Repo) loadView(ctx context.Context, id string) (View, error) {
	var v View
	err := r.pool.QueryRow(ctx, `
		SELECT id, title, status, COALESCE(background_key,''), share_token,
		       COALESCE(user_agent_name,''), COALESCE(user_avatar_id,''), user_ready,
		       COALESCE(vendor_agent_name,''), COALESCE(vendor_avatar_id,''), vendor_ready
		FROM negotiations WHERE id = $1`, id,
	).Scan(&v.ID, &v.Title, &v.Status, &v.BackgroundKey, &v.ShareToken,
		&v.User.Name, &v.User.AvatarID, &v.User.Ready,
		&v.Vendor.Name, &v.Vendor.AvatarID, &v.Vendor.Ready)
	if errors.Is(err, pgx.ErrNoRows) {
		return v, ErrNotFound
	}
	if err != nil {
		return v, fmt.Errorf("loadView: %w", err)
	}
	return v, nil
}

func (r *Repo) Create(ctx context.Context, req CreateRoomRequest, file *FileUpload) (CreateRoomResponse, error) {
	id := uuid.NewString()
	share := token()
	userTok := token()
	title := req.Title
	if title == "" {
		title = "Negosiasi tanpa judul"
	}

	fileName, filePath, err := r.saveFile(id, "user", file)
	if err != nil {
		return CreateRoomResponse{}, err
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return CreateRoomResponse{}, err
	}
	defer tx.Rollback(ctx)

	if _, err = tx.Exec(ctx, `
		INSERT INTO negotiations
			(id, title, status, background_key, user_agent_name, user_avatar_id, user_ready, share_token, user_token)
		VALUES ($1,$2,'draft',$3,$4,$5,TRUE,$6,$7)`,
		id, title, nilIfEmpty(req.BackgroundKey), req.Name, req.AvatarID, share, userTok); err != nil {
		return CreateRoomResponse{}, fmt.Errorf("insert negotiation: %w", err)
	}
	if _, err = tx.Exec(ctx, `
		INSERT INTO room_inputs (id, negotiation_id, seat, raw_text, file_name, file_path)
		VALUES ($1,$2,'user',$3,$4,$5)`,
		uuid.NewString(), id, nilIfEmpty(req.RawText), nilIfEmpty(fileName), nilIfEmpty(filePath)); err != nil {
		return CreateRoomResponse{}, fmt.Errorf("insert input: %w", err)
	}
	if err = tx.Commit(ctx); err != nil {
		return CreateRoomResponse{}, err
	}

	v, err := r.loadView(ctx, id)
	if err != nil {
		return CreateRoomResponse{}, err
	}
	return CreateRoomResponse{View: v, UserToken: userTok}, nil
}

func (r *Repo) Get(ctx context.Context, id string) (View, error) {
	return r.loadView(ctx, id)
}

// GetByShareToken lets the invited vendor preview the room before joining.
func (r *Repo) GetByShareToken(ctx context.Context, shareToken string) (View, error) {
	var id string
	err := r.pool.QueryRow(ctx, `SELECT id FROM negotiations WHERE share_token = $1`, shareToken).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return View{}, ErrNotFound
	}
	if err != nil {
		return View{}, err
	}
	return r.loadView(ctx, id)
}

func (r *Repo) Join(ctx context.Context, shareToken string, req JoinRoomRequest, file *FileUpload) (JoinRoomResponse, error) {
	var id string
	var vendorReady bool
	err := r.pool.QueryRow(ctx,
		`SELECT id, vendor_ready FROM negotiations WHERE share_token = $1`, shareToken,
	).Scan(&id, &vendorReady)
	if errors.Is(err, pgx.ErrNoRows) {
		return JoinRoomResponse{}, ErrNotFound
	}
	if err != nil {
		return JoinRoomResponse{}, err
	}
	if vendorReady {
		return JoinRoomResponse{}, ErrVendorPresent
	}

	fileName, filePath, err := r.saveFile(id, "vendor", file)
	if err != nil {
		return JoinRoomResponse{}, err
	}

	vendorTok := token()
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return JoinRoomResponse{}, err
	}
	defer tx.Rollback(ctx)

	if _, err = tx.Exec(ctx, `
		UPDATE negotiations
		SET vendor_agent_name=$1, vendor_avatar_id=$2, vendor_ready=TRUE, vendor_token=$3, status='ready'
		WHERE id=$4`, req.Name, req.AvatarID, vendorTok, id); err != nil {
		return JoinRoomResponse{}, fmt.Errorf("update vendor seat: %w", err)
	}
	if _, err = tx.Exec(ctx, `
		INSERT INTO room_inputs (id, negotiation_id, seat, raw_text, file_name, file_path)
		VALUES ($1,$2,'vendor',$3,$4,$5)`,
		uuid.NewString(), id, nilIfEmpty(req.RawText), nilIfEmpty(fileName), nilIfEmpty(filePath)); err != nil {
		return JoinRoomResponse{}, fmt.Errorf("insert input: %w", err)
	}
	if err = tx.Commit(ctx); err != nil {
		return JoinRoomResponse{}, err
	}

	v, err := r.loadView(ctx, id)
	if err != nil {
		return JoinRoomResponse{}, err
	}
	return JoinRoomResponse{View: v, VendorToken: vendorTok}, nil
}

func nilIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}
