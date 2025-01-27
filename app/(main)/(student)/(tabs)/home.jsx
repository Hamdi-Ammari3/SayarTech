import { useState, useEffect,useRef } from 'react'
import { Alert,StyleSheet, Text, View, ActivityIndicator,Image,TouchableOpacity,TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, {Circle} from 'react-native-svg'
import haversine from 'haversine'
import { useUser } from '@clerk/clerk-expo'
import { Link } from 'expo-router'
import MapView, { Marker, AnimatedRegion } from 'react-native-maps'
import MapViewDirections from 'react-native-maps-directions'
import { doc,updateDoc,onSnapshot } from 'firebase/firestore'
import {DB} from '../../../../firebaseConfig'
import { useStudentData } from '../../../stateManagment/StudentState'
import colors from '../../../../constants/Colors'
import logo from '../../../../assets/images/logo.jpeg'

const home = () => {

  const GOOGLE_MAPS_APIKEY = ''
  const {students,fetchingStudentsLoading} = useStudentData()

  const markerRef = useRef(null)
  const mapRef = useRef(null)

  const { isLoaded } = useUser()

  const [isCanceling, setIsCanceling] = useState(false)
  const [cancelText, setCancelText] = useState('')
  const [driverOriginLocation,setDriverOriginLocation] = useState(null)
  const [destination, setDestination] = useState(null)
  const [driverCurrentLocation, setDriverCurrentLocation] = useState(null)
  const [driverCurrentLocationLoading, setDriverCurrentLocationLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  

  const animatedDriverLocation = useRef(new AnimatedRegion({
    latitude: 0,
    longitude: 0,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  })).current;

  const createAlert = (alerMessage) => {
    Alert.alert(alerMessage)
  }

  const markerIcon = () => {
    return(
      <Svg height={20} width={20}>
        <Circle
          cx="10"
          cy="10"
          r="10"
          fill="rgba(57, 136, 251, 0.28)"
          stroke="transparent"
        />
        <Circle
          cx="10"
          cy="10"
          r="6"
          fill="rgba(57, 137, 252, 1)"
          stroke="#fff"
          strokeWidth="2"
        />
      </Svg>
    )
  }

  const handleMapReady = () => {
    setMapReady(true);
  };
  
  // Fetch driver location
  useEffect(() => {
    if (students[0]?.driver_id) {
      const driverRef = doc(DB, 'drivers', students[0]?.driver_id)
  
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
            console.log("Driver document doesn't exist or lacks location.")
            setDriverCurrentLocationLoading(false)
          }
        },
        (error) => {
          console.error('Error fetching driver location:', error)
          setDriverCurrentLocationLoading(false)
        }
      );
  
      return () => unsubscribe();
    }
    setDriverCurrentLocationLoading(false)
  }, [students[0]?.driver_id, driverCurrentLocation]);

  // Function to check and update the origin location
  let lastOriginUpdateTime = Date.now();

  const checkAndUpdateOriginLocation = (currentLocation) => {
    
    if (!currentLocation?.latitude || !currentLocation?.longitude) {
      return;
    }
    
    if (!driverOriginLocation) {
      // Set the initial origin if it's not set yet
      setDriverOriginLocation(currentLocation)
      return;
    }

    const now = Date.now();
    if (now - lastOriginUpdateTime < 50000) return; // Prevent updates within 50 seconds

    // Calculate the distance between the current location and the origin
    const distance = haversine(driverOriginLocation, currentLocation, { unit: "meter" });
  
    if (isNaN(distance)) {
      return;
    }
  
    if (distance > 8000) {
      setDriverOriginLocation(currentLocation)
      lastOriginUpdateTime = now;
    }
  };

  // Set destination based on student trip status
  useEffect(() => {
    if (students[0]?.student_trip_status === 'going to school') {
      setDestination(students[0]?.student_school_location)
      setDriverOriginLocation(driverCurrentLocation)
    } else if (students[0]?.student_trip_status === 'going to home') {
      setDestination(students[0]?.student_home_location.coords)
      setDriverOriginLocation(driverCurrentLocation)
    }
  }, [students[0]?.student_trip_status]);

  // fit coordinate function
  const fitCoordinatesForCurrentTrip = () => {
    if (!mapReady || !mapRef.current || !driverOriginLocation) return;
      
    if (driverOriginLocation && destination) {
      mapRef.current.fitToCoordinates(
        [driverOriginLocation, destination],
        {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        }
      );
    }
  };

  useEffect(() => {
    if (mapReady && driverOriginLocation && destination) {
      fitCoordinatesForCurrentTrip();
    }
  }, [mapReady,destination]);

  // Function to show only one-time route calculation
  const renderDirections = () => {
    if (driverCurrentLocation && destination) {
      return (
        <MapViewDirections
          origin={driverOriginLocation}
          destination={destination}
          optimizeWaypoints={true}
          apikey={GOOGLE_MAPS_APIKEY}
          strokeWidth={4}
          strokeColor="blue"
          onError={(error) => console.log(error)}
        />
      );
    }
    return null;
  };

  // Return map and marker based on the trip status
  const renderMap = () => (
    <MapView
      ref={mapRef}
      onMapReady={handleMapReady}
      provider="google"
      initialRegion={{
        latitude: driverCurrentLocation?.latitude || 0,
        longitude: driverCurrentLocation?.longitude || 0,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }}
      loadingEnabled={true}
      style={styles.map}
    >
      {renderDirections()}

      <Marker.Animated
        ref={markerRef}
        coordinate={animatedDriverLocation}
        title="السائق"
      >
        <View>
          {markerIcon()}
        </View>
      </Marker.Animated>
  
      <Marker
        key={`Destination ${students[0]?.id}`}
        coordinate={destination}
        title={students[0]?.student_trip_status === 'going to school' ? 'المدرسة' : 'المنزل'}
        pinColor="red"
      />
    </MapView>
  );

  // Function to handle canceling the trip
  const handleCancelTrip = async () => {
    if (cancelText.trim() === 'نعم') {
      try {
        const studentDoc = doc(DB, 'students', students[0].id);
        await updateDoc(studentDoc, {
          tomorrow_trip_canceled: true,
        });
        createAlert('تم إلغاء رحلة الغد بنجاح');
        setIsCanceling(false);
        setCancelText('');
      } catch (error) {
        createAlert('حدث خطأ أثناء إلغاء الرحلة. حاول مرة أخرى.');
      }
    } else {
      createAlert('لتاكيد الالغاء يرجى كتابة نعم');
    }
  };
  
  const handleDenyCancelTrip = () => {
    setIsCanceling(false);
    setCancelText('');
  }

  // Wait untill data load
  if (fetchingStudentsLoading || driverCurrentLocationLoading || !isLoaded) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.spinner_error_container}>
          <ActivityIndicator size="large" color={colors.PRIMARY} />
        </View>
      </SafeAreaView>
    );
  }

