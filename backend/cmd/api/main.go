package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/sdhuchri/negotiai/backend/internal/agentclient"
	"github.com/sdhuchri/negotiai/backend/internal/hub"
	"github.com/sdhuchri/negotiai/backend/internal/nego"
	"github.com/sdhuchri/negotiai/backend/internal/room"
	"github.com/sdhuchri/negotiai/backend/internal/store"
)

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func main() {
	ctx := context.Background()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	pool, err := store.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer pool.Close()

	if err := store.Migrate(ctx, pool, env("MIGRATIONS_DIR", "migrations")); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	log.Println("migrations applied")

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	// No global timeout: the SSE stream is long-lived.
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3200", "http://localhost:3000", "http://127.0.0.1:3200"},
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	uploadDir := env("UPLOAD_DIR", "/data/uploads")
	if err := os.MkdirAll(uploadDir, 0o755); err != nil {
		log.Fatalf("mkdir upload dir: %v", err)
	}
	roomHandler := room.NewHandler(room.NewRepo(pool, uploadDir))

	sseHub := hub.New()
	agent := agentclient.New(env("AGENT_SERVICE_URL", "http://agent:8000"))
	negoHandler := nego.NewHandler(nego.NewRepo(pool), sseHub, agent)

	r.Route("/api", func(api chi.Router) {
		roomHandler.Routes(api)
		negoHandler.Routes(api)
	})
	negoHandler.Internal(r) // POST /internal/events (agent webhook, no CORS needed)

	port := env("PORT", "8080")
	log.Printf("backend listening on :%s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatal(err)
	}
}
