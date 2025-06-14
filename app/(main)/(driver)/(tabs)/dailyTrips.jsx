import { useState,useEffect } from 'react'
import { StyleSheet,Text,View,ActivityIndicator,Image,TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { doc,onSnapshot,updateDoc } from "firebase/firestore"
import { DB } from '../../../../firebaseConfig'
import { useDriverData } from '../../../stateManagment/DriverContext'
import { useUser } from '@clerk/clerk-expo'
import LottieView from "lottie-react-native"
import colors from '../../../../constants/Colors'
import logo from '../../../../assets/images/logo.jpg'
import addDataAnimation from '../../../../assets/animations/adding_data.json'
import driverWaiting from '../../../../assets/animations/waiting_driver.json'

const dailyTrips = () => {
  const {userData,fetchingUserDataLoading,driverData,fetchingDriverDataLoading} = useDriverData()
  const { isLoaded } = useUser()
  const router = useRouter()

  const [activeTripData, setActiveTripData] = useState(null)
  const [loadingTrip, setLoadingTrip] = useState(false)
  const [startingTrip, setStartingTrip] = useState(false)

  //Redirect to add data screen
  const redirectToAddDataPage = () => {
    router.push({
      pathname:"/addDriverData",
      params: {
        driverName: userData.user_full_name,
        driverFamily:userData.user_family_name,
        driverUserId:userData.user_id,
        driverPhone:userData.phone_number,
        driverNotification:userData.user_notification_token,
      }
    })
  }

  //Fetch driver active trip
  useEffect(() => {
    if (driverData[0]?.activeTripId) {
      setLoadingTrip(true)
    
      const tripRef = doc(DB, 'activeTrips', driverData[0].activeTripId)
      const unsubscribe = onSnapshot(tripRef, (docSnap) => {
        if (docSnap.exists()) {
          setActiveTripData({ id: docSnap.id, ...docSnap.data() })
        } else {
          console.log('No active trip data found!')
          setActiveTripData(null)
        }
        setLoadingTrip(false)
      }, (error) => {
        console.log('Error listening to active trip:', error)
        setLoadingTrip(false)
      })
      return () => unsubscribe()
    }
  }, [driverData[0]?.activeTripId])

  // Start the trip
  const handleStartTrip = async () => {
    if (!activeTripData || activeTripData?.started || startingTrip) return    
    setStartingTrip(true)
    try {
      const tripRef = doc(DB, 'activeTrips', activeTripData.id)
      await updateDoc(tripRef, { started: true })
    } catch (error) {
      console.log('Error starting trip:', error)
    } finally {
      setStartingTrip(false)
    }
  }

  //Loading State
  if( !isLoaded || fetchingDriverDataLoading || fetchingUserDataLoading || loadingTrip) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.spinner_error_container}>
          <ActivityIndicator size="large" color={colors.PRIMARY} />
        </View>
      </SafeAreaView>
    )
  }

  // if the driver haven't yet added his info
  if(!driverData?.length) {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.add_your_data_container}>
          <View style={styles.logo}>
            <Image source={logo} style={styles.logo_image}/>
          </View>
          <View style={styles.animation_container}>
            <LottieView
              source={addDataAnimation}
              autoPlay
              loop
              style={{ width: 200, height: 200}}
            />
          </View>
          <View style={styles.add_your_data_text_container}>
            <Text style={styles.add_your_data_text}>الرجاء اضافة بياناتك</Text>
            <TouchableOpacity style={styles.link_container} onPress={redirectToAddDataPage}>
              <Text style={styles.link_text}>اضف الآن</Text>
            </TouchableOpacity>
          </View>
        </View>        
      </SafeAreaView>
    )
  }

  return(
    <SafeAreaView style={styles.container}>
      <View style={styles.add_your_data_container}>
        <View style={styles.logo}>
          <Image source={logo} style={styles.logo_image}/>
        </View>
        <View style={styles.animation_container}>
          <LottieView
            source={driverWaiting}
            autoPlay
            loop
            style={{ width: 250, height: 250}}
          />
        </View>
        <View>
          <Text style={styles.service_unavailable_text}>هذه الخدمة غير متوفرة في الوقت الحالي</Text>
        </View>
      </View>  
    </SafeAreaView>
  )

  /*
  const isCarFull = activeTripData?.seats_booked >= activeTripData?.seats_capacity

  if (driverData[0]?.activeTripId) {
    if (activeTripData?.started) {
      return (
        <SafeAreaView style={styles.container}>
          <DriverTripMap tripData={activeTripData}/>
        </SafeAreaView>
      )
    } else {
      return (
        <SafeAreaView style={styles.container}>
            <View style={styles.logo}>
              <Image source={logo} style={styles.logo_image}/>
            </View>
            <View style={styles.tripStatusSectionBox}>
              <View>
                <Text style={styles.tripStatusSectionText}>عدد الركاب: {activeTripData?.seats_booked} / {activeTripData?.seats_capacity}</Text>
              </View>
              <View style={styles.driverCarInfoImageBox}>
                <Image 
                  source={{uri:driverData[0]?.driver_car_image}} 
                  style={styles.driverCarInfoImage}
                />
              </View>
              <View>
                <TouchableOpacity 
                  style={[
                    styles.search_trip_btn, 
                    { backgroundColor: isCarFull ? colors.BLUE : '#ccc' }
                  ]}
                  onPress={handleStartTrip}
                  disabled={!isCarFull || startingTrip}
                >
                  <Text style={styles.search_trip_btn_text}>
                    {startingTrip ? '...جاري بدء الرحلة' : 'ابدأ الرحلة'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
        </SafeAreaView>
      )
    }
  } else {
    return(
      <SafeAreaView style={styles.container}>
        <InactiveTripData/>
      </SafeAreaView>
    )
  }
    */
}

