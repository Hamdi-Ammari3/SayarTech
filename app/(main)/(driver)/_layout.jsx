import { Stack } from "expo-router";
import { DriverProvider } from "../../stateManagment/DriverContext";

export default function DriverLayout() {

  return(
    <DriverProvider>
    <Stack>
      <Stack.Screen name="(tabs)" options={{headerShown:false}}/>
    </Stack>
    </DriverProvider>
  )
}
