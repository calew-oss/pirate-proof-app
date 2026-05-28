import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetLockStatusQueryKey,
  getListDeliveriesQueryKey,
  getListNotificationsQueryKey,
  useGetLockStatus,
  useListDeliveries,
  useListNotifications,
  useSetDeliveryMode,
  useSyncDeliveries,
  useToggleLock,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AddDeliverySheet } from "@/components/AddDeliverySheet";
import { DeliveryCard } from "@/components/DeliveryCard";
import { StatCard } from "@/components/StatCard";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const { data: deliveries, isLoading: loadingDeliveries, refetch: refetchDeliveries } = useListDeliveries();
  const { data: lockStatus, isLoading: loadingLock } = useGetLockStatus();
  const { data: notifications } = useListNotifications();
  const { mutate: syncAll, isPending: isSyncing } = useSyncDeliveries();
  const { mutate: toggleLock, isPending: togglingLock } = useToggleLock();
  const { mutate: setDeliveryMode } = useSetDeliveryMode();

  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;
  const activeDeliveries = (deliveries ?? []).filter((d) =>
    ["in_transit", "out_for_delivery", "pending"].includes(d.status),
  );
  const deliveredCount = (deliveries ?? []).filter((d) => d.status === "delivered").length;
  const outForDelivery = (deliveries ?? []).filter((d) => d.status === "out_for_delivery");

  const handleRefresh = () => {
    syncAll(undefined, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListDeliveriesQueryKey() });
        qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
      },
    });
    refetchDeliveries();
  };

  const handleToggleLock = () => {
    if (!lockStatus) return;
    const action = lockStatus.isLocked ? "unlock" : "lock";
    Haptics.impactAsync(
      action === "unlock" ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium,
    );
    toggleLock(
      { data: { action } },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getGetLockStatusQueryKey() }) },
    );
  };

  const handleToggleDeliveryMode = () => {
    if (!lockStatus) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDeliveryMode(
      { data: { enabled: !lockStatus.deliveryModeEnabled } },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getGetLockStatusQueryKey() }) },
    );
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const isUnlocked = lockStatus && !lockStatus.isLocked;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: topPad + 16, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 100) },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isSyncing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{getGreeting()},</Text>
            <Text style={[styles.userName, { color: colors.foreground }]}>
              {user?.name?.split(" ")[0] ?? "Captain"}
            </Text>
          </View>
          <View style={styles.headerActions}>
            {isSyncing && <ActivityIndicator color={colors.primary} size="small" />}
            <TouchableOpacity
              style={[styles.notifBtn, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 20 }]}
              onPress={() => {}}
            >
              <Feather name="bell" size={17} color={colors.foreground} />
              {unreadCount > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Lock widget */}
        {!loadingLock && lockStatus ? (
          <Animated.View entering={FadeInDown.delay(80).springify().damping(14)}>
            <View
              style={[
                styles.lockHero,
                {
                  backgroundColor: isUnlocked ? `${colors.warning}12` : colors.card,
                  borderColor: isUnlocked ? colors.warning : colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            >
              {/* Left: icon + status */}
              <TouchableOpacity
                style={styles.lockLeft}
                onPress={handleToggleLock}
                disabled={togglingLock}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.lockIcon,
                    {
                      backgroundColor: isUnlocked ? `${colors.warning}30` : `${colors.success}20`,
                      borderRadius: 16,
                    },
                  ]}
                >
                  {togglingLock ? (
                    <ActivityIndicator color={isUnlocked ? colors.warning : colors.success} size="small" />
                  ) : (
                    <Feather
                      name={isUnlocked ? "unlock" : "lock"}
                      size={26}
                      color={isUnlocked ? colors.warning : colors.success}
                    />
                  )}
                </View>
                <View>
                  <Text style={[styles.lockState, { color: colors.foreground }]}>
                    {isUnlocked ? "Unlocked" : "Secured"}
                  </Text>
                  <Text style={[styles.lockSub, { color: colors.mutedForeground }]}>
                    {isUnlocked ? "Tap to lock" : "Tap to unlock"}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Right: stats */}
              <View style={styles.lockRight}>
                <View style={styles.lockStat}>
                  <Feather
                    name="battery"
                    size={12}
                    color={lockStatus.batteryLevel > 20 ? colors.success : colors.destructive}
                  />
                  <Text style={[styles.lockStatText, { color: colors.mutedForeground }]}>
                    {lockStatus.batteryLevel}%
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.delivModeBtn,
                    {
                      backgroundColor: lockStatus.deliveryModeEnabled ? `${colors.info}25` : colors.muted,
                      borderRadius: 8,
                    },
                  ]}
                  onPress={handleToggleDeliveryMode}
                  activeOpacity={0.8}
                >
                  <Feather
                    name="truck"
                    size={12}
                    color={lockStatus.deliveryModeEnabled ? colors.info : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.delivModeText,
                      { color: lockStatus.deliveryModeEnabled ? colors.info : colors.mutedForeground },
                    ]}
                  >
                    {lockStatus.deliveryModeEnabled ? "Auto" : "Manual"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        ) : null}

        {/* Stats row */}
        <Animated.View entering={FadeInDown.delay(160).duration(400)} style={styles.statsRow}>
          <StatCard
            label="Active"
            value={activeDeliveries.length}
            icon="package"
            iconColor={colors.info}
            sub={outForDelivery.length > 0 ? `${outForDelivery.length} OFD` : undefined}
            delay={200}
          />
          <StatCard
            label="Delivered"
            value={deliveredCount}
            icon="check-circle"
            iconColor={colors.success}
            delay={300}
          />
        </Animated.View>

        {/* Out for delivery banner */}
        {outForDelivery.length > 0 && (
          <Animated.View entering={FadeInDown.delay(220).duration(350)}>
            <View
              style={[
                styles.alertBanner,
                { backgroundColor: `${colors.warning}15`, borderColor: colors.warning, borderRadius: colors.radius },
              ]}
            >
              <View style={[styles.alertIcon, { backgroundColor: `${colors.warning}25`, borderRadius: 8 }]}>
                <Feather name="truck" size={14} color={colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.alertTitle, { color: colors.warning }]}>Out for Delivery</Text>
                <Text style={[styles.alertBody, { color: colors.mutedForeground }]}>
                  {outForDelivery.length} package{outForDelivery.length > 1 ? "s are" : " is"} arriving today
                  {lockStatus?.deliveryModeEnabled ? " — box will auto-unlock" : ""}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Recent packages */}
        <View style={styles.section}>
          <Animated.View entering={FadeInUp.delay(280).duration(350)} style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Packages</Text>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowAdd(true);
              }}
            >
              <Feather name="plus" size={13} color={colors.primaryForeground} />
              <Text style={[styles.addBtnText, { color: colors.primaryForeground }]}>Track</Text>
            </TouchableOpacity>
          </Animated.View>

          {loadingDeliveries ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
          ) : (deliveries ?? []).length === 0 ? (
            <Animated.View entering={FadeInDown.delay(320).duration(400)}>
              <View
                style={[
                  styles.empty,
                  { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
                ]}
              >
                <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}18`, borderRadius: 24 }]}>
                  <Feather name="package" size={28} color={colors.primary} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No packages yet</Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  Add a tracking number and your box will auto-unlock when it arrives
                </Text>
                <TouchableOpacity
                  style={[styles.emptyBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowAdd(true);
                  }}
                >
                  <Feather name="plus" size={14} color={colors.primaryForeground} />
                  <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>Track Your First Package</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          ) : (
            <FlatList
              data={(deliveries ?? []).slice(0, 5)}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
              renderItem={({ item, index }) => (
                <DeliveryCard
                  id={item.id}
                  carrier={item.carrier}
                  trackingNumber={item.trackingNumber}
                  description={item.description}
                  status={item.status}
                  estimatedDelivery={item.estimatedDelivery}
                  lastLocation={item.lastLocation}
                  accessCode={item.accessCode}
                  codeStatus={item.codeStatus}
                  index={index}
                />
              )}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            />
          )}
        </View>
      </ScrollView>

      <AddDeliverySheet visible={showAdd} onClose={() => setShowAdd(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 18, gap: 18 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  greeting: { fontSize: 13, fontFamily: "Inter_400Regular" },
  userName: { fontSize: 26, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  notifBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  badge: {
    position: "absolute", top: -2, right: -2,
    minWidth: 16, height: 16, borderRadius: 8,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 3,
  },
  badgeText: { color: "#0d1117", fontSize: 9, fontFamily: "Inter_700Bold" },
  lockHero: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
    borderWidth: 1,
    gap: 12,
  },
  lockLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  lockIcon: { width: 54, height: 54, alignItems: "center", justifyContent: "center" },
  lockState: { fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  lockSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  lockRight: { alignItems: "flex-end", gap: 8 },
  lockStat: { flexDirection: "row", alignItems: "center", gap: 5 },
  lockStatText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  delivModeBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 5 },
  delivModeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  statsRow: { flexDirection: "row", gap: 12 },
  section: { gap: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  alertBanner: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: 1 },
  alertIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  alertTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  alertBody: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  empty: { alignItems: "center", gap: 10, padding: 36, borderWidth: 1 },
  emptyIcon: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", maxWidth: 260, lineHeight: 19 },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 20, paddingVertical: 12, marginTop: 4 },
  emptyBtnText: { fontSize: 14, fontFamily: "Inter_700Bold" },
});
