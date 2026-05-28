import colors from "@/constants/colors";

/**
 * Returns the Pirate Proof dark design tokens.
 * The app uses a fixed dark theme — always returns the dark palette.
 */
export function useColors() {
  return { ...colors.dark, radius: colors.radius };
}
