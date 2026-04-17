// Allowlist-based sanitizers for booking and order responses.
//
// Scope: top-level envelope only. Only fields listed in the returned
// object are surfaced to the MCP caller; any NEW top-level field the
// Ventrata API starts returning will be dropped automatically.
//
// Nested objects (product, option, unit, pricing, and elements passed
// through inside those) are passed through verbatim — they are
// structural/catalog data today, not PII-bearing. If Ventrata ever
// starts embedding PII inside one of these sub-objects, add a dedicated
// allowlist for that object here.

interface UnknownBooking {
  [key: string]: unknown;
  unitItems?: UnknownUnitItem[] | null;
}

interface UnknownUnitItem {
  [key: string]: unknown;
}

interface UnknownOrder {
  [key: string]: unknown;
  bookings?: UnknownBooking[] | null;
}

export function sanitizeUnitItem(item: UnknownUnitItem): Record<string, unknown> {
  return {
    uuid: item.uuid ?? null,
    unitId: item.unitId ?? null,
    unit: item.unit ?? null,
    status: item.status ?? null,
    pricing: item.pricing ?? null,
  };
}

export function sanitizeBooking(b: UnknownBooking): Record<string, unknown> {
  return {
    id: b.id ?? null,
    uuid: b.uuid ?? null,
    testMode: b.testMode ?? null,
    resellerReference: b.resellerReference ?? null,
    supplierReference: b.supplierReference ?? null,
    status: b.status ?? null,
    utcCreatedAt: b.utcCreatedAt ?? null,
    utcUpdatedAt: b.utcUpdatedAt ?? null,
    utcExpiresAt: b.utcExpiresAt ?? null,
    utcConfirmedAt: b.utcConfirmedAt ?? null,
    productId: b.productId ?? null,
    product: b.product ?? null,
    optionId: b.optionId ?? null,
    option: b.option ?? null,
    availabilityId: b.availabilityId ?? null,
    localDateTimeStart: b.localDateTimeStart ?? null,
    localDateTimeEnd: b.localDateTimeEnd ?? null,
    cancellable: b.cancellable ?? null,
    unitItems: Array.isArray(b.unitItems) ? b.unitItems.map(sanitizeUnitItem) : [],
    pricing: b.pricing ?? null,
    meetingPoint: b.meetingPoint ?? null,
    meetingPointLatitude: b.meetingPointLatitude ?? null,
    meetingPointLongitude: b.meetingPointLongitude ?? null,
    meetingLocalDateTime: b.meetingLocalDateTime ?? null,
    duration: b.duration ?? null,
    durationAmount: b.durationAmount ?? null,
    durationUnit: b.durationUnit ?? null,
  };
}

export function sanitizeOrder(o: UnknownOrder): Record<string, unknown> {
  return {
    id: o.id ?? null,
    orderId: o.orderId ?? null,
    status: o.status ?? null,
    active: o.active ?? null,
    cancellable: o.cancellable ?? null,
    confirmable: o.confirmable ?? null,
    updatable: o.updatable ?? null,
    testMode: o.testMode ?? null,
    productId: o.productId ?? null,
    optionId: o.optionId ?? null,
    currency: o.currency ?? null,
    supplierReference: o.supplierReference ?? null,
    settlementMethod: o.settlementMethod ?? null,
    utcCreatedAt: o.utcCreatedAt ?? null,
    utcUpdatedAt: o.utcUpdatedAt ?? null,
    utcConfirmedAt: o.utcConfirmedAt ?? null,
    utcExpiresAt: o.utcExpiresAt ?? null,
    pricing: o.pricing ?? null,
    bookings: Array.isArray(o.bookings) ? o.bookings.map(sanitizeBooking) : [],
  };
}
