package main

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"os"
	"time"

	_ "github.com/lib/pq"
	"mini-erp-fnb/internal/api"
	"mini-erp-fnb/internal/store"
)

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:postgres@localhost:5432/mini_erp_fnb?sslmode=disable"
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("Gagal membuka koneksi database: %v", err)
	}
	defer db.Close()

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(5 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		log.Fatalf("Gagal ping PostgreSQL (%s): %v", dbURL, err)
	}

	st := store.NewStore(db)
	srv := api.NewServer(st)

	addr := ":" + port
	log.Printf("🚀 Mini ERP F&B Backend berjalan di http://localhost%s", addr)
	if err := http.ListenAndServe(addr, srv); err != nil {
		log.Fatalf("Server berhenti: %v", err)
	}
}