export default dailyTrips

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.WHITE,
  },
  add_your_data_container:{
    width:'100%',
    alignItems:'center',
    justifyContent:'center',
  },
  animation_container:{
    width:200,
    height:200,
    justifyContent:'center',
    alignItems:'center',
    marginTop:25,
  },
  add_your_data_text_container:{
    width:'100%',
    height:100,
    justifyContent:'center',
    alignItems:'center',
  },
  add_your_data_text:{
    fontFamily: 'Cairo_400Regular',
    lineHeight:50
  },
  service_unavailable_container:{
    width:'100%',
    height:200,
    justifyContent:'center',
    alignItems:'center',
  },
  service_unavailable_text:{
    width:300,
    lineHeight:40,
    borderRadius:15,
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    backgroundColor:colors.GRAY
  },
  link_container: {
    width:110,
    height:40,
    marginTop:0,
    justifyContent:'center',
    alignItems:'center',
    backgroundColor:'rgba(190, 154, 78, 0.30)',
    borderColor:colors.BLACK,
    borderWidth:1,
    borderRadius: 15,
  },
  link_text: {
    fontSize: 14,
    fontFamily: 'Cairo_700Bold',
    lineHeight: 35,
  },
  logo:{
    width:'100%',
    height:200,
    alignItems:'center',
    justifyContent:'center',
  },
  logo_image:{
    height:180,
    width:180,
    resizeMode:'contain',
  },
  tripStatusSectionBox:{
    flex:1,
    alignItems: 'center',
  },
  tripStatusSectionText:{
    lineHeight:50,
    fontFamily:'Cairo_700Bold',
    textAlign:'center',
    fontSize:14,
  },
  driverCarInfoImageBox:{
    width: 200,
    height: 200,
    marginTop:10,
    marginBottom:30,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 15,
    backgroundColor: '#f5f5f5',
    overflow: 'hidden',
  },
  driverCarInfoImage:{
    height:'100%',
    width:'100%',
    resizeMode: 'contain',
    borderRadius: 12,
  },
  search_trip_btn:{
    width:150,
    height:45,
    backgroundColor:colors.BLUE,
    borderRadius:15,
    justifyContent:'center',
    alignItems:'center',
  },
  search_trip_btn_text:{
    lineHeight:45,
    fontFamily: 'Cairo_400Regular',
    fontSize: 15,
    color: colors.WHITE,
  },
  spinner_error_container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
})