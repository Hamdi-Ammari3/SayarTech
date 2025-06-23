import {useState,useEffect,useRef} from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Alert,StyleSheet,Text,View,ActivityIndicator,TouchableOpacity,Modal } from 'react-native'
import { useRouter,useLocalSearchParams } from 'expo-router'
import MapView, { Marker ,AnimatedRegion } from 'react-native-maps'
import { doc,onSnapshot,arrayUnion,arrayRemove,writeBatch,increment,updateDoc,getDoc } from 'firebase/firestore'
import { DB } from '../../../../../firebaseConfig'
import {useRiderData} from '../../../../stateManagment/RiderContext'
import * as Clipboard from 'expo-clipboard';
import dayjs from "dayjs"
import colors from '../../../../../constants/Colors'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import FontAwesome5 from '@expo/vector-icons/FontAwesome5'
import Fontisto from '@expo/vector-icons/Fontisto'
import EvilIcons from '@expo/vector-icons/EvilIcons'
import AntDesign from '@expo/vector-icons/AntDesign'
import FontAwesome6 from '@expo/vector-icons/FontAwesome6'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import Feather from '@expo/vector-icons/Feather'
import Svg, {Circle} from 'react-native-svg'

const intercityTripDetails = () => {
  const router = useRouter()
  const {userData,fetchingUserDataLoading} = useRiderData()
  const {tripID} = useLocalSearchParams()
  const mapRef = useRef(null)
  const markerRef = useRef(null)

  const [tripData, setTripData] = useState(null)
  const [fetchingTripLoading, setFetchingTripLoading] = useState(true)
  const [openSeatBookingModel,setOpenSeatBookingModel] = useState(false)
  const [location,setLocation] = useState(null)
  const [seatCount, setSeatCount] = useState(1)
  const [bookingTheTrip,setBookingTheTrip] = useState(false)
  const [cancelingTripJoin,setCancelingTripJoin] = useState(false)
  const [openTrackTripModal,setOpenTackTripModal] = useState(false)
  const [driverOriginLocation,setDriverOriginLocation] = useState(null)
  const [driverCurrentLocation, setDriverCurrentLocation] = useState(null)
  const [driverCurrentLocationLoading, setDriverCurrentLocationLoading] = useState(true)
  const [confirmingPickUp,setConfirmingPickUp] = useState(false)

  const createAlert = (alerMessage) => {
    Alert.alert(alerMessage)
  }

  //Fetch trip data
  useEffect(() => {
    if (!tripID) return;
    const tripRef = doc(DB, 'intercityTrips', tripID);

    const unsubscribe = onSnapshot(tripRef, (tripSnap) => {
      if (tripSnap.exists()) {
        const trip = tripSnap.data();
        setTripData({ id: tripSnap.id, ...trip });
      } else {
        console.log('Trip not found');
      }

      setFetchingTripLoading(false);
    }, (error) => {
      console.log('Error with trip snapshot:', error);
      setFetchingTripLoading(false);
    });

    // Clean up on unmount
    return () => unsubscribe();
  }, [tripID]);

  //Come back to home screen
  const comeBackToHome = () => {
    router.push('/riderDailyTripsMain')  
  }

  //Format start date and time
  const formatTripStartTime = (timestamp) => {
    if (!timestamp) return '';
    const date = dayjs(timestamp.toDate());
    if (date.isToday()) {
      return `اليوم ${date.format('hh:mm A')}`;
    }
    if (date.isTomorrow()) {
      return `غدا ${date.format('hh:mm A')}`;
    }
    return date.format('dddd D MMMM hh:mm A');
  }

  // format trip amount
  const formatTripAmount = (amount) => {
    return amount?.toLocaleString('ar-IQ', {
      style: 'currency',
      currency: 'IQD',
      minimumFractionDigits: 0,
    })
  }

  //Copy feed account info
  const handleCopy = async (text) => {
    await Clipboard.setStringAsync(text)
    Alert.alert('تم النسخ', 'تم نسخ الرقم إلى الحافظة')
  }

  const isAlreadyJoined = tripData?.riders?.some(r => r.id === userData.id)
  const thisRider = tripData?.riders?.find(r => r.id === userData.id)
  const shouldShowPickupConfirm = thisRider?.picked_check && !thisRider?.picked

  // Calculate price
  const totalPrice = tripData?.seat_price * seatCount;

  // Increament seats
  const incrementSeat = () => {
    if (seatCount < (tripData?.seats_available - tripData?.seats_booked)) {
      setSeatCount(prev => prev + 1);
    }
  }
  
  // Decrement seats
  const decrementSeat = () => {
    if (seatCount > 1) {
      setSeatCount(prev => prev - 1);
    }
  }

  //Close seats number modal
  const closeSeatsNumberModal = () => {
    setOpenSeatBookingModel(false)
    setSeatCount(1)
  }

  //Send trip join request 
  const joinTrip = async () => {
    if (!tripData || !tripData.id) return createAlert("البيانات غير مكتملة");

    // Define trip fee
    const totalCost = Number(totalPrice) + Number(tripData?.company_commission);

    if (userData.account_balance < totalCost) {
      return createAlert(`الرصيد غير كافٍ. المبلغ المطلوب هو ${totalCost.toLocaleString()} د.ع.`);
    }

    setBookingTheTrip(true);

    try {
      const tripRef = doc(DB, 'intercityTrips', tripData.id);
      const riderRef = doc(DB, 'users', userData.id);
      const batch = writeBatch(DB);

      // 1. Add rider to join_request array
      batch.update(tripRef, {
        seats_booked: increment(Number(seatCount)),
        riders: arrayUnion({
          id: userData.id,
          name: userData.user_full_name,
          location: location,
          phone: userData.phone_number,
          notification: userData.user_notification_token,
          seats_booked: Number(seatCount),
          seats_booked_price: Number(totalPrice),
          total_price: Number(totalCost),
          picked_check:false,
          picked:false
        }),
      })

      // 2. Deduct from rider balance
      batch.update(riderRef, {
        account_balance: userData.account_balance - totalCost,
        intercityTrips: arrayUnion({
          id:tripData.id,
          picked:false,
        })
      })

      // 3. Notify the driver
      if (tripData.driver_notification) {
        await sendNotification(
          tripData.driver_notification,
          "راكب جديد انضم",
          `الراكب ${userData.user_full_name} انضم إلى رحلتك نحو ${tripData.destination_address}`
        )
      }
      // 4. Commit batch
      await batch.commit();
      createAlert("تم الحجز بنجاح")
    } catch (error) {
      console.log("Error sending join request:", error);
      createAlert("حدث خطأ أثناء الحجز حاول مرة أخرى");
    } finally {
      setBookingTheTrip(false)
      setOpenSeatBookingModel(false)
      router.push('/riderDailyTripsMain') 
    }
  }

  // Handle notification sending
  const sendNotification = async (token, title, body) => {
    try {
      const message = {
        to: token,
        sound: 'default',
          title: title,
        body: body 
      };

      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });
      
    } catch (error) {
      console.log("Error sending notification:", error);
    }
  }

  //Cancel trip join request 
  const cancelJoinRequest = async () => {
    if (!tripData || !tripData.id) return createAlert("البيانات غير مكتملة");

    setCancelingTripJoin(true);

    try {
      const tripRef = doc(DB, 'intercityTrips', tripData.id);
      const riderRef = doc(DB, 'users', userData.id);
      const batch = writeBatch(DB);

      // Check if rider exists in join_request
      //const requestEntry  = tripData.join_request?.find(r => r.id === userData.id);

      // Check if rider exists in riders
      const riderEntry = tripData.riders?.find(r => r.id === userData.id);

      if (!riderEntry) {
        createAlert("لست مسجل برحلة");
        setCancelingTripJoin(false);
        return;
      }

      //const entryToRemove = requestEntry || riderEntry;
      //const fieldToUpdate = requestEntry ? "join_request" : "riders";
      const refundAmount = Number(riderEntry.total_price) || 0

      // 1. Remove rider from the appropriate array
      batch.update(tripRef, {
        seats_booked: increment(-Number(riderEntry.seats_booked)),
        riders: arrayRemove(riderEntry),
      })

      // 2. Remove trip reference from user's intercityTrips
      const tripRefInUser = {
        id: tripData.id,
        picked: false,
      };

      batch.update(riderRef, {
        account_balance: userData.account_balance + refundAmount,
        intercityTrips: arrayRemove(tripRefInUser),
      });

      // 4. Commit batch
      await batch.commit();
      createAlert("تم إلغاء الرحلة واسترداد المبلغ");

    } catch (error) {
      console.log("Error canceling join request:", error);
      createAlert("حدث خطأ أثناء إلغاء الطلب. حاول مرة أخرى.");
    } finally {
      setCancelingTripJoin(false);
      router.push('/riderDailyTripsMain');
    }
  }

  //Animated driver marker
  const animatedDriverLocation = useRef(new AnimatedRegion({
    latitude: 0,
    longitude: 0,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  })).current;
    
  const markerIcon = () => {
    return(
      <Svg height={20} width={20}>
        <Circle
          cx="10"
          cy="10"
          r="10"
          fill="rgba(255, 165, 0, 0.28)"
          stroke="transparent"
        />
        <Circle
          cx="10"
          cy="10"
          r="6"
          fill="rgba(255, 140, 0, 1)"
          stroke="#fff"
          strokeWidth="2"
        />
      </Svg>
    )
  }

  // Function to check and update the origin location
  let lastOriginUpdateTime = Date.now();
  
  const checkAndUpdateOriginLocation = (currentLocation) => {
      
    if (!currentLocation?.latitude || !currentLocation?.longitude) {
      return;
    }
      
    if (!driverOriginLocation) {
      setDriverOriginLocation(currentLocation)
      return;
    }
  
    const now = Date.now();
    if (now - lastOriginUpdateTime < 30000) return; // Prevent updates within 30 seconds
  
    // Calculate the distance between the current location and the origin
    const distance = haversine(driverOriginLocation, currentLocation, { unit: "meter" });
    
    if (isNaN(distance)) {
      return;
    }
    
    if (distance > 400) {
      setDriverOriginLocation(currentLocation)
      lastOriginUpdateTime = now;
    }
  }

  // Fetch driver location
  useEffect(() => {
    if (tripData?.started || tripData?.driver_id){
    const driverRef = doc(DB, 'drivers', tripData?.driver_id)
    const unsubscribe = onSnapshot(
      driverRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.current_location) {
            const newLocation = data.current_location;
                
            setDriverCurrentLocation(newLocation)
  
            // Check if the driver has moved 1000 meters or more
            checkAndUpdateOriginLocation(newLocation)
                
            // Animate driver marker to the new location
            animatedDriverLocation.timing({
              latitude: newLocation.latitude,
              longitude: newLocation.longitude,
              duration: 1000,
              useNativeDriver: false,
            }).start();
  
            setDriverCurrentLocationLoading(false)
          }
        } else {
          setDriverCurrentLocationLoading(false)
        }
      },
      (error) => {
        setDriverCurrentLocationLoading(false)
      }
    )
      return () => unsubscribe();
    }
      setDriverCurrentLocationLoading(false)
  }, [tripData?.driver_id,tripData?.started,openTrackTripModal])

  //Track the trip
  const trackTrip = async() => {
    setOpenTackTripModal(true)
  }

  //Close track trip modal
  const closeTrackTripModal = () => {
    setOpenTackTripModal(false)
  }

  //Click the confirm pick up function
  const handlePickupConfirmPress = () => {
    Alert.alert(
      'تأكيد الصعود',
      'يجب الضغط على هذا الزر فقط بعد أن يصعدك السائق فعلًا. هل أنت متأكد؟',
      [
        {
          text: 'لا',
          style: 'cancel',
        },
        {
          text: 'نعم',
          onPress: () => confirmPickUp(),
          style: 'destructive',
        },
      ]
    );
  };

  //Confirm pick up
  const confirmPickUp = async () => {
    try {
      setConfirmingPickUp(true)
      const tripRef = doc(DB, 'intercityTrips', tripData.id)
      const tripSnap = await getDoc(tripRef)
      if (!tripSnap.exists()) {
        console.log("Trip not found");
        return;
      }

      const trip = tripSnap.data();

      const updatedRiders = trip.riders.map(r => {
        if (r.id === userData.id && r.picked_check) {
          return { 
            ...r, 
            picked: true 
          }
        }
        return r;
      })

      await updateDoc(tripRef, { riders: updatedRiders });
      createAlert('تم تأكيد الصعود بنجاح ✅')
    } catch (error) {
      console.log('Error confirming pickup:', error);
      createAlert('حدث خطأ أثناء تأكيد الصعود')
    } finally{
      setConfirmingPickUp(false)
      router.push('/riderDailyTripsMain') 
    }
  }

  //Adding new trip loading
  if (fetchingTripLoading || fetchingUserDataLoading || bookingTheTrip || cancelingTripJoin || driverCurrentLocationLoading || confirmingPickUp) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.spinner_error_container}>
          <ActivityIndicator size="large" color={colors.PRIMARY}/>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.title}>
        <Text style={styles.titleText}>تفاصيل الرحلة</Text>
        <TouchableOpacity style={styles.arrowBackFunction} onPress={comeBackToHome}>
          <FontAwesome5 name="arrow-circle-left" size={24} color="black" />
        </TouchableOpacity>
      </View>
      <View style={styles.main_box}>
        <View style={styles.location_box}>
          <View style={styles.location_text_box}>
            <Text style={styles.trip_text_start_point_title}>الانطلاق</Text>
            <Text style={styles.trip_text_start_point}>{tripData?.start_point}</Text>
          </View>
          <View style={styles.location_icon_box}>
            <MaterialCommunityIcons name="map-marker-account-outline" size={24} color="black" />
          </View>
        </View>
        <View style={styles.location_box}>
          <View style={styles.location_text_box}>
            <Text style={styles.trip_text_start_point_title}>الوصول</Text>
            <Text style={styles.trip_text_start_point}>{tripData?.destination_address}</Text>
          </View>
          <View style={styles.location_icon_box}>
            <MaterialCommunityIcons name="map-marker-check-outline" size={24} color="black" />
          </View>
        </View>
        <View style={styles.location_box}>
          <View style={styles.location_text_box}>
            <Text style={styles.trip_text_start_point_title}>التوقيت</Text>
            <Text style={styles.trip_text_start_point}>{formatTripStartTime(tripData?.start_datetime)}</Text>
          </View>
          <View style={styles.location_icon_box}>
            <MaterialIcons name="access-time" size={24} color="black" />
          </View>
        </View>
        <View style={styles.location_box}>
          <View style={styles.location_text_box}>
            <Text style={styles.trip_text_start_point_title}>السائق</Text>
            <View style={{flexDirection:'row-reverse',gap:10}}>
              <Text style={styles.trip_text_start_point}>{tripData?.driver_name}</Text>
              <Text style={styles.trip_text_start_point}>-</Text>
              <Text style={styles.trip_text_start_point}>{tripData?.driver_phone}</Text>
              <TouchableOpacity 
                style={{marginRight:10}}
                onPress={() => handleCopy(tripData?.driver_phone)}
              >
                <Feather name="copy" size={24} color="black" />
              </TouchableOpacity>  
            </View>
          </View>
          <View style={styles.location_icon_box}>
            <FontAwesome name="user" size={22} color="black" />
          </View>
        </View>
        <View style={styles.location_box}>
          <View style={styles.location_text_box}>
            <Text style={styles.trip_text_start_point_title}>السيارة</Text>
            <View style={{flexDirection:'row-reverse',gap:10}}>
              <Text style={styles.trip_text_start_point}>{tripData?.car_modal}</Text>
              <Text style={styles.trip_text_start_point}>-</Text>
              <Text style={styles.trip_text_start_point}>{tripData?.car_plate}</Text>
            </View>
          </View>
          <View style={styles.location_icon_box}>
            <Fontisto name="automobile" size={24} color="black" />
          </View>
        </View>
        <View style={styles.location_box}>
          <View style={styles.location_text_box}>
            <Text style={styles.trip_text_start_point_title}>السعر</Text>
            <Text style={styles.trip_text_start_point}>{formatTripAmount(tripData?.seat_price)}</Text>
          </View>
          <View style={styles.location_icon_box}>
            <FontAwesome5 name="dollar-sign" size={22} color="black" />
          </View>
        </View>
        {tripData.started === false && !isAlreadyJoined && (
          <>
            <View style={styles.track_trip_box}>
              <TouchableOpacity style={styles.track_trip_button} onPress={() => setOpenSeatBookingModel(true)}>
                <Text style={styles.track_trip_button_text}>احجز الان</Text>
              </TouchableOpacity>
            </View>
            <Modal
              animationType="fade"
              transparent={true} 
              visible={openSeatBookingModel} 
              onRequestClose={closeSeatsNumberModal}
            >
              <View style={styles.modal_container}>
                <View>

                </View>
                <View style={styles.modal_box}>
                  <View style={styles.modal_header}>
                    <TouchableOpacity onPress={closeSeatsNumberModal}>
                      <AntDesign name="closecircleo" size={24} color="gray" />
                    </TouchableOpacity>
                  </View>
                  <MapView
                    style={styles.map}
                    initialRegion={{
                      latitude: 33.3152,
                      longitude: 44.3661,
                      latitudeDelta: 10,
                      longitudeDelta: 10, 
                    }}
                    showsUserLocation={true}
                    showsMyLocationButton={true}
                    onRegionChangeComplete={(reg) => {
                      setLocation({
                        latitude: reg.latitude,
                        longitude: reg.longitude,
                      });
                    }}
                  />
                  <View style={styles.centerPin}>
                    <FontAwesome6 name="map-pin" size={24} color="red" />
                  </View>
                  <View style={styles.confirm_book_trip}>     
                    <View style={styles.number_seat_booked_box}>
                      <TouchableOpacity onPress={decrementSeat} style={{height:60,alignItems:'center'}}>
                        <EvilIcons name="minus" size={28} style={{lineHeight:60}} />
                      </TouchableOpacity >
                      <Text style={styles.seatCountText}>{seatCount}</Text>
                      <TouchableOpacity onPress={incrementSeat} style={{height:60,alignItems:'center'}}>
                        <EvilIcons name="plus" size={28} style={{lineHeight:60}} />
                      </TouchableOpacity >
                    </View>
                    <View style={styles.seats_booked_total_price}>
                      <Text style={styles.trip_text_start_point}>{formatTripAmount(totalPrice)}</Text>
                    </View> 
                  </View>
                  <View style={styles.seats_booked_total_price}>
                    <TouchableOpacity style={styles.track_trip_button} onPress={joinTrip}>
                      <Text style={styles.track_trip_button_text}>تاكيد</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          </>
        )}
        {isAlreadyJoined && (
          <View style={styles.track_trip_box}>
            {tripData.started === false ? (
              <TouchableOpacity 
                style={[styles.track_trip_button,{backgroundColor:'#B82132'}]}
                onPress={cancelJoinRequest}
              >
                <Text style={styles.track_trip_button_text}>الغاء الرحلة</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.track_trip_confirm_pickup_box}>
                <TouchableOpacity 
                  style={styles.track_trip_button}
                  onPress={trackTrip}
                >
                  <Text style={styles.track_trip_button_text}>تتبع الرحلة</Text>
                </TouchableOpacity>
                <Modal
                  animationType="fade"
                  transparent={true} 
                  visible={openTrackTripModal} 
                  onRequestClose={closeTrackTripModal}
                >
                  <View style={styles.modal_container}>
                    <View style={styles.modal_box}>
                      <View style={styles.modal_header}>
                        <TouchableOpacity onPress={closeTrackTripModal}>
                          <AntDesign name="closecircleo" size={24} color="gray" />
                        </TouchableOpacity>
                      </View>
                      <MapView
                        ref={mapRef}
                        provider="google"
                        initialRegion={{
                          latitude: driverCurrentLocation?.latitude || 0,
                          longitude: driverCurrentLocation?.longitude || 0,                        
                          latitudeDelta: 0.05,
                          longitudeDelta: 0.05,
                        }}
                        showsUserLocation={true}
                        showsMyLocationButton={true}
                        loadingEnabled={true}
                        style={[styles.map,{height:540}]}
                      >
                        <Marker.Animated
                          ref={markerRef}
                          coordinate={animatedDriverLocation}
                          title="السائق"
                        >
                          <View>
                            {markerIcon()}
                          </View>
                        </Marker.Animated>
                      </MapView>
                    </View>
                  </View>
                </Modal>
                {shouldShowPickupConfirm  && (
                  <TouchableOpacity 
                    style={[styles.track_trip_button,{backgroundColor:'#BF9264'}]}
                    onPress={handlePickupConfirmPress}
                  >
                    <Text style={styles.track_trip_button_text}>تاكيد الصعود</Text>
                  </TouchableOpacity>
                )}              
              </View>
              
            )}
            
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}

