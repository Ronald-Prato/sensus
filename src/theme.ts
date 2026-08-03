import type { ColorSchemeName, ImageSourcePropType } from "react-native";

import type { ThemeMode } from "./lib/sensus";

export interface AppPalette {
  ink: string;
  mutedInk: string;
  quietInk: string;
  paper: string;
  paperDeep: string;
  paperRaised: string;
  line: string;
  accent: string;
  accentInk: string;
  danger: string;
  success: string;
  warning: string;
  texture: string;
  textureImage: ImageSourcePropType;
  textureOpacity: number;
  displayFont: string;
}

export const lightPalette: AppPalette = {
  ink: "#1E1B18",
  mutedInk: "#655F57",
  quietInk: "#928B80",
  paper: "#F7F3EC",
  paperDeep: "#EAE3D7",
  paperRaised: "#FBF8F2",
  line: "#B9AF9F",
  accent: "#163F3B",
  accentInk: "#F4F1E9",
  danger: "#A74639",
  success: "#316D54",
  warning: "#966C2D",
  texture: "rgba(74, 61, 43, 0.07)",
  textureImage: require("../assets/paper-light.jpg"),
  textureOpacity: 0.52,
  displayFont: "Iowan Old Style",
};

export const darkPalette: AppPalette = {
  ink: "#F0E9DC",
  mutedInk: "#B8AEA0",
  quietInk: "#887F73",
  paper: "#121A22",
  paperDeep: "#0E141B",
  paperRaised: "#1A2530",
  line: "#46504B",
  accent: "#B5D6C3",
  accentInk: "#17211E",
  danger: "#F09B87",
  success: "#9ED0B1",
  warning: "#E4BE77",
  texture: "rgba(224, 216, 200, 0.055)",
  textureImage: require("../assets/paper-dark.jpg"),
  textureOpacity: 0.48,
  displayFont: "Iowan Old Style",
};

export function getPalette(themeMode: ThemeMode, systemScheme: ColorSchemeName): AppPalette {
  const dark = themeMode === "dark" || (themeMode === "system" && systemScheme === "dark");
  return dark ? darkPalette : lightPalette;
}
