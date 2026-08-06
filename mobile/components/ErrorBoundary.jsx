import { Component } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import * as Sentry from "@sentry/react-native";
import ScreenBackground from "./ScreenBackground";

// App-wide safety net. If a render throws anywhere below it, we show a calm
// branded screen instead of a crash, and report the error to Sentry (a no-op
// without a DSN). Class component because only class components can be error
// boundaries in React.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    try {
      Sentry.captureException(error);
    } catch {
      // Sentry unavailable — never let reporting break the fallback
    }
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <ScreenBackground style={styles.screen}>
        <View style={styles.card}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>
            The app hit an unexpected error — trying again usually fixes it.
          </Text>
          <Pressable style={styles.button} onPress={this.reset}>
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      </ScreenBackground>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  title: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 24,
    color: "white",
    textAlign: "center",
  },
  body: {
    fontFamily: "Lato_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 22,
  },
  button: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: "center",
    marginTop: 22,
  },
  buttonText: {
    fontFamily: "Lato_700Bold",
    fontSize: 16,
    color: "#7C6BAE",
    letterSpacing: 0.5,
  },
});

export default ErrorBoundary;
