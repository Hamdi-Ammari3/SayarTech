import React,{useState,useEffect,useRef} from 'react'
import { Alert,StyleSheet,Text,View,TextInput,ActivityIndicator,TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, {Circle} from 'react-native-svg'
import haversine from 'haversine'
import MapView, { Marker ,AnimatedRegion } from 'react-native-maps'
import MapViewDirections from 'react-native-maps-directions'
import { getDoc,doc,writeBatch,onSnapshot } from 'firebase/firestore'
import { DB } from '../firebaseConfig'
import LottieView from "lottie-react-native"
import colors from '../constants/Colors'
import driverWaiting from '../assets/animations/waiting_driver.json'
import tripReady from '../assets/animations/next_trip.json'

const toArabicNumbers = (num) => num.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d])

const StudentHomePage = ({student}) => {

  // after the driver picked up the student and hiding toward a next student location show a message of "student is in the car" instead of "student going to school"
  // Add Advertising slide for private schools and universities 

  const GOOGLE_MAPS_APIKEY = ''
  const mapRef = useRef(null)
  const markerRef = useRef(null)

  const [isCanceling, setIsCanceling] = useState(false)
  const [cancelText, setCancelText] = useState('')
  const [nextTripText, setNextTripText] = useState("");
  const [returnTripText, setReturnTripText] = useState("");
  const [driverOriginLocation,setDriverOriginLocation] = useState(null)
  const [destination, setDestination] = useState(null);
  const [driverCurrentLocation, setDriverCurrentLocation] = useState(null);
  const [driverCurrentLocationLoading, setDriverCurrentLocationLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false)

  // Next trip date
  useEffect(() => {
    if (!student?.driver_id || student?.trip_status !== "at home") return;

    const riderTimetable = student?.timetable || [];
    if (!riderTimetable.length) {
      setNextTripText("لا توجد رحلة قادمة");
      return;
    }

    const now = new Date();
    const todayIndex = now.getDay(); // 0=Sunday, ..., 6=Saturday
    const sortedTimetable = [...riderTimetable].sort((a, b) => a.id - b.id);
    let nextTripDay = null;
    let tripLabel = "لا توجد رحلة قادمة";

    const formatTimeWithPeriod = (date) => {
      let hours = date.getHours();
      let minutes = date.getMinutes();
      const period = hours >= 12 ? "مساءً" : "صباحًا";

      // Convert to 12-hour format
      hours = hours % 12 || 12; // Convert 0 (midnight) and 12 (noon) correctly

      return `${toArabicNumbers(hours.toString().padStart(2, "0"))}:${toArabicNumbers(minutes.toString().padStart(2, "0"))} ${period}`;
    };

    // Step 1: Check today's start time first
    const todaySchedule = sortedTimetable.find(day => day.id === todayIndex && day.active);
    if (todaySchedule && todaySchedule.startTime) {
      let startTimeDate = todaySchedule.startTime.toDate();

      const nowHours = now.getHours();
      const nowMinutes = now.getMinutes();

      let startHours = startTimeDate.getHours();
      let startMinutes = startTimeDate.getMinutes();

      if (startHours > nowHours || (startHours === nowHours && startMinutes > nowMinutes)) {
        nextTripDay = "اليوم";
        tripLabel = `${nextTripDay} الساعة ${formatTimeWithPeriod(startTimeDate)}`;
      }
    }

    // Step 2: If today's trip already passed, find the next available active day (looping over the week)
    if (!nextTripDay) {
      for (let i = 1; i <= 7; i++) { // Max 7 days search ensures looping back to Sunday
        let nextIndex = (todayIndex + i) % 7; // Loop back after Saturday
        const nextDay = sortedTimetable.find(day => day.id === nextIndex && day.active);

        if (nextDay && nextDay.startTime) {
          let startTimeDate = nextDay.startTime.toDate();
          nextTripDay = i === 1 ? "غدا" : nextDay.day; // "غدا" for tomorrow, else use DB day name
          tripLabel = `${nextTripDay} الساعة ${formatTimeWithPeriod(startTimeDate)}`;
          break;
        }
      }
    }

    // Step 3: If no trip found, display "No upcoming trips"
    if (!nextTripDay) {
      tripLabel = "لا توجد رحلة قادمة";
    }

    setNextTripText(tripLabel);
  }, [student?.trip_status, student?.timetable]);

  // Next return trip date
  useEffect(() => {
    if (!student?.driver_id || student?.trip_status !== "at destination") return;

    const riderTimetable = student?.timetable || [];
    if (!riderTimetable.length) {
      setReturnTripText("لا توجد رحلة عودة");
      return;
    }

    const now = new Date();
    const todayIndex = now.getDay(); // 0=Sunday, ..., 6=Saturday
    const sortedTimetable = [...riderTimetable].sort((a, b) => a.id - b.id);
    let returnTripDay = null;
    let tripLabel = "لا توجد رحلة عودة";

    const formatTimeWithPeriod = (date) => {
      let hours = date.getHours();
      let minutes = date.getMinutes();
      const period = hours >= 12 ? "مساءً" : "صباحًا";

      // Convert to 12-hour format
      hours = hours % 12 || 12; // Convert 0 (midnight) and 12 (noon) correctly

      return `${toArabicNumbers(hours.toString().padStart(2, "0"))}:${toArabicNumbers(minutes.toString().padStart(2, "0"))} ${period}`;
    };

    // **Step 1: Check today's return time first**
    const todaySchedule = sortedTimetable.find(day => day.id === todayIndex && day.active);
    if (todaySchedule && todaySchedule.endTime) {
      let endTimeDate = todaySchedule.endTime.toDate();

      const nowHours = now.getHours();
      const nowMinutes = now.getMinutes();

      let endHours = endTimeDate.getHours();
      let endMinutes = endTimeDate.getMinutes();

      if (endHours > nowHours || (endHours === nowHours && endMinutes > nowMinutes)) {
        returnTripDay = "اليوم";
        tripLabel = `${returnTripDay} الساعة ${formatTimeWithPeriod(endTimeDate)}`;
      }
    }

    // **Step 2: If today's return time has passed, find the next active return time (looping over the week)**
    if (!returnTripDay) {
      for (let i = 1; i <= 7; i++) { // Max 7-day search ensures looping back to Sunday
        let nextIndex = (todayIndex + i) % 7; // Loop back after Saturday
        const nextDay = sortedTimetable.find(day => day.id === nextIndex && day.active);

        if (nextDay && nextDay.endTime) {
          let endTimeDate = nextDay.endTime.toDate();
          returnTripDay = i === 1 ? "غدا" : nextDay.day; // "غدا" for tomorrow, else use DB day name
          tripLabel = `${returnTripDay} الساعة ${formatTimeWithPeriod(endTimeDate)}`;
          break;
        }
      }
    }

    // **Step 3: If no return trip found, display "No return trip"**
    if (!returnTripDay) {
      tripLabel = "لا توجد رحلة عودة";
    }

    setReturnTripText(tripLabel);
  }, [student?.trip_status, student?.timetable]);


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
    if (student.trip_status === 'to destination') {
      setDestination(student.destination_location)
      setDriverOriginLocation(driverCurrentLocation)
    } else if (student.trip_status === 'to home') {
      setDestination(student.home_location.coords);
      setDriverOriginLocation(driverCurrentLocation)
    }
  }, [student.trip_status])

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
  }, [mapReady,destination])
  
  // Function to handle canceling the trip
  const handleCancelTrip = async () => {
    if (cancelText.trim() !== 'نعم') {
      createAlert('لتاكيد الالغاء يرجى كتابة نعم');
      return;
    }
  
    try {
      const batch = writeBatch(DB);
      const riderDocRef = doc(DB, 'riders', student.id);
  
      // Step 1: Update Rider Document
      batch.update(riderDocRef, { tomorrow_trip_canceled: true });
  
      // Step 2: Fetch Driver Document
      const driverDocRef = doc(DB, 'drivers', student.driver_id);
      const driverSnap = await getDoc(driverDocRef);
  
      if (!driverSnap.exists()) {
        createAlert('لم يتم العثور على السائق');
        return;
      }
  
      const driverData = driverSnap.data();
      const updatedLines = driverData.line.map((line) => {
        if (line.line_destination === student.destination) {
          return {
            ...line,
            riders: line.riders.map((rider) =>
              rider.id === student.id
                ? { ...rider, tomorrow_trip_canceled: true } // Step 4: Update student trip cancellation
                : rider
            ),
          };
        }
        return line;
      });
  
      batch.update(driverDocRef, { line: updatedLines });
      await batch.commit();
      setIsCanceling(false);
      setCancelText('');
    } catch (error) {
      console.error("Error canceling trip:", error);
      createAlert('حدث خطأ أثناء إلغاء الرحلة. حاول مرة أخرى.');
    }
  }

  // Deny canceling the trip
  const handleDenyCancelTrip = () => {
    setIsCanceling(false);
    setCancelText('');
  }

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
        key={`Destination ${student?.id}`}
        coordinate={destination}
        title={student?.trip_status === 'to destination' ? 'المدرسة' : 'المنزل'}
        pinColor="red"
      />
    </MapView>
  );

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
        <View style={styles.student_container}>
          <View style={styles.no_driver_animation_container}>
            <LottieView
              source={driverWaiting}
              autoPlay
              loop
              style={{ width: 250, height: 250}}
            />
          </View>
          <View style={styles.not_connected_to_driver}>
            <Text style={styles.not_connected_to_driver_text}>جاري ربط الحساب بسائق</Text>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  // If the student is at home
  if(student.driver_id && student.trip_status === 'at home') {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.student_container}>
          <View style={styles.next_trip_box}>
            <View style={styles.trip_ready_animation_container}>
              <LottieView
                source={tripReady}
                autoPlay
                loop
                style={{ width: 250, height: 250}}
              />
            </View>
            <View style={styles.next_trip_text_box}>
              <Text style={styles.next_trip_text}>رحلتك القادمة الى المدرسة</Text>
              <Text style={styles.next_trip_counter_text}>{nextTripText}</Text>
            </View>            
          </View> 
          {!student.tomorrow_trip_canceled && (
            <View style={styles.cancel_trip_btn_container}>
              <TouchableOpacity style={styles.cancel_trip_btn} onPress={() => setIsCanceling(true)}>
                <Text style={styles.cancel_trip_btn_text}>الغاء الرحلة القادمة</Text>
              </TouchableOpacity>
              {isCanceling && (
                <View style={styles.cancel_trip_confirmation}>
                  <TextInput
                    style={styles.cancel_trip_input}
                    placeholderTextColor={colors.BLACK}
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
  if(student.driver_id && student.trip_status === 'at destination') {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.student_container}>
          <View style={styles.next_trip_box}>
            <View style={styles.trip_ready_animation_container}>
              <LottieView
                source={tripReady}
                autoPlay
                loop
                style={{ width: 250, height: 250}}
              />
            </View>
            <View style={styles.next_trip_text_box}>
              <Text style={styles.next_trip_text}>رحلتك القادمة الى المنزل</Text>
              <Text style={styles.next_trip_counter_text}>{returnTripText}</Text>
            </View>
          </View> 
        </View>
      </SafeAreaView>
    )
  }

  // If the student is going to school
  if(student.driver_id && student.trip_status === 'to destination'){
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
  if(student.driver_id && student.trip_status === 'to home') {
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
  student_container:{
    width:'100%',
    height:'100%',
    alignItems:'center',
    justifyContent:'center',
  },
  no_driver_animation_container:{
    width:200,
    height:200,
    justifyContent:'center',
    alignItems:'center',
  },
  not_connected_to_driver:{
    width:'100%',
    height:100,
    justifyContent:'center',
    alignItems:'center',
  },
  not_connected_to_driver_text:{
    fontFamily: 'Cairo_700Bold',
    color:colors.BLACK,
    lineHeight:100
  },
  next_trip_box:{
    width:300,
    height:350,
    marginTop:55,
    borderRadius:15,
    alignItems:'center',
    justifyContent:'center',
  },
  trip_ready_animation_container:{
    width:250,
    height:250,
    justifyContent:'center',
    alignItems:'center',
  },
  next_trip_text_box:{
    height:70,
    justifyContent:'space-between',
    alignItems:'center',
  },
  next_trip_text:{
    width:300,
    lineHeight:30,
    verticalAlign:'middle',
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    fontSize:15,
  },
  next_trip_counter_text:{
    width:300,
    lineHeight:30,
    verticalAlign:'middle',
    textAlign:'center',
    fontFamily: 'Cairo_700Bold',
    fontSize:15,
  },
  cancel_trip_btn_container:{
    width:300,
    height:130,
    justifyContent:'center',
    alignItems:'center',
  },
  cancel_trip_btn:{
    backgroundColor:colors.BLUE,
    width:200,
    height:40,
    borderRadius:15,
  },
  cancel_trip_btn_text:{
    lineHeight:40,
    verticalAlign:'middle',
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    fontSize:15,
    color:colors.WHITE,
  },
  cancel_trip_input:{
    width:200,
    padding:7,
    borderRadius:15,
    borderColor:'#ddd',
    borderWidth:1,
    marginTop:7,
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
    width:80,
    height:35,
    borderRadius:15,
    marginTop:7
  },
  deny_cancel_btn:{
    width:80,
    height:35,
    borderWidth:1,
    borderColor:colors.BLUE,
    borderRadius:15,
    marginTop:7
  },
  confirm_cancel_btn_text:{
    lineHeight:35,
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    fontSize:15,
    color:colors.WHITE
  },
  deny_cancel_btn_text:{
    lineHeight:35,
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
    top:80,
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
    verticalAlign:'middle',
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