// if the student haven't yet registered his info
  if(!students.length) {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.student_container}>
          <View style={styles.logo}>
            <Image source={logo} style={styles.logo_image}/>
          </View>
          <View style={styles.no_registered_students}>
          <Text style={styles.no_student_text}>الرجاء اضافة بياناتك الخاصة</Text>
            <Link href="/addData" style={styles.link_container}>
              <Text style={styles.link_text}>اضف الآن</Text>
            </Link>
          </View>
        </View>
      </SafeAreaView>
    )
  }
  
  if(!students[0]?.driver_id) {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.student_container}>
          <View style={styles.logo}>
            <Image source={logo} style={styles.logo_image}/>
          </View>
          <View style={styles.student_route_status_box}>
            <Text style={styles.student_route_status_text}>في انتظار ربط حسابك بسائق</Text>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  if(students[0]?.driver_id && students[0]?.student_trip_status === 'at home') {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.student_container}>
          <View style={styles.logo}>
            <Image source={logo} style={styles.logo_image}/>
          </View>
          <View>
            <View style={styles.student_box}>
              <Text style={styles.student_text}>الطالب في المنزل 😴</Text>
            </View>
            {!students[0].tomorrow_trip_canceled && (
              <View>
                <TouchableOpacity style={styles.cancel_trip_btn} onPress={() => setIsCanceling(true)}>
                  <Text style={styles.cancel_trip_btn_text}>الغاء رحلة الغد</Text>
                </TouchableOpacity>
                {isCanceling && (
                  <View style={styles.cancel_trip_confirmation}>
                    <TextInput
                      style={styles.cancel_trip_input}
                      value={cancelText}
                      onChangeText={setCancelText}
                      placeholder="للتاكيد اكتب كلمة نعم هنا"
                    />
                    <View style={styles.confirm_deny_canceling_btn}>
                      <TouchableOpacity style={styles.confirm_cancel_btn} onPress={handleCancelTrip}>
                        <Text style={styles.confirm_cancel_btn_text}>تأكيد</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.deny_cancel_btn} onPress={handleDenyCancelTrip}>
                        <Text style={styles.deny_cancel_btn_text}>رفض</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>
    )
  }

  if(students[0]?.driver_id && students[0]?.student_trip_status === 'at school') {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.student_container}>
          <View style={styles.logo}>
            <Image source={logo} style={styles.logo_image}/>
          </View>
          <View style={styles.student_box}>
            <Text style={styles.student_text}>الطالب في المدرسة 📖</Text>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  // If the student is going to school
  if(students[0]?.driver_id && students[0]?.student_trip_status === 'going to school'){
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.student_route_status_container}>
          <View style={styles.student_route_status_box}>
            <Text style={styles.student_route_status_text}>في اتجاه المدرسة</Text>
          </View>
        </View>
        <View style={styles.student_map_container}>
          {renderMap()}
        </View>
      </SafeAreaView>
    )
  }

  // If the student is going to school or going to home
  if(students[0]?.driver_id && students[0]?.student_trip_status === 'going to home') {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.student_route_status_container}>
          <View style={styles.student_route_status_box}>
            <Text style={styles.student_route_status_text}>{students[0].picked_up ? 'في اتجاه المنزل' : 'السائق في الاتجاه اليك'}</Text>
          </View>
        </View>
        <View style={styles.student_map_container}>
          {renderMap()}
        </View>
      </SafeAreaView>
    )
  }
}
export default home;

