import AsyncStorage from "@react-native-async-storage/async-storage";

// Screens remember preferences (the calendar's Week/Month mode, collapsed
// cards) and the storage mock keeps them for the whole file. Without this, one
// test switching to Month leaves the next one starting in Month.
afterEach(async () => {
  await AsyncStorage.clear();
});
