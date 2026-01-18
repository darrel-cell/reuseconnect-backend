
export const vehicleEmissions: Record<string, number> = {
  petrol: 0.21, // kg CO2 per km
  diesel: 0.19,
  electric: 0.0,
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

export { calculateRoundTripRoadDistance as calculateRoundTripDistance };

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

  const reuseSavings = calculateReuseCO2e(assets, categories);
  // Use 0 if distance is not provided or invalid (instead of defaulting to 80km)
  // This allows the UI to show error/warning when distance calculation fails
  const distance = (distanceKm && distanceKm > 0) ? distanceKm : 0;
  const vehicleEmissionsAll = calculateAllVehicleEmissions(distance);
  const selectedVehicleType = vehicleType || 'petrol';
  const travelEmissions = selectedVehicleType === 'electric'
    ? 0
    : (vehicleEmissionsAll[selectedVehicleType as keyof typeof vehicleEmissionsAll] ?? vehicleEmissionsAll.petrol);
  const netImpact = reuseSavings - travelEmissions;
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

