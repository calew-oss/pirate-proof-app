const MOCK_LOCATIONS: Record<string, string[]> = {
  ups: [
    "Louisville, KY — UPS Hub",
    "Chicago, IL — Distribution Center",
    "Denver, CO — Sorting Facility",
    "Phoenix, AZ — Local Post Office",
    "Out for Delivery",
  ],
  fedex: [
    "Memphis, TN — FedEx World Hub",
    "Dallas, TX — Regional Hub",
    "Albuquerque, NM — Station",
    "Your City, CA — Delivery Station",
    "Out for Delivery",
  ],
  usps: [
    "National Distribution Center",
    "Regional Facility",
    "Local Post Office",
    "Out for Delivery",
  ],
  amazon: [
    "Amazon Fulfillment Center",
    "Amazon Regional Hub",
    "Amazon Delivery Station",
    "Out for Delivery",
  ],
  dhl: [
    "DHL Gateway — Cincinnati, OH",
    "DHL Service Point",
    "Out for Delivery",
  ],
  other: ["Carrier Hub", "Regional Facility", "Out for Delivery"],
};

const STATUSES = [
  "in_transit",
  "in_transit",
  "in_transit",
  "out_for_delivery",
  "delivered",
] as const;

export function getMockTrackingStatus(carrier: string, trackingNumber: string) {
  const hash = trackingNumber
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const locations = MOCK_LOCATIONS[carrier] ?? MOCK_LOCATIONS.other;
  const statusIndex = hash % STATUSES.length;
  const status = STATUSES[statusIndex];
  const locationIndex = hash % locations.length;
  const lastLocation = locations[locationIndex];

  const daysOffset = (hash % 7) - 2;
  const eta = new Date();
  eta.setDate(eta.getDate() + daysOffset);
  const estimatedDelivery =
    status === "delivered"
      ? new Date(Date.now() - 86400000 * (hash % 3)).toISOString().split("T")[0]
      : eta.toISOString().split("T")[0];

  return { status, lastLocation, estimatedDelivery };
}
