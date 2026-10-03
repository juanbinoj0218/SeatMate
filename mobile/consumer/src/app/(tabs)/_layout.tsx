import { Tabs } from "expo-router/js-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CompassIcon, HeartIcon, SearchIcon, UserIcon } from "@/components/icons";
import { colors } from "@/components/ui";
import { useAccount } from "@/lib/account";

export default function TabsLayout() {
  const { favorites } = useAccount();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: { fontSize: 11, lineHeight: 14, fontWeight: "800" },
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: colors.border,
          height: 66 + insets.bottom,
          paddingTop: 4,
          paddingBottom: insets.bottom + 4,
        },
        sceneStyle: { backgroundColor: colors.page },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Explore",
          tabBarIcon: ({ color, focused }) => <CompassIcon color={color as string} strokeWidth={focused ? 2.5 : 1.9} size={25} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color, focused }) => <SearchIcon color={color as string} strokeWidth={focused ? 2.5 : 1.9} size={24} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: "Saved",
          tabBarIcon: ({ color, focused }) => <HeartIcon color={color as string} filled={focused} size={25} />,
          tabBarBadge: favorites.length > 0 ? favorites.length : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.greenBright, color: colors.ink, fontSize: 11, fontWeight: "800" },
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color, focused }) => <UserIcon color={color as string} strokeWidth={focused ? 2.5 : 1.9} size={25} />,
        }}
      />
    </Tabs>
  );
}
