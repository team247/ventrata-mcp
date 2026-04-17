// ============================================================
// Ventrata OCTO API Response Types
// Derived from live API responses verified on 2026-02-27
// ============================================================

// --- Shared types ---

export interface VentrataPricing {
  original: number;
  retail: number;
  net: number | null;
  currency: string;
  currencyPrecision: number;
  includedTaxes: unknown[];
}

export interface VentrataOpeningHours {
  from: string;
  to: string;
  frequency: string | null;
  frequencyAmount: number | null;
  frequencyUnit: string;
}

export interface VentrataUnitPricingEntry {
  unitId: string;
  unitType: string;
  original: number;
  retail: number;
  net: number | null;
  currency: string;
  currencyPrecision: number;
  includedTaxes: unknown[];
}

// --- Product types ---

export interface VentrataUnitRestrictions {
  required: boolean;
  minAge: number;
  maxAge: number;
  idRequired: boolean;
  minQuantity: number;
  maxQuantity: number | null;
  paxCount: number;
  accompaniedBy: string[];
}

export interface VentrataOptionRestrictions {
  minUnits: number;
  maxUnits: number | null;
  minPaxCount: number;
  maxPaxCount: number | null;
}

export interface VentrataUnit {
  id: string;
  internalName: string;
  reference: string | null;
  type: string;
  restrictions: VentrataUnitRestrictions;
  title: string;
  titlePlural: string;
  subtitle: string | null;
  pricingFrom: VentrataPricing[];
}

export interface VentrataOption {
  id: string;
  default: boolean;
  internalName: string;
  availabilityLocalStartTimes: string[];
  cancellationCutoff: string;
  cancellationCutoffAmount: number;
  cancellationCutoffUnit: string;
  restrictions: VentrataOptionRestrictions;
  units: VentrataUnit[];
  // Content capability fields
  title: string;
  subtitle: string | null;
  language: string | null;
  shortDescription: string | null;
  duration: string | null;
  durationAmount: number | null;
  durationUnit: string | null;
  meetingPoint: string | null;
  meetingPointLatitude: number | null;
  meetingPointLongitude: number | null;
}

export interface VentrataProduct {
  id: string;
  internalName: string;
  reference: string | null;
  locale: string;
  timeZone: string;
  allowFreesale: boolean;
  instantConfirmation: boolean;
  instantDelivery: boolean;
  availabilityRequired: boolean;
  availabilityType: string;
  deliveryFormats: string[];
  deliveryMethods: string[];
  redemptionMethod: string;
  options: VentrataOption[];
  // Content capability fields
  title: string;
  country: string;
  location: string;
  shortDescription: string;
  description: string;
  highlights: string[];
  inclusions: string[];
  exclusions: string[];
  coverImageUrl: string | null;
  categories: string[];
  defaultCurrency: string;
  availableCurrencies: string[];
}

// --- Availability types ---

export interface VentrataCalendarDay {
  localDate: string;
  availabilityLocalStartTimes: string[];
  available: boolean;
  status: string;
  statusMessage: string;
  vacancies: number | null;
  capacity: number | null;
  paxCount: number;
  openingHours: VentrataOpeningHours[];
  unitPricingFrom: VentrataUnitPricingEntry[];
  pricingFrom: VentrataPricing[];
}

export interface VentrataBatchCalendarDay extends VentrataCalendarDay {
  productId: string;
  optionId: string;
}

export interface VentrataAvailabilitySlot {
  id: string;
  localDateTimeStart: string;
  localDateTimeEnd: string;
  allDay: boolean;
  available: boolean;
  status: string;
  statusMessage: string;
  vacancies: number | null;
  capacity: number | null;
  paxCount: number;
  maxUnits: number | null;
  maxPaxCount: number | null;
  utcCutoffAt: string | null;
  openingHours: VentrataOpeningHours[];
  meetingPoint: string | null;
  unitPricing: VentrataUnitPricingEntry[];
  pricing: VentrataPricing | null;
}

export interface VentrataBatchAvailabilitySlot extends VentrataAvailabilitySlot {
  productId: string;
  optionId: string;
}

// --- Booking types ---

export interface VentrataContact {
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  emailAddress: string | null;
  phoneNumber: string | null;
  country: string | null;
  notes: string | null;
}

export interface VentrataUnitItem {
  uuid: string;
  unitId: string;
  unit: VentrataUnit | null;
  status: string;
  contact: VentrataContact | null;
  ticket: unknown | null;
  pricing: VentrataPricing | null;
}

export interface VentrataBooking {
  id: string;
  uuid: string;
  testMode: boolean;
  resellerReference: string | null;
  supplierReference: string | null;
  status: string;
  utcCreatedAt: string;
  utcUpdatedAt: string;
  utcExpiresAt: string | null;
  utcConfirmedAt: string | null;
  productId: string;
  product: VentrataProduct | null;
  optionId: string;
  option: VentrataOption | null;
  availabilityId: string;
  localDateTimeStart: string;
  localDateTimeEnd: string;
  cancellable: boolean;
  contact: VentrataContact | null;
  notes: string | null;
  unitItems: VentrataUnitItem[];
  pricing: VentrataPricing | null;
  meetingPoint: string | null;
  meetingPointLatitude: number | null;
  meetingPointLongitude: number | null;
  meetingLocalDateTime: string | null;
  duration: string | null;
  durationAmount: number | null;
  durationUnit: string | null;
}

// --- Order type ---

export interface VentrataOrder {
  id: string;
  orderId: string;
  status: string;
  active: boolean;
  cancellable: boolean;
  confirmable: boolean;
  updatable: boolean;
  testMode: boolean;
  productId: string;
  optionId: string;
  currency: string;
  supplierReference: string | null;
  contact: VentrataContact | null;
  bookings: VentrataBooking[];
  settlementMethod: string | null;
  utcCreatedAt: string;
  utcUpdatedAt: string;
  utcConfirmedAt: string | null;
  utcExpiresAt: string | null;
  pricing: VentrataPricing | null;
}

// Dashboard types (VentrataReseller, VentrataAgent, etc.) not yet implemented.

// --- Error type (per OCTO OpenAPI spec: required fields are error + errorMessage) ---

export interface VentrataError {
  error: string;
  errorMessage: string;
  errorCode?: string;
}
