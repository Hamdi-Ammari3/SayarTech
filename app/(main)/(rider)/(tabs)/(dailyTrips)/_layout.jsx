import { Stack } from "expo-router"

const RiderDailyTripsLayout = () => {
  return (
    <Stack>
        <Stack.Screen name="riderDailyTripsMain" options={{headerShown:false}}/>
        <Stack.Screen name="riderCreateNewTrip" options={{headerShown:false}}/>
        <Stack.Screen name="riderTripDetails" options={{headerShown:false}}/> 
    </Stack>
  )
}

export default RiderDailyTripsLayout