package domain

import (
	"errors"
	"fmt"
	"math"
)

var (
	ErrEmptyCart            = errors.New("keranjang pesanan tidak boleh kosong")
	ErrInvalidQuantity      = errors.New("jumlah item (qty) harus lebih dari 0")
	ErrInvalidPrice         = errors.New("harga produk tidak boleh negatif")
	ErrInvalidTaxRate       = errors.New("persentase pajak tidak boleh negatif")
	ErrInsufficientPayment  = errors.New("nominal uang tunai yang diterima kurang dari Grand Total")
	ErrInsufficientRawStock = errors.New("stok bahan baku tidak mencukupi untuk memenuhi pesanan")
)

type InsufficientStockDetail struct {
	RawMaterialID   int     `json:"raw_material_id"`
	RawMaterialName string  `json:"raw_material_name"`
	Unit            string  `json:"unit"`
	Available       float64 `json:"available"`
	Required        float64 `json:"required"`
	Shortage        float64 `json:"shortage"`
}

type InsufficientStockError struct {
	Details []InsufficientStockDetail `json:"details"`
}

func (e *InsufficientStockError) Error() string {
	if len(e.Details) == 0 {
		return ErrInsufficientRawStock.Error()
	}
	first := e.Details[0]
	return fmt.Sprintf(
		"%s: %s (tersedia %.2f %s, dibutuhkan %.2f %s)",
		ErrInsufficientRawStock.Error(),
		first.RawMaterialName,
		first.Available,
		first.Unit,
		first.Required,
		first.Unit,
	)
}

func RoundCurrency(val float64) float64 {
	return math.Round(val*100) / 100
}

func CalculateTransactionTotals(items []CartItemInput, taxRatePercent float64) (subtotal, taxAmount, grandTotal float64, err error) {
	if len(items) == 0 {
		return 0, 0, 0, ErrEmptyCart
	}
	if taxRatePercent < 0 {
		return 0, 0, 0, ErrInvalidTaxRate
	}

	var rawSubtotal float64
	for _, item := range items {
		if item.Quantity <= 0 {
			return 0, 0, 0, ErrInvalidQuantity
		}
		if item.UnitPrice < 0 {
			return 0, 0, 0, ErrInvalidPrice
		}
		rawSubtotal += item.UnitPrice * float64(item.Quantity)
	}

	subtotal = RoundCurrency(rawSubtotal)
	taxAmount = RoundCurrency(subtotal * (taxRatePercent / 100.0))
	grandTotal = RoundCurrency(subtotal + taxAmount)
	return subtotal, taxAmount, grandTotal, nil
}

func CalculatePaymentChange(grandTotal, cashReceived float64, paymentMethod string) (effectiveCashReceived, changeAmount float64, err error) {
	if paymentMethod == "CASH" {
		if cashReceived < grandTotal {
			return 0, 0, ErrInsufficientPayment
		}
		return RoundCurrency(cashReceived), RoundCurrency(cashReceived - grandTotal), nil
	}
	return RoundCurrency(grandTotal), 0, nil
}

func CalculateBOMDeductions(items []CartItemInput, recipesByProduct map[int][]RecipeItem) (map[int]float64, error) {
	if len(items) == 0 {
		return nil, ErrEmptyCart
	}

	deductions := make(map[int]float64)
	for _, item := range items {
		if item.Quantity <= 0 {
			return nil, ErrInvalidQuantity
		}
		recipes := recipesByProduct[item.ProductID]
		for _, recipe := range recipes {
			if recipe.QuantityRequired <= 0 {
				continue
			}
			totalNeeded := RoundCurrency(recipe.QuantityRequired * float64(item.Quantity))
			deductions[recipe.RawMaterialID] = RoundCurrency(deductions[recipe.RawMaterialID] + totalNeeded)
		}
	}
	return deductions, nil
}

func ValidateAndApplyStockDeductions(
	currentMaterials map[int]RawMaterial,
	requiredDeductions map[int]float64,
) (map[int]float64, error) {
	updatedStocks := make(map[int]float64, len(requiredDeductions))
	var shortages []InsufficientStockDetail

	for rawID, neededQty := range requiredDeductions {
		mat, exists := currentMaterials[rawID]
		if !exists {
			shortages = append(shortages, InsufficientStockDetail{
				RawMaterialID:   rawID,
				RawMaterialName: fmt.Sprintf("Material #%d", rawID),
				Available:       0,
				Required:        neededQty,
				Shortage:        neededQty,
			})
			continue
		}

		if mat.Stock < neededQty {
			shortages = append(shortages, InsufficientStockDetail{
				RawMaterialID:   mat.ID,
				RawMaterialName: mat.Name,
				Unit:            mat.Unit,
				Available:       mat.Stock,
				Required:        neededQty,
				Shortage:        RoundCurrency(neededQty - mat.Stock),
			})
			continue
		}

		updatedStocks[rawID] = RoundCurrency(mat.Stock - neededQty)
	}

	if len(shortages) > 0 {
		return nil, &InsufficientStockError{Details: shortages}
	}

	return updatedStocks, nil
}

func IsLowStock(stock, minStock float64) bool {
	return stock <= minStock
}

func CalculateMaxPortions(recipes []RecipeItem) int {
	if len(recipes) == 0 {
		return 999
	}
	maxPortions := math.MaxInt32
	for _, r := range recipes {
		if r.QuantityRequired <= 0 {
			continue
		}
		possible := int(math.Floor(r.AvailableStock / r.QuantityRequired))
		if possible < 0 {
			possible = 0
		}
		if possible < maxPortions {
			maxPortions = possible
		}
	}
	if maxPortions == math.MaxInt32 {
		return 0
	}
	return maxPortions
}

func CalculateShiftReconciliation(openingCash, totalCashSales, actualCash float64) (expectedCash, variance float64, discrepancyType string) {
	expectedCash = RoundCurrency(openingCash + totalCashSales)
	variance = RoundCurrency(actualCash - expectedCash)

	switch {
	case math.Abs(variance) < 0.01:
		variance = 0
		discrepancyType = "MATCH"
	case variance < 0:
		discrepancyType = "SHORTAGE"
	default:
		discrepancyType = "OVERAGE"
	}
	return expectedCash, variance, discrepancyType
}
