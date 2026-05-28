import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  pending: { label: "Pending", bg: "#252d3d", text: "#7a8899" },
  in_transit: { label: "In Transit", bg: "#1a2f4a", text: "#3b82f6" },
  out_for_delivery: { label: "Out for Delivery", bg: "#2d2a14", text: "#f59e0b" },
  delivered: { label: "Delivered", bg: "#142a1f", text: "#22c55e" },
  exception: { label: "Exception", bg: "#2a1515", text: "#ef4444" },
  unknown: { label: "Unknown", bg: "#252d3d", text: "#7a8899" },
};

export function StatusBadge({ status }: { status: string }) {
  const colors = useColors();
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown;
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg, borderRadius: colors.radius / 2 }]}>
      <View style={[styles.dot, { backgroundColor: cfg.text }]} />
      <Text style={[styles.label, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
  },
});
