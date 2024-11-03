import { Stack } from "expo-router"
import { StudentProvider } from "../../stateManagment/StudentState"


export default function StudentLayout() {

  return(
    <StudentProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{headerShown:false}}/>
      </Stack>
    </StudentProvider>
  )
}
