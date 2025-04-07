import React,{useState,useEffect,useRef} from 'react'
import { StyleSheet,Text,Image,View,ScrollView,TouchableOpacity,Dimensions,Alert } from 'react-native'
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
import startEngineImage from '../assets/images/push-button.png'
import logo from '../assets/images/logo.jpeg'

const LinePage = ({line,todayLines}) => {
    
    // disactivate the current line and activate the next if the line trip canceled

    // add points to driver based on time he get to the school

    // add points of the month in the driver profile

    // change driver location tracking from foreground to background

    // **** if line if finished (second trip) must be excluded from activation and indexing *****
    
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
    const [distanceToRider,setDistanceToRider] = useState(null)
    const [distanceToDestination,setDistanceToDestination] = useState(null)

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

                // Calculate distance to the rider
                if (sortedRiders[currentRiderIndex]) {
                    const riderLocation = sortedRiders[currentRiderIndex]?.home_location;
                    if (riderLocation) {
                        const distance = haversine(currentLocation, riderLocation, { unit: "meter" });
                        setDistanceToRider(distance);  // Store as a number
                    }
                }

                // Distance to Final Destination (School/Work)
                const finalDestination = sortedRiders.find(rider => rider.id === 'school');
                
                if (finalDestination) {
                    const destinationLocation = finalDestination?.school_coords;
                    if (destinationLocation) {
                        const distance = haversine(currentLocation, destinationLocation, { unit: "meter" });
                        setDistanceToDestination(distance);
                    }
                }
                
                
                // Check if the driver has moved 1000 meters or more
                checkAndUpdateOriginLocation(currentLocation);
            });
        }
        startTracking();
    }, [driverData,sortedRiders,currentRiderIndex]);

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
                sorted = assignedRiders.map((rider) => ({
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
                reSorted = assignedRiders.filter(rider => rider.picked_up === false)
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

    // Get iraqi time and driver daily tracking object
    const getIraqTimeAndTracking = (driverData) => {
        const iraqTimeString = new Date().toLocaleString("en-US", { timeZone: "Asia/Baghdad" });
        const [month, day, year] = iraqTimeString.split(/[/, ]/);
        const yearMonthKey = `${year}-${month.padStart(2, "0")}`; // "YYYY-MM"
        const dayKey = day.padStart(2, "0"); // "DD"
        const iraqRealTime = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Baghdad", hour12: false }).slice(0, 5); // "HH:MM"
    
        // Get existing dailyTracking object
        const existingTracking = driverData[0].dailyTracking || {};
        if (!existingTracking[yearMonthKey]) existingTracking[yearMonthKey] = {};
        if (!existingTracking[yearMonthKey][dayKey]) existingTracking[yearMonthKey][dayKey] = {};
    
        return { yearMonthKey, dayKey, iraqRealTime, existingTracking };
    };
    
    // Start the first trip
    const handleFirstTripStart = async () => {
        if (isMarkingRider) return;
        setIsMarkingRider(true);

        try {
            const batch = writeBatch(DB)
            const driverDoc = doc(DB,'drivers', driverData[0].id)
            const { yearMonthKey, dayKey, iraqRealTime, existingTracking } = getIraqTimeAndTracking(driverData)

            // Find the currently active line
            const activeLine = todayLines?.find(li => li?.line_active);

            // Skip activation check if only one line exists
            if (todayLines.length > 1 && activeLine && activeLine.line_index !== line.line_index) {
                alert(`الرجاء إنهاء رحلة ${activeLine.lineName} قبل بدء هذا الخط`);
                setIsMarkingRider(false);
                return;
            }

            // Update the line's first_trip_started status
            const updatedLine = {
                ...line,
                first_trip_started: true,
                first_trip_start_time: iraqRealTime,
            };

            // Update the driver's line data
            const updatedTodayLines = todayLines.map((li) =>
                li.id === line.id ? updatedLine : li
            )

            // Update dailyTracking
            existingTracking[yearMonthKey][dayKey].today_lines = updatedTodayLines;

            // Update the driver's line data in the batch
            batch.update(driverDoc, { 
                dailyTracking: existingTracking 
            });

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

        //if (distanceToDestination > 200) {
            //createAlert('يجب أن تكون على بعد 200 متر أو أقل من الوجهة النهائية لإنهاء الرحلة');
            //return;
        //}

        try {
            const batch = writeBatch(DB);
            const driverDoc = doc(DB,'drivers', driverData[0].id);
            const pickedUpRiders = line.riders.filter(rider => rider.picked_up);
            const { yearMonthKey, dayKey, iraqRealTime, existingTracking } = getIraqTimeAndTracking(driverData);

            // Mark the current line as finished
            const updatedLine = {
                ...line,
                first_trip_finished: true,
                first_trip_finish_time: iraqRealTime,
                current_trip: 'second',
                line_active: todayLines.length === 1 // Keep active if there is only one line
            }

            // Find the next line in the round process
            let nextLineIndex = null;
            if (todayLines.length > 1) {
                nextLineIndex = (line.line_index % todayLines.length) + 1; // Move to the next line in order
            }

            // Update the lines array with the new states
            const updatedTodayLines = todayLines.map(li => {
                if (li.line_index === line.line_index) {
                    return updatedLine; // Update the current line
                } else if (todayLines.length > 1 && li.line_index === nextLineIndex) {
                    return { ...li, line_active: true }; // Activate the next line
                }

                return { ...li, line_active: false }; // Deactivate all other lines
            });

            // Update dailyTracking
            existingTracking[yearMonthKey][dayKey].today_lines = updatedTodayLines;

            batch.update(driverDoc, { 
                dailyTracking: existingTracking 
            });

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
        // Find the currently active line
        const activeLine = todayLines?.find(li => li?.line_active);
        
        if (todayLines.length > 1 && activeLine && activeLine.line_index !== line.line_index) {
            alert(`الرجاء إنهاء رحلة ${activeLine.lineName} قبل بدء هذا الخط`);
            return;
        } else {
            setCheckingPickedUpRiders(true)
        } 
    }

    // Start the second trip
    const handlesecondTripStart = async () => {
        if (isMarkingRider) return; 
        setIsMarkingRider(true);

        try {
            const batch = writeBatch(DB)
            const driverDoc = doc(DB, 'drivers', driverData[0].id)
            const { yearMonthKey, dayKey, iraqRealTime, existingTracking } = getIraqTimeAndTracking(driverData)

            // Find the currently active line
            const activeLine = todayLines?.find(li => li?.line_active);

            // Check if the selected line is active
            if (todayLines.length > 1 && activeLine && activeLine?.line_index !== line.line_index) {            
                alert(`الرجاء إنهاء رحلة ${activeLine.lineName} قبل بدء هذا الخط`);
                setIsMarkingRider(false);
                return;
            }

            // Update the line's first_trip_started status
            const updatedLine = {
                ...line,
                second_trip_started: true,
                second_trip_start_time: iraqRealTime,
            }

            // Update the driver's line data
            const updatedTodayLines = todayLines.map((li) =>
                li.id === line.id ? updatedLine : li
            )

            // Update dailyTracking
            existingTracking[yearMonthKey][dayKey].today_lines = updatedTodayLines;

            // Update the driver's line data in the batch
            batch.update(driverDoc, { 
                dailyTracking: existingTracking 
            });

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
            const droppedOffRiders = line.riders.filter(rider => rider.dropped_off)
            const { yearMonthKey, dayKey, iraqRealTime, existingTracking } = getIraqTimeAndTracking(driverData);

            // Get the last line index
            const lastLineIndex = Math.max(...todayLines.map(li => li.line_index || 0))

            // Determine if the current line is the last one
            const isLastLine = line.line_index === lastLineIndex

            // Update current line
            const updatedCurrentLine = {
                ...line,
                second_trip_finished: true,
                secont_trip_finish_time: iraqRealTime,
                line_active: false,
            }

            // Update the lines array with the new states
            const updatedTodayLines = todayLines.map(li => {
                if (li.line_index === line.line_index) {
                    return updatedCurrentLine; // Update the current line
                } else if (!isLastLine && li.line_index === line.line_index + 1) {
                    return { ...li, line_active: true }; // Activate the next line
                }
                return li
            });

            existingTracking[yearMonthKey][dayKey].today_lines = updatedTodayLines;

            if(isLastLine){
                existingTracking[yearMonthKey][dayKey].complete_today_journey = true;
            }

            batch.update(driverDoc, {
                dailyTracking: existingTracking,
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

        //if(distanceToRider > 200) {
            //createAlert('يجب أن تكون على بعد 200 متر أو أقل من منزل الطالب لتتمكن من تأكيد الصعود');
            //return;
        //}

        if (isMarkingRider) return;
        setIsMarkingRider(true);

        try {
            const batch = writeBatch(DB);
            const driverDocRef = doc(DB, 'drivers', driverData[0]?.id);
            const currentRider = sortedRiders[currentRiderIndex];
            const currentTrip = line.current_trip || todayLines.find((li) => li.lineName === line.lineName)?.current_trip;
            
            if (!currentTrip) {
                createAlert('حدث خطا الرجاء المحاولة مرة اخرى')
                return;                
            }

            if(currentRider) {
                const riderDoc = doc(DB, 'riders', currentRider.id);               

                if (currentRider.id !== 'school' && currentRider.id !== 'driver_home') {
                    const updateField = 
                        currentTrip === 'first' 
                            ? { picked_up: status, trip_status: status ? 'to destination' :'at home'} 
                            : { trip_status:'at home' };
                    batch.update(riderDoc, updateField)

                    const { yearMonthKey, dayKey, iraqRealTime, existingTracking } = getIraqTimeAndTracking(driverData);

                    // Update rider status AND timing inside the line (in dailyTracking)
                    const updatedLine = {
                        ...line,
                        riders: line.riders.map((rider) => {
                            if (rider.id === currentRider.id) {
                                return {                          
                                ...rider,
                                //...(currentTrip === 'first' && status ? { picked_up: true, picked_up_time: iraqRealTime } : {picked_up: false}),
                                //...(currentTrip === 'second' && status ? { dropped_off: true, dropped_off_time: iraqRealTime } : {dropped_off: false}),
                                ...(currentTrip === 'first' ? { picked_up: status,picked_up_time: iraqRealTime } : { dropped_off: status,dropped_off_time: iraqRealTime })
                                };                      
                            }
                            return rider;
                        }),
                    };

                    const updatedTracking = {
                        ...existingTracking,
                        [yearMonthKey]: {
                            ...existingTracking[yearMonthKey],
                            [dayKey]: {
                                ...existingTracking[yearMonthKey][dayKey],
                                today_lines: existingTracking[yearMonthKey][dayKey].today_lines.map((li) =>
                                    li.id === line.id ? updatedLine : li
                                ),
                            },
                        },
                    };

                    batch.update(driverDocRef, {
                        dailyTracking: updatedTracking,
                    });

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
            const { yearMonthKey, dayKey, existingTracking } = getIraqTimeAndTracking(driverData);

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

            const updatedTracking = {
                ...existingTracking,
                [yearMonthKey]: {
                    ...existingTracking[yearMonthKey],
                    [dayKey]: {
                        ...existingTracking[yearMonthKey][dayKey],
                        today_lines: existingTracking[yearMonthKey][dayKey].today_lines.map((li) =>
                            li.id === line.id ? updatedLine : li
                        ),
                    },
                },
            };

            batch.update(driverDocRef, { 
                dailyTracking: updatedTracking 
            });

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
    const handleSettingCheckedRiderID = (riderId) => {
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
            const driverDoc = doc(DB, 'drivers', driverData[0]?.id);
            const { yearMonthKey, dayKey, existingTracking } = getIraqTimeAndTracking(driverData);

            // Remove the canceled line
            const filteredLines = todayLines.filter(li => li.id !== line.id)

            if (filteredLines.length === 0) {
                // No remaining lines — journey is complete
                existingTracking[yearMonthKey][dayKey].complete_today_journey = true;
            } else {
                // Reindex remaining lines starting from 1
                const reIndexedLines = filteredLines.map((li, index) => ({
                    ...li,
                    line_index: index + 1,
                    line_active: false // We'll activate the right one in a moment
                }));

                // Find index of the canceled line in original list
                const canceledLineIndex = line.line_index;

                // Find next line to activate: the one that came after the canceled line (or first if last was canceled)
                const nextLineToActivateIndex = reIndexedLines.findIndex(
                    li => li.line_index === canceledLineIndex
                ) !== -1
                    ? reIndexedLines.findIndex(li => li.line_index === canceledLineIndex)
                    : 0; // If not found (last line), go back to first
                
                 // Activate the correct line
                reIndexedLines[nextLineToActivateIndex] = {
                    ...reIndexedLines[nextLineToActivateIndex],
                    line_active: true
                };

                // Save updated lines into tracking
                existingTracking[yearMonthKey][dayKey].today_lines = reIndexedLines;
            }

            // Apply the batch update
            batch.update(driverDoc, {
                dailyTracking: existingTracking
            });

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
                <View style={styles.start_trip_container}>
                    <TouchableOpacity 
                        onPress={() => handleFirstTripStart()}
                        disabled={isMarkingRider}
                    >
                        <Image source={startEngineImage} style={styles.start_engine_image}/>
                    </TouchableOpacity>
                    <Text style={styles.start_trip_text}>
                        {isMarkingRider ? '...' : 'ابدأ رحلة الذهاب'}
                    </Text>
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
                            <View style={styles.rider_picked_dropped_status_container}>
                                <TouchableOpacity
                                    style={styles.pick_button_accepted} 
                                    onPress={() => markRider(true)} 
                                    disabled={isMarkingRider}
                                >
                                    <Text style={styles.pick_button_text}>{isMarkingRider ? '...' :'صعد'}</Text>
                                </TouchableOpacity>
                                <View style={styles.map_student_name_distance_container}>
                                    <Text style={styles.map_student_name}>{currentRider?.name}</Text>
                                    <Text style={styles.map_student_distance}>
                                        {distanceToRider >= 1000 ? `${(distanceToRider / 1000).toFixed(2)} km` : `${Math.round(distanceToRider)} m`}
                                    </Text>
                                </View>
                                <TouchableOpacity 
                                    style={styles.pick_button_denied} 
                                    onPress={() => markRider(false)} 
                                    disabled={isMarkingRider}
                                >
                                    <Text style={styles.pick_button_text}>{isMarkingRider ? '...' :'لم يصعد'}</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.resort_riders_btn_container}>
                                <TouchableOpacity 
                                    style={styles.resort_riders_button} 
                                    onPress={() => resortRiders()}
                                    disabled={isMarkingRider}
                                >
                                    <Text style={styles.resort_riders_button_text}>
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
                                        style={styles.cancel_trip_button} 
                                        onPress={() => handleCancelTrip()}
                                        disabled={isMarkingRider}
                                    >
                                        <Text style={styles.complete_trip_button_text}>
                                            {isMarkingRider ? '...' : 'إلغاء الرحلة'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={styles.complete_first_trip_container}>
                                    <TouchableOpacity 
                                        style={styles.complete_trip_button} 
                                        onPress={() => handleFirstTripFinish()}
                                        disabled={isMarkingRider}>
                                        <Text style={styles.complete_trip_button_text}>
                                            {isMarkingRider ? '...' : 'إنهاء رحلة الذهاب'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
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
                    <View style={styles.start_trip_container}>
                        <TouchableOpacity 
                            onPress={() => handleCheckPickedUpRiders()}
                            style={styles.complete_trip_button}
                        >
                            <Text style={styles.complete_trip_button_text}>تحقق من صعود الركاب</Text>
                        </TouchableOpacity>
                        {checkingPickedUpRiders === false && (
                            <Text style={styles.warning_text_before_start_second_trip}>يُرجى التحقق من صعود جميع الركاب قبل بدء رحلة العودة. في حال غياب أحد الركاب، يُرجى التواصل معه أو مع ولي أمره قبل المتابعة
                            </Text>
                        )}
                    </View>
                    
                ) : (
                    <View style={styles.container}>
                        {line.riders.filter(rider => rider.picked_up)
                                      .filter(rider => rider.picked_from_school === true)?.length > 0 ? (
                            <View style={styles.start_second_trip_container}>
                                <View style={styles.start_second_trip_container2}>
                                    <TouchableOpacity 
                                        onPress={() => handlesecondTripStart()}
                                        disabled={isMarkingRider}
                                    >
                                        <Image source={startEngineImage} style={styles.start_engine_image}/>
                                    </TouchableOpacity>
                                    <Text style={styles.start_trip_text}>
                                        {isMarkingRider ? '...' : 'ابدأ رحلة العودة'}
                                    </Text>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.start_second_trip_container}>
                            <TouchableOpacity 
                                style={styles.cancel_trip_button} 
                                onPress={() => handlesecondTripFinish()}
                                disabled={isMarkingRider}
                            >
                                <Text style={styles.complete_trip_button_text}>
                                    {isMarkingRider ? '...' : 'إنهاء الرحلة'}
                                </Text>
                            </TouchableOpacity>  
                            </View>
                            
                        )}
                    </View>       
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
                                                onPress={() => handleSettingCheckedRiderID(rider.id)}
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
                            <View style={styles.rider_picked_dropped_status_container}>
                                <View style={styles.map_student_name_distance_container}>
                                    <Text style={styles.map_student_name}>{currentRider?.name}</Text>
                                    <Text style={styles.map_student_distance}>
                                        {distanceToRider >= 1000 ? `${(distanceToRider / 1000).toFixed(2)} km` : `${Math.round(distanceToRider)} m`}
                                    </Text>
                                </View>
                                <TouchableOpacity 
                                    style={styles.pick_button_accepted} 
                                    onPress={() => markRider(true)} 
                                    disabled={isMarkingRider}
                                >
                                    <Text style={styles.pick_button_text}>{isMarkingRider ? '...' : 'نزل'}</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.resort_riders_btn_container}>
                                <TouchableOpacity 
                                    style={styles.resort_riders_button} 
                                    onPress={() => resortRiders()}
                                    disabled={isMarkingRider}
                                >
                                    <Text style={styles.resort_riders_button_text}>
                                        {isMarkingRider ? '...' : 'مواصلة خط الرحلة'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )
                    ) : (
                        <View style={styles.complete_second_trip_container}>
                            <TouchableOpacity 
                                style={styles.complete_trip_button} 
                                onPress={() => handlesecondTripFinish()}
                                disabled={isMarkingRider}
                            >
                                <Text style={styles.complete_trip_button_text}>
                                    {isMarkingRider ? '...' : 'إنهاء رحلة العودة'}
                                </Text>
                            </TouchableOpacity>
                        </View>
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

    // Driver cancel the second trip
    if(
        line.first_trip_started === true &&
        line.first_trip_finished === true &&
        line.second_trip_started === false &&
        line.second_trip_finished === true
    ) {
        return(
            <SafeAreaView style={styles.container}>
                <View style={styles.trip_finished_today}>
                    <View style={styles.logo}>
                        <Image source={logo} style={styles.logo_image}/>
                    </View>
                    <Text style={styles.today_trip_completed_text}>الرحلة انتهت</Text>
                </View>             
            </SafeAreaView>
        )
    }

    // Driver complete the second trip
    if(
        line.first_trip_started === true &&
        line.first_trip_finished === true &&
        line.second_trip_started === true &&
        line.second_trip_finished === true
    ) {
        return(
            <SafeAreaView style={styles.container}>
                <View style={styles.trip_finished_today}>
                    <View style={styles.logo}>
                        <Image source={logo} style={styles.logo_image}/>
                    </View>
                    <Text style={styles.today_trip_completed_text}>الرحلة انتهت</Text>
                </View>             
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
    map: {
        width: '100%',
        height: SCheight,
    },
    resort_riders_btn_container:{
        width:'100%',
        position:'absolute',
        top:72,
        left:0,
        zIndex:5,
        alignItems:'center',
        justifyContent:'center',
    },
    resort_riders_button:{
        width:200,
        height:50,
        borderRadius:15,
        alignItems:'center',
        justifyContent:'center',
        backgroundColor:colors.BLUE
    },
    resort_riders_button_text:{
        lineHeight:50,
        verticalAlign:'middle',
        fontFamily: 'Cairo_400Regular',
        color:colors.WHITE
    },
    rider_picked_dropped_status_container:{
        width:'100%',
        position:'absolute',
        top:73,
        left:0,
        zIndex:5,
        flexDirection:'row-reverse',
        alignItems:'center',
        justifyContent:'space-around',
    },
    map_student_name_distance_container:{
        width:200,
        height:40,
        backgroundColor:colors.WHITE,
        borderColor:colors.BLACK,
        borderWidth:1,
        borderRadius:15,
        flexDirection:'row-reverse',
        alignItems:'center',
        justifyContent:'space-around'
    },
    map_student_name:{
        lineHeight:40,      
        fontFamily: 'Cairo_400Regular',
        fontSize:15,
    },
    map_student_distance:{
        lineHeight:40,   
        fontFamily: 'Cairo_700Bold',
        fontSize:14,
    },
    pick_button_accepted:{
        width:75,
        height:40,
        borderRadius:15,
        alignItems:'center',
        justifyContent:'center',
        backgroundColor:colors.BLUE,
    },
    pick_button_denied:{
        width:75,
        height:40,
        borderRadius:15,
        alignItems:'center',
        justifyContent:'center',
        backgroundColor:'#d11a2a',
    },
    pick_button_text:{
        lineHeight:40,
        verticalAlign:'middle',
        fontFamily: 'Cairo_700Bold',
        color:colors.WHITE
    },
    complete_first_trip_container:{
        width:'100%',
        position:'absolute',
        top:73,
        left:0,
        zIndex:5,
        alignItems:'center',
        justifyContent:'center',
    },
    complete_second_trip_container:{
        width:'100%',
        position:'absolute',
        top:'50%',
        left:0,
        zIndex:5,
        alignItems:'center',
        justifyContent:'center',
    },
    complete_trip_button:{
        width:200,
        height:50,
        borderRadius:15,
        alignItems:'center',
        justifyContent:'center',
        backgroundColor:colors.BLUE,
    },
    cancel_trip_button:{
        width:200,
        height:50,
        borderRadius:15,
        alignItems:'center',
        justifyContent:'center',
        backgroundColor:'#d11a2a',
    },
    complete_trip_button_text:{
        lineHeight:50,
        verticalAlign:'middle',
        fontFamily: 'Cairo_400Regular',
        fontSize:15,
        color:colors.WHITE
    },
    warning_text_before_start_second_trip:{
        width:320,
        fontFamily: 'Cairo_700Bold',
        fontSize:12,
        textAlign:'center',
    },
    second_trip_container:{
        backgroundColor:'yellow'
    },
    start_second_trip_container:{
        height:'100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    start_second_trip_container2:{
        marginTop:300,
        height:200,
        justifyContent: 'center',
        alignItems: 'center',
    },
    start_trip_container:{
        height:200,
        alignItems:'center',
        justifyContent:'space-around',
    },
    start_engine_image:{
        height:130,
        width:130,
        resizeMode:'contain',
      },
    start_trip_text:{
        width:180,
        marginTop:10,
        verticalAlign:'middle',
        borderRadius:15,
        textAlign:'center',
        fontFamily: 'Cairo_400Regular', 
        fontSize:16,
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
        width:220,
        height:42,
        borderColor:colors.BLACK,
        borderWidth:1,
        borderRadius:15,
        justifyContent:'center',
        alignItems:'center',
    },
    check_students_name_text:{
        lineHeight:42,
        verticalAlign:'middle',
        fontFamily: 'Cairo_400Regular',
        fontSize:15,
        color:colors.BLACK
    },
    check_students_buttons:{
        width:220,
        flexDirection:'row-reverse',
        alignItems:'center',
        justifyContent:'space-between',
        marginVertical:7,
    },
    check_students_button:{
        width:60,
        height:40,
        borderRadius:10,
        alignItems:'center',
        justifyContent:'center',
        backgroundColor:colors.SECONDARY
    },
    call_student_parent:{
        width:60,
        height:40,
        borderRadius:15,
        backgroundColor:'#56CA00',
        flexDirection:'row-reverse',
        alignItems:'center',
        justifyContent:'space-around',
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
    trip_finished_today:{
        height:400,
        alignItems:'center',
        justifyContent:'center',
    },
    logo:{
        width:'100%',
        height:200,
        alignItems:'center',
        justifyContent:'center',
    },
    logo_image:{
        height:150,
        width:150,
        resizeMode:'contain',
    },
    today_trip_completed_text:{
        width:200,
        height:50,
        backgroundColor:colors.WHITE,
        borderColor:colors.BLACK,
        borderWidth:1,
        verticalAlign:'middle',
        borderRadius:15,
        textAlign:'center',
        fontFamily: 'Cairo_400Regular',
        fontSize:16,
    },
})