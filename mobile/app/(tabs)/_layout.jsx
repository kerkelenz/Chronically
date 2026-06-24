import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

function TabIcon({ name, color, size }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#7C6BAE",
        tabBarInactiveTintColor: "rgba(124,107,174,0.45)",
        tabBarStyle: {
          backgroundColor: "rgba(255,255,255,0.92)",
          borderTopWidth: 1,
          borderTopColor: "rgba(124,107,174,0.15)",
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontFamily: "Lato_400Regular",
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name={focused ? "home" : "home-outline"}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="trends"
        options={{
          title: "Trends",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name={focused ? "trending-up" : "trending-up-outline"}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="medications"
        options={{
          title: "Meds",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name={focused ? "medical" : "medical-outline"}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: "Appts",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name={focused ? "calendar" : "calendar-outline"}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name={focused ? "person" : "person-outline"}
              color={color}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}
