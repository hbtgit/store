/**
 * The Saleor catalog shape for vehicles. scripts/provision-saleor.ts creates
 * these objects, and the catalog adapter looks them up by slug.
 */
export const VEHICLE_PRODUCT_TYPE_SLUG = "vehicle";
export const VEHICLE_CATEGORY_SLUG = "vehicles";
export const VEHICLE_WAREHOUSE_SLUG = "brokerage-yard";
export const STATUS_METADATA_KEY = "vehicle.status";

type AttributeDef = {
  slug: string;
  name: string;
  inputType: "DROPDOWN" | "NUMERIC" | "PLAIN_TEXT";
  unit?: "KM";
  valueRequired: boolean;
  /** Initial choices for dropdowns; new values are created on the fly. */
  choices?: string[];
};

export const VEHICLE_ATTRIBUTES = {
  make: { slug: "vehicle-make", name: "Make", inputType: "DROPDOWN", valueRequired: true },
  model: { slug: "vehicle-model", name: "Model", inputType: "PLAIN_TEXT", valueRequired: true },
  year: { slug: "vehicle-year", name: "Year", inputType: "NUMERIC", valueRequired: true },
  mileageKm: {
    slug: "vehicle-mileage",
    name: "Mileage",
    inputType: "NUMERIC",
    unit: "KM",
    valueRequired: true,
  },
  bodyType: {
    slug: "vehicle-body-type",
    name: "Body type",
    inputType: "DROPDOWN",
    valueRequired: false,
    choices: ["Sedan", "Hatchback", "SUV", "Pickup", "Coupe", "Convertible", "Wagon", "Van"],
  },
  fuelType: {
    slug: "vehicle-fuel-type",
    name: "Fuel type",
    inputType: "DROPDOWN",
    valueRequired: false,
    choices: ["Petrol", "Diesel", "Hybrid", "Plug-in hybrid", "Electric"],
  },
  transmission: {
    slug: "vehicle-transmission",
    name: "Transmission",
    inputType: "DROPDOWN",
    valueRequired: false,
    choices: ["Automatic", "Manual"],
  },
  exteriorColor: {
    slug: "vehicle-exterior-color",
    name: "Exterior colour",
    inputType: "DROPDOWN",
    valueRequired: false,
  },
  condition: {
    slug: "vehicle-condition",
    name: "Condition",
    inputType: "DROPDOWN",
    valueRequired: false,
    choices: ["New", "Used", "Certified pre-owned"],
  },
} satisfies Record<string, AttributeDef>;

export type VehicleAttributeKey = keyof typeof VEHICLE_ATTRIBUTES;
