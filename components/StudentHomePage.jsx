import React,{useState,useEffect,useRef} from 'react'
import { Alert,StyleSheet, Text, View, TextInput,ActivityIndicator,TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, {Circle} from 'react-native-svg'
import haversine from 'haversine'
import MapView, { Marker ,AnimatedRegion } from 'react-native-maps'
import MapViewDirections from 'react-native-maps-directions'
import { doc,updateDoc,onSnapshot,getDoc } from 'firebase/firestore'
import { DB } from '../firebaseConfig'
import colors from '../constants/Colors'

const StudentHomePage = ({student}) => {

  const GOOGLE_MAPS_APIKEY = ''
  const mapRef = useRef(null)
  const markerRef = useRef(null)

  const [isCanceling, setIsCanceling] = useState(false);
  const [cancelText, setCancelText] = useState('');
  const [driverOriginLocation,setDriverOriginLocation] = useState(null)
  const [destination, setDestination] = useState(null);
  const [driverCurrentLocation, setDriverCurrentLocation] = useState(null);
  const [driverCurrentLocationLoading, setDriverCurrentLocationLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false)

  const animatedDriverLocation = useRef(new AnimatedRegion({
    latitude: 0,
    longitude: 0,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
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
    if (student.driver_id) {
      const driverRef = doc(DB, 'drivers', student.driver_id)
  
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
  }, [student.driver_id, driverCurrentLocation]);

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
  };

  // Set destination based on student trip status
  useEffect(() => {
    if (student.student_trip_status === 'going to school') {
      setDestination(student.student_school_location);
      setDriverOriginLocation(driverCurrentLocation)
    } else if (student.student_trip_status === 'going to home') {
      setDestination(student.student_home_location.coords);
      setDriverOriginLocation(driverCurrentLocation)
    }
  }, [student.student_trip_status]);

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
    if (driverOriginLocation && destination) {
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

      {/* Animated Driver Marker */}
      <Marker.Animated
        ref={markerRef}
        coordinate={animatedDriverLocation}
        title="السائق"
      >
        <View>
          {markerIcon()}
        </View>
      </Marker.Animated>

      {/* Destination Marker */}
      <Marker
        key={`Destination ${student?.id}`}
        coordinate={destination}
        title={student?.student_trip_status === 'going to school' ? 'المدرسة' : 'المنزل'}
        pinColor="red"
      />
    </MapView>
  );

  // Function to handle canceling the trip
  const handleCancelTrip = async () => {
    if (cancelText.trim() === 'نعم') {
      try {
        const driverRef = doc(DB, 'drivers', student.driver_id)
        // Fetch the current driver's document to get the assigned_students list
        const driverSnapshot = await getDoc(driverRef);

        if (driverSnapshot.exists()) {
          const driverData = driverSnapshot.data();
          const assignedStudents = driverData.assigned_students || [];
  
          // Update only the relevant student's data in the assigned_students list
          const updatedAssignedStudents = assignedStudents.map((studentItem) => {
            if (studentItem.id === student.id) {
              return { ...studentItem, tomorrow_trip_canceled: true }; // Update the field
            }
            return studentItem; // Keep other students unchanged
          });
  
          // Update the driver's document with the modified assigned_students list
          await updateDoc(driverRef, {
            assigned_students: updatedAssignedStudents,
          });

          createAlert('تم إلغاء رحلة الغد بنجاح');
          setIsCanceling(false);
          setCancelText('');
        } else {
          createAlert('تعذر العثور على بيانات السائق.');
        }
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
  if (driverCurrentLocationLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.spinner_error_container}>
          <ActivityIndicator size="large" color={colors.PRIMARY} />
        </View>
      </SafeAreaView>
    );
  }

  // If the student is not assigned to a driver
  if(!student.driver_id) {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.finding_driver_container}>
          <View style={styles.finding_driver_loading_box}>
            <ActivityIndicator size={'small'} color={colors.WHITE}/>
            <Text style={styles.finding_driver_loading_text}>جاري ربط حسابك بسائق</Text>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  // If the student is at home
  if(student.driver_id && student.student_trip_status === 'at home') {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.student_container}>
          <View style={styles.student_box}>
            <Text style={styles.student_text}>الطالب في المنزل 😴</Text>
          </View>
          {!student.tomorrow_trip_canceled && (
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
                  <Text style={styles.deny_cancel_btn_text}>لا</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
          )}
        </View>
      </SafeAreaView>
    )
  }

  // If the student is at school
  if(student.driver_id && student.student_trip_status === 'at school') {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.student_container}>
          <View style={styles.student_box}>
            <Text style={styles.student_text}>الطالب في المدرسة 📖</Text>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  // If the student is going to school
  if(student.driver_id && student.student_trip_status === 'going to school'){
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.student_route_status_container}>
         <View style={styles.student_route_status_box}>
            <Text style={styles.student_route_status_text}>الطالب في الطريق الى المدرسة</Text>
          </View>
        </View>
        <View style={styles.student_map_container}>
          {renderMap()}
        </View>
      </SafeAreaView>
    )
  }

  // If the student is going to school or going to home
  if(student.driver_id && student.student_trip_status === 'going to home') {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.student_route_status_container}>
          <View style={styles.student_route_status_box}>
            <Text style={styles.student_route_status_text}>{student.picked_up ? 'الطالب في الطريق الى المنزل' : 'السائق في الاتجاه اليك'}</Text>
          </View>
        </View>
        <View style={styles.student_map_container}>
          {renderMap()}
        </View>
      </SafeAreaView>
    )
  }
}

export default StudentHomePage

const styles = StyleSheet.create({
  container:{
    flex:1,
  },
  finding_driver_container:{
    width:'100%',
    height:'100%',
    alignItems:'center',
    justifyContent:'center'
  }, 
  finding_driver_loading_box:{
    width:250,
    padding:10,
    backgroundColor:colors.PRIMARY,
    borderRadius:15,
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'space-around'
  },
  finding_driver_loading_text:{
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    fontSize:15,
    color:colors.WHITE,
  }, 
  student_container:{
    width:'100%',
    height:'100%',
    alignItems:'center',
    justifyContent:'center'
  },
  student_box:{
    backgroundColor:colors.GRAY,
    width:250,
    padding:10,
    borderRadius:15,
    alignItems:'center',
    justifyContent:'center'
  },
  student_text:{
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    fontSize:15,
    color:colors.BLACK,
  },
  cancel_trip_btn:{
    backgroundColor:colors.BLUE,
    width:250,
    padding:10,
    borderRadius:15,
    marginTop:10
  },
  cancel_trip_btn_text:{
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
    width:500,
    position:'absolute',
    top:100,
    left:0,
    zIndex:100,
    alignItems:'center',
    justifyContent:'center',
  },
  student_route_status_box:{
    backgroundColor:colors.BLUE,
    width:250,
    padding:10,
    borderRadius:15,
    alignItems:'center',
    justifyContent:'center'
  },
  student_route_status_text:{
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

