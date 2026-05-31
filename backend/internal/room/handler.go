package room

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
)

const maxUpload = 25 << 20 // 25 MB

type Handler struct{ repo *Repo }

func NewHandler(repo *Repo) *Handler { return &Handler{repo: repo} }

func (h *Handler) Routes(r chi.Router) {
	r.Post("/rooms", h.create)
	r.Get("/rooms/by-token/{token}", h.getByToken)
	r.Get("/rooms/{id}", h.get)
	r.Post("/rooms/{token}/join", h.join)
}

func readFile(r *http.Request) *FileUpload {
	f, hdr, err := r.FormFile("file")
	if err != nil {
		return nil
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, maxUpload))
	if err != nil || len(data) == 0 {
		return nil
	}
	return &FileUpload{Filename: hdr.Filename, Data: data}
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var req CreateRoomRequest
	var file *FileUpload
	if strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/form-data") {
		if err := r.ParseMultipartForm(maxUpload); err != nil {
			writeErr(w, http.StatusBadRequest, "invalid form")
			return
		}
		req = CreateRoomRequest{
			Title:         r.FormValue("title"),
			Name:          r.FormValue("name"),
			AvatarID:      r.FormValue("avatar_id"),
			BackgroundKey: r.FormValue("background_key"),
			RawText:       r.FormValue("raw_text"),
		}
		file = readFile(r)
	} else if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if req.Name == "" || req.AvatarID == "" {
		writeErr(w, http.StatusBadRequest, "name and avatar_id are required")
		return
	}
	resp, err := h.repo.Create(r.Context(), req, file)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, resp)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	v, err := h.repo.Get(r.Context(), chi.URLParam(r, "id"))
	if errors.Is(err, ErrNotFound) {
		writeErr(w, http.StatusNotFound, "room not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, v)
}

func (h *Handler) getByToken(w http.ResponseWriter, r *http.Request) {
	v, err := h.repo.GetByShareToken(r.Context(), chi.URLParam(r, "token"))
	if errors.Is(err, ErrNotFound) {
		writeErr(w, http.StatusNotFound, "room not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, v)
}

func (h *Handler) join(w http.ResponseWriter, r *http.Request) {
	var req JoinRoomRequest
	var file *FileUpload
	if strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/form-data") {
		if err := r.ParseMultipartForm(maxUpload); err != nil {
			writeErr(w, http.StatusBadRequest, "invalid form")
			return
		}
		req = JoinRoomRequest{
			Name:     r.FormValue("name"),
			AvatarID: r.FormValue("avatar_id"),
			RawText:  r.FormValue("raw_text"),
		}
		file = readFile(r)
	} else if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if req.Name == "" || req.AvatarID == "" {
		writeErr(w, http.StatusBadRequest, "name and avatar_id are required")
		return
	}
	resp, err := h.repo.Join(r.Context(), chi.URLParam(r, "token"), req, file)
	switch {
	case errors.Is(err, ErrNotFound):
		writeErr(w, http.StatusNotFound, "room not found")
	case errors.Is(err, ErrVendorPresent):
		writeErr(w, http.StatusConflict, "room already has a vendor")
	case err != nil:
		writeErr(w, http.StatusInternalServerError, err.Error())
	default:
		writeJSON(w, http.StatusOK, resp)
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
