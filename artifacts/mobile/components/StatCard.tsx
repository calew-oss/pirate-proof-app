import { Feather } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";

interface StatCardProps {
  label: string;
  value: number;
  icon: keyof typeof Feather.glyphMap;
  iconColor?: string;
  sub?: string;
  delay?: number;
}

const AnimatedText = Animated.createAnimatedComponent(Text);

export function StatCard({ label, value, icon, iconColor, sub, delay = 0 }: StatCardProps) {
  const colors = useColors();
  const color = iconColor ?? colors.primary;
  const displayed = useSharedValue(0);

  useEffect(() => {
    displayed.value = withDelay(delay, withTiming(value, { duration: 800 }));
  }, [value]);

  const animatedProps = useAnimatedProps(() => ({
    text: String(Math.round(displayed.value)),
  } as any));

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <View style={[styles.topRow]}>
        <View style={[styles.iconWrap, { backgroundColor: `${color}20`, borderRadius: 10 }]}>
          <Feather name={icon} size={16} color={color} />
        </View>
        {sub ? (
          <View style={[styles.subChip, { backgroundColor: `${color}18`, borderRadius: 20 }]}>
            <Text style={[styles.subText, { color }]}>{sub}</Text>
          </View>
        ) : null}
      </View>
      <AnimatedText
        style={[styles.value, { color: colors.foreground }]}
        animatedProps={animatedProps}
      >
        {value.toString()}
      </AnimatedText>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 16,
    borderWidth: 1,
    gap: 8,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  iconWrap: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  subChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  subText: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
});
