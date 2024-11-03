import { Alert,StyleSheet, Text, View, ActivityIndicator, TouchableOpacity,ScrollView, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useUser } from '@clerk/clerk-expo'
import { useState,useEffect,useRef } from 'react'
import * as Location from 'expo-location'
import MapView, { Marker } from 'react-native-maps'
import MapViewDirections from 'react-native-maps-directions'
import haversine from 'haversine'
import { doc,updateDoc } from 'firebase/firestore'
import { DB } from '../../../../firebaseConfig'
import { Link } from 'expo-router'
import colors from '../../../../constants/Colors'
import { useDriverData } from '../../../stateManagment/DriverContext'
import AntDesign from '@expo/vector-icons/AntDesign'
import Feather from '@expo/vector-icons/Feather'

const GOOGLE_MAPS_APIKEY = 'google maps api key'

const Home = () => {
  const {fetchingUserDataLoading,driverData,fetchingDriverDataLoading,assignedStudents,fetchingAssignedStudetns} = useDriverData()

  const { isLoaded,user } = useUser()
  const [sortedStudents, setSortedStudents] = useState([])
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0)
  const [displayFinalStation,setDisplayFinalStation] = useState(false)
  const [currentTrip, setCurrentTrip] = useState('first')
  const [isMarkingStudent, setIsMarkingStudent] = useState(false)
  const [checkingPickedUpStudents, setCheckingPickedUpStudents] = useState(false)
  const [checkingStudentId, setCheckingStudentId] = useState(null)
  const [finishingTrip, setFinishingTrip] = useState(false)
  const [cancelTodayTrip, setCancelTodayTrip] = useState(false)
  const[ pickedUpStudentsFromHome, setPickedUpStudentsFromHome] = useState([])
  const [driverCurrentLocation, setDriverCurrentLocation] = useState(null)
  const mapRef = useRef(null)
  const [destination, setDestination] = useState(null)

  const createAlert = (alerMessage) => {
    Alert.alert(alerMessage)
  }

  // Fetch the driver's current location
  useEffect(() => {
    if (fetchingDriverDataLoading === false && driverData[0]) {
      const startTracking = async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
  
        if (status !== 'granted') {
          createAlert('الرجاء تفعيل الصلاحيات للوصول الى الموقع');
          return;
        }
  
        await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 20,
            timeInterval: 5000,
          },
          (newLocation) => {
            const { latitude, longitude } = newLocation.coords;
            setDriverCurrentLocation(newLocation.coords);
            saveLocationToFirebase(latitude, longitude);
          }
        );
      };
  
      startTracking();
    }
  }, [fetchingDriverDataLoading,driverData]);
  
//Save new location to firebase
  const saveLocationToFirebase = async (latitude, longitude) => {
    if (!driverData[0]) {
      return
    }

  try {
    const driverDoc = doc(DB, 'drivers', driverData[0]?.id);
    await updateDoc(driverDoc, {
      current_location: {
        latitude: latitude,
        longitude: longitude
      },
    });
  } catch (error) {
    Alert.alert('خطا اثناء تحديث الموقع');
  }
}

// sort students by distance
useEffect(() => {
  const sortStudentsByDistance = async () => {
    if (!user || !driverData[0] || !assignedStudents.length) {
      return;
    }

    try {
      let startingPoint = driverData[0]?.current_location;
      let sorted = [];

      if (currentTrip === 'first') {  
          sorted = assignedStudents.filter(student => student.tomorrow_trip_canceled === false)
          .map((student) => ({
            ...student,
            distance: calculateDistance(startingPoint, student.student_home_location.coords),
          }))
          .sort((a, b) => a.distance - b.distance);

          sorted.push({
            id: 'school',
            school_name: assignedStudents[0].student_school,
            school_coords: assignedStudents[0].student_school_location,
          });

      } else if (currentTrip === 'second') {
          sorted = assignedStudents.filter(student => student.picked_up === true)
                                    .filter(student => student.picked_from_school === true)
          .map((student) => ({
            ...student,
            distance: calculateDistance(startingPoint, student.student_home_location.coords),
          }))
          .sort((a, b) => a.distance - b.distance);

          sorted.push({
            id: 'driver_home',
            driver_home_coords: driverData[0].driver_home_location.coords,
          });
      }

      setSortedStudents(sorted);

    } catch (err) {
      createAlert('حدث خطأ اثناء تحديد موقع الطلاب')
    }
  };
  sortStudentsByDistance();
}, [driverData[0], assignedStudents, currentTrip]);

