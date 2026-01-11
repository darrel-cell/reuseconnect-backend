// CO2 Calculation utilities (matching frontend logic)

export const vehicleEmissions: Record<string, number> = {
  petrol: 0.21, // kg CO2 per km
  diesel: 0.19, // kg CO2 per km
  electric: 0.0, // kg CO2 per km (zero tailpipe emissions)
  // Legacy support
  car: 0.17,
  van: 0.24,
  truck: 0.89,
};

export interface AssetCategory {
  id: string;
  name: string; // Category name (e.g., "Laptop", "Server")
  co2ePerUnit: number; // kg CO2e saved per unit reused
  avgWeight: number; // kg
  avgBuybackValue: number; // £
}

export interface CO2CalculationInput {
  assets: Array<{
    categoryId: string;
    quantity: number;
  }>;
  distanceKm?: number;
  vehicleType?: 'petrol' | 'diesel' | 'electric' | 'car' | 'van' | 'truck';
  categories: AssetCategory[];
}

export interface CO2CalculationResult {
  reuseSavings: number; // kg CO2e
  travelEmissions: number; // kg CO2e
  netImpact: number; // kg CO2e
  distanceKm: number;
  distanceMiles: number;
  vehicleEmissions: {
    petrol: number;
    diesel: number;
    electric: number;
  };
  equivalencies: {
    treesPlanted: number;
    householdDays: number;
    carMiles: number;
    flightHours: number;
  };
}

// Import routing function
import { calculateRoundTripRoadDistance } from './routing';

// Export as calculateRoundTripDistance for backward compatibility
// Note: This is now async and uses road distance instead of straight-line
export { calculateRoundTripRoadDistance as calculateRoundTripDistance };

/**
 * Calculate distance between two coordinates using Haversine formula (for fallback/legacy use)
 * Note: New code should use calculateRoadDistance from routing.ts for road distance
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert kilometers to miles
 */
export function kmToMiles(km: number): number {
  return km * 0.621371;
}

/**
 * Calculate travel emissions for a specific vehicle type
 */
export function calculateTravelEmissions(
  distanceKm: number,
  vehicleType: string
): number {
  if (vehicleType === 'electric') {
    return 0;
  }
  const emissionsPerKm = vehicleEmissions[vehicleType] || vehicleEmissions.petrol;
  return Math.round(distanceKm * emissionsPerKm * 100) / 100;
}

/**
 * Calculate travel emissions for all vehicle types
 */
export function calculateAllVehicleEmissions(distanceKm: number): {
  petrol: number;
  diesel: number;
  electric: number;
} {
  return {
    petrol: calculateTravelEmissions(distanceKm, 'petrol'),
    diesel: calculateTravelEmissions(distanceKm, 'diesel'),
    electric: 0,
  };
}

/**
 * Calculate reuse CO2e savings
 */
export function calculateReuseCO2e(
  assets: Array<{ categoryId: string; quantity: number }>,
  categories: AssetCategory[]
): number {
  return assets.reduce((total, asset) => {
    const category = categories.find(c => c.id === asset.categoryId);
    return total + (category?.co2ePerUnit || 0) * asset.quantity;
  }, 0);
}

/**
 * Conservative buyback calculator constants
 * Based on baseline: 3-year-old equipment, Grade B condition, bulk volumes
 */

// Average RRP values by category (GBP)
const categoryAvgRRP: Record<string, number> = {
  'Networking': 2000,
  'Laptop': 1000,
  'Server': 5000,
  'Smart Phones': 700,
  'Smartphone': 700,
  'Smartphones': 700,
  'Desktop': 900,
  'Storage': 6000,
  'Tablets': 600,
  'Tablet': 600,
};

// Low residual percentages @ 3 years (R^c_low) - conservative bottom-quartile values
const categoryResidualLow: Record<string, number> = {
  'Networking': 0.15,    // 15%
  'Laptop': 0.18,        // 18%
  'Server': 0.08,        // 8%
  'Smart Phones': 0.17,  // 17%
  'Smartphone': 0.17,
  'Smartphones': 0.17,
  'Desktop': 0.09,       // 9%
  'Storage': 0.05,       // 5%
  'Tablets': 0.17,       // 17%
  'Tablet': 0.17,
};

// Volume factor based on quantity (muted upside)
function getVolumeFactor(quantity: number): number {
  if (quantity >= 200) return 1.10;
  if (quantity >= 50) return 1.06;
  if (quantity >= 10) return 1.03;
  return 1.00; // 1-9 items
}

// Floor and cap values by category (GBP)
const categoryFloors: Record<string, number> = {
  'Networking': 30,
  'Laptop': 30,
  'Server': 50,
  'Smart Phones': 10,
  'Smartphone': 10,
  'Smartphones': 10,
  'Desktop': 10,
  'Storage': 50,
  'Tablets': 15,
  'Tablet': 15,
};

const categoryCaps: Record<string, number> = {
  'Networking': 2000,
  'Laptop': 600,
  'Server': 2500,
  'Smart Phones': 450,
  'Smartphone': 450,
  'Smartphones': 450,
  'Desktop': 250,
  'Storage': 3000,
  'Tablets': 400,
  'Tablet': 400,
};

/**
 * Normalize category name for lookup
 */
