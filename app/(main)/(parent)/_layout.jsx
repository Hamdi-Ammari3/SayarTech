import { Stack } from "expo-router"
import { RiderProvider } from "../../stateManagment/RiderContext"

export default function ParentLayout() {

  return(
    <RiderProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{headerShown:false}}/>
      </Stack>
    </RiderProvider>
  )
}
