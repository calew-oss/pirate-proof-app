import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListDeliveriesQueryKey,
  useDeleteDelivery,
  useListDeliveries,
  useSyncDeliveries,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown, Layout } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AddDeliverySheet } from "@/components/AddDeliverySheet";
import { DeliveryCard } from "@/components/DeliveryCard";
import { useColors } from "@/hooks/useColors";

const FILTERS = ["All", "Active", "Delivered", "Exception"] as const;
type Filter = (typeof FILTERS)[number];

const FILTER_STATUS: Record<Filter, string[]> = {
  All: [],
  Active: ["in_transit", "out_for_delivery", "pending"],
  Delivered: ["delivered"],
  Exception: ["exception", "unknown"],
};

export default function DeliveriesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("All");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const { data: deliveries, isLoading, refetch } = useListDeliveries();
  const { mutate: syncAll, isPending: isSyncing } = useSyncDeliveries();
  const { mutate: deleteDelivery } = useDeleteDelivery();

  const filtered = (deliveries ?? []).filter((d) => {
    const matchSearch =
      !search ||
      d.trackingNumber.toLowerCase().includes(search.toLowerCase()) ||
      d.carrier.toLowerCase().includes(search.toLowerCase()) ||
      (d.description ?? "").toLowerCase().includes(search.toLowerCase());
    const statuses = FILTER_STATUS[filter];
    const matchFilter = statuses.length === 0 || statuses.includes(d.status);
    return matchSearch && matchFilter;
  });

  const getCount = (f: Filter) => {
    const statuses = FILTER_STATUS[f];
    if (statuses.length === 0) return (deliveries ?? []).length;
    return (deliveries ?? []).filter((d) => statuses.includes(d.status)).length;
  };

  const handleRefresh = () => {
    syncAll(undefined, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListDeliveriesQueryKey() }),
    });
    refetch();
  };

  const handleDelete = (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    deleteDelivery(
      { id },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getListDeliveriesQueryKey() }) },
    );
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Sticky header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 16,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>Deliveries</Text>
          <View style={styles.headerBtns}>
            {isSyncing ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <TouchableOpacity
                onPress={handleRefresh}
                style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 10 }]}
              >
                <Feather name="refresh-cw" size={15} color={colors.foreground} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowAdd(true);
              }}
              style={[styles.iconBtn, { backgroundColor: colors.primary, borderRadius: 10 }]}
            >
              <Feather name="plus" size={18} color={colors.primaryForeground} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View
          style={[
            styles.searchWrap,
            {
              backgroundColor: colors.input,
              borderRadius: colors.radius,
              borderColor: colors.border,
            },
          ]}
        >
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search carrier or tracking #"
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter chips */}
        <View style={styles.filters}>
          {FILTERS.map((f) => {
            const active = filter === f;
            const count = getCount(f);
            return (
              <TouchableOpacity
                key={f}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                    borderRadius: 20,
                  },
                ]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.filterText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>
                  {f}
                </Text>
                {count > 0 && (
                  <View
                    style={[
                      styles.countBubble,
                      { backgroundColor: active ? `${colors.primaryForeground}30` : colors.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.countText,
                        { color: active ? colors.primaryForeground : colors.mutedForeground },
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 100) },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isSyncing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 50).springify().damping(14)} layout={Layout.springify()}>
              <View style={styles.cardWrap}>
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
                <TouchableOpacity
                  style={[styles.deleteBtn, { backgroundColor: `${colors.destructive}15`, borderRadius: 8 }]}
                  onPress={() => handleDelete(item.id)}
                >
                  <Feather name="trash-2" size={15} color={colors.destructive} />
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <View
              style={[
                styles.empty,
                { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
              ]}
            >
              <View style={[styles.emptyIcon, { backgroundColor: search || filter !== "All" ? `${colors.mutedForeground}12` : `${colors.primary}18`, borderRadius: 20 }]}>
                <Feather name="inbox" size={30} color={search || filter !== "All" ? colors.mutedForeground : colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {search ? "No results" : filter !== "All" ? `No ${filter.toLowerCase()} packages` : "No deliveries yet"}
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {search
                  ? "Try a different search term"
                  : filter !== "All"
                  ? "Change filter to see other packages"
                  : "Add a tracking number — codes generate automatically when your package is out for delivery"}
              </Text>
              {!search && filter === "All" && (
                <TouchableOpacity
                  style={[styles.emptyBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowAdd(true);
                  }}
                >
                  <Feather name="plus" size={14} color={colors.primaryForeground} />
                  <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>Add Tracking Number</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      <AddDeliverySheet visible={showAdd} onClose={() => setShowAdd(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 18, paddingBottom: 14, gap: 12, borderBottomWidth: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  headerBtns: { flexDirection: "row", gap: 8 },
  iconBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  filters: { flexDirection: "row", gap: 8 },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
  },
  filterText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  countBubble: { borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1 },
  countText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  list: { padding: 16, gap: 0 },
  cardWrap: { gap: 4 },
  deleteBtn: { alignSelf: "flex-end", padding: 8 },
  empty: { alignItems: "center", gap: 10, padding: 48, borderWidth: 1, marginTop: 24 },
  emptyIcon: { width: 60, height: 60, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", maxWidth: 280, lineHeight: 19 },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 20, paddingVertical: 12, marginTop: 4 },
  emptyBtnText: { fontSize: 14, fontFamily: "Inter_700Bold" },
});