// Function to calculate distance between two coordinates
  const calculateDistance = (coord1, coord2) => {
    return haversine(coord1, coord2, { unit: 'meter' });
  };

  const getCoordinates = (location) => {
    return {
      latitude: location.latitude,
      longitude: location.longitude
    };
  };

  const currentStudent = sortedStudents[currentStudentIndex]

// Set destination based on student trip status
  useEffect(() => { 
    if (displayFinalStation === true) {
      setDestination(currentStudent?.school_coords);
    } else if (displayFinalStation === false) {
      setDestination(currentStudent?.student_home_location?.coords);
    }
  }, [displayFinalStation,currentStudent]);
 
 // Fit both markers in the map view
  useEffect(() => {
    if (mapRef.current && driverCurrentLocation && destination) {
      mapRef.current.fitToCoordinates([driverCurrentLocation, destination], {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  }, [driverCurrentLocation, destination]);

  const sendNotification = async (token, title, body) => {
    try {
      const message = {
        to: token,
        sound: 'default',
        title: title,
        body: body,
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
      console.error("Error sending notification:", error);
    }
  }

// Click the button to start the first trip
  const handleFirstTripStart = async () => {
    // Save the trip start time and status to the database
    try {
      const driverDoc = doc(DB,'drivers', driverData[0].id)
      await updateDoc(driverDoc, { 
        first_trip_status: 'started',
        first_trip_start: new Date(),
        second_trip_status:'not started'
      })

      // Update all assigned students status (the driver start mouving)
      for (const student of assignedStudents) {
        const studentDoc = doc(DB, 'students', student.id);
        await updateDoc(studentDoc, {
          student_trip_status: 'going to home',
        });

        if(student.student_user_notification_token) {
          await sendNotification(
            student.student_user_notification_token,
            "السائق بدأ الرحلة",
            'السائق في الطريق اليك'
          );
        }
      }

    } catch (error) {
      alert('حدث خطأ اثناء بدء الرحلة') 
      console.log(error)
    }
  }

// Click the button to finish the first trip
  const handleFirstTripFinish = async () => {
    try {
      const driverDoc = doc(DB,'drivers', driverData[0].id)
      const pickedUpStudents = assignedStudents.filter(student => student.picked_up);

      await updateDoc(driverDoc, { 
        first_trip_status: 'finished',
        first_trip_end: new Date(),
      })

      // Update student statuses
      for (const student of pickedUpStudents) {
        const studentDoc = doc(DB, 'students', student.id);
        await updateDoc(studentDoc, {
          student_trip_status: 'at school',
        });

        if(student.student_user_notification_token) {
          await sendNotification(
            student.student_user_notification_token,
            "الطالب وصل المدرسة بسلام",
            `${student.student_full_name} وصل المدرسة الان`
          )
        }

        // Reset state variables
        setCurrentTrip('second');
        setCurrentStudentIndex(0);
        setDisplayFinalStation(false);
        setSortedStudents([]);
        setCancelTodayTrip(false)
        setPickedUpStudentsFromHome([])
      }
    } catch (error) {
      alert('حدث خطأ اثناء انهاء الرحلة')
    }
  }

// Click the button to start the second trip
const handlesecondTripStart = async () => {
  try {
    const driverDoc = doc(DB, 'drivers', driverData[0].id);
    await updateDoc(driverDoc, { 
      second_trip_status: 'started', 
      second_trip_start: new Date(),
      first_trip_status: 'not started',
    });

    // Update students status (students picked up from school)
    const pickedUpStudents = assignedStudents.filter(student => student.picked_from_school === true);
    for (const student of pickedUpStudents) {
      const studentDoc = doc(DB, 'students', student.id);
      await updateDoc(studentDoc, {
        student_trip_status: 'going to home',
      });

      if(student.student_user_notification_token) {
        await sendNotification(
          student.student_user_notification_token,
          "رحلة العودة بدأت",
          `${student.student_full_name} في الطريق إلى المنزل الآن`
        )
      }
    }

    // Update students status (students not picked up from school)
    const notPickedUpStudents = assignedStudents.filter(student => student.picked_from_school === false);
    for (const student of notPickedUpStudents) {
      const studentDoc = doc(DB, 'students', student.id);
      await updateDoc(studentDoc, {
        student_trip_status: 'at home',
      });
    }

  } catch (error) {
    alert('حدث خطأ اثناء بدء الرحلة')
  }
};

// Click the button to finish the second trip
const handlesecondTripFinish = async () => {
  try {
    setFinishingTrip(true)
    const driverDoc = doc(DB,'drivers', driverData[0].id)
    await updateDoc(driverDoc, { 
      second_trip_status: 'finished', 
      second_trip_end: new Date(),
      first_trip_status: 'not started',
      trip_canceled: false
    })

    //update students status
    for (const student of assignedStudents) {
      const studentDoc = doc(DB, 'students', student.id);
      await updateDoc(studentDoc, {
        picked_up: false,
        dropped_off: false,
        called_by_driver: false,
        picked_from_school: false,
        checked_in_front_of_school: false,
        tomorrow_trip_canceled: false,
        student_trip_status: 'at home',
        driver_is_mouving: false,
      });

    }
    // Reset state variables
    setCurrentTrip('first');
    setCurrentStudentIndex(0);
    setDisplayFinalStation(false);
    setSortedStudents([]);
    setCheckingPickedUpStudents(false)
    setCheckingStudentId(null)
    setCancelTodayTrip(false)
    setPickedUpStudentsFromHome([])
    
  } catch (error) {
    alert('حدث خطأ اثناء انهاء الرحلة')
  } finally {
    setFinishingTrip(false)
  }
}

// move to the next student location
const markStudent = async (status) => {

  if (isMarkingStudent) return; // Prevent double-click

  setIsMarkingStudent(true); // Set loading state to true

  const currentStudent = sortedStudents[currentStudentIndex];

  if (currentStudent) {
    try {
      if (currentStudent.id !== 'school' && currentStudent.id !== 'driver_home') {
        const studentDoc = doc(DB, 'students', currentStudent.id);
        const updateField = currentTrip === 'first' ? 
          { picked_up: status,student_trip_status: status ? 'going to school' :'at home'} : 
          { dropped_off: status, student_trip_status:'at home' };
          await updateDoc(studentDoc, updateField);
      }

      // Local tracking of picked-up students
      let updatedPickedUpStudents = [...pickedUpStudentsFromHome]
      if (status === true) {
        updatedPickedUpStudents.push(currentStudent); // Add the current student to the picked-up list
        setPickedUpStudentsFromHome(updatedPickedUpStudents); // Update state with the new list
        if(currentStudent.student_user_notification_token) {
          if(currentTrip === 'first') {
            await sendNotification(
              currentStudent.student_user_notification_token,
              "رحلة المدرسة بدأت",
              `${currentStudent.student_full_name} في الطريق إلى المدرسة الآن`
            );
          } else {
            await sendNotification(
              currentStudent.student_user_notification_token,
              "الطالب وصل المنزل بسلام",
              `${currentStudent.student_full_name} وصل المنزل الان`
            )
          }
        }
      }

      if (currentStudentIndex < sortedStudents.length - 1) {
        setCurrentStudentIndex((prevIndex) => prevIndex + 1);
        const nextStudent = sortedStudents[currentStudentIndex + 1];

        if (nextStudent.id === 'school' || nextStudent.id === 'driver_home') {
          setDisplayFinalStation(true);
          if(updatedPickedUpStudents.length === 0) {
            setCancelTodayTrip(true)
          }
        }
      }

   } catch (error) {
      alert('حدث خطأ اثناء تحديث حالة الطالب')
    }finally{
      setIsMarkingStudent(false);
    }
  }
};

const HandleMarkStudentFromSchool = async (studentId, status) => {
  try {
    // Update the student's status in the database
    const studentDocRef = doc(DB, 'students', studentId);
    await updateDoc(studentDocRef, {
      checked_in_front_of_school: true,
      picked_from_school: status,
    });

    // Remove the student from the list in the UI
      assignedStudents.filter((student) => student.picked_from_school === true)
  } catch (error) {
    createAlert('حدث خطأ اثناء تحديث حالة الطالب')
  }
};

const handleMarkAbsentStudent = (studentId) => {
  setCheckingStudentId(studentId);
}

const handleCallParent = (phoneNumber) => {
  Linking.openURL(`tel:${phoneNumber}`);
}

//Loading State
if( fetchingUserDataLoading || 
    fetchingDriverDataLoading  || 
    fetchingAssignedStudetns || 
    !isLoaded || 
    finishingTrip) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.spinner_error_container}>
        <ActivityIndicator size="large" color={colors.PRIMARY} />
      </View>
    </SafeAreaView>
  )
}

// if the driver haven't yet registered his info
if(!driverData.length) {
  return(
    <SafeAreaView style={styles.container}>
      <View style={styles.no_registered_students}>
        <Text style={styles.no_student_text}>الرجاء اضافة بياناتك الخاصة</Text>
        <Link href="/addData" style={styles.link_container}>
          <Text style={styles.link_text}>اضف الآن</Text>
        </Link>
      </View>
    </SafeAreaView>
  )
}

//if the driver have no assigned students
if(driverData.length > 0 && assignedStudents.length === 0) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.no_assigned_students_box}>
        <ActivityIndicator size={'small'} color={colors.WHITE}/>
        <Text style={styles.no_assigned_students_text}>نحن بصدد ربط حسابك بطلاب</Text>
      </View>
    </SafeAreaView>
  )
}