export default intercityTripDetails

const styles = StyleSheet.create({
    container:{
        flex:1,
        backgroundColor:colors.WHITE,
    },
    title:{
        width:'100%',
        height:150,
        flexDirection:'row-reverse',
        alignItems:'center',
        justifyContent:'center',
        gap:20,
    },
    titleText:{
        lineHeight:40,
        fontFamily:'Cairo_400Regular',
        fontSize:24,
        textAlign:'center',
    },
    arrowBackFunction:{
        height:40,
        alignItems:'center',
        justifyContent:'center',
    },
    main_box:{
        width:'100%',
        alignItems:'center',
        justifyContent:'center',
    },
    location_box:{
        width:'100%',
        flexDirection:'row',
        justifyContent:'flex-end',
        marginBottom:15,
      },
    location_text_box:{
        height:60,
        justifyContent:'space-between',
        alignItems:'flex-end',
    },
    location_icon_box:{
      height:60,
      width:60,
      justifyContent:'center',
      alignItems:'center',
    },
    trip_text_start_point_title:{
        lineHeight:30,
        fontFamily: 'Cairo_400Regular',
        fontSize:13,
        color:colors.DARKGRAY
    },
    trip_text_start_point:{
      lineHeight:30,
      fontFamily: 'Cairo_700Bold',
      fontSize:14,
    },
  modal_container:{
    flex:1,
    justifyContent:'center',
    alignItems:'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modal_box:{
    width: '95%',
    height:600,
    backgroundColor:colors.WHITE,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  modal_header:{
    width:'100%',
    height:40,
    flexDirection:'row',
    justifyContent:'center',
    alignItems:'center',
  },
  modal_title:{
    lineHeight:40,
    fontFamily:'Cairo_700Bold',
    fontSize:15,
    marginLeft:10,
  },
  map:{
    width:'100%',
    height:400,
  },
  centerPin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -40, 
    zIndex: 10,
  },
  confirm_book_trip:{
    width:300,
    marginVertical:10,
    flexDirection:'row-reverse',
    justifyContent:'space-around',
    alignItems:'center',
  },
  number_seat_booked_box:{
    width:150,
    height:50,
    borderRadius:15,
    backgroundColor: '#fff',
    flexDirection:'row',
    justifyContent:'center',
    alignItems:'center',
    gap:20,
    borderColor:colors.GRAY,
    borderWidth:1,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
  },
  seatCountText:{
    lineHeight:60,
    fontFamily:'Cairo_700Bold',
    fontSize: 16
  },
  seats_booked_total_price:{
    width:100,
    height:50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  track_trip_box:{
    width:'100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop:20
  },
  track_trip_confirm_pickup_box:{
    flexDirection:'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    gap:10
  },
  track_trip_button:{
    width:130,
    height:40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#295F98',
    borderRadius:15
  },
  track_trip_button_text:{
    lineHeight:40,
    fontFamily: 'Cairo_700Bold',
    fontSize:14,
    color:colors.WHITE
  },
  spinner_error_container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
})