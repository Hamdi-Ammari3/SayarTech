import { ClerkProvider, ClerkLoaded } from '@clerk/clerk-expo'
import { Stack } from "expo-router"
import {useFonts,Cairo_400Regular,Cairo_700Bold} from '@expo-google-fonts/cairo'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from "react"
import * as SecureStore from 'expo-secure-store'

SplashScreen.preventAutoHideAsync()


const publishableKey = 'pk_test_Zmlyc3QtbWFjYXctOTcuY2xlcmsuYWNjb3VudHMuZGV2JA'

if (!publishableKey) {
  throw new Error(
    'Missing Publishable Key. Please set EXPO_KEY in your .env',
  )
}

const tokenCache = {
  async getToken(key) {
    try {
      const item = await SecureStore.getItemAsync(key)
      if (item) {
        console.log(`${key} was used 🔐 \n`)
      } else {
        console.log('No values stored under key: ' + key)
      }
      return item
    } catch (error) {
      console.error('SecureStore get item error: ', error)
      await SecureStore.deleteItemAsync(key)
      return null
    }
  },
  async saveToken(key, value) {
    try {
      return SecureStore.setItemAsync(key, value)
    } catch (err) {
      return
    }
  },
}


export default function RootLayout() {


  const [loaded,error] = useFonts({
    Cairo_400Regular,Cairo_700Bold
  })

  useEffect(() => { 
    if(loaded || error) {
      SplashScreen.hideAsync();
    }
  },[loaded,error])

  if (!loaded && !error) {
    return null;
  }


  return(
    <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
      <ClerkLoaded>
        <Stack>
            <Stack.Screen name="index" options={{headerShown:false}}/>
            <Stack.Screen name="(auth)" options={{headerShown:false}}/>
            <Stack.Screen name="(main)" options={{headerShown:false}}/>
          </Stack>
      </ClerkLoaded>
    </ClerkProvider> 
  )
}