function normalizeCategoryName(categoryName: string | undefined): string {
  if (!categoryName) {
    return '';
  }
  const normalized = categoryName.trim();
  // Try exact match first
  if (categoryAvgRRP[normalized]) return normalized;
  
  // Try case-insensitive match
  for (const key in categoryAvgRRP) {
    if (key.toLowerCase() === normalized.toLowerCase()) {
      return key;
    }
  }
  
  // Try partial match
  const normalizedLower = normalized.toLowerCase();
  for (const key in categoryAvgRRP) {
    if (normalizedLower.includes(key.toLowerCase()) || key.toLowerCase().includes(normalizedLower)) {
      return key;
    }
  }
  
  return normalized;
}

/**
 * Calculate conservative low-end buyback estimate per unit
 * 
 * Formula: buyback = (RRP × residual_low %) × volume_factor × condition_factor × age_factor × market_factor
 * 
 * Fixed values:
 * - Age: 3 years (36 months) → age_factor = 1.0
 * - Grade: B → condition_factor = 1.0
 * - Market: default → market_factor = 1.0
 * 
 * Client inputs: category and quantity only
 */
function calculateBuybackPerUnit(
  categoryName: string,
  quantity: number
): number {
  // Normalize category name
  const normalizedCategory = normalizeCategoryName(categoryName);
  
  // Get RRP and residual percentage
  const avgRRP = categoryAvgRRP[normalizedCategory] || 0;
  const residualLow = categoryResidualLow[normalizedCategory] || 0;
  
  if (avgRRP === 0 || residualLow === 0) {
    // Fallback: return 0 if category not recognized
    return 0;
  }
  
  // Base buyback = RRP × residual_low %
  const baseBuyback = avgRRP * residualLow;
  
  // Fixed factors (all 1.0 due to fixed conditions)
  const ageFactor = 1.0;        // Fixed at 3 years
  const conditionFactor = 1.0;  // Fixed at Grade B
  const marketFactor = 1.0;     // Default market index
  const specFactor = 1.0;       // Optional, default to 1.0 for conservative estimate
  
  // Variable factor
  const volumeFactor = getVolumeFactor(quantity);
  
  // Calculate raw buyback value
  const rawBuyback = baseBuyback * ageFactor * conditionFactor * volumeFactor * marketFactor * specFactor;
  
  // Apply floor and cap
  const floor = categoryFloors[normalizedCategory] || 0;
  const cap = categoryCaps[normalizedCategory] || Infinity;
  
  return Math.max(floor, Math.min(cap, rawBuyback));
}

/**
 * Calculate buyback estimate (conservative low-end)
 * 
 * Uses conservative baseline formula:
 * - 3-year-old equipment
 * - Grade B condition
 * - Low residual percentages (bottom-quartile)
 * - Volume factor for bulk volumes
 */
export function calculateBuybackEstimate(
  assets: Array<{ categoryId: string; quantity: number }>,
  categories: AssetCategory[]
): number {
  return assets.reduce((total, asset) => {
    const category = categories.find(c => c.id === asset.categoryId);
    if (!category) return total;
    
    const buybackPerUnit = calculateBuybackPerUnit(category.name, asset.quantity);
    return total + buybackPerUnit * asset.quantity;
  }, 0);
}

/**
 * CO2e equivalencies
 */
const co2eEquivalencies = {
  treesPlanted: (kg: number) => Math.round(kg / 21), // 1 tree absorbs ~21kg CO2/year
  householdDays: (kg: number) => Math.round(kg / 27), // UK household ~27kg CO2/day
  carMiles: (kg: number) => Math.round(kg / 0.21), // ~0.21kg CO2 per mile
  flightHours: (kg: number) => Math.round(kg / 250), // ~250kg CO2 per flight hour
};

/**
 * Full CO2 calculation
 */
export function calculateCO2e(input: CO2CalculationInput): CO2CalculationResult {
  const { assets, distanceKm, vehicleType, categories } = input;

  // Calculate reuse savings
  const reuseSavings = calculateReuseCO2e(assets, categories);

  // Calculate distance (use provided or default)
  const distance = distanceKm || 80; // Default 80km round trip

  // Calculate emissions for all vehicle types
  const vehicleEmissionsAll = calculateAllVehicleEmissions(distance);

  // Use selected vehicle type or default to petrol
  const selectedVehicleType = vehicleType || 'petrol';
  const travelEmissions = selectedVehicleType === 'electric'
    ? 0
    : (vehicleEmissionsAll[selectedVehicleType as keyof typeof vehicleEmissionsAll] ?? vehicleEmissionsAll.petrol);

  // Calculate net impact
  const netImpact = reuseSavings - travelEmissions;

  // Calculate equivalencies
  const equivalencies = {
    treesPlanted: co2eEquivalencies.treesPlanted(netImpact),
    householdDays: co2eEquivalencies.householdDays(netImpact),
    carMiles: co2eEquivalencies.carMiles(netImpact),
    flightHours: co2eEquivalencies.flightHours(netImpact),
  };

  return {
    reuseSavings,
    travelEmissions,
    netImpact,
    distanceKm: distance,
    distanceMiles: kmToMiles(distance),
    vehicleEmissions: vehicleEmissionsAll,
    equivalencies,
  };
}

