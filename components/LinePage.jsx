import React,{useState,useEffect,useRef} from 'react'
import { StyleSheet, Text, View,ScrollView,TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Location from 'expo-location'
import MapView, { Marker } from 'react-native-maps'
import MapViewDirections from 'react-native-maps-directions'
import haversine from 'haversine'
import { doc,updateDoc,writeBatch } from 'firebase/firestore'
import { DB } from '../firebaseConfig'
import { useDriverData } from '../app/stateManagment/DriverContext'
import colors from '../constants/Colors'
import AntDesign from '@expo/vector-icons/AntDesign'
import Feather from '@expo/vector-icons/Feather'

const LinePage = ({line,selectedLine}) => {

    // handle the case where there is no student in the line
    
    // disactivate the current line and activate the next if the line trip canceled

    // disable the finish first trip button till the driver get close to the school location

    // add points to driver based on time he get to the school

    // add points of the month in the driver profile

    // change driver location tracking from foreground to background

    // change policies text and permission to meet with google and apple best practices
    
    const {driverData} = useDriverData()
    const GOOGLE_MAPS_APIKEY = ''
    const mapRef = useRef(null)

    const [driverOriginLocation,setDriverOriginLocation] = useState(null)
    const [destination,setDestination] = useState(null)
    const [sortedStudents, setSortedStudents] = useState([])
    const [currentStudentIndex, setCurrentStudentIndex] = useState(0)
    const [displayFinalStation,setDisplayFinalStation] = useState(false)
    const [isMarkingStudent, setIsMarkingStudent] = useState(false)
    const [checkingPickedUpStudents, setCheckingPickedUpStudents] = useState(false)
    const [checkingStudentId, setCheckingStudentId] = useState(null)
    const [cancelTodayTrip, setCancelTodayTrip] = useState(false)
    const [pickedUpStudentsFromHome, setPickedUpStudentsFromHome] = useState([])
    const [mapReady, setMapReady] = useState(false)

    const createAlert = (alerMessage) => {
        Alert.alert(alerMessage)
      }
    
    const handleMapReady = () => {
        setMapReady(true)
    }

    // Fetch the driver's current location
    useEffect(() => {
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
            });
        }
        startTracking();
    }, [driverData]);

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

    // Sort students by distance
    const sortStudentsByDistance = async () => {
        if (!driverData[0] || line.students.length === 0) {
            return;
        }

        try {
            let startingPoint = driverData[0]?.current_location;
            let assignedStudents = line.students;
            let sorted = [];

            if (line.current_trip === 'first') {
                sorted = assignedStudents.filter(student => student.tomorrow_trip_canceled === false)
                .map((student) => ({
                    ...student,
                    distance: calculateDistance(startingPoint, student.home_location),
                }))
                .sort((a, b) => a.distance - b.distance);
           
                sorted.push({
                    id: 'school',
                    school_name: line.lineSchool,
                    school_coords: line.line_school_location,
                });

            } else if (line.current_trip === 'second') {
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

    // Re-Sort the Students
    const resortStudents = async () => {
        if (isMarkingStudent) return; // Prevent double-click
        setIsMarkingStudent(true);

        if (!driverData[0] || line.students.length === 0) {
            setIsMarkingStudent(false);
            return;
        }
    
        try {
            const startingPoint = driverData[0]?.current_location;
            const assignedStudents = line.students;
            let reSorted = [];
    
            if (line.current_trip === 'first') {
                // Filter students who have not been picked up and their trip isn't canceled
                reSorted = assignedStudents.filter(student => student.picked_up === false && student.tomorrow_trip_canceled === false)
                    .map(student => ({
                        ...student,
                        distance: calculateDistance(startingPoint, student.home_location),
                    }))
                    .sort((a, b) => a.distance - b.distance);
    
                // Add the school as the final destination
                reSorted.push({
                    id: 'school',
                    school_name: line.lineSchool,
                    school_coords: line.line_school_location,
                });
    
            } else if (line.current_trip === 'second') {
                // Filter students who were picked up from school but not yet dropped off
                reSorted = assignedStudents.filter(student => student.picked_up === true && student.picked_from_school === true && student.dropped_off === false)
                    .map(student => ({
                        ...student,
                        distance: calculateDistance(startingPoint, student.home_location),
                    }))
                    .sort((a, b) => a.distance - b.distance);
    
                // Add the driver's home as the final destination
                reSorted.push({
                    id: 'driver_home',
                    driver_home_coords: driverData[0].driver_home_location.coords,
                });
            }
    
            // Update the sorted students and reset the index
            setSortedStudents(reSorted);
            setCurrentStudentIndex(0);

            // Check if the current student is the school or driver home
            const currentStep = reSorted[0]
            if (currentStep?.id === 'school' || currentStep?.id === 'driver_home') {
                setDisplayFinalStation(true);
            } else {
                setDisplayFinalStation(false);
            }

            console.log(reSorted)
    
        } catch (err) {
            console.error('Error while re-sorting students:', err);
            createAlert('حدث خطأ اثناء تحديث ترتيب الطلاب');
        } finally{
            setIsMarkingStudent(false);
        }
    };
  
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
        if (line.students.length > 0) {
            if(displayFinalStation){
                setDestination(line.line_school_location)
            } else {
                setDestination(sortedStudents[currentStudentIndex]?.home_location);
            }    
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

    // Start the first trip
    const handleFirstTripStart = async () => {
        if (isMarkingStudent) return;
        setIsMarkingStudent(true);

        try {
            const lines = driverData[0]?.line || [];

             // Skip activation check if only one line exists
            if (lines.length > 1 && !line.line_active) {
                const nextLineIndex = selectedLine + 1;
                const nextLine = lines[nextLineIndex] || lines[0];
                const nextLineName = nextLine.lineName || `الخط ${nextLineIndex + 1}`;

                alert(`الرجاء انهاء رحلة ${nextLineName} قبل بدء هذا الخط`);
                setIsMarkingStudent(false);
                return;
            }

            const batch = writeBatch(DB)
            const driverDoc = doc(DB,'drivers', driverData[0].id)

            // Update the line's first_trip_started status
            const updatedLine = {
                ...line,
                first_trip_started: true,
                started_the_line: new Date(),
            };

            // Update the driver's line data
            const updatedLines = driverData[0].line.map((li) =>
                li.lineName === line.lineName ? updatedLine : li
            );

            // Update the driver's line data in the batch
            batch.update(driverDoc, { line: updatedLines });

            // Update all students' statuses in the batch
            for (const student of line.students) {
                const studentDoc = doc(DB, 'students', student.id);
                batch.update(studentDoc, {
                    student_trip_status: 'going to home',
                });
  
                // Send a notification to the student
                if (student.notification_token) {
                    await sendNotification(
                        student.notification_token,
                        "السائق بدأ الرحلة",
                        'السائق في الطريق اليك'
                    );
                }
            }
  
            // Commit the batch
            await batch.commit();

            sortStudentsByDistance()
            setDriverOriginLocation(driverData[0]?.current_location)

        } catch (error) {
            alert('حدث خطأ اثناء بدء الرحلة')
            console.error('Error starting the first trip:', error);
        } finally {
            setIsMarkingStudent(false)
        }
    }

    // Finish the first trip
    const handleFirstTripFinish = async () => {
        if (isMarkingStudent) return; // Prevent double-click
        setIsMarkingStudent(true);

        try {
            const batch = writeBatch(DB);
            const driverDoc = doc(DB,'drivers', driverData[0].id);
            const lines = driverData[0]?.line || [];
            const pickedUpStudents = line.students.filter(student => student.picked_up);

            const updatedLine = {
                ...line,
                first_trip_finished: true,
                arrived_to_school: new Date(),
                current_trip: 'second',
                line_active: lines.length === 1, // Keep line active if only one exists
            };

            const updatedLines = lines.map((li, index) => {
                if (index === selectedLine) {
                    return updatedLine;
                } else if (lines.length > 1 && index === (selectedLine + 1) % lines.length) {
                    return { ...li, line_active: true };
                }
                return li;
            });

            batch.update(driverDoc, { line: updatedLines });

            // Update all picked-up students' statuses
            for (const student of pickedUpStudents) {
                const studentDoc = doc(DB, 'students', student.id);
                batch.update(studentDoc, {
                    student_trip_status: 'at school',
                });
  
                // Send a notification to the student
                if (student.notification_token) {
                    await sendNotification(
                        student.notification_token,
                        "الطالب وصل المدرسة بسلام",
                        `${student.name} وصل المدرسة الان`
                    );
                }
            }

            // Commit the batch
            await batch.commit();

            // Reset state variables
            setCurrentStudentIndex(0)
            setDisplayFinalStation(false)
            setSortedStudents([])
            setCancelTodayTrip(false)
            setPickedUpStudentsFromHome([])
            setMapReady(false)
            setIsMarkingStudent(false)
            
        } catch (error) {
            alert('حدث خطأ اثناء انهاء الرحلة')
            console.error('Error finishing first trip:', error.message)
        } finally {
            setIsMarkingStudent(false)
        }
    }

    // Check students list before starting the second trip
    const handleCheckPickedUpStudents = () => {
        const lines = driverData[0]?.line || [];
        
        if (lines.length > 1 && !line.line_active) {
            const nextLineIndex = selectedLine + 1;
            const nextLine = driverData[0].line[nextLineIndex] || driverData[0].line[0]; // Loop back to the first line if out of bounds
            const nextLineName = nextLine.lineName || `الخط ${nextLineIndex + 1}`;
            alert(`الرجاء انهاء رحلة ${nextLineName} قبل بدا هذا الخط`);
            return;
        } else {
            setCheckingPickedUpStudents(true)
        }
        
    }

    // Start the second trip
    const handlesecondTripStart = async () => {
        if (isMarkingStudent) return; // Prevent double-click
        setIsMarkingStudent(true);

        try {
            const lines = driverData[0]?.line || [];
            // Check if the selected line is active
            if (lines.length > 1 && !line.line_active) {
                // Get the next line name or order dynamically
                const nextLineIndex = selectedLine + 1;
                const nextLine = driverData[0].line[nextLineIndex] || driverData[0].line[0]; // Loop back to the first line if out of bounds
                const nextLineName = nextLine.lineName || `الخط ${nextLineIndex + 1}`;
            
                alert(`الرجاء انهاء رحلة ${nextLineName} قبل بدء هذا الخط`);
                setIsMarkingStudent(false);
                return;
            }

            const batch = writeBatch(DB)
            const driverDoc = doc(DB, 'drivers', driverData[0].id)

            // Update the line's first_trip_started status
            const updatedLine = {
                ...line,
                second_trip_started: true,
            };

            // Update the driver's line data
            const updatedLines = driverData[0].line.map((li) =>
                li.lineName === line.lineName ? updatedLine : li
            );

            // Update the driver's line data in the batch
            batch.update(driverDoc, { line: updatedLines });

            const pickedUpStudents = line.students.filter(student => student.picked_from_school === true);

            // Update students picked up from school statuses
            for (const student of pickedUpStudents) {
                const studentDoc = doc(DB, 'students', student.id);
                batch.update(studentDoc, {
                    student_trip_status: 'going to home',
                });
  
                // Send a notification to the picked-up students
                if (student.notification_token) {
                    await sendNotification(
                        student.notification_token,
                        "رحلة العودة بدأت",
                        `${student.name} في الطريق إلى المنزل الآن`
                    );
                }
            }

            // Commit the batch
            await batch.commit();

            sortStudentsByDistance()
            setDriverOriginLocation(driverData[0]?.current_location)

        } catch (error) {
            alert('حدث خطأ اثناء بدء الرحلة')
            console.error("Error starting the second trip:", error);
        } finally {
            setIsMarkingStudent(false);
        }
    }

    // Click the button to finish the second trip
    const handlesecondTripFinish = async () => {
        if (isMarkingStudent) return;
        setIsMarkingStudent(true);

        try {
            const batch = writeBatch(DB)
            const driverDoc = doc(DB,'drivers', driverData[0]?.id)
            const lines = driverData[0]?.line || []
            const droppedOffStudents = line.students.filter(student => student.dropped_off)

            // Update line states
            const updatedLine = {
                ...line,
                first_trip_started: false,
                first_trip_finished: false,
                second_trip_started: false,
                second_trip_finished: false,
                current_trip: 'first',
                line_active: lines.length === 1,
                students: line.students.map((student) => ({
                    ...student,
                    picked_up: false,
                    picked_from_school: false,
                    dropped_off: false,
                    tomorrow_trip_canceled: false,
                    checked_in_front_of_school: false,
                })),
            }

            const updatedLines = lines.map((li, index) => {
                if (index === selectedLine) {
                    return updatedLine;
                } else if (lines.length > 1 && index === (selectedLine + 1) % lines.length) {
                    return { ...li, line_active: true };
                }
                return li;
            });

            batch.update(driverDoc, { line: updatedLines });

            // Update all dropped-off students' statuses
            for (const student of droppedOffStudents) {
                const studentDocRef = doc(DB, 'students', student.id);
                batch.update(studentDocRef, {
                    student_trip_status: 'at home',
                    picked_up: false,
                });

                // Send a notification to the parent
                if (student.notification_token) {
                    await sendNotification(
                        student.notification_token,
                        "الطالب وصل المنزل",
                        `${student.name} وصل المنزل الان`
                    );
                }
            }

            // Commit the batch
            await batch.commit();

            // Reset state variables
            setCurrentStudentIndex(0);
            setDisplayFinalStation(false)
            setSortedStudents([]);
            setCheckingPickedUpStudents(false)
            setCheckingStudentId(null)
            setCancelTodayTrip(false)
            setPickedUpStudentsFromHome([])
            setMapReady(false)
    
        } catch (error) {
            alert('حدث خطأ اثناء انهاء الرحلة')
            console.error("Error finishing the second trip:", error);
        } finally {
            setIsMarkingStudent(false);
        }
    }

    // move to the next student location
    const markStudent = async (status) => {
        if (isMarkingStudent) return; // Prevent double-click
        setIsMarkingStudent(true); // Set loading state to true

        try {
            const batch = writeBatch(DB); // Initialize Firestore batch
            const driverDocRef = doc(DB, 'drivers', driverData[0]?.id);
            const currentStudent = sortedStudents[currentStudentIndex];
            const currentTrip = line.current_trip || driverData[0]?.line.find((li) => li.lineName === line.lineName)?.current_trip;
            
            if (!currentTrip) {
                throw new Error("Unable to determine current trip status.");
            }

            if(currentStudent) {
                const studentDoc = doc(DB, 'students', currentStudent.id);               

                if (currentStudent.id !== 'school' && currentStudent.id !== 'driver_home') {
                    const updateField = currentTrip === 'first' ? { picked_up: status, student_trip_status: status ? 'going to school' :'at home'} : { student_trip_status:'at home' };
                    batch.update(studentDoc, updateField)

                    // Update the specific student's status in the selected line
                    const updatedLine = {
                        ...line,
                        students: line.students.map((student) => {
                            if (student.id === currentStudent.id) {
                                return {                          
                                ...student,
                                ...(currentTrip === 'first' ? { picked_up: status } : { dropped_off: status })
                                };                               
                            }
                            return student;
                        }),
                    };

                    // Update the driver's line data in Firestore
                    const updatedLines = driverData[0].line.map((li) =>
                        li.lineName === line.lineName ? updatedLine : li
                    );
                    batch.update(driverDocRef, { line: updatedLines });

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
                        const message = currentTrip === 'first'
                            ? { title: "رحلة المدرسة بدأت", body: `${currentStudent.name} في الطريق إلى المدرسة الآن` }
                            : { title: "الطالب وصل المنزل", body: `${currentStudent.name} وصل المنزل الان` };
                        await sendNotification(currentStudent.notification_token, message.title, message.body);
                    }
                }

                // Move to the next student in the sorted list
                if (currentStudentIndex < sortedStudents?.length - 1) {
                    setCurrentStudentIndex((prevIndex) => prevIndex + 1);
                    const nextStudent = sortedStudents[currentStudentIndex + 1];

                    if (nextStudent.id === 'school' || nextStudent.id === 'driver_home') {
                        setDisplayFinalStation(true);

                        if(updatedPickedUpStudents?.length === 0) {
                            setCancelTodayTrip(true)
                        }
                    }
                }
            }
        } catch (error) {
            alert('حدث خطأ اثناء تحديث حالة الطالب')
            console.log(error)
        } finally{
            setIsMarkingStudent(false);
        }
    }

    // mark students from school
    const HandleMarkStudentFromSchool = async (studentId, status) => {
        if (isMarkingStudent) return
        setIsMarkingStudent(true)

        try {
            const batch = writeBatch(DB);
            const driverDocRef = doc(DB, 'drivers', driverData[0]?.id);

            // Update the specific student's status in the selected line
            const updatedLine = {
                ...line,
                students: line.students.map((student) => {
                    if (student.id === studentId) {
                        return {
                            ...student,
                            picked_from_school: status,
                            checked_in_front_of_school: true,
                        };
                    }
                    return student;
                }),
            };

            // Update the driver's line data in Firestore
            const updatedLines = driverData[0].line.map((li) =>
                li.lineName === line.lineName ? updatedLine : li
            );
            batch.update(driverDocRef, { line: updatedLines });

            await batch.commit();

            // Remove the student from the list in the UI
            line.students.filter((student) => student.picked_from_school === true)
        } catch (error) {
            createAlert('حدث خطأ اثناء تحديث حالة الطالب')
            console.error('Error marking student:', error)
        } finally {
            setIsMarkingStudent(false)
        }
    };

    //mark absent students
    const handleMarkAbsentStudent = (studentId) => {
        setCheckingStudentId(studentId);
    }

    // Call Student parent in case he is absent
    const handleCallParent = (phoneNumber) => {
        Linking.openURL(`tel:${phoneNumber}`);
    }

    // Cancel the trip in case no student is picked up
    const handleCancelTrip = async () => {
        if (isMarkingStudent) return
        setIsMarkingStudent(true)

        try {
            const batch = writeBatch(DB);
            const driverDocRef = doc(DB, 'drivers', driverData[0]?.id);

            // Reset the selected line's statuses
            const resetLine = {
                ...line,
                first_trip_started: false,
                first_trip_finished: false,
                second_trip_started: false,
                second_trip_finished: false,
                current_trip: 'first',
                students: line.students.map((student) => ({
                    ...student,
                    picked_up: false,
                    dropped_off: false,
                    picked_from_school: false,
                    tomorrow_trip_canceled: false,
                    checked_in_front_of_school: false,
                })),
            };

            // Update the driver's `line` data in Firestore
            const updatedLines = driverData[0].line.map((li) =>
                li.lineName === line.lineName ? resetLine : li
            );
            batch.update(driverDocRef, { line: updatedLines });

            // Commit the batch
            await batch.commit();

            // Reset local state variables if necessary
            setCurrentStudentIndex(0);
            setDisplayFinalStation(false);
            setSortedStudents([]);
            setCancelTodayTrip(false);
            setPickedUpStudentsFromHome([]);
            setMapReady(false);

        } catch (error) {
            console.error('Error canceling the trip:', error);
            alert('حدث خطأ أثناء إلغاء الرحلة');
        } finally {
            setIsMarkingStudent(false);
        }
    }
    
    // Line have no students
    if(line.students.length === 0) {
        return(
            <SafeAreaView style={styles.container}>
                <View style={styles.start_line_container}>
                    <View style={styles.no_registered_students}>
                        <Text style={styles.no_student_text}>لا يوجد طلاب في هذا الخط</Text>
                    </View>                  
                </View>
            </SafeAreaView>
        )
    }

    // Driver didnt start the first trip
    if(
        line.first_trip_started === false &&
        line.first_trip_finished === false &&
        line.second_trip_started === false &&
        line.second_trip_finished === false
    ) {
        return(
            <SafeAreaView style={styles.container}>
                <View style={styles.start_line_container}>
                    <TouchableOpacity 
                        style={styles.done_trip_button} 
                        onPress={() => handleFirstTripStart()}
                        disabled={isMarkingStudent}
                    >
                        <Text style={styles.done_trip_button_text}>
                            {isMarkingStudent ? '...' : 'ابدأ رحلة الذهاب'}
                        </Text>
                    </TouchableOpacity>
                </View>               
            </SafeAreaView>
        )
    }

    const currentStudent = sortedStudents[currentStudentIndex]

    // Driver started the first trip journey
    if(
        line.first_trip_started === true &&
        line.first_trip_finished === false &&
        line.second_trip_started === false &&
        line.second_trip_finished === false
    ) {
        return(
            <SafeAreaView style={styles.student_map_container}>
                <>
                    {!displayFinalStation ? (
                        currentStudent ? (
                        <>
                            <View style={styles.map_student_name_container}>
                                <Text style={styles.map_student_name}>{currentStudent?.name}</Text>
                            </View>
                            <View style={styles.map_picked_button_container}>
                                <View style={styles.map_picked_button_container2}>
                                    <TouchableOpacity
                                        style={styles.pick_button_accepted} 
                                        onPress={() => markStudent(true)} 
                                        disabled={isMarkingStudent}
                                    >
                                        <Text style={styles.pick_button_text}>{isMarkingStudent ? '...' :'صعد'}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={styles.pick_button_denied} 
                                        onPress={() => markStudent(false)} 
                                        disabled={isMarkingStudent}
                                    >
                                        <Text style={styles.pick_button_text}>{isMarkingStudent ? '...' :'لم يصعد'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </>
                        ) : (
                            <View style={styles.map_student_name_container}>
                                <TouchableOpacity 
                                    style={styles.done_trip_button} 
                                    onPress={() => resortStudents()}
                                    disabled={isMarkingStudent}
                                >
                                    <Text style={styles.done_trip_button_text}>
                                        {isMarkingStudent ? '...' : 'مواصلة خط الرحلة'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )                        
                    ) : (
                        <>
                            {cancelTodayTrip ? (
                                <View style={styles.container}>
                                    <TouchableOpacity 
                                        style={styles.done_trip_button} 
                                        onPress={() => handleCancelTrip()}
                                        disabled={isMarkingStudent}
                                    >
                                        <Text style={styles.done_trip_button_text}>
                                            {isMarkingStudent ? '...' : 'إلغاء الرحلة'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <>
                                    <View style={styles.map_student_name_container}>
                                        <Text style={styles.map_student_name}>{line.lineSchool}</Text>
                                    </View>
                                    <View style={styles.map_picked_button_container}>
                                        <TouchableOpacity 
                                            style={styles.done_trip_button} 
                                            onPress={() => handleFirstTripFinish()}
                                            disabled={isMarkingStudent}>
                                            <Text style={styles.done_trip_button_text}>
                                                {isMarkingStudent ? '...' : 'إنهاء رحلة الذهاب'}
                                            </Text>
                                        </TouchableOpacity>
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


                        <MapViewDirections
                            origin={driverOriginLocation}
                            destination={displayFinalStation ? currentStudent?.school_coords : currentStudent?.home_location}
                            optimizeWaypoints={true} // Optimize route for efficiency
                            apikey={GOOGLE_MAPS_APIKEY}
                            strokeWidth={4}
                            strokeColor="blue"
                            onError={(error) => console.log(error)}
                        />


                        {currentStudent?.home_location && !displayFinalStation && (
                        <Marker
                            coordinate={currentStudent?.home_location}
                            title={currentStudent.student_full_name}
                            pinColor="red"
                        />
                        )}


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
        )
    }

    // Driver didnt start the second trip
    if(
        line.first_trip_started === true &&
        line.first_trip_finished === true &&
        line.second_trip_started === false &&
        line.second_trip_finished === false
    ) {
        return(
            <SafeAreaView style={styles.container}>
                {line.students.filter(student => student.picked_up)
                              .filter(student => student.checked_in_front_of_school === false)?.length > 0 ? (
                        <TouchableOpacity 
                            style={styles.done_trip_button}
                            onPress={() => handleCheckPickedUpStudents()}
                        >
                            <Text style={styles.pick_button_text}>إبدأ رحلة العودة</Text>
                        </TouchableOpacity>
                ) : (
                    <>
                        {line.students.filter(student => student.picked_up)
                                      .filter(student => student.picked_from_school === true)?.length > 0 ? (
                            <TouchableOpacity 
                                style={styles.done_trip_button} 
                                onPress={() => handlesecondTripStart()}
                                disabled={isMarkingStudent}
                            >
                                <Text style={styles.pick_button_text}>
                                    {isMarkingStudent ? '...' : 'إبدأ الان'}
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity 
                                style={styles.done_trip_button} 
                                onPress={() => handlesecondTripFinish()}
                                disabled={isMarkingStudent}
                            >
                                <Text style={styles.pick_button_text}>
                                    {isMarkingStudent ? '...' : 'إنهاء الرحلة'}
                                </Text>
                            </TouchableOpacity>  
                        )}
                    </>       
                )}
      
                {checkingPickedUpStudents && (
                    <View style={styles.scrollViewContainer}>
                        <ScrollView>
                            {line.students.filter(student => student.picked_up)
                                .filter(student => student.checked_in_front_of_school === false)
                                .map((student,index) => (
                                    <View key={index} style={styles.check_students_boxes}>
                                        <View>
                                            <TouchableOpacity 
                                                style={styles.check_students_name} 
                                                onPress={() => handleMarkAbsentStudent(student.id)}
                                            >
                                                <Text style={styles.check_students_name_text}>{student.name}</Text>
                                            </TouchableOpacity>

                                            {checkingStudentId === student.id && (
                                                <View style={styles.check_students_buttons}>
                                                    <TouchableOpacity 
                                                        style={styles.check_students_button} 
                                                        onPress={() => HandleMarkStudentFromSchool(student.id,true)}
                                                    >
                                                        <AntDesign name="checkcircleo" size={24} color="white" />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity 
                                                        style={styles.call_student_parent} 
                                                        onPress={() => handleCallParent(student.phone_number)}
                                                    >
                                                        <Text style={styles.call_student_parent_text}>اتصل بولي الطالب</Text>
                                                        <Feather name="phone" size={24} color="white" />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity 
                                                        style={styles.check_students_button} 
                                                        onPress={() => HandleMarkStudentFromSchool(student.id,false)}
                                                    >
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

    // Driver started the second trip journey
    if(
        line.first_trip_started === true &&
        line.first_trip_finished === true &&
        line.second_trip_started === true &&
        line.second_trip_finished === false
    ) {
        return(
            <SafeAreaView style={styles.student_map_container}>
                <>
                    {!displayFinalStation ? (
                        currentStudent ? (
                            <>
                                <View style={styles.map_student_name_container}>
                                    <Text style={styles.map_student_name}>{currentStudent?.name}</Text>
                                </View>
                                <View style={styles.map_picked_button_container}>
                                    <TouchableOpacity 
                                        style={styles.pick_button_accepted} 
                                        onPress={() => markStudent(true)} 
                                        disabled={isMarkingStudent}
                                    >
                                        <Text style={styles.pick_button_text}>{isMarkingStudent ? '...' : 'نزل'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        ) : (
                            <View style={styles.map_student_name_container}>
                                <TouchableOpacity 
                                    style={styles.done_trip_button} 
                                    onPress={() => resortStudents()}
                                    disabled={isMarkingStudent}
                                >
                                    <Text style={styles.done_trip_button_text}>
                                        {isMarkingStudent ? '...' : 'مواصلة خط الرحلة'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )
                    ) : (
                        <>
                            <View style={styles.map_picked_button_container_back_home}>
                                <TouchableOpacity 
                                    style={styles.done_trip_button} 
                                    onPress={() => handlesecondTripFinish()}
                                    disabled={isMarkingStudent}
                                >
                                    <Text style={styles.pick_button_text}>
                                        {isMarkingStudent ? '...' : 'إنهاء رحلة العودة'}
                                    </Text>
                                </TouchableOpacity>
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
        )
    }
}

export default LinePage

const styles = StyleSheet.create({
    container:{
        flex:1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.WHITE,
      },
    start_line_container:{
        width:'100%',
        height:'100%',
        alignItems:'center',
        justifyContent:'center'
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
        top:92,
        left:0,
        zIndex:5,
        alignItems:'center',
        justifyContent:'center',
      },
      map_student_name:{
        backgroundColor:colors.WHITE,
        width:250,
        height:35,
        verticalAlign:'middle',
        borderRadius:15,
        textAlign:'center',
        fontFamily: 'Cairo_400Regular',
        fontSize:15,
      },
      map_picked_button_container:{
        width:'100%',
        position:'absolute',
        top:135,
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
      pick_button_accepted:{
        width:90,
        height:32,
        borderRadius:15,
        alignItems:'center',
        justifyContent:'center',
        backgroundColor:'#56CA00'
      },
      pick_button_denied:{
        width:90,
        height:32,
        borderRadius:15,
        alignItems:'center',
        justifyContent:'center',
        backgroundColor: '#FF4C51',
      },
      pick_button_text:{
        height:32,
        verticalAlign:'middle',
        fontFamily: 'Cairo_700Bold',
        color:colors.WHITE
      },
      done_trip_button:{
        width:250,
        height:40,
        borderRadius:15,
        marginBottom:20,
        alignItems:'center',
        justifyContent:'center',
        backgroundColor:colors.PRIMARY
      },
      done_trip_button_text:{
        height:40,
        verticalAlign:'middle',
        fontFamily: 'Cairo_700Bold',
        color:colors.WHITE
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
        width:250,
        height:40,
        borderRadius:15,
        marginBottom:7,
        backgroundColor:'#16B1FF',
        justifyContent:'center',
        alignItems:'center',
      },
      check_students_name_text:{
        height:40,
        verticalAlign:'middle',
        fontFamily: 'Cairo_400Regular',
        fontSize:14,
        color:colors.WHITE
      },
      check_students_buttons:{
        width:250,
        flexDirection:'row-reverse',
        alignItems:'center',
        justifyContent:'space-between',
        marginBottom:10
      },
      check_students_button:{
        width:40,
        height:40,
        borderRadius:50,
        marginHorizontal:5,
        alignItems:'center',
        justifyContent:'center',
        backgroundColor:colors.SECONDARY
      },
      call_student_parent:{
        width:150,
        height:40,
        borderRadius:15,
        backgroundColor:'#56CA00',
        flexDirection:'row-reverse',
        alignItems:'center',
        justifyContent:'space-around',
      },
      call_student_parent_text:{
        height:40,
        verticalAlign:'middle',
        fontFamily: 'Cairo_400Regular',
        fontSize:14,
        color:colors.WHITE,
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
      no_registered_students: {
        height:50,
        width:300,
        backgroundColor:colors.GRAY,
        borderRadius:15,
        justifyContent: 'center',
        alignItems: 'center',
      },
      no_student_text: {
        height:50,
        verticalAlign:'middle',
        fontFamily: 'Cairo_400Regular',
      },
      map: {
        flex:1,
      },
})