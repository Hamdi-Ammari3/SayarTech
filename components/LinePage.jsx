import React,{useState,useEffect,useRef} from 'react'
import { StyleSheet, Text, View,ScrollView,TouchableOpacity,Dimensions } from 'react-native'
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

const LinePage = ({line}) => {
    
    // disactivate the current line and activate the next if the line trip canceled

    // disable the finish first trip button till the driver get close to the school location

    // add points to driver based on time he get to the school

    // add points of the month in the driver profile

    // change driver location tracking from foreground to background
    
    const {driverData} = useDriverData()
    const GOOGLE_MAPS_APIKEY = ''
    const mapRef = useRef(null)

    const [driverOriginLocation,setDriverOriginLocation] = useState(null)
    const [destination,setDestination] = useState(null)
    const [sortedRiders, setSortedRiders] = useState([])
    const [currentRiderIndex, setCurrentRiderIndex] = useState(0)
    const [displayFinalStation,setDisplayFinalStation] = useState(false)
    const [isMarkingRider, setIsMarkingRider] = useState(false)
    const [checkingPickedUpRiders, setCheckingPickedUpRiders] = useState(false)
    const [checkingRiderId, setCheckingRiderId] = useState(null)
    const [cancelTodayTrip, setCancelTodayTrip] = useState(false)
    const [pickedUpRidersFromHome, setPickedUpRidersFromHome] = useState([])
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

    // Sort riders by distance
    const sortRidersByDistance = async () => {
        if (!driverData[0] || line.riders.length === 0) {
            return;
        }

        try {
            let startingPoint = driverData[0]?.current_location;
            let assignedRiders = line.riders;
            let sorted = [];

            if (line.current_trip === 'first') {
                sorted = assignedRiders.filter(rider => rider.tomorrow_trip_canceled === false)
                .map((rider) => ({
                    ...rider,
                    distance: calculateDistance(startingPoint, rider.home_location),
                }))
                .sort((a, b) => a.distance - b.distance);
           
                sorted.push({
                    id: 'school',
                    school_name: line.line_destination,
                    school_coords: line.line_destination_location,
                });

            } else if (line.current_trip === 'second') {
                sorted = assignedRiders.filter(rider => rider.picked_up === true)
                                         .filter(rider => rider.picked_from_school === true)
                .map((rider) => ({
                    ...rider,
                    distance: calculateDistance(startingPoint, rider.home_location),
                }))
                .sort((a, b) => a.distance - b.distance);

                sorted.push({
                    id: 'driver_home',
                    driver_home_coords: driverData[0].driver_home_location.coords,
                });
            }

            setSortedRiders(sorted);

        } catch (err) {
            createAlert('حدث خطأ اثناء تحديد موقع الطلاب')
        }
    }

    // Re-Sort the Riders
    const resortRiders = async () => {
        if (isMarkingRider) return; // Prevent double-click
        setIsMarkingRider(true);

        if (!driverData[0] || line.riders.length === 0) {
            setIsMarkingRider(false);
            return;
        }
    
        try {
            const startingPoint = driverData[0]?.current_location;
            const assignedRiders = line.riders;
            let reSorted = [];
    
            if (line.current_trip === 'first') {
                // Filter riders who have not been picked up and their trip isn't canceled
                reSorted = assignedRiders.filter(rider => rider.picked_up === false && rider.tomorrow_trip_canceled === false)
                    .map(rider => ({
                        ...rider,
                        distance: calculateDistance(startingPoint, rider.home_location),
                    }))
                    .sort((a, b) => a.distance - b.distance);
    
                // Add the school as the final destination
                reSorted.push({
                    id: 'school',
                    school_name: line.line_destination,
                    school_coords: line.line_destination_location,
                });
    
            } else if (line.current_trip === 'second') {
                // Filter riders who were picked up from school but not yet dropped off
                reSorted = assignedRiders.filter(rider => rider.picked_up === true && rider.picked_from_school === true && rider.dropped_off === false)
                    .map(rider => ({
                        ...rider,
                        distance: calculateDistance(startingPoint, rider.home_location),
                    }))
                    .sort((a, b) => a.distance - b.distance);
    
                // Add the driver's home as the final destination
                reSorted.push({
                    id: 'driver_home',
                    driver_home_coords: driverData[0].driver_home_location.coords,
                });
            }
    
            // Update the sorted riders and reset the index
            setSortedRiders(reSorted);
            setCurrentRiderIndex(0);

            // Check if the current rider is the school or driver home
            const currentStep = reSorted[0]
            if (currentStep?.id === 'school' || currentStep?.id === 'driver_home') {
                setDisplayFinalStation(true);
            } else {
                setDisplayFinalStation(false);
            }
        } catch (err) {
            console.log('Error while re-sorting riders:', err);
            createAlert('حدث خطأ اثناء تحديث ترتيب الطلاب');
        } finally{
            setIsMarkingRider(false);
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
            console.log("Error sending notification:", error);
        }
    }

    // Set destination based on driver trip status
    useEffect(() => {
        if (line.riders.length > 0) {
            if(displayFinalStation){
                setDestination(line.line_destination_location)
            } else {
                setDestination(sortedRiders[currentRiderIndex]?.home_location);
            }    
        }
    }, [currentRiderIndex,displayFinalStation,mapReady]);

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
        if (isMarkingRider) return;
        setIsMarkingRider(true);

        try {
            const lines = driverData[0]?.line || [];

            // Find the currently active line
            const activeLine = lines?.find(li => li?.line_active);

            // Skip activation check if only one line exists
            if (lines.length > 1 && activeLine && activeLine.line_index !== line.line_index) {
                alert(`الرجاء إنهاء رحلة ${activeLine.lineName} قبل بدء هذا الخط`);
                setIsMarkingRider(false);
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
                li.id === line.id ? updatedLine : li
            );

            // Update the driver's line data in the batch
            batch.update(driverDoc, { line: updatedLines });

            // Update all riders' statuses in the batch
            for (const rider of line.riders) {
                const riderDoc = doc(DB, 'riders', rider.id);
                batch.update(riderDoc, {
                    trip_status: 'to home',
                });
  
                // Send a notification to the riders
                if (rider.notification_token) {
                    await sendNotification(
                        rider.notification_token,
                        "السائق بدأ الرحلة",
                        'السائق في الطريق اليك'
                    );
                }
            }
  
            // Commit the batch
            await batch.commit();

            sortRidersByDistance()
            setDriverOriginLocation(driverData[0]?.current_location)
        } catch (error) {
            alert('حدث خطأ اثناء بدء الرحلة')
            console.log('Error starting the first trip:', error);
        } finally {
            setIsMarkingRider(false)
        }
    }

    // Finish the first trip
    const handleFirstTripFinish = async () => {
        if (isMarkingRider) return; // Prevent double-click
        setIsMarkingRider(true);

        try {
            const batch = writeBatch(DB);
            const driverDoc = doc(DB,'drivers', driverData[0].id);
            const lines = driverData[0]?.line || [];
            const pickedUpRiders = line.riders.filter(rider => rider.picked_up);

            // Mark the current line as finished
            const updatedLine = {
                ...line,
                first_trip_finished: true,
                arrived_to_destination: new Date(),
                current_trip: 'second',
                line_active: lines.length === 1, // Keep line active if only one exists
            };

            // Find the next line in the round process
            let nextLineIndex = null;
            if (lines.length > 1) {
                nextLineIndex = (line.line_index % lines.length) + 1; // Move to the next line in order
            }

            // Update the lines array with the new states
            const updatedLines = lines.map(li => {
                if (li.line_index === line.line_index) {
                    return updatedLine; // Update the current line
                } else if (lines.length > 1 && li.line_index === nextLineIndex) {
                    return { ...li, line_active: true }; // Activate the next line
                }
                return { ...li, line_active: false }; // Deactivate all other lines
            });

            batch.update(driverDoc, { line: updatedLines });

            // Update all picked-up riders' statuses
            for (const rider of pickedUpRiders) {
                const riderDoc = doc(DB, 'riders', rider.id);
                batch.update(riderDoc, {
                    trip_status: 'at destination',
                });

                // Skip notification if no token exists
                if (!rider.notification_token) continue;

                // Dynamically set message based on rider type
                const title = rider.rider_type === "student" ? "الطالب وصل المدرسة" : "الموظف وصل العمل";
                const body = rider.rider_type === "student" 
                    ? `${rider.name} وصل المدرسة الآن` 
                    : `${rider.name} وصل مقر العمل الآن`;

                // Send the notification
                await sendNotification(rider.notification_token, title, body);
            }

            // Commit the batch
            await batch.commit();

            // Reset state variables
            setCurrentRiderIndex(0)
            setDisplayFinalStation(false)
            setSortedRiders([])
            setCancelTodayTrip(false)
            setPickedUpRidersFromHome([])
            setMapReady(false)
            setIsMarkingRider(false)
            
        } catch (error) {
            alert('حدث خطأ اثناء انهاء الرحلة')
            console.log('Error finishing first trip:', error.message)
        } finally {
            setIsMarkingRider(false)
        }
    }

    // Check riders list before starting the second trip
    const handleCheckPickedUpRiders = () => {
        const lines = driverData[0]?.line || [];

        // Find the currently active line
        const activeLine = lines?.find(li => li?.line_active);
        
        if (lines.length > 1 && activeLine && activeLine.line_index !== line.line_index) {
            alert(`الرجاء إنهاء رحلة ${activeLine.lineName} قبل بدء هذا الخط`);
            return;
        } else {
            setCheckingPickedUpRiders(true)
        } 
    }

    // Start the second trip
    const handlesecondTripStart = async () => {
        if (isMarkingRider) return; // Prevent double-click
        setIsMarkingRider(true);

        try {
            const lines = driverData[0]?.line || [];

            // Find the currently active line
            const activeLine = lines?.find(li => li?.line_active);

            // Check if the selected line is active
            if (lines.length > 1 && activeLine?.line_index !== line.line_index) {            
                alert(`الرجاء إنهاء رحلة ${activeLine.lineName} قبل بدء هذا الخط`);
                setIsMarkingRider(false);
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
                li.id === line.id ? updatedLine : li
            );

            // Update the driver's line data in the batch
            batch.update(driverDoc, { line: updatedLines });

            const pickedUpRiders = line.riders.filter(rider => rider.picked_from_school === true);

            // Update riders picked up from school statuses
            for (const rider of pickedUpRiders) {
                const riderDoc = doc(DB, 'riders', rider.id);
                batch.update(riderDoc, {
                    trip_status: 'to home',
                });
  
                // Send a notification to the picked-up riders
                if (rider.notification_token) {
                    await sendNotification(
                        rider.notification_token,
                        "رحلة العودة بدأت",
                        `${rider.name} في الطريق إلى المنزل الآن`
                    );
                }
            }

            // Commit the batch
            await batch.commit();

            sortRidersByDistance()
            setDriverOriginLocation(driverData[0]?.current_location)

        } catch (error) {
            alert('حدث خطأ اثناء بدء الرحلة')
            console.log("Error starting the second trip:", error);
        } finally {
            setIsMarkingRider(false);
        }
    }

    // Click the button to finish the second trip
    const handlesecondTripFinish = async () => {
        if (isMarkingRider) return;
        setIsMarkingRider(true);

        try {
            const batch = writeBatch(DB)
            const driverDoc = doc(DB,'drivers', driverData[0]?.id)
            const lines = driverData[0]?.line || []
            const droppedOffRiders = line.riders.filter(rider => rider.dropped_off)

            // Get the last line index
            const lastLineIndex = Math.max(...lines.map(li => li.line_index || 0))

            // Determine if the current line is the last one
            const isLastLine = line.line_index === lastLineIndex

            // Reset or switch to the next line
            const updatedLines = lines.map((li) => {
                if (li.line_index === line.line_index) {
                    return {
                        ...li,
                        first_trip_started: false,
                        first_trip_finished: false,
                        second_trip_started: false,
                        second_trip_finished: false,
                        current_trip: 'first',
                        line_active: false,
                        riders: li.riders.map((rider) => ({
                            ...rider,
                            picked_up: false,
                            picked_from_school: false,
                            dropped_off: false,
                            tomorrow_trip_canceled: false,
                            checked_in_front_of_school: false,
                        })),
                    }
                } else if (!isLastLine && li.line_index === line.line_index + 1) {
                    return { ...li, line_active: true }; // Activate the next line only
                }
                return li;
            });

            batch.update(driverDoc, {
                line: updatedLines,
                start_the_journey:!isLastLine,
            });

            // Update all dropped-off riders' statuses
            for (const rider of droppedOffRiders) {
                const riderDocRef = doc(DB, 'riders', rider.id);
                batch.update(riderDocRef, {
                    trip_status: 'at home',
                    picked_up: false,
                });

                // Send a notification to the parent
                if (rider.notification_token) {
                    await sendNotification(
                        rider.notification_token,
                        " في المنزل",
                        `${rider.name} وصل المنزل الان`
                    );
                }
            }

            // Commit the batch
            await batch.commit();

            // Reset state variables
            setCurrentRiderIndex(0);
            setDisplayFinalStation(false)
            setSortedRiders([]);
            setCheckingPickedUpRiders(false)
            setCheckingRiderId(null)
            setCancelTodayTrip(false)
            setPickedUpRidersFromHome([])
            setMapReady(false)
    
        } catch (error) {
            alert('حدث خطأ اثناء انهاء الرحلة')
            console.log("Error finishing the second trip:", error);
        } finally {
            setIsMarkingRider(false);
        }
    }

    // move to the next rider location
    const markRider = async (status) => {
        if (isMarkingRider) return; // Prevent double-click
        setIsMarkingRider(true); // Set loading state to true

        try {
            const batch = writeBatch(DB); // Initialize Firestore batch
            const driverDocRef = doc(DB, 'drivers', driverData[0]?.id);
            const currentRider = sortedRiders[currentRiderIndex];
            const currentTrip = line.current_trip || driverData[0]?.line.find((li) => li.lineName === line.lineName)?.current_trip;
            
            if (!currentTrip) {
                createAlert('حدث خطا الرجاء المحاولة مرة اخرى')
                return;                
            }

            if(currentRider) {
                const riderDoc = doc(DB, 'riders', currentRider.id);               

                if (currentRider.id !== 'school' && currentRider.id !== 'driver_home') {
                    const updateField = currentTrip === 'first' ? { picked_up: status, trip_status: status ? 'to destination' :'at home'} : { trip_status:'at home' };
                    batch.update(riderDoc, updateField)

                    // Update the specific rider's status in the selected line
                    const updatedLine = {
                        ...line,
                        riders: line.riders.map((rider) => {
                            if (rider.id === currentRider.id) {
                                return {                          
                                ...rider,
                                ...(currentTrip === 'first' ? { picked_up: status } : { dropped_off: status })
                                };                               
                            }
                            return rider;
                        }),
                    };

                    // Update the driver's line data in Firestore
                    const updatedLines = driverData[0].line.map((li) =>
                        li.id === line.id ? updatedLine : li
                    );
                    batch.update(driverDocRef, { line: updatedLines });

                    // Commit the batch
                    await batch.commit();
                      
                    setDriverOriginLocation(driverData[0]?.current_location)
                }

                // Local tracking of picked-up riders
                let updatedPickedUpRiders = [...pickedUpRidersFromHome]
                if (status === true) {
                    updatedPickedUpRiders.push(currentRider); // Add the current rider to the picked-up list
                    setPickedUpRidersFromHome(updatedPickedUpRiders); // Update state with the new list

                    if(currentRider.notification_token) {
                        const message = currentTrip === 'first'
                            ? { title: "رحلة الذهاب بدأت", body: currentRider.rider_type === 'student' ? `${currentRider.name} في الطريق إلى المدرسة الآن` : `${currentRider.name} في الطريق إلى مقر العمل الآن`}
                            : { title: " في المنزل", body: `${currentRider.name} وصل المنزل الان` };
                        await sendNotification(currentRider.notification_token, message.title, message.body);
                    }
                }

                // Move to the next rider in the sorted list
                if (currentRiderIndex < sortedRiders?.length - 1) {
                    setCurrentRiderIndex((prevIndex) => prevIndex + 1);
                    const nextRider = sortedRiders[currentRiderIndex + 1];

                    if (nextRider.id === 'school' || nextRider.id === 'driver_home') {
                        setDisplayFinalStation(true);

                        if(updatedPickedUpRiders?.length === 0) {
                            setCancelTodayTrip(true)
                        }
                    }
                }
            }
        } catch (error) {
            alert('حدث خطأ اثناء تحديث حالة الطالب')
            console.log(error)
        } finally{
            setIsMarkingRider(false);
        }
    }

    // mark riders from school
    const HandleMarkRiderFromSchool = async (riderId, status) => {
        if (isMarkingRider) return
        setIsMarkingRider(true)

        try {
            const batch = writeBatch(DB);
            const driverDocRef = doc(DB, 'drivers', driverData[0]?.id);

            // Update the specific rider's status in the selected line
            const updatedLine = {
                ...line,
                riders: line.riders.map((rider) => {
                    if (rider.id === riderId) {
                        return {
                            ...rider,
                            picked_from_school: status,
                            checked_in_front_of_school: true,
                        };
                    }
                    return rider;
                }),
            };

            // Update the driver's line data in Firestore
            const updatedLines = driverData[0].line.map((li) =>
                li.id === line.id ? updatedLine : li
            );
            batch.update(driverDocRef, { line: updatedLines });

            await batch.commit();

            // Remove the rider from the list in the UI
            line.riders.filter((rider) => rider.picked_from_school === true)
        } catch (error) {
            createAlert('حدث خطأ اثناء تحديث حالة الطالب')
            console.log('Error marking rider:', error)
        } finally {
            setIsMarkingRider(false)
        }
    };

    //mark absent riders
    const handleMarkAbsentRider = (riderId) => {
        setCheckingRiderId(riderId);
    }

    // Call rider parent in case he is absent
    const handleCallParent = (phoneNumber) => {
        Linking.openURL(`tel:${phoneNumber}`);
    }

    // Cancel the trip in case no rider is picked up
    const handleCancelTrip = async () => {
        if (isMarkingRider) return
        setIsMarkingRider(true)

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
                riders: line.riders.map((rider) => ({
                    ...rider,
                    picked_up: false,
                    dropped_off: false,
                    picked_from_school: false,
                    tomorrow_trip_canceled: false,
                    checked_in_front_of_school: false,
                })),
            };

            // Update the driver's `line` data in Firestore
            const updatedLines = driverData[0].line.map((li) =>
                li.id === line.id ? resetLine : li
            );
            batch.update(driverDocRef, { line: updatedLines });

            // Commit the batch
            await batch.commit();

            // Reset local state variables if necessary
            setCurrentRiderIndex(0);
            setDisplayFinalStation(false);
            setSortedRiders([]);
            setCancelTodayTrip(false);
            setPickedUpRidersFromHome([]);
            setMapReady(false);

        } catch (error) {
            console.error('Error canceling the trip:', error);
            alert('حدث خطأ أثناء إلغاء الرحلة');
        } finally {
            setIsMarkingRider(false);
        }
    }
    
    // Line have no riders
    if(line.riders.length === 0) {
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
                        disabled={isMarkingRider}
                    >
                        <Text style={styles.done_trip_button_text}>
                            {isMarkingRider ? '...' : 'ابدأ رحلة الذهاب'}
                        </Text>
                    </TouchableOpacity>
                </View>               
            </SafeAreaView>
        )
    }

    const currentRider = sortedRiders[currentRiderIndex]

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
                        currentRider ? (
                        <>
                            <View style={styles.map_student_name_container}>
                                <Text style={styles.map_student_name}>{currentRider?.name}</Text>
                            </View>
                            <View style={styles.map_picked_button_container}>
                                <View style={styles.map_picked_button_container2}>
                                    <TouchableOpacity
                                        style={styles.pick_button_accepted} 
                                        onPress={() => markRider(true)} 
                                        disabled={isMarkingRider}
                                    >
                                        <Text style={styles.pick_button_text}>{isMarkingRider ? '...' :'صعد'}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={styles.pick_button_denied} 
                                        onPress={() => markRider(false)} 
                                        disabled={isMarkingRider}
                                    >
                                        <Text style={styles.pick_button_text}>{isMarkingRider ? '...' :'لم يصعد'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </>
                        ) : (
                            <View style={styles.map_student_name_container}>
                                <TouchableOpacity 
                                    style={styles.done_trip_button} 
                                    onPress={() => resortRiders()}
                                    disabled={isMarkingRider}
                                >
                                    <Text style={styles.done_trip_button_text}>
                                        {isMarkingRider ? '...' : 'مواصلة خط الرحلة'}
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
                                        disabled={isMarkingRider}
                                    >
                                        <Text style={styles.done_trip_button_text}>
                                            {isMarkingRider ? '...' : 'إلغاء الرحلة'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <>
                                    <View style={styles.map_student_name_container}>
                                        <Text style={styles.map_student_name}>{line.line_destination}</Text>
                                    </View>
                                    <View style={styles.map_picked_button_container}>
                                        <TouchableOpacity 
                                            style={styles.done_trip_button} 
                                            onPress={() => handleFirstTripFinish()}
                                            disabled={isMarkingRider}>
                                            <Text style={styles.done_trip_button_text}>
                                                {isMarkingRider ? '...' : 'إنهاء رحلة الذهاب'}
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
                            destination={displayFinalStation ? currentRider?.school_coords : currentRider?.home_location}
                            optimizeWaypoints={true}
                            apikey={GOOGLE_MAPS_APIKEY}
                            strokeWidth={4}
                            strokeColor="blue"
                            onError={(error) => console.log(error)}
                        />


                        {currentRider?.home_location && !displayFinalStation && (
                        <Marker
                            coordinate={currentRider?.home_location}
                            title={currentRider?.name}
                            pinColor="red"
                        />
                        )}


                        {currentRider?.school_coords && displayFinalStation && (
                        <Marker
                            coordinate={currentRider?.school_coords}
                            title={currentRider?.school_name}
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
                {line.riders.filter(rider => rider.picked_up)
                              .filter(rider => rider.checked_in_front_of_school === false)?.length > 0 ? (
                        <TouchableOpacity 
                            style={styles.done_trip_button}
                            onPress={() => handleCheckPickedUpRiders()}
                        >
                            <Text style={styles.pick_button_text}>إبدأ رحلة العودة</Text>
                        </TouchableOpacity>
                ) : (
                    <>
                        {line.riders.filter(rider => rider.picked_up)
                                      .filter(rider => rider.picked_from_school === true)?.length > 0 ? (
                            <TouchableOpacity 
                                style={styles.done_trip_button} 
                                onPress={() => handlesecondTripStart()}
                                disabled={isMarkingRider}
                            >
                                <Text style={styles.pick_button_text}>
                                    {isMarkingRider ? '...' : 'إبدأ الان'}
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity 
                                style={styles.done_trip_button} 
                                onPress={() => handlesecondTripFinish()}
                                disabled={isMarkingRider}
                            >
                                <Text style={styles.pick_button_text}>
                                    {isMarkingRider ? '...' : 'إنهاء الرحلة'}
                                </Text>
                            </TouchableOpacity>  
                        )}
                    </>       
                )}
      
                {checkingPickedUpRiders && (
                    <View style={styles.scrollViewContainer}>
                        <ScrollView>
                            {line.riders.filter(rider => rider.picked_up)
                                .filter(rider => rider.checked_in_front_of_school === false)
                                .map((rider,index) => (
                                    <View key={index} style={styles.check_students_boxes}>
                                        <View>
                                            <TouchableOpacity 
                                                style={styles.check_students_name} 
                                                onPress={() => handleMarkAbsentRider(rider.id)}
                                            >
                                                <Text style={styles.check_students_name_text}>{rider.name}</Text>
                                            </TouchableOpacity>

                                            {checkingRiderId === rider.id && (
                                                <View style={styles.check_students_buttons}>
                                                    <TouchableOpacity 
                                                        style={styles.check_students_button} 
                                                        onPress={() => HandleMarkRiderFromSchool(rider.id,true)}
                                                    >
                                                        <AntDesign name="checkcircleo" size={24} color="white" />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity 
                                                        style={styles.call_student_parent} 
                                                        onPress={() => handleCallParent(rider.phone_number)}
                                                    >
                                                        <Text style={styles.call_student_parent_text}>اتصل بولي الطالب</Text>
                                                        <Feather name="phone" size={24} color="white" />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity 
                                                        style={styles.check_students_button} 
                                                        onPress={() => HandleMarkRiderFromSchool(rider.id,false)}
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
                        currentRider ? (
                            <>
                                <View style={styles.map_student_name_container}>
                                    <Text style={styles.map_student_name}>{currentRider?.name}</Text>
                                </View>
                                <View style={styles.map_picked_button_container}>
                                    <TouchableOpacity 
                                        style={styles.pick_button_accepted} 
                                        onPress={() => markRider(true)} 
                                        disabled={isMarkingRider}
                                    >
                                        <Text style={styles.pick_button_text}>{isMarkingRider ? '...' : 'نزل'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        ) : (
                            <View style={styles.map_student_name_container}>
                                <TouchableOpacity 
                                    style={styles.done_trip_button} 
                                    onPress={() => resortRiders()}
                                    disabled={isMarkingRider}
                                >
                                    <Text style={styles.done_trip_button_text}>
                                        {isMarkingRider ? '...' : 'مواصلة خط الرحلة'}
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
                                    disabled={isMarkingRider}
                                >
                                    <Text style={styles.pick_button_text}>
                                        {isMarkingRider ? '...' : 'إنهاء رحلة العودة'}
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
                            destination={displayFinalStation ? currentRider?.driver_home_coords : currentRider?.home_location}
                            optimizeWaypoints={true}
                            apikey={GOOGLE_MAPS_APIKEY}
                            strokeWidth={4}
                            strokeColor="blue"
                            onError={(error) => console.log(error)}
                        />
        
                        {currentRider?.home_location && !displayFinalStation && (
                            <Marker
                                coordinate={currentRider?.home_location}
                                title={currentRider?.name}
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

//get screen height
const { width: SCwidth, height: SCheight } = Dimensions.get('window');

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
        height:SCheight,
        backgroundColor: colors.WHITE,
      },
      map_student_name_container:{
        width:'100%',
        position:'absolute',
        top:75,
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
        justifyContent:'space-evenly',
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
        lineHeight:32,
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
        lineHeight:40,
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
        lineHeight:40,
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
        lineHeight:40,
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
        lineHeight:50,
        verticalAlign:'middle',
        fontFamily: 'Cairo_400Regular',
      },
      mapView_safeArea_container:{
        flex: 1, // Occupy full space
        width: '100%', // Ensure the map spans the full width
        height: '100%',
      },
      map: {
        width: '100%',
        height: SCheight,
      },
})