//if the driver didnt start the first trip yet
if(driverData[0].first_trip_status === "not started" && driverData[0].second_trip_status === "finished") {
  return(
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.done_trip_button} onPress={() => handleFirstTripStart()}>
          <Text style={styles.pick_button_text}>إبدأ رحلة الذهاب</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

//if the driver didnt start the second trip yet
if(driverData[0].first_trip_status === "finished" && driverData[0].second_trip_status === "not started") {
  return(
    <SafeAreaView style={styles.container}>
      {assignedStudents.filter(student => student.picked_up)
                        .filter(student => student.checked_in_front_of_school === false).length > 0 ? (
          <TouchableOpacity style={styles.done_trip_button} onPress={() => setCheckingPickedUpStudents(true)}>
            <Text style={styles.pick_button_text}>إبدأ رحلة العودة</Text>
          </TouchableOpacity>
                        ) : (
          <>
            {assignedStudents.filter(student => student.picked_up)
                              .filter(student => student.picked_from_school === true).length > 0 ? (
              <TouchableOpacity style={styles.done_trip_button} onPress={() => handlesecondTripStart()}>
                <Text style={styles.pick_button_text}>إبدأ الان</Text>
              </TouchableOpacity>
                              ) : (
              <TouchableOpacity style={styles.done_trip_button} onPress={() => handlesecondTripFinish()}>
                <Text style={styles.pick_button_text}>انهاء الرحلة</Text>
              </TouchableOpacity>  
                              )}
          </>
          
      )}
      
      {checkingPickedUpStudents && (
        <View style={styles.scrollViewContainer}>
        <ScrollView>
          {assignedStudents.filter(student => student.picked_up)
          .filter(student => student.checked_in_front_of_school === false)
          .map((student,index) => (
            <View key={index} style={styles.check_students_boxes}>
              <View style={styles.check_students_box}>

                <TouchableOpacity style={styles.check_students_name} onPress={() => handleMarkAbsentStudent(student.id)}>
                  <Text style={styles.check_students_name_text}>{student.student_full_name}</Text>
                </TouchableOpacity>

                {checkingStudentId === student.id && (
                  <View style={styles.check_students_buttons}>
                    <TouchableOpacity style={styles.check_students_button} onPress={() => HandleMarkStudentFromSchool(student.id,true)}>
                      <AntDesign name="checkcircleo" size={24} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.call_student_parent} onPress={() => handleCallParent(student.student_phone_number)}>
                      <Text style={styles.call_student_parent_text}>اتصل بولي الطالب</Text>
                      <Feather name="phone" size={24} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.check_students_button} onPress={() => HandleMarkStudentFromSchool(student.id,false)}>
                      <AntDesign name="closecircleo" size={24} color="white" />
                    </TouchableOpacity>
                  </View>
                )}
                
              </View>
            </View>
          ))}
        </ScrollView>
        </View>
      )}
    </SafeAreaView>
  )
}

