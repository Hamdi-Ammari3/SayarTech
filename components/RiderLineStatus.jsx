import {useState,useEffect,useRef} from 'react'
import { Alert,StyleSheet,Text,View,ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, {Circle} from 'react-native-svg'
import haversine from 'haversine'
import MapView, { Marker ,AnimatedRegion } from 'react-native-maps'
import MapViewDirections from 'react-native-maps-directions'
import { getDoc,doc,onSnapshot } from 'firebase/firestore'
import { DB } from '../firebaseConfig'
import LottieView from "lottie-react-native"
import colors from '../constants/Colors'
import tripReady from '../assets/animations/school_bus.json'
import LineWithoutDriver from './LineWithoutDriver'
import LinesFeed from './LinesFeed'

const toArabicNumbers = (num) => num.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d])

// ****  calculate the rider subscription fee on adding new rider page and create the bill when the line taken by a driver
// ****  if we switch the line to driver B riders must track the new driver location and not the old one

const RiderLineStatus = ({rider}) => {
  const GOOGLE_MAPS_APIKEY = ''
  const mapRef = useRef(null)
  const markerRef = useRef(null)

  const [nextTripText, setNextTripText] = useState("")
  const [returnTripText, setReturnTripText] = useState("")
  const [driverOriginLocation,setDriverOriginLocation] = useState(null)
  const [destination, setDestination] = useState(null)
  const [driverCurrentLocation, setDriverCurrentLocation] = useState(null)
  const [driverCurrentLocationLoading, setDriverCurrentLocationLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const [todayJourneyStarted, setTodayJourneyStarted] = useState(false)

  const createAlert = (alerMessage) => {
    Alert.alert(alerMessage)
  }

  // Rider today status
  useEffect(() => {
    const checkTodayJourney = async () => {
      try {
        const iraqTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Baghdad" });
        const [month, day, year] = iraqTime.split(/[/, ]/);
        const yearMonthKey = `${year}-${month.padStart(2, "0")}`;
        const dayKey = day.padStart(2, "0");
  
        const driverDoc = await getDoc(doc(DB, "drivers", rider?.driver_id));
        if (!driverDoc.exists()) {
          setTodayJourneyStarted(false);
          return;
        }
  
        const driverData = driverDoc.data();
        const journeyCheck = driverData?.dailyTracking?.[yearMonthKey]?.[dayKey]?.start_the_journey || false;
        setTodayJourneyStarted(journeyCheck);
      } catch (error) {
        createAlert("حدث خطأ أثناء التحقق من حالة الرحلة اليوم.");
        console.log("Error checking today's journey:", error);
      }
    };
  
    if (rider?.driver_id) {
      checkTodayJourney();
    }
  }, [rider?.driver_id]);

  // Next trip date
  useEffect(() => {
    if (!rider?.driver_id || rider?.trip_status !== "at home") return;

    const riderTimetable = rider?.timetable || [];
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
  }, [rider?.trip_status, rider?.timetable]);

  // Next return trip date
  useEffect(() => {
    if (!rider?.driver_id || rider?.trip_status !== "at destination") return;

    const riderTimetable = rider?.timetable || [];
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
  }, [rider?.trip_status, rider?.timetable]);

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
    if (rider.driver_id) {
      const driverRef = doc(DB, 'drivers', rider.driver_id)
  
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
  }, [rider.driver_id, driverCurrentLocation]);

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

  // Set destination based on rider trip status
  useEffect(() => {
    if (rider.trip_status === 'to destination') {
      setDestination(rider.destination_location)
      setDriverOriginLocation(driverCurrentLocation)
    } else if (rider.trip_status === 'to home') {
      setDestination(rider.home_location);
      setDriverOriginLocation(driverCurrentLocation)
    }
  }, [rider.trip_status])

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
        key={`Destination ${rider?.id}`}
        coordinate={destination}
        title={rider?.trip_status === 'to destination' ? 'المدرسة' : 'المنزل'}
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

  // If the rider not joining a line yet
  if(!rider.line_id) {
    return(
      <SafeAreaView style={styles.container}>
        <LinesFeed rider={rider}/>
      </SafeAreaView>
    )
  }

  // If rider join a line not taken by a driver yet
  if(rider.line_id && rider.driver_id === null) {
    return(
      <SafeAreaView style={styles.container}>
        <LineWithoutDriver rider={rider}/>
      </SafeAreaView>
    )
  }

  // If the rider is at home
  if(rider.line_id && rider.driver_id && (todayJourneyStarted === false || rider.trip_status === 'at home')) {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.rider_container}>
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
        </View>
      </SafeAreaView>
    )
  }

  // If the rider is at school
  if(rider.line_id && rider.driver_id && todayJourneyStarted !== false && rider.trip_status === 'at destination') {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.rider_container}>
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

  // If the rider is going to school
  if(rider.line_id && rider.driver_id && todayJourneyStarted !== false && rider.trip_status === 'to destination'){
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.rider_route_status_container}>
         <View style={styles.rider_route_status_box}>
            <Text style={styles.rider_route_status_text}>الطالب في الطريق الى المدرسة</Text>
          </View>
        </View>
        <View style={styles.rider_map_container}>
          {renderMap()}
        </View>
      </SafeAreaView>
    )
  }

  // If the rider is going to home
  if(rider.line_id && rider.driver_id && todayJourneyStarted !== false && rider.trip_status === 'to home') {
    return(
      <SafeAreaView style={styles.container}>
        <View style={srider_route_status_container}>
          <View style={styles.rider_route_status_box}>
            <Text style={styles.rider_route_status_text}>{rider.picked_up ? 'الطالب في الطريق الى المنزل' : 'السائق في الاتجاه اليك'}</Text>
          </View>
        </View>
        <View style={styles.rider_map_container}>
          {renderMap()}
        </View>
      </SafeAreaView>
    )
  }
}

export default RiderLineStatus

const styles = StyleSheet.create({
  container:{
    flex:1,
  },
  rider_container:{
    width:'100%',
    height:'100%',
    alignItems:'center',
    justifyContent:'center',
  },
  next_trip_box:{
    width:300,
    height:350,
    marginTop:0,
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
  rider_map_container:{
    width:500,
    height:800,
    position:'relative',
  },
  rider_route_status_container:{
    width:500,
    position:'absolute',
    top:80,
    left:0,
    zIndex:100,
    alignItems:'center',
    justifyContent:'center',
  },
  rider_route_status_box:{
    backgroundColor:colors.BLUE,
    width:250,
    height:50,
    borderRadius:15,
    alignItems:'center',
    justifyContent:'center'
  },
  rider_route_status_text:{
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