const styles = StyleSheet.create({
  container:{
    flex:1,
    backgroundColor: colors.WHITE,
  },
  student_container:{
    height:400,
    paddingTop:30,
    alignItems:'center',
    justifyContent:'space-between',
  },
  logo:{
    width:'100%',
    height:150,
    justifyContent:'center',
    alignItems:'center',
  },
  logo_image:{
    height:120,
    width:120,
    resizeMode:'contain',
  },
  no_registered_students: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  no_student_text: {
    fontFamily: 'Cairo_400Regular',
  },
  link_container: {
    backgroundColor: colors.PRIMARY,
    width:100,
    height:50,
    textAlign:'center',
    marginTop:10,
    borderRadius: 20,
  },
  link_text: {
    lineHeight:50,
    color: colors.WHITE,
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
  },
  student_box:{
    backgroundColor:colors.GRAY,
    width:250,
    height:50,
    borderRadius:15,
    alignItems:'center',
    justifyContent:'center'
  },
  student_text:{
    lineHeight:50,
    verticalAlign:'middle',
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    fontSize:15,
  },
  cancel_trip_btn:{
    backgroundColor:colors.BLUE,
    width:250,
    height:50,
    borderRadius:15,
    marginTop:10
  },
  cancel_trip_btn_text:{
    lineHeight:50,
    verticalAlign:'middle',
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    fontSize:15,
    color:colors.WHITE,
  },
  cancel_trip_input:{
    width:250,
    padding:10,
    borderRadius:15,
    borderColor:'#ddd',
    borderWidth:1,
    marginTop:10,
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    fontSize:13,
    color:colors.BLACK
  },
  confirm_deny_canceling_btn:{
    flexDirection:'row-reverse',
    alignItems:'center',
    justifyContent:'space-around',
  },
  confirm_cancel_btn:{
    backgroundColor:colors.BLUE,
    width:100,
    padding:10,
    borderRadius:15,
    marginTop:10
  },
  deny_cancel_btn:{
    borderWidth:1,
    borderColor:colors.BLUE,
    width:100,
    padding:10,
    borderRadius:15,
    marginTop:10
  },
  confirm_cancel_btn_text:{
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    fontSize:15,
    color:colors.WHITE
  },
  deny_cancel_btn_text:{
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    fontSize:15,
    color:'#16B1FF'
  },
  student_map_container:{
    width:500,
    height:800,
    position:'relative',
  },
  student_route_status_container:{
    width:'100%',
    position:'absolute',
    top:50,
    left:0,
    zIndex:100,
    alignItems:'center',
    justifyContent:'center',
  },
  student_route_status_box:{
    backgroundColor:colors.BLUE,
    width:250,
    height:50,
    borderRadius:15,
    alignItems:'center',
    justifyContent:'center'
  },
  student_route_status_text:{
    lineHeight:50,
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    fontSize:15,
    color:colors.WHITE,
  },
  map: {
    flex:1,
  },
  spinner_error_container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  }
})