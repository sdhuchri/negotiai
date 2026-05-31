package nego

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-pdf/fpdf"
)

func rupiah(n float64) string {
	s := fmt.Sprintf("%.0f", n)
	// insert thousand separators
	var b strings.Builder
	for i, c := range s {
		if i > 0 && (len(s)-i)%3 == 0 {
			b.WriteByte('.')
		}
		b.WriteRune(c)
	}
	return "Rp " + b.String()
}

func (h *Handler) agreement(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	meta, err := h.repo.Meta(r.Context(), id)
	if err != nil {
		writeErr(w, http.StatusNotFound, "room not found")
		return
	}
	if meta.Status != "deal" || meta.DealPrice == nil {
		writeErr(w, http.StatusConflict, "belum ada kesepakatan")
		return
	}

	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(20, 20, 20)
	pdf.AddPage()

	pdf.SetFont("Helvetica", "B", 20)
	pdf.CellFormat(0, 12, "Kesepakatan Negosiasi", "", 1, "C", false, 0, "")
	pdf.SetFont("Helvetica", "", 10)
	pdf.SetTextColor(120, 120, 120)
	pdf.CellFormat(0, 6, "NegotiAI - dokumen otomatis", "", 1, "C", false, 0, "")
	pdf.SetTextColor(0, 0, 0)
	pdf.Ln(8)

	row := func(label, value string) {
		pdf.SetFont("Helvetica", "B", 11)
		pdf.CellFormat(55, 8, label, "", 0, "L", false, 0, "")
		pdf.SetFont("Helvetica", "", 11)
		pdf.CellFormat(0, 8, value, "", 1, "L", false, 0, "")
	}

	row("Judul", meta.Title)
	row("Negotiation ID", meta.ID)
	pdf.Ln(2)
	pdf.SetDrawColor(220, 220, 220)
	pdf.Line(20, pdf.GetY(), 190, pdf.GetY())
	pdf.Ln(4)

	row("Pihak Pembeli", emptyDash(meta.UserName))
	row("Pihak Penjual", emptyDash(meta.VendorName))
	pdf.Ln(2)
	pdf.Line(20, pdf.GetY(), 190, pdf.GetY())
	pdf.Ln(4)

	pdf.SetFont("Helvetica", "B", 13)
	pdf.CellFormat(0, 9, "Harga Final: "+rupiah(*meta.DealPrice), "", 1, "L", false, 0, "")
	pdf.SetFont("Helvetica", "", 11)
	if meta.DealLead != nil {
		row("Lead time", fmt.Sprintf("%d hari", *meta.DealLead))
	}
	pdf.Ln(10)

	pdf.SetTextColor(120, 120, 120)
	pdf.SetFont("Helvetica", "I", 9)
	pdf.MultiCell(0, 5,
		"Dokumen ini dihasilkan otomatis oleh NegotiAI sebagai ringkasan kesepakatan hasil negosiasi "+
			"antar agent dengan persetujuan manusia. Audit trail lengkap tersimpan pada sistem.",
		"", "L", false)

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`inline; filename="kesepakatan-%s.pdf"`, id[:8]))
	if err := pdf.Output(w); err != nil {
		writeErr(w, http.StatusInternalServerError, "gagal membuat pdf")
	}
}

func emptyDash(s string) string {
	if strings.TrimSpace(s) == "" {
		return "-"
	}
	return s
}
