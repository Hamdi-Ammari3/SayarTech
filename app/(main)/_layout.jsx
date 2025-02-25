import { Stack } from "expo-router";


export default function MainLayout() {

  return(
    <Stack>
      <Stack.Screen name="(driver)" options={{headerShown:false}}/>
      <Stack.Screen name="(parent)" options={{headerShown:false}}/>
      <Stack.Screen name="(student)" options={{headerShown:false}}/>
      <Stack.Screen name="(employee)" options={{headerShown:false}}/>
    </Stack>
  )
}