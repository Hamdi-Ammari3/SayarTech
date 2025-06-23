import { Stack } from "expo-router"

const DriverDailyTripsLayout = () => {
  return (
    <Stack>
      <Stack.Screen name="driverDailyTripsMain" options={{headerShown:false}}/>
      <Stack.Screen name="driverCreateNewTrip" options={{headerShown:false}}/>
      <Stack.Screen name="driverTripDetails" options={{headerShown:false}}/> 
    </Stack>
  )
}

export default DriverDailyTripsLayout