import { Alert,StyleSheet, Text, View, ActivityIndicator, TouchableOpacity,ScrollView, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useUser } from '@clerk/clerk-expo'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useState,useEffect,useRef } from 'react'
import * as Location from 'expo-location'
import MapView, { Marker } from 'react-native-maps'
import MapViewDirections from 'react-native-maps-directions'
import haversine from 'haversine'
import { doc,updateDoc,writeBatch } from 'firebase/firestore'
import { DB } from '../../../../firebaseConfig'
import { Link } from 'expo-router'
import colors from '../../../../constants/Colors'
import { useDriverData } from '../../../stateManagment/DriverContext'
import AntDesign from '@expo/vector-icons/AntDesign'
import Feather from '@expo/vector-icons/Feather'

const Home = () => {
  const {driverData,fetchingDriverDataLoading} = useDriverData()

  const GOOGLE_MAPS_APIKEY = ''
 
  const mapRef = useRef(null)

  const { isLoaded,user } = useUser()

  const [driverOriginLocation,setDriverOriginLocation] = useState(null)
  const [destination,setDestination] = useState(null)
  const [sortedStudents, setSortedStudents] = useState([])
  const [pickedUpStudentsState,setPickedUpStudentsState] = useState([])
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0)
  const [displayFinalStation,setDisplayFinalStation] = useState(false)
  const [currentTrip, setCurrentTrip] = useState('first')
  const [isMarkingStudent, setIsMarkingStudent] = useState(false)
  const [checkingPickedUpStudents, setCheckingPickedUpStudents] = useState(false)
  const [checkingStudentId, setCheckingStudentId] = useState(null)
  const [cancelTodayTrip, setCancelTodayTrip] = useState(false)
  const[ pickedUpStudentsFromHome, setPickedUpStudentsFromHome] = useState([])
  const [finishingTrip, setFinishingTrip] = useState(false)
  const [mapReady, setMapReady] = useState(false)

  const createAlert = (alerMessage) => {
    Alert.alert(alerMessage)
  }

  const handleMapReady = () => {
    setMapReady(true)
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
              distanceInterval: 100,
              timeInterval:10000
          },
          async (newLocation) => {
            const { latitude, longitude } = newLocation.coords;
            const currentLocation = { latitude, longitude };

            //Save to Firebase
            await saveLocationToFirebase(latitude, longitude);

            // Check if the driver has moved 1000 meters or more
            checkAndUpdateOriginLocation(currentLocation);
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

  // Function to check and update the origin location
  let lastOriginUpdateTime = Date.now();

  const checkAndUpdateOriginLocation = (currentLocation) => {
    if (!currentLocation?.latitude || !currentLocation?.longitude) {
      return;
    }
  
    if (!driverOriginLocation) {
      // Set the initial origin if it's not set yet
      setDriverOriginLocation(currentLocation);
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

  // Save trip state to AsyncStorage
  const saveTripState = async (trip, studentIndex) => {
    try {
      await AsyncStorage.setItem('TripInfo', JSON.stringify({
        currentTrip: trip,
        currentStudentIndex: studentIndex,
      }));
    } catch (error) {
      console.error('Error saving trip state:', error);
    }
  };

  // Load local storage data
  const loadTripState = async () => {
    try {
      const savedTripState = await AsyncStorage.getItem('TripInfo');
      if (savedTripState) {
        const { currentTrip, currentStudentIndex } = JSON.parse(savedTripState);
        setCurrentTrip(currentTrip);
        setCurrentStudentIndex(currentStudentIndex);
      }
    } catch (error) {
      console.error('Error loading trip state:', error);
    }
  };

  useEffect(() => {
    loadTripState();
  }, []);

  // sort students by distance
  const sortStudentsByDistance = async () => {
    if (!user || !driverData[0] || !driverData[0]?.assigned_students.length) {
      return;
    }

    try {
      let startingPoint = driverData[0]?.current_location;
      let assignedStudents = driverData[0]?.assigned_students;
      let sorted = [];

      if (currentTrip === 'first') {
        sorted = assignedStudents.filter(student => student.tomorrow_trip_canceled === false)
        .map((student) => ({
          ...student,
          distance: calculateDistance(startingPoint, student.home_location),
        }))
        .sort((a, b) => a.distance - b.distance);

        sorted.push({
          id: 'school',
          school_name: assignedStudents[0].school_name,
          school_coords: assignedStudents[0].school_location,
        });

      } else if (currentTrip === 'second') {
          sorted = assignedStudents.filter(student => student.picked_up === true)
                                    .filter(student => student.picked_from_school === true)
          .map((student) => ({
            ...student,
            distance: calculateDistance(startingPoint, student.home_location),
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
  }

  // Function to calculate distance between two coordinates
  const calculateDistance = (coord1, coord2) => {
    return haversine(coord1, coord2, { unit: 'meter' });
  };

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
      console.error("Error sending notification:", error);
    }
  }

  // Set destination based on driver trip status
  useEffect(() => {
    if (currentTrip === 'first' && driverData[0]?.assigned_students?.length > 0) {
      if(displayFinalStation){
        setDestination(driverData[0]?.assigned_students[0]?.school_location)
      } else {
        setDestination(sortedStudents[currentStudentIndex]?.home_location);
      }
      
    } else if (currentTrip === 'second' && pickedUpStudentsState.length > 0) {
      setDestination(pickedUpStudentsState[currentStudentIndex]?.home_location);
    }
  }, [currentStudentIndex,displayFinalStation,mapReady]);

  // fit coordinate function
  const fitCoordinatesForCurrentTrip = () => {
    if (!mapReady || !mapRef.current || !driverData[0]?.current_location) return;
    
    if (driverData[0]?.current_location && destination) {
      mapRef.current.fitToCoordinates(
        [driverData[0]?.current_location, destination],
        {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        }
      );
    }
  };

  // Trigger map update when state changes
  useEffect(() => {
    if(mapReady && driverData[0]?.current_location && destination) {
      fitCoordinatesForCurrentTrip();
    }
  }, [mapReady,destination]);

  // Click the button to start the first trip
  const handleFirstTripStart = async () => {
    // Save the trip start time and status to the database
    try {
      sortStudentsByDistance()
      setDriverOriginLocation(driverData[0]?.current_location)
  
      const driverDoc = doc(DB,'drivers', driverData[0].id)
      await updateDoc(driverDoc, { 
        first_trip_status: 'started',
        first_trip_start: new Date(),
        second_trip_status:'not started'
      })

      // Update all assigned students status (the driver start mouving)
      for (const student of driverData[0]?.assigned_students) {
        const studentDoc = doc(DB, 'students', student.id);
        await updateDoc(studentDoc, {
          student_trip_status: 'going to home',
        });
        
        if(student.notification_token) {
          await sendNotification(
            student.notification_token,
            "السائق بدأ الرحلة",
            'السائق في الطريق اليك'
          );
        }
      }

    } catch (error) {
      alert('حدث خطأ اثناء بدء الرحلة') 
    }
  }

  // Click the button to finish the first trip
  const handleFirstTripFinish = async () => {
    try {
      const driverDoc = doc(DB,'drivers', driverData[0].id)
      const pickedUpStudents = driverData[0]?.assigned_students.filter(student => student.picked_up);

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

        if(student.notification_token) {
          await sendNotification(
            student.notification_token,
            "الطالب وصل المدرسة بسلام",
            `${student.name} وصل المدرسة الان`
          )
        }

        // Reset state variables
        setCurrentTrip('second');
        setCurrentStudentIndex(0);
        saveTripState('second', 0);
        setDisplayFinalStation(false);
        setSortedStudents([]);
        setCancelTodayTrip(false)
        setPickedUpStudentsFromHome([])
        setMapReady(false)
        setIsMarkingStudent(false)
      }
    } catch (error) {
      alert('حدث خطأ اثناء انهاء الرحلة')
    }
  }

  // Click the button to start the second trip
  const handlesecondTripStart = async () => {
    try {
      sortStudentsByDistance()
      setDriverOriginLocation(driverData[0]?.current_location)

      const driverDoc = doc(DB, 'drivers', driverData[0].id)
      await updateDoc(driverDoc, { 
        second_trip_status: 'started', 
        second_trip_start: new Date(),
        first_trip_status: 'not started',
      });

      // Update students status (students picked up from school)
      const pickedUpStudents = driverData[0]?.assigned_students.filter(student => student.picked_from_school === true);
      setPickedUpStudentsState(pickedUpStudents)
      for (const student of pickedUpStudents) {
        const studentDoc = doc(DB, 'students', student.id);
        await updateDoc(studentDoc, {
          student_trip_status: 'going to home',
        });

        if(student.notification_token) {
          await sendNotification(
            student.notification_token,
            "رحلة العودة بدأت",
            `${student.name} في الطريق إلى المنزل الآن`
          )
        }
      }

      // Update students status (students not picked up from school)
      const notPickedUpStudents = driverData[0]?.assigned_students.filter(student => student.picked_from_school === false);
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
      const batch = writeBatch(DB); // Initialize Firestore batch
      const driverDoc = doc(DB,'drivers', driverData[0]?.id)

      // 1. Update the driver's document
      const updatedAssignedStudents = driverData[0]?.assigned_students.map((student) => ({
        ...student,
        picked_up: false,
        dropped_off: false,
        picked_from_school: false,
        checked_in_front_of_school: false,
        tomorrow_trip_canceled: false,
      }));

      batch.update(driverDoc, {
        assigned_students: updatedAssignedStudents,
        second_trip_status: 'finished',
        second_trip_end: new Date(),
        first_trip_status: 'not started',
        trip_canceled: false,
      });

      // 2. Update each student's document in the 'students' collection
      for (const student of driverData[0]?.assigned_students) {
        const studentDocRef = doc(DB, 'students', student.id);
        batch.update(studentDocRef, {
          student_trip_status: 'at home',
          picked_up: false,
        });
      }

      // Commit the batch operation
      await batch.commit();

      // Reset state variables
      setCurrentTrip('first');
      setCurrentStudentIndex(0);
      saveTripState('first', 0);
      setDisplayFinalStation(false);
      setSortedStudents([]);
      setCheckingPickedUpStudents(false)
      setCheckingStudentId(null)
      setCancelTodayTrip(false)
      setPickedUpStudentsFromHome([])
      setMapReady(false)
      setIsMarkingStudent(false)
    
    } catch (error) {
      alert('حدث خطأ اثناء انهاء الرحلة')
      setFinishingTrip(false)
    } finally {
      setFinishingTrip(false)
    }
  }

  // move to the next student location
  const markStudent = async (status) => {
    if (isMarkingStudent) return; // Prevent double-click
    setIsMarkingStudent(true); // Set loading state to true
    try {
      const batch = writeBatch(DB); // Initialize Firestore batch
      const currentStudent = sortedStudents[currentStudentIndex];

      if(currentStudent) {
        const studentDoc = doc(DB, 'students', currentStudent.id);
        const driverDocRef = doc(DB, 'drivers', driverData[0]?.id);

        if (currentStudent.id !== 'school' && currentStudent.id !== 'driver_home') {
          const updateField = currentTrip === 'first' ? { picked_up: status, student_trip_status: status ? 'going to school' :'at home'} : { student_trip_status:'at home' };
          batch.update(studentDoc, updateField)
          
          // Update the student's lightweight data in the driver's document
          const driverAssignedStudents = driverData[0]?.assigned_students || [];
          const updatedAssignedStudents = driverAssignedStudents.map((student) => {
            if (student.id === currentStudent.id) {
              // Merge the existing fields with the new status field
              return {
                ...student,
                ...(currentTrip === 'first' ? { picked_up: status } : { dropped_off: status }),
              };
            }
            return student; // Keep other students unchanged
          });
          batch.update(driverDocRef, { assigned_students: updatedAssignedStudents });

          // Commit the batch
          await batch.commit();
          setDriverOriginLocation(driverData[0]?.current_location)
        }
        // Local tracking of picked-up students
        let updatedPickedUpStudents = [...pickedUpStudentsFromHome]
        if (status === true) {
          updatedPickedUpStudents.push(currentStudent); // Add the current student to the picked-up list
          setPickedUpStudentsFromHome(updatedPickedUpStudents); // Update state with the new list
          if(currentStudent.notification_token) {
            if(currentTrip === 'first') {
              await sendNotification(
                currentStudent.notification_token,
                "رحلة المدرسة بدأت",
                `${currentStudent.name} في الطريق إلى المدرسة الآن`
              );
            } else {
              await sendNotification(
                currentStudent.notification_token,
                "الطالب وصل المنزل",
                `${currentStudent.name} وصل المنزل الان`
              )
            }
          }
        }

        if (currentStudentIndex < sortedStudents.length - 1) {
          setCurrentStudentIndex((prevIndex) => prevIndex + 1);
          saveTripState(currentTrip, currentStudentIndex);
          const nextStudent = sortedStudents[currentStudentIndex + 1];

          if (nextStudent.id === 'school' || nextStudent.id === 'driver_home') {
            setDisplayFinalStation(true);
            if(updatedPickedUpStudents.length === 0) {
              setCancelTodayTrip(true)
            }
          }
        }

      }
    } catch (error) {
      alert('حدث خطأ اثناء تحديث حالة الطالب')
    } finally{
      setIsMarkingStudent(false);
    }
  };

  // mark students from school
  const HandleMarkStudentFromSchool = async (studentId, status) => {
    try {
      // Update the driver assigned_students data
      const driverDocRef = doc(DB, 'drivers', driverData[0]?.id);
      const driverAssignedStudents = driverData[0]?.assigned_students || [];

      const updatedAssignedStudents = driverAssignedStudents.map((student) => {
        if (student.id === studentId) {
          return {
            ...student,
            picked_from_school: status,
            checked_in_front_of_school: true,
          };
        }
        return student; // Leave other students unchanged
      });

      // Update the 'assigned_students' array in the driver document
      await updateDoc(driverDocRef, {
        assigned_students: updatedAssignedStudents,
      });

      // Remove the student from the list in the UI
      driverData[0]?.assigned_students.filter((student) => student.picked_from_school === true)
    } catch (error) {
      createAlert('حدث خطأ اثناء تحديث حالة الطالب')
    }
  };

  //mark absent students
  const handleMarkAbsentStudent = (studentId) => {
    setCheckingStudentId(studentId);
  }

  const handleCallParent = (phoneNumber) => {
    Linking.openURL(`tel:${phoneNumber}`);
  }

  //Loading State
  if( fetchingDriverDataLoading  || !isLoaded || finishingTrip) {
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
  if(driverData.length > 0 && driverData[0].assigned_students.length === 0) {
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
      {driverData[0]?.assigned_students.filter(student => student.picked_up)
                        .filter(student => student.checked_in_front_of_school === false).length > 0 ? (
          <TouchableOpacity style={styles.done_trip_button} onPress={() => setCheckingPickedUpStudents(true)}>
            <Text style={styles.pick_button_text}>إبدأ رحلة العودة</Text>
          </TouchableOpacity>
                        ) : (
          <>
            {driverData[0]?.assigned_students.filter(student => student.picked_up)
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
          {driverData[0]?.assigned_students.filter(student => student.picked_up)
          .filter(student => student.checked_in_front_of_school === false)
          .map((student,index) => (
            <View key={index} style={styles.check_students_boxes}>
              <View style={styles.check_students_box}>

                <TouchableOpacity style={styles.check_students_name} onPress={() => handleMarkAbsentStudent(student.id)}>
                  <Text style={styles.check_students_name_text}>{student.name}</Text>
                </TouchableOpacity>

                {checkingStudentId === student.id && (
                  <View style={styles.check_students_buttons}>
                    <TouchableOpacity style={styles.check_students_button} onPress={() => HandleMarkStudentFromSchool(student.id,true)}>
                      <AntDesign name="checkcircleo" size={24} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.call_student_parent} onPress={() => handleCallParent(student.phone_number)}>
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

const currentStudent = sortedStudents[currentStudentIndex]



if( driverData[0].first_trip_status === "started" && driverData[0].second_trip_status === "not started") {
  return(
    <SafeAreaView style={styles.student_map_container}>
      <>
        {!displayFinalStation ? (
          <>
            <View style={styles.map_student_name_container}>
              <Text style={styles.map_student_name}>{currentStudent?.name}</Text>
            </View>
            <View style={styles.map_picked_button_container}>
              <View style={styles.map_picked_button_container2}>
                <TouchableOpacity
                  style={styles.pick_button_accepted} 
                  onPress={() => markStudent(true)} 
                  disabled={isMarkingStudent}>
                  <Text style={styles.pick_button_text}>{isMarkingStudent ? '...' :'صعد'}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.pick_button_denied} 
                  onPress={() => markStudent(false)} 
                  disabled={isMarkingStudent}>
                  <Text style={styles.pick_button_text}>{isMarkingStudent ? '...' :'لم يصعد'}</Text>
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
        onMapReady={handleMapReady}
        provider="google"
        initialRegion={{
          latitude: driverData[0]?.current_location?.latitude,
          longitude: driverData[0]?.current_location?.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
        loadingEnabled={true}
        showsUserLocation={true}
        style={styles.map}
        userInterfaceStyle="light"
        >

        {/* Display route with waypoints */}
        <MapViewDirections
          origin={driverOriginLocation}
          destination={displayFinalStation ? currentStudent?.school_coords : currentStudent?.home_location}
          optimizeWaypoints={true} // Optimize route for efficiency
          apikey={GOOGLE_MAPS_APIKEY}
          strokeWidth={4}
          strokeColor="blue"
          onError={(error) => console.log(error)}
        />

        {/* Student's home marker */}
        {currentStudent?.home_location && !displayFinalStation && (
          <Marker
            coordinate={currentStudent?.home_location}
            title={currentStudent.student_full_name}
            pinColor="red"
          />
        )}

        {/* School marker */}
        {currentStudent?.school_coords && displayFinalStation && (
          <Marker
            coordinate={currentStudent?.school_coords}
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
              <Text style={styles.map_student_name}>{currentStudent?.name}</Text>
             </View>
            <View style={styles.map_picked_button_container}>
              <View style={styles.map_picked_button_container2}>
                <TouchableOpacity 
                  style={styles.pick_button_accepted} 
                  onPress={() => markStudent(true)} 
                  disabled={isMarkingStudent}>
                  <Text style={styles.pick_button_text}>{isMarkingStudent ? '...' : 'نزل'}</Text>
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
        onMapReady={handleMapReady}
        provider="google"
        initialRegion={{
          latitude: driverData[0]?.current_location?.latitude,
          longitude: driverData[0]?.current_location?.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
        loadingEnabled={true}
        showsUserLocation={true}
        style={styles.map}
        userInterfaceStyle="light"
        >

        {/* Display route with waypoints */}
        <MapViewDirections
          origin={driverOriginLocation}
          destination={displayFinalStation ? currentStudent?.driver_home_coords : currentStudent?.home_location}
          optimizeWaypoints={true}
          apikey={GOOGLE_MAPS_APIKEY}
          strokeWidth={4}
          strokeColor="blue"
          onError={(error) => console.log(error)}
        />
        
        {currentStudent?.home_location && !displayFinalStation && (
          <Marker
            coordinate={currentStudent.home_location}
            title={currentStudent.name}
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