const renderFirstTripDirection = () => {
  if(driverCurrentLocation && destination) {
    return(
      <MapViewDirections
        origin={driverCurrentLocation}
        destination={destination}
        optimizeWaypoints={true}
        apikey={GOOGLE_MAPS_APIKEY}
        strokeWidth={4}
        strokeColor="blue"
        onError={(error) => console.log(error)}
      />
    )
  }     
}

const renderSecondTripDirection = () => {
  if(driverCurrentLocation && destination) {
    return(
      <MapViewDirections
        origin={driverCurrentLocation}
        destination={destination}
        optimizeWaypoints={true}
        apikey={GOOGLE_MAPS_APIKEY}
        strokeWidth={4}
        strokeColor="blue"
        onError={(error) => console.log(error)}
      />
    )
  }       
}

if( driverData[0].first_trip_status === "started" && driverData[0].second_trip_status === "not started") {
  return(
    <SafeAreaView style={styles.student_map_container}>
      <>
        {!displayFinalStation ? (
          <>
            <View style={styles.map_student_name_container}>
              <Text style={styles.map_student_name}>{currentStudent?.student_full_name}</Text>
            </View>
            <View style={styles.map_picked_button_container}>
              <View style={styles.map_picked_button_container2}>
                <TouchableOpacity
                  style={styles.pick_button_accepted} 
                  onPress={() => markStudent(true)} 
                  disabled={isMarkingStudent}>
                  <Text style={styles.pick_button_text}>صعد</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.pick_button_denied} 
                  onPress={() => markStudent(false)} 
                  disabled={isMarkingStudent}>
                  <Text style={styles.pick_button_text}>لم يصعد</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        ) : (
          <>
          {cancelTodayTrip ? (
              <View style={styles.container}>
                <TouchableOpacity style={styles.done_trip_button} onPress={() => handlesecondTripFinish()}>
                    <Text style={styles.pick_button_text}>الغاء الرحلة</Text>
                </TouchableOpacity>
              </View>
          ) : (
            <>
              <View style={styles.map_student_name_container}>
                <Text style={styles.map_student_name}>{currentStudent?.school_name}</Text>
              </View>
              <View style={styles.map_picked_button_container}>
                <View style={styles.done_trip_button_container}>
                  <TouchableOpacity style={styles.done_trip_button} onPress={() => handleFirstTripFinish()}>
                      <Text style={styles.pick_button_text}>تاكيد وصول الطلاب الى المدرسة</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
          </>  
        )}
      </>
      {!cancelTodayTrip && (
        <MapView
        ref={mapRef}
        provider="google"
        region={{
          latitude: driverCurrentLocation?.latitude,
          longitude: driverCurrentLocation?.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
        showsUserLocation={true}
        followsUserLocation={true}
        style={styles.map}
        userInterfaceStyle="light"
      >
    
        {renderFirstTripDirection()}
            
    
        {currentStudent?.student_home_location?.coords && !displayFinalStation && (
          <Marker
            coordinate={getCoordinates(currentStudent?.student_home_location?.coords)}
            title={currentStudent.student_full_name}
            pinColor="red"
          />
        )}
    
    
        {currentStudent?.school_coords && displayFinalStation && (
          <Marker
            coordinate={getCoordinates(currentStudent?.school_coords)}
            title={currentStudent.school_name}
            pinColor="red"
          />
        )}
    
      </MapView>
      )}
    </SafeAreaView>
  )}
 
if(driverData[0].second_trip_status === "started" && driverData[0].first_trip_status === "not started") {
  return(
    <SafeAreaView style={styles.student_map_container}>
      <>
        {!displayFinalStation ? (
          <>
            <View style={styles.map_student_name_container}>
              <Text style={styles.map_student_name}>{currentStudent?.student_full_name}</Text>
             </View>
            <View style={styles.map_picked_button_container}>
              <View style={styles.map_picked_button_container2}>
                <TouchableOpacity 
                  style={styles.pick_button_accepted} 
                  onPress={() => markStudent(true)} 
                  disabled={isMarkingStudent}>
                  <Text style={styles.pick_button_text}>نزل</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.map_picked_button_container_back_home}>
              <View style={styles.done_trip_button_container}>
                 <TouchableOpacity style={styles.done_trip_button} onPress={() => handlesecondTripFinish()}>
                   <Text style={styles.pick_button_text}>تاكيد عودة الطلاب الى منازلهم</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </>
      {!displayFinalStation && (
       <MapView
        ref={mapRef}
        provider="google"
        region={{
          latitude: driverCurrentLocation?.latitude,
          longitude: driverCurrentLocation?.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
        showsUserLocation={true}
        followsUserLocation={true}
        style={styles.map}
        userInterfaceStyle="light"
        >

        {renderSecondTripDirection()}
        
       
        {currentStudent?.student_home_location?.coords && !displayFinalStation && (
          <Marker
            coordinate={getCoordinates(currentStudent.student_home_location.coords)}
            title={currentStudent.student_full_name}
            pinColor="red"
          />
        )}
  
         {driverData[0]?.driver_home_location?.coords && displayFinalStation && (
          <Marker
            coordinate={driverData[0].driver_home_location.coords}
            title="Driver Location"
          />
        )}

      </MapView>
      )}
    </SafeAreaView>
    )}
}

export default Home;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.WHITE,
  },
  student_map_container:{
    flex:1,
    width:'100%',
    position:'relative',
    backgroundColor: colors.WHITE,
  },
  map_student_name_container:{
    width:'100%',
    position:'absolute',
    top:65,
    left:0,
    zIndex:5,
    alignItems:'center',
    justifyContent:'center',
  },
  map_student_name:{
    backgroundColor:colors.WHITE,
    width:250,
    padding:9,
    borderRadius:15,
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    fontSize:15,
  },
  map_picked_button_container:{
    width:'100%',
    position:'absolute',
    top:120,
    left:0,
    zIndex:5,
    alignItems:'center',
    justifyContent:'center',
  },
  map_picked_button_container2:{
    width:300,
    flexDirection:'row-reverse',
    alignItems:'center',
    justifyContent:'space-evenly'
  },
  map_picked_button_container_back_home:{
    width:'100%',
    position:'absolute',
    top:'50%',
    left:0,
    zIndex:5,
    alignItems:'center',
    justifyContent:'center',
  },
  pick_button_accepted:{
    width:120,
    padding:10,
    borderRadius:15,
    alignItems:'center',
    justifyContent:'center',
    backgroundColor:'#56CA00'
  },
  pick_button_denied:{
    width:110,
    padding:10,
    borderRadius:15,
    alignItems:'center',
    justifyContent:'center',
    backgroundColor: '#FF4C51',
  },
  pick_button_text:{
    fontFamily: 'Cairo_700Bold',
    color:colors.WHITE
  },
  start_trip_container:{
    flex:1,
    justifyContent:'center',
    alignItems:'center'
  },
  done_trip_button:{
    width:280,
    padding:10,
    borderRadius:15,
    marginBottom:20,
    alignItems:'center',
    justifyContent:'center',
    backgroundColor:colors.PRIMARY
  },
  scrollViewContainer:{
    height:450,
  },
  check_students_boxes:{
    width:300,
    marginVertical:5,
    alignItems:'center',
  }, 
  check_students_name:{
    width:280,
    padding:10,
    borderRadius:15,
    marginBottom:7,
    backgroundColor:'#16B1FF',
    alignItems:'center',
  },
  check_students_name_text:{
    fontFamily: 'Cairo_400Regular',
    fontSize:14,
    color:colors.WHITE
  },
  check_students_buttons:{
    width:280,
    flexDirection:'row-reverse',
    alignItems:'center',
    justifyContent:'space-between',
    marginBottom:10
  },
  check_students_button:{
    width:50,
    padding:10,
    borderRadius:15,
    marginHorizontal:5,
    alignItems:'center',
    justifyContent:'center',
    backgroundColor:colors.SECONDARY
  },
  call_student_parent:{
    width:150,
    padding:7,
    borderRadius:15,
    backgroundColor:'#56CA00',
    flexDirection:'row-reverse',
    alignItems:'center',
    justifyContent:'space-between',
  },
  call_student_parent_text:{
    fontFamily: 'Cairo_400Regular',
    fontSize:14,
    color:colors.WHITE,
  },
  spinner_error_container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  map: {
    flex:1,
  },
  no_assigned_students_box:{
    backgroundColor:colors.PRIMARY,
    width:280,
    padding:10,
    borderRadius:15,
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'space-between'
  },
  no_assigned_students_text:{
    fontFamily: 'Cairo_400Regular',
    fontSize:15,
    color:colors.WHITE
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
    padding: 15,
    marginTop:10,
    borderRadius: 20,
  },
  link_text: {
    color: colors.WHITE,
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
  },
  finding_driver_loading:{
    width:'100%',
    position:'absolute',
    top:20,
    left:0,
    zIndex:5,
    alignItems:'center',
    justifyContent:'center',
  },
  finding_driver_loading_box:{
    width:250,
    padding:10,
    backgroundColor:colors.WHITE,
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'space-between',
    borderRadius:15,
  },
  finding_driver_loading_text:{
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    fontSize:13,
  }
});
