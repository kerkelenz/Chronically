import * as WebBrowser from "expo-web-browser";
import { Linking } from "react-native";

// In-app browser first: it works even where the external browser is unavailable
// or restricted (an App Review device hit exactly that on our privacy link).
// Falls back to the system browser, and never throws — a dead link should never
// crash or leave a button feeling broken.
export async function openLink(url) {
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    try {
      await Linking.openURL(url);
    } catch {
      /* no-op */
    }
  }
}
