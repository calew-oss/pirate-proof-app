import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";

const CARRIER_CONFIG: Record<string, { icon: keyof typeof Feather.glyphMap; color: string; label: string; bg: string }> = {
  amazon:  { icon: "shopping-bag", color: "#FF9900", label: "Amazon",  bg: "#FF990020" },
  ups:     { icon: "truck",        color: "#C8873A", label: "UPS",     bg: "#C8873A20" },
  fedex:   { icon: "zap",          color: "#4D148C", label: "FedEx",   bg: "#4D148C20" },
  usps:    { icon: "mail",         color: "#004B87", label: "USPS",    bg: "#004B8720" },
  dhl:     { icon: "package",      color: "#FFCC00", label: "DHL",     bg: "#FFCC0020" },
  other:   { icon: "box",          color: "#7a8899", label: "Other",   bg: "#7a889920" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; pulse?: boolean }> = {
  pending:          { label: "Pending",          color: "#7a8899", bg: "#7a889918" },
  in_transit:       { label: "In Transit",       color: "#3b82f6", bg: "#3b82f618", pulse: true },
  out_for_delivery: { label: "Out for Delivery", color: "#f59e0b", bg: "#f59e0b20", pulse: true },
  delivered:        { label: "Delivered",        color: "#22c55e", bg: "#22c55e18" },
  exception:        { label: "Exception",        color: "#ef4444", bg: "#ef444420" },
  unknown:          { label: "Unknown",          color: "#7a8899", bg: "#7a889918" },
};

const CODE_STATUS_COLOR: Record<string, string> = {
  active:  "#22c55e",
  used:    "#7a8899",
  expired: "#ef4444",
};

interface DeliveryCardProps {
  id: number;
  carrier: string;
  trackingNumber: string;
  description?: string | null;
  status: string;
  estimatedDelivery?: string | null;
  lastLocation?: string | null;
  compact?: boolean;
  index?: number;
  accessCode?: string | null;
  codeStatus?: string | null;
}

function PulsingDot({ color }: { color: string }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.9);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(withTiming(1.5, { duration: 900 }), withTiming(1, { duration: 900 })),
      -1,
    );
    opacity.value = withRepeat(
      withSequence(withTiming(0.3, { duration: 900 }), withTiming(0.9, { duration: 900 })),
      -1,
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={{ width: 10, height: 10, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }, style]} />
    </View>
  );
}

export function DeliveryCard({
  id, carrier, trackingNumber, description, status,
  estimatedDelivery, lastLocation, compact = false, index = 0,
  accessCode, codeStatus,
}: DeliveryCardProps) {
  const colors = useColors();
  const router = useRouter();
  const cfg = CARRIER_CONFIG[carrier] ?? CARRIER_CONFIG.other;
  const st = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown;

  const showCode = !!accessCode && codeStatus === "active";

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify().damping(14)}>
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
            width: compact ? 220 : "100%",
          },
        ]}
        onPress={() => router.push(`/delivery/${id}` as any)}
        activeOpacity={0.75}
      >
        {/* Top accent line keyed to status */}
        <View style={[styles.accentBar, { backgroundColor: st.color }]} />

        <View style={styles.body}>
          {/* Carrier badge */}
          <View style={[styles.carrierBadge, { backgroundColor: cfg.bg, borderRadius: 10 }]}>
            <Feather name={cfg.icon} size={18} color={cfg.color} />
          </View>

          <View style={styles.main}>
            <View style={styles.topRow}>
              <Text style={[styles.carrier, { color: colors.foreground }]}>{cfg.label}</Text>
              <View style={[styles.statusChip, { backgroundColor: st.bg, borderRadius: 20 }]}>
                {st.pulse ? <PulsingDot color={st.color} /> : (
                  <View style={[styles.dot, { backgroundColor: st.color }]} />
                )}
                <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
              </View>
            </View>

            <Text style={[styles.tracking, { color: colors.mutedForeground }]} numberOfLines={1}>
              {trackingNumber}
            </Text>

            {description ? (
              <Text style={[styles.description, { color: colors.mutedForeground }]} numberOfLines={1}>
                {description}
              </Text>
            ) : null}

            {!compact && (estimatedDelivery || lastLocation) ? (
              <View style={styles.metaRow}>
                {lastLocation ? (
                  <View style={styles.metaItem}>
                    <Feather name="map-pin" size={10} color={colors.mutedForeground} />
                    <Text style={[styles.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {lastLocation}
                    </Text>
                  </View>
                ) : null}
                {estimatedDelivery ? (
                  <View style={styles.metaItem}>
                    <Feather name="calendar" size={10} color={colors.mutedForeground} />
                    <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                      ETA {estimatedDelivery}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Smart access code chip */}
            {showCode && !compact ? (
              <View style={styles.codeChipRow}>
                <View style={[styles.codeChip, { backgroundColor: "#22c55e12", borderColor: "#22c55e30" }]}>
                  <Feather name="key" size={9} color="#22c55e" />
                  <Text style={[styles.codeChipText, { color: "#22c55e" }]}>Code {accessCode}</Text>
                </View>
              </View>
            ) : null}

            {/* Expired/used code note */}
            {!showCode && accessCode && (codeStatus === "expired" || codeStatus === "used") && !compact ? (
              <View style={styles.codeChipRow}>
                <View style={[styles.codeChip, { backgroundColor: "#ef444412", borderColor: "#ef444428" }]}>
                  <Feather name="key" size={9} color={CODE_STATUS_COLOR[codeStatus] ?? "#7a8899"} />
                  <Text style={[styles.codeChipText, { color: CODE_STATUS_COLOR[codeStatus] ?? "#7a8899" }]}>
                    Code {codeStatus === "expired" ? "expired" : "used"} — tap to regenerate
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          <Feather name="chevron-right" size={15} color={colors.mutedForeground} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: "hidden",
  },
  accentBar: {
    height: 3,
    width: "100%",
    opacity: 0.8,
  },
  body: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  carrierBadge: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  main: {
    flex: 1,
    gap: 3,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  carrier: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
  tracking: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  description: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 2,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    maxWidth: 120,
  },
  codeChipRow: {
    marginTop: 5,
  },
  codeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  codeChipText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
  },
});
