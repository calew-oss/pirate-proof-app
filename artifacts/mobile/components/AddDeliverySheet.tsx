import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateDelivery,
  getListDeliveriesQueryKey,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const CARRIERS = [
  { value: "amazon", label: "Amazon" },
  { value: "ups", label: "UPS" },
  { value: "fedex", label: "FedEx" },
  { value: "usps", label: "USPS" },
  { value: "dhl", label: "DHL" },
  { value: "other", label: "Other" },
] as const;

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function AddDeliverySheet({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { mutate, isPending } = useCreateDelivery();

  const [carrier, setCarrier] = useState<string>("ups");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!trackingNumber.trim()) {
      setError("Tracking number is required");
      return;
    }
    setError("");
    mutate(
      { data: { carrier: carrier as any, trackingNumber: trackingNumber.trim(), description: description.trim() || undefined } },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          qc.invalidateQueries({ queryKey: getListDeliveriesQueryKey() });
          setTrackingNumber("");
          setDescription("");
          setCarrier("ups");
          onClose();
        },
        onError: () => {
          setError("Failed to add tracking. Please try again.");
        },
      },
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <Pressable style={styles.overlay} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.card,
            paddingBottom: insets.bottom + 16,
            borderTopLeftRadius: colors.radius * 2,
            borderTopRightRadius: colors.radius * 2,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>Track a Package</Text>
          <TouchableOpacity onPress={onClose}>
            <Feather name="x" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Carrier</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.carrierList}>
            {CARRIERS.map((c) => (
              <TouchableOpacity
                key={c.value}
                style={[
                  styles.carrierChip,
                  {
                    backgroundColor: carrier === c.value ? colors.primary : colors.secondary,
                    borderRadius: colors.radius,
                  },
                ]}
                onPress={() => setCarrier(c.value)}
              >
                <Text
                  style={[
                    styles.carrierChipText,
                    { color: carrier === c.value ? colors.primaryForeground : colors.mutedForeground },
                  ]}
                >
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.label, { color: colors.mutedForeground }]}>Tracking Number</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.input,
                color: colors.foreground,
                borderColor: error ? colors.destructive : colors.border,
                borderRadius: colors.radius,
              },
            ]}
            placeholder="Enter tracking number"
            placeholderTextColor={colors.mutedForeground}
            value={trackingNumber}
            onChangeText={setTrackingNumber}
            autoCapitalize="characters"
          />
          {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}

          <Text style={[styles.label, { color: colors.mutedForeground }]}>Description (optional)</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.input,
                color: colors.foreground,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
            placeholder="e.g. Birthday gift, Work equipment"
            placeholderTextColor={colors.mutedForeground}
            value={description}
            onChangeText={setDescription}
          />

          <TouchableOpacity
            style={[
              styles.submitBtn,
              {
                backgroundColor: isPending ? colors.secondary : colors.primary,
                borderRadius: colors.radius,
              },
            ]}
            onPress={handleSubmit}
            disabled={isPending}
            activeOpacity={0.8}
          >
            {isPending ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.submitText, { color: colors.primaryForeground }]}>
                Add Package
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 16,
  },
  carrierList: {
    marginBottom: 4,
  },
  carrierChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  carrierChipText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  input: {
    height: 48,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
  },
  error: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  submitBtn: {
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    marginBottom: 8,
  },
  submitText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
});
