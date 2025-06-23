import {useState,useEffect,useRef} from 'react'
import { Alert,StyleSheet,Text,View,ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, {Circle} from 'react-native-svg'
import haversine from 'haversine'
import MapView, { Marker ,AnimatedRegion } from 'react-native-maps'
import MapViewDirections from 'react-native-maps-directions'
import { getDoc,doc,onSnapshot } from 'firebase/firestore'
import { DB } from '../firebaseConfig'
import dayjs from '../utils/dayjs'
import LottieView from "lottie-react-native"
import colors from '../constants/Colors'
import tripReady from '../assets/animations/school_bus.json'
import noRiderData from '../assets/animations/waiting_driver.json'
import LineWithoutDriver from './LineWithoutDriver'
import LinesFeed from './LinesFeed'

const toArabicNumbers = (num) => num.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d])

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

  console.log(rider?.id)

  const now = new Date();
  const endDate = rider?.service_period?.end_date?.toDate?.() || new Date(0);
  const isSubscriptionExpired = now > endDate;

  // Rider today status
  useEffect(() => {
    const checkTodayJourney = async () => {
      try {
        const iraqNow = dayjs().utcOffset(180);
        const yearMonthKey = `${iraqNow.year()}-${String(iraqNow.month() + 1).padStart(2, "0")}`;
        const dayKey = String(iraqNow.date()).padStart(2, "0");
  
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
      }
    };
  
    if (rider?.driver_id) {
      checkTodayJourney();
    }
  }, [rider?.driver_id]);

  // Next trip date
  useEffect(() => {
    const fetchNextTrip = async () => {
      if (!rider?.driver_id || rider?.trip_status !== "at home" || !rider?.line_id) return;

      try {
        const lineSnap = await getDoc(doc(DB, "lines", rider.line_id));
        if (!lineSnap.exists()) {
          setNextTripText("لا توجد رحلة قادمة");
          return;
        }

        const lineData = lineSnap.data();
        const timetable = lineData?.timeTable || [];

        if (!timetable.length) {
          setNextTripText("لا توجد رحلة قادمة");
          return;
        }

        const now = new Date();
        const todayIndex = now.getDay(); // 0=Sunday, ..., 6=Saturday
        const sortedTimetable = [...timetable].sort((a, b) => a.id - b.id);

        let nextTripDay = null;
        let tripLabel = "لا توجد رحلة قادمة";

        const formatTimeWithPeriod = (date) => {
          let hours = date.getHours();
          let minutes = date.getMinutes();
          const period = hours >= 12 ? "مساءً" : "صباحًا";
          hours = hours % 12 || 12;
          return `${toArabicNumbers(hours.toString().padStart(2, "0"))}:${toArabicNumbers(minutes.toString().padStart(2, "0"))} ${period}`;
        };

        // Step 1: Check today's trip
        const todaySchedule = sortedTimetable.find(day => day.dayIndex === todayIndex && day.active);
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

        // Step 2: Find the next upcoming trip if today's passed
        if (!nextTripDay) {
          for (let i = 1; i <= 7; i++) {
            let nextIndex = (todayIndex + i) % 7;
            const nextDay = sortedTimetable.find(day => day.dayIndex === nextIndex && day.active);
            if (nextDay && nextDay.startTime) {
              let startTimeDate = nextDay.startTime.toDate();
              nextTripDay = i === 1 ? "غدا" : nextDay.day;
              tripLabel = `${nextTripDay} الساعة ${formatTimeWithPeriod(startTimeDate)}`;
              break;
            }
          }
        }

        setNextTripText(tripLabel);
      } catch (err) {
        setNextTripText("لا توجد رحلة قادمة");
      }
    };

    fetchNextTrip();
  }, [rider?.trip_status, rider?.driver_id, rider?.line_id]);

  // Next return to home trip date
  useEffect(() => {
    const fetchReturnTrip = async () => {
      if (!rider?.driver_id || rider?.trip_status !== "at destination" || !rider?.line_id) return;

      try {
        const lineSnap = await getDoc(doc(DB, "lines", rider.line_id));
        if (!lineSnap.exists()) {
          setReturnTripText("لا توجد رحلة عودة");
          return;
        }

        const lineData = lineSnap.data();
        const timetable = lineData?.timeTable || [];

        if (!timetable.length) {
          setReturnTripText("لا توجد رحلة عودة");
          return;
        }

        const now = new Date();
        const todayIndex = now.getDay(); // 0 = Sunday, ..., 6 = Saturday
        const sortedTimetable = [...timetable].sort((a, b) => a.id - b.id);
        let returnTripDay = null;
        let tripLabel = "لا توجد رحلة عودة";

        const formatTimeWithPeriod = (date) => {
          let hours = date.getHours();
          let minutes = date.getMinutes();
          const period = hours >= 12 ? "مساءً" : "صباحًا";
          hours = hours % 12 || 12;
          return `${toArabicNumbers(hours.toString().padStart(2, "0"))}:${toArabicNumbers(minutes.toString().padStart(2, "0"))} ${period}`;
        };

        // Step 1: Check today's return time first
        const todaySchedule = sortedTimetable.find(day => day.dayIndex === todayIndex && day.active);
        
        if (todaySchedule && todaySchedule.endTime) {
          let endTimeDate = todaySchedule.endTime.toDate();
          const nowHours = now.getHours();
          const nowMinutes = now.getMinutes();
          const endHours = endTimeDate.getHours();
          const endMinutes = endTimeDate.getMinutes();

          if (endHours > nowHours || (endHours === nowHours && endMinutes > nowMinutes)) {
            returnTripDay = "اليوم";
            tripLabel = `${returnTripDay} الساعة ${formatTimeWithPeriod(endTimeDate)}`;
          }
        }

        // Step 2: Find next available return time if today's has passed
        if (!returnTripDay) {
          for (let i = 1; i <= 7; i++) {
            let nextIndex = (todayIndex + i) % 7;
            const nextDay = sortedTimetable.find(day => day.dayIndex === nextIndex && day.active);

            if (nextDay && nextDay.endTime) {
              let endTimeDate = nextDay.endTime.toDate();
              returnTripDay = i === 1 ? "غدا" : nextDay.day;
              tripLabel = `${returnTripDay} الساعة ${formatTimeWithPeriod(endTimeDate)}`;
              break;
            }
          }
        }

        setReturnTripText(tripLabel);
      } catch (err) {
        setReturnTripText("لا توجد رحلة عودة");
      }
    };

    fetchReturnTrip();
  }, [rider?.trip_status, rider?.driver_id, rider?.line_id]);

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
            setDriverCurrentLocationLoading(false)
          }
        },
        (error) => {
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
  
  /*
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

  //{renderDirections()}
  */

  // Return map and marker based on the trip status
  const renderMap = () => (
    <MapView
      ref={mapRef}
      onMapReady={handleMapReady}
      provider="google"
      initialRegion={{
        latitude: driverCurrentLocation?.latitude || 0,
        longitude: driverCurrentLocation?.longitude || 0,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
      loadingEnabled={true}
      style={styles.map}
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

      <Marker
        key={`Destination ${rider?.id}`}
        coordinate={destination}
        title={rider?.trip_status === 'to destination' ? 'المدرسة' : 'المنزل'}
        pinColor="red"
      />
    </MapView>
  );

  // track driver only marker (driver start the trip didnt reach rider home yet)
  const driverOnlyMarker = () => (
    <MapView
      ref={mapRef}
      onMapReady={handleMapReady}
      provider="google"
      initialRegion={{
        latitude: driverCurrentLocation?.latitude || 0,
        longitude: driverCurrentLocation?.longitude || 0,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
      loadingEnabled={true}
      style={styles.map}
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

      <Marker
        key={`Destination ${rider?.id}`}
        coordinate={rider.home_location}
        //title={rider?.trip_status === 'to destination' ? 'المدرسة' : 'المنزل'}
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

  //If rider subs expired
  if(
    rider.line_id &&
    rider.driver_id &&
    isSubscriptionExpired
  ) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.rider_container}>
          <View style={styles.next_trip_box}>
            <View style={styles.trip_ready_animation_container}>
              <LottieView
                source={noRiderData}
                autoPlay
                loop
                style={{ width: 250, height: 250}}
              />
            </View>
            <View style={styles.next_trip_text_box}>
              <Text style={styles.next_trip_text}>لقد انتهى اشتراكك. يرجى تجديد الاشتراك للاستمرار في استخدام الخدمة.</Text>
            </View>
          </View> 
        </View>
      </SafeAreaView>
    );
  }

  // If the rider is at home
  if(
    rider.line_id && 
    rider.driver_id && 
    isSubscriptionExpired === false &&
    todayJourneyStarted === false
  ) {
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
              <Text style={styles.next_trip_text}>
                رحلتك القادمة إلى {rider.destination}
              </Text>        
              <Text style={styles.next_trip_counter_text}>{nextTripText}</Text>
            </View>            
          </View> 
        </View>
      </SafeAreaView>
    )
  }

  // If the driver start the today journey but didnt pick the rider so he stay at home
  if( 
      rider.line_id && 
      rider.driver_id && 
      isSubscriptionExpired === false &&
      todayJourneyStarted !== false && 
      rider.trip_status === 'at home' &&
      rider.checked_at_home === true 
    ) {
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
              <Text style={styles.next_trip_text}>
                رحلتك القادمة إلى {rider.destination}
              </Text>  
              <Text style={styles.next_trip_counter_text}>{nextTripText}</Text>
            </View>            
          </View> 
        </View>
      </SafeAreaView>
    )
  }

  // If the driver start the today journey but didnt reach the rider home yet
  if( 
      rider.line_id && 
      rider.driver_id && 
      isSubscriptionExpired === false &&
      todayJourneyStarted !== false && 
      rider.trip_status === 'at home' &&
      rider.checked_at_home === false
    ) {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.rider_route_status_container}>
          <View style={styles.rider_route_status_box}>
            <Text style={styles.rider_route_status_text}>السائق بدا رحلة الذهاب</Text>
          </View>
        </View>
        <View style={styles.rider_map_container}>
          {driverOnlyMarker()}
        </View>
      </SafeAreaView>
    )
  }

  // If the rider is at school
  if( 
      rider.line_id &&
      rider.driver_id && 
      isSubscriptionExpired === false &&
      todayJourneyStarted !== false &&
      rider.trip_status === 'at destination'
    ) {
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
  if(
    rider.line_id && 
    rider.driver_id && 
    isSubscriptionExpired === false &&
    todayJourneyStarted !== false && 
    rider.trip_status === 'to destination'
  ) {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.rider_route_status_container}>
         <View style={styles.rider_route_status_box}>
            <Text style={styles.rider_route_status_text}>
              الراكب في الطريق إلى {rider.destination}
            </Text>
          </View>
        </View>
        <View style={styles.rider_map_container}>
          {renderMap()}
        </View>
      </SafeAreaView>
    )
  }

  /*
  // If the rider is going to home
  if(
    rider.line_id && 
    rider.driver_id && 
    isSubscriptionExpired === false &&
    todayJourneyStarted !== false && 
    rider.trip_status === 'to home'
  ) {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.rider_route_status_container}>
          <View style={styles.rider_route_status_box}>
            <Text style={styles.rider_route_status_text}>الراكب في الطريق الى المنزل</Text>
          </View>
        </View>
        <View style={styles.rider_map_container}>
          {renderMap()}
        </View>
      </SafeAreaView>
    )
  }
*/

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.rider_container}>
        <View style={styles.next_trip_box}>
          <View style={styles.trip_ready_animation_container}>
            <LottieView
              source={noRiderData}
              autoPlay
              loop
              style={{ width: 250, height: 250}}
            />
          </View>
          <View style={styles.next_trip_text_box}>
            <Text style={styles.next_trip_text}>لا توجد بيانات متاحة للراكب حاليا</Text>
          </View>
        </View> 
      </View>
    </SafeAreaView>
  );
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
    height:60,
    marginTop:40,
    justifyContent:'space-between',
    alignItems:'center',
  },
  next_trip_text:{
    width:300,
    lineHeight:30,
    verticalAlign:'middle',
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    fontSize:14,
  },
  next_trip_counter_text:{
    width:300,
    lineHeight:30,
    verticalAlign:'middle',
    textAlign:'center',
    fontFamily: 'Cairo_700Bold',
    fontSize:14,
  },
  rider_map_container:{
    width:500,
    height:800,
    position:'relative',
  },
  rider_route_status_container:{
    width:500,
    position:'absolute',
    top:60,
    left:0,
    zIndex:100,
    alignItems:'center',
    justifyContent:'center',
  },
  rider_route_status_box:{
    width:320,
    height:45,
    borderRadius:15,
    alignItems:'center',
    justifyContent:'center',
    backgroundColor:colors.WHITE,
    shadowColor:'#000',
    shadowOffset:{width:0,height:2},
    shadowOpacity:0.3,
    shadowRadius:4,
    elevation:5,
  },
  rider_route_status_text:{
    lineHeight:45,
    verticalAlign:'middle',
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    fontSize:15,
    color:colors.BLACK,
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
