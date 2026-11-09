package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"mini-erp-fnb/internal/domain"
	"mini-erp-fnb/internal/store"
)

type Server struct {
	store *store.Store
	mux   *http.ServeMux
}

func NewServer(st *store.Store) *Server {
	s := &Server{
		store: st,
		mux:   http.NewServeMux(),
	}
	s.registerRoutes()
	return s
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	// CORS Headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	rw := &responseRecorder{ResponseWriter: w, statusCode: http.StatusOK}
	s.mux.ServeHTTP(rw, r)

	elapsedMs := float64(time.Since(start).Microseconds()) / 1000.0
	w.Header().Set("X-Response-Time-Ms", strconv.FormatFloat(elapsedMs, 'f', 2, 64))
}

type responseRecorder struct {
	http.ResponseWriter
	statusCode int
}

func (r *responseRecorder) WriteHeader(code int) {
	r.statusCode = code
	r.ResponseWriter.WriteHeader(code)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, message string, details any) {
	resp := map[string]any{
		"error": message,
	}
	if details != nil {
		resp["details"] = details
	}
	writeJSON(w, status, resp)
}

func (s *Server) registerRoutes() {
	// Healthcheck & Dashboard
	s.mux.HandleFunc("GET /api/health", s.handleHealth)
	s.mux.HandleFunc("GET /api/dashboard", s.handleDashboard)

	// Modul 2: Raw Materials (Master Bahan Baku & Low Stock Alert)
	s.mux.HandleFunc("GET /api/raw-materials", s.handleListRawMaterials)
	s.mux.HandleFunc("POST /api/raw-materials", s.handleCreateRawMaterial)
	s.mux.HandleFunc("PUT /api/raw-materials/{id}", s.handleUpdateRawMaterial)
	s.mux.HandleFunc("POST /api/raw-materials/{id}/adjust", s.handleAdjustRawMaterialStock)
	s.mux.HandleFunc("DELETE /api/raw-materials/{id}", s.handleDeleteRawMaterial)
	s.mux.HandleFunc("GET /api/stock-movements", s.handleListStockMovements)

	// Modul 1 & 2: Products (Master Menu & Resep BOM)
	s.mux.HandleFunc("GET /api/products", s.handleListProducts)
	s.mux.HandleFunc("GET /api/products/{id}", s.handleGetProduct)
	s.mux.HandleFunc("POST /api/products", s.handleCreateProduct)
	s.mux.HandleFunc("PUT /api/products/{id}", s.handleUpdateProduct)
	s.mux.HandleFunc("DELETE /api/products/{id}", s.handleDeleteProduct)

	// Modul 1: POS Transactions & Cart Calculation
	s.mux.HandleFunc("POST /api/pos/calculate", s.handleCalculateCart)
	s.mux.HandleFunc("POST /api/transactions", s.handleCheckoutTransaction)
	s.mux.HandleFunc("GET /api/transactions", s.handleListTransactions)

	// Modul 3: HR & Cash Management (Shift Kasir & Rekonsiliasi)
	s.mux.HandleFunc("GET /api/shifts/active", s.handleGetActiveShift)
	s.mux.HandleFunc("GET /api/shifts", s.handleListShifts)
	s.mux.HandleFunc("POST /api/shifts/open", s.handleOpenShift)
	s.mux.HandleFunc("POST /api/shifts/{id}/close", s.handleCloseShift)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "ok",
		"service": "mini-erp-fnb-backend",
		"time":    time.Now().Format(time.RFC3339),
	})
}

func (s *Server) handleDashboard(w http.ResponseWriter, r *http.Request) {
	summary, err := s.store.GetDashboardSummary(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, summary)
}

// --- Raw Materials Handlers ---

func (s *Server) handleListRawMaterials(w http.ResponseWriter, r *http.Request) {
	materials, err := s.store.ListRawMaterials(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, materials)
}

func (s *Server) handleCreateRawMaterial(w http.ResponseWriter, r *http.Request) {
	var input domain.RawMaterialInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "format JSON tidak valid", nil)
		return
	}
	mat, err := s.store.CreateRawMaterial(r.Context(), input)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusCreated, mat)
}

func (s *Server) handleUpdateRawMaterial(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "ID bahan baku tidak valid", nil)
		return
	}
	var input domain.RawMaterialInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "format JSON tidak valid", nil)
		return
	}
	mat, err := s.store.UpdateRawMaterial(r.Context(), id, input)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, err.Error(), nil)
		return
	}
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, mat)
}

func (s *Server) handleAdjustRawMaterialStock(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "ID bahan baku tidak valid", nil)
		return
	}
	var input domain.StockAdjustmentInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "format JSON tidak valid", nil)
		return
	}
	mat, err := s.store.AdjustRawMaterialStock(r.Context(), id, input)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, err.Error(), nil)
		return
	}
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, mat)
}

