import { getMockTrackingStatus } from "./mockTracking";

export interface TrackingResult {
  status: string;
  lastLocation: string | null;
  estimatedDelivery: string | null;
  events: Array<{ message: string; datetime: string; location: string }>;
}

const EASYPOST_STATUS_MAP: Record<string, string> = {
  pre_transit: "pending",
  in_transit: "in_transit",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
  available_for_pickup: "out_for_delivery",
  return_to_sender: "exception",
  failure: "exception",
  error: "exception",
  unknown: "unknown",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export async function getTrackingStatus(
  carrier: string,
  trackingNumber: string,
): Promise<TrackingResult> {
  const apiKey = process.env.EASYPOST_API_KEY;

  if (apiKey) {
    try {
      const credentials = Buffer.from(`${apiKey}:`).toString("base64");
      const res = await fetch("https://api.easypost.com/v2/trackers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${credentials}`,
        },
        body: JSON.stringify({
          tracker: { tracking_code: trackingNumber, carrier: carrier.toUpperCase() },
        }),
      });

      if (res.ok) {
        const data = await res.json() as any;
        const details: any[] = data.tracking_details ?? [];
        const latest = details[details.length - 1];
        const loc = latest?.tracking_location;

        return {
          status: EASYPOST_STATUS_MAP[data.status ?? "unknown"] ?? "unknown",
          lastLocation: loc?.city ? `${loc.city}, ${loc.state}` : null,
          estimatedDelivery: data.est_delivery_date ? formatDate(data.est_delivery_date) : null,
          events: details
            .slice(-10)
            .reverse()
            .map((d) => ({
              message: d.message ?? "",
              datetime: d.datetime ?? "",
              location: d.tracking_location?.city
                ? `${d.tracking_location.city}, ${d.tracking_location.state}`
                : "In Transit",
            })),
        };
      }
    } catch {
      // fall through to mock
    }
  }

  // Mock fallback — mirrors EasyPost structure
  const mock = getMockTrackingStatus(carrier, trackingNumber);
  return {
    status: mock.status,
    lastLocation: mock.lastLocation,
    estimatedDelivery: mock.estimatedDelivery,
    events: [
      {
        message: mock.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        datetime: new Date().toISOString(),
        location: mock.lastLocation ?? "In Transit",
      },
    ],
  };
}