func (s *Server) handleDeleteRawMaterial(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "ID bahan baku tidak valid", nil)
		return
	}
	if err := s.store.DeleteRawMaterial(r.Context(), id); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, err.Error(), nil)
			return
		}
		writeError(w, http.StatusConflict, "Bahan baku tidak dapat dihapus karena sedang digunakan pada resep menu", nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Bahan baku berhasil dihapus"})
}

func (s *Server) handleListStockMovements(w http.ResponseWriter, r *http.Request) {
	movements, err := s.store.ListStockMovements(r.Context(), 50)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, movements)
}

// --- Products & BOM Recipes Handlers ---

func (s *Server) handleListProducts(w http.ResponseWriter, r *http.Request) {
	products, err := s.store.ListProducts(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, products)
}

func (s *Server) handleGetProduct(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "ID menu tidak valid", nil)
		return
	}
	prod, err := s.store.GetProductByID(r.Context(), id)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, err.Error(), nil)
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, prod)
}

func (s *Server) handleCreateProduct(w http.ResponseWriter, r *http.Request) {
	var input domain.ProductInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "format JSON tidak valid", nil)
		return
	}
	prod, err := s.store.CreateProduct(r.Context(), input)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusCreated, prod)
}

func (s *Server) handleUpdateProduct(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "ID menu tidak valid", nil)
		return
	}
	var input domain.ProductInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "format JSON tidak valid", nil)
		return
	}
	prod, err := s.store.UpdateProduct(r.Context(), id, input)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, err.Error(), nil)
		return
	}
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, prod)
}

func (s *Server) handleDeleteProduct(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "ID menu tidak valid", nil)
		return
	}
	if err := s.store.DeleteProduct(r.Context(), id); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, err.Error(), nil)
			return
		}
		writeError(w, http.StatusConflict, "Menu tidak dapat dihapus karena sudah memiliki riwayat transaksi", nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Menu berhasil dihapus"})
}

// --- POS Calculation & Checkout Handlers ---

func (s *Server) handleCalculateCart(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Items   []domain.CartItemInput `json:"items"`
		TaxRate *float64               `json:"tax_rate"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "format JSON tidak valid", nil)
		return
	}
	taxRate := 10.0
	if req.TaxRate != nil {
		taxRate = *req.TaxRate
	}
	subtotal, taxAmount, grandTotal, err := domain.CalculateTransactionTotals(req.Items, taxRate)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"subtotal":    subtotal,
		"tax_rate":    taxRate,
		"tax_amount":  taxAmount,
		"grand_total": grandTotal,
	})
}

func (s *Server) handleCheckoutTransaction(w http.ResponseWriter, r *http.Request) {
	var input domain.CheckoutInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "format JSON tidak valid", nil)
		return
	}
	tx, err := s.store.CheckoutTransaction(r.Context(), input)
	if err != nil {
		var stockErr *domain.InsufficientStockError
		if errors.As(err, &stockErr) {
			writeError(w, http.StatusUnprocessableEntity, stockErr.Error(), stockErr.Details)
			return
		}
		writeError(w, http.StatusBadRequest, err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusCreated, tx)
}

func (s *Server) handleListTransactions(w http.ResponseWriter, r *http.Request) {
	txs, err := s.store.ListTransactions(r.Context(), 50)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, txs)
}

// --- Shift Management (Modul 3) Handlers ---

func (s *Server) handleGetActiveShift(w http.ResponseWriter, r *http.Request) {
	sh, err := s.store.GetActiveShift(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"active_shift": sh,
	})
}

func (s *Server) handleListShifts(w http.ResponseWriter, r *http.Request) {
	shifts, err := s.store.ListShifts(r.Context(), 30)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, shifts)
}

func (s *Server) handleOpenShift(w http.ResponseWriter, r *http.Request) {
	var input domain.OpenShiftInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "format JSON tidak valid", nil)
		return
	}
	sh, err := s.store.OpenShift(r.Context(), input)
	if errors.Is(err, store.ErrActiveShiftExists) {
		writeError(w, http.StatusConflict, err.Error(), nil)
		return
	}
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusCreated, sh)
}

func (s *Server) handleCloseShift(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "ID shift tidak valid", nil)
		return
	}
	var input domain.CloseShiftInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "format JSON tidak valid", nil)
		return
	}
	sh, err := s.store.CloseShift(r.Context(), id, input)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, err.Error(), nil)
		return
	}
	if errors.Is(err, store.ErrShiftAlreadyClose) {
		writeError(w, http.StatusConflict, err.Error(), nil)
		return
	}
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error(), nil)
		return
	}
	writeJSON(w, http.StatusOK, sh)
}
