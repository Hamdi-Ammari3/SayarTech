import {useState,useEffect,useRef} from 'react'
import { StyleSheet,Text,View,Image,TouchableOpacity,Dimensions,Alert } from 'react-native'
import * as Location from 'expo-location'
import MapView, { Marker } from 'react-native-maps'
import MapViewDirections from 'react-native-maps-directions'
import haversine from 'haversine'
import { doc,updateDoc,writeBatch } from 'firebase/firestore'
import { DB } from '../firebaseConfig'
import dayjs from '../utils/dayjs'
import { useDriverData } from '../app/stateManagment/DriverContext'
import colors from '../constants/Colors'
import AntDesign from '@expo/vector-icons/AntDesign'
import logo from '../assets/images/logo.jpg'

const LinePage = ({line}) => {
    const {driverData} = useDriverData()
    const GOOGLE_MAPS_APIKEY = ''
    const mapRef = useRef(null)

    const [driverOriginLocation,setDriverOriginLocation] = useState(null)
    const [selectedRider, setSelectedRider] = useState(null)
    const [isMarkingRider, setIsMarkingRider] = useState(false)
    const [firstTripRemainingRiders, setFirstTripRemainingRiders] = useState(
        line?.first_phase?.riders?.filter(r => !r.checked_at_home)?.length
    )
    const [secondTripRemainingRiders, setSecondTripRemainingRiders] = useState(
        line?.second_phase?.riders?.filter(r => !r.dropped_off)?.length
    )
    
    const createAlert = (alerMessage) => {
        Alert.alert(alerMessage)
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

    // the initial driver location update
    let lastOriginUpdateTime = Date.now();

    // Function to check and update the origin location
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
    }

    // Fit coordinates
    useEffect(() => {
        if (mapRef.current) {
            let allCoords = [];
            if (selectedRider) {
                allCoords = [
                    {
                        latitude: driverOriginLocation?.latitude,
                        longitude: driverOriginLocation?.longitude
                    },
                    {
                        latitude: selectedRider?.home_location?.latitude,
                        longitude: selectedRider?.home_location?.longitude
                    }
                ]
            } else if (line.first_phase.phase_finished === false) {
                allCoords = [
                    {
                        latitude: driverData[0]?.current_location?.latitude,
                        longitude: driverData[0]?.current_location?.longitude
                    },
                    ...line?.first_phase?.riders.map(r => ({
                        latitude: r?.home_location?.latitude,
                        longitude: r?.home_location?.longitude
                    })),
                    {
                        latitude: line?.first_phase?.destination_location?.latitude,
                        longitude: line?.first_phase?.destination_location?.longitude
                    },
                ];
                mapRef.current.fitToCoordinates(allCoords, {
                    edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
                    animated: true
                });
            } else if(line.first_phase.phase_finished === true) {
                allCoords = [
                    {
                        latitude: driverData[0].current_location?.latitude,
                        longitude: driverData[0].current_location?.longitude
                    },
                    ...line?.second_phase?.riders.map(r => ({
                        latitude: r?.home_location?.latitude,
                        longitude: r?.home_location?.longitude
                    })),
                ];
            }
            mapRef.current.fitToCoordinates(allCoords, {
                edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
                animated: true
            });
        }
    }, [driverOriginLocation, selectedRider]);

    // Get iraqi time and driver daily tracking object
    const getIraqTimeAndTracking = (driverData) => {
        const iraqNow = dayjs().utcOffset(180);
        const yearMonthKey = `${iraqNow.year()}-${String(iraqNow.month() + 1).padStart(2, "0")}`;
        const dayKey = String(iraqNow.date()).padStart(2, "0");
        const iraqRealTime = iraqNow.format("HH:mm");

        // Get existing dailyTracking object
        const existingTracking = driverData[0].dailyTracking || {};
        if (!existingTracking[yearMonthKey]) existingTracking[yearMonthKey] = {};
        if (!existingTracking[yearMonthKey][dayKey]) existingTracking[yearMonthKey][dayKey] = {};
    
        return { yearMonthKey, dayKey, iraqRealTime, existingTracking };
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

    //Picking-up riders
    const pickRider = async (status) => {

        //if(status === true) {
            //if (distanceToRider > 200) {
                //createAlert('يجب أن تكون على بعد 200 متر أو أقل من منزل الطالب لتتمكن من تأكيد الصعود');
                //return;
            //}
        //}

        if (isMarkingRider) return;
        setIsMarkingRider(true);

        try {
            const batch = writeBatch(DB);
            const driverDocRef = doc(DB, 'drivers', driverData[0]?.id);

            if (!selectedRider || !line) {
                alert('حدث خطأ: لا يوجد طالب أو خط محدد');
                setIsMarkingRider(false);
                return;
            }

            const riderDoc = doc(DB, 'riders', selectedRider.id)
            const { yearMonthKey, dayKey, iraqRealTime, existingTracking } = getIraqTimeAndTracking(driverData)
            let updatedLine = { ...line }

            updatedLine.first_phase.riders = line.first_phase.riders.map((rider) => {
                if (rider.id === selectedRider.id) {
                    return {
                        ...rider,
                        checked_at_home:true,
                        picked_up: status,
                        picked_up_time: iraqRealTime,
                    };
                }
                return rider;
            })

            // send notification to picked up riders
            if (status === true) {
                if(selectedRider.notification_token) {
                    await sendNotification(
                        selectedRider.notification_token, 
                        "رحلة الذهاب بدأت",
                        `${selectedRider.name} في الطريق إلى المدرسة الآن`
                    )
                }
            }

            // Update rider document in riders collection
            batch.update(riderDoc, {
                checked_at_home:true,
                //picked_up: status,
                trip_status: status ? 'to destination' : 'at home',
            })

            setFirstTripRemainingRiders(updatedLine.first_phase.riders.filter(r => !r.checked_at_home).length)  

            // Update the specific line inside dailyTracking
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
            }

            batch.update(driverDocRef, {
                dailyTracking: updatedTracking,
            })

            await batch.commit()
                      
        } catch (error) {
            alert('حدث خطأ اثناء تحديث حالة الطالب')
            console.log(error)
        } finally{
            setIsMarkingRider(false)
            setSelectedRider(null)
        }
    }

    //Dropping-off riders
    const droppingRiders = async () => {
        if (isMarkingRider) return;
        setIsMarkingRider(true);

        try {
            const batch = writeBatch(DB);
            const driverDocRef = doc(DB, 'drivers', driverData[0]?.id);

            if (!selectedRider || !line) {
                alert('حدث خطأ: لا يوجد طالب أو خط محدد');
                setIsMarkingRider(false);
                return;
            }

            const riderDoc = doc(DB, 'riders', selectedRider.id);
            const { yearMonthKey, dayKey, iraqRealTime, existingTracking } = getIraqTimeAndTracking(driverData);
            let updatedLine = { ...line };

            updatedLine.second_phase.riders = line.second_phase.riders.map((rider) => {
                if (rider.id === selectedRider.id) {
                    return {
                        ...rider,
                        dropped_off: true,
                        dropped_off_time: iraqRealTime,
                    };
                }
                return rider;
            })

            //Update rider document in Firestore
            batch.update(riderDoc, {
                trip_status: 'at home',
            });

            //Send notification (if token exists)
            if (selectedRider.notification_token) {
                await sendNotification(
                    selectedRider.notification_token,
                    "وصل إلى المنزل",
                    `${selectedRider.name} وصل إلى المنزل الان`
                );
            }

            //Update UI state for remaining riders
            const remainingRiders = updatedLine.second_phase.riders.filter(r => !r.dropped_off).length;
            setSecondTripRemainingRiders(remainingRiders);

            //If all riders are dropped off, mark phase_finished
            if (remainingRiders === 0) {
                updatedLine.second_phase.phase_finished = true;
                updatedLine.second_phase.phase_finished_time = iraqRealTime;
            }

            //Update dailyTracking in driver doc
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

            await batch.commit();

        } catch (error) {
            alert('حدث خطأ أثناء تحديث حالة الطالب');
            console.log(error);
        } finally {
            setIsMarkingRider(false);
            setSelectedRider(null);
        }
    };

    //Finish first phase trip
    const finishFirstPhaseTrip = async () => {
        if (isMarkingRider || firstTripRemainingRiders > 0) return;
        setIsMarkingRider(true);

        try {
            const batch = writeBatch(DB);
            const driverDocRef = doc(DB, 'drivers', driverData[0]?.id);

            if (!line) {
                alert('حدث خطأ: لا يوجد خط محدد');
                setIsMarkingRider(false);
                return;
            }

            const { yearMonthKey, dayKey, iraqRealTime, existingTracking } = getIraqTimeAndTracking(driverData);
            let updatedLine = { ...line };

            // Mark the phase as finished
            updatedLine.first_phase.phase_finished = true;
            updatedLine.first_phase.phase_finished_time = iraqRealTime;

            // Update rider documents in riders collection
            updatedLine.first_phase.riders.forEach((rider) => {
                if(rider.picked_up) {
                    const riderDoc = doc(DB, 'riders', rider.id);
                    batch.update(riderDoc, {
                        trip_status: 'at destination',
                    });
                }           
            });

            // Update the specific line inside dailyTracking
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

            // Commit changes to the driver document
            batch.update(driverDocRef, {
                dailyTracking: updatedTracking,
            });

            await batch.commit();

        } catch (error) {
            alert('حدث خطأ أثناء إنهاء المرحلة الأولى');
            console.log(error);
        } finally {
            setIsMarkingRider(false);
            setSelectedRider(null);
        }
    };

    // Format the rider name to two words only combination
    const formatRiderName = (name = '', familyName = '') => {
        const firstName = name.trim().split(/\s+/)[0] || '';
        const firstFamilyName = familyName.trim().split(/\s+/)[0] || '';
        return `${firstName} ${firstFamilyName}`;
    };

    // Format the destiantion name to two words only combination
    const getFirstTwoWords = (text) => {
        if (!text) return '';
        return text.trim().split(/\s+/).slice(0, 2).join(' ');
    };

    //Render markers
    const renderMarkers = () => {
        if (line.first_phase.phase_finished === false) {
            return (
                <>
                    {line.first_phase.riders.filter(r => !r.checked_at_home).map((r, idx) => (
                        <Marker
                            key={`first-${r.id || idx}`}
                            coordinate={{
                                latitude: r?.home_location?.latitude,
                                longitude: r?.home_location?.longitude
                            }}
                            pinColor="red"
                            onPress={() => setSelectedRider(r)}
                        />
                    ))}
                    <Marker
                        key={`school-${line.id}`}
                        coordinate={{
                            latitude: line.first_phase.destination_location.latitude,
                            longitude: line.first_phase.destination_location.longitude
                        }}
                        pinColor="blue"
                        onPress={() =>
                            setSelectedRider({
                                id: 'school',
                                name: line.first_phase.destination,
                                isSchool: true
                            })
                        }
                    />
                </>
            );
        } else {
            return (
                <>
                    {line.second_phase.riders.filter(r => !r.dropped_off).map((r, idx) => (
                        <Marker
                            key={`second-${r.id || idx}`}
                            coordinate={{
                                latitude: r?.home_location?.latitude,
                                longitude: r?.home_location?.longitude
                            }}
                            pinColor="red"
                            onPress={() => setSelectedRider(r)}
                        />
                    ))}
                </>
            );
        }
    };

    if(line.first_phase.phase_finished === true && line.second_phase.phase_finished === true) {
        return(
            <View style={styles.finished_line_container}>
                <View style={styles.logo}>
                    <Image source={logo} style={styles.logo_image}/>
                </View>
                <Text style={styles.finished_line_text}>لقد انهيت رحلات هذا الخط بنجاح</Text>
            </View>
        )
    }

    return(    
        <View style={styles.map_container}>
            <MapView
                ref={mapRef}
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
            >
                {selectedRider && driverOriginLocation && (
                    <MapViewDirections
                        origin={driverOriginLocation}
                        destination={
                            selectedRider.isSchool
                                ? line.first_phase.destination_location
                                : selectedRider.home_location
                        }
                        optimizeWaypoints={true}
                        apikey={GOOGLE_MAPS_APIKEY}
                        strokeWidth={4}
                        strokeColor="blue"
                        onError={(error) => console.log(error)}
                    />
                )}
                {renderMarkers()}
            </MapView>

            {selectedRider ? (
                selectedRider.id === 'school' ? (
                    <View style={styles.rider_info_box}>
                        <Text style={styles.rider_name}>{getFirstTwoWords(selectedRider.name)}</Text>
                        <TouchableOpacity
                            style={[
                                styles.finish_trip_button,
                                firstTripRemainingRiders > 0 && styles.finish_trip_disabled
                            ]}
                            onPress={finishFirstPhaseTrip}
                            disabled={firstTripRemainingRiders > 0}
                        >
                            <Text 
                                style={[
                                    styles.finish_trip_button_text,
                                    firstTripRemainingRiders > 0 && styles.finish_trip_disabled_text
                                ]}
                            >
                                {isMarkingRider ? '...' : 'إنهاء المرحلة الأولى'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setSelectedRider(null)}>
                            <AntDesign name="closecircleo" size={22} color="black" />
                        </TouchableOpacity>
                    </View>
                ) : (                
                    <View style={styles.rider_info_box}>
                        {line.first_phase.phase_finished === false ? (
                            <View style={styles.check_students_boxes}>
                                <TouchableOpacity
                                    style={styles.pick_button_accepted} 
                                    onPress={() => pickRider(true)} 
                                    disabled={isMarkingRider}
                                >
                                    <Text style={styles.pick_button_text}>{isMarkingRider ? '...' :'صعد'}</Text>
                                </TouchableOpacity>
                                <Text style={styles.rider_name}>{formatRiderName(selectedRider.name,selectedRider.family_name)}</Text>
                                <TouchableOpacity
                                    style={styles.pick_button_denied} 
                                    onPress={() => pickRider(false)}
                                    disabled={isMarkingRider}
                                >
                                    <Text style={styles.pick_button_text}>{isMarkingRider ? '...' :'لم يصعد'}</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.check_students_boxes}>
                                <Text style={styles.rider_name}>{formatRiderName(selectedRider.name,selectedRider.family_name)}</Text>
                                <TouchableOpacity
                                    style={styles.pick_button_accepted} 
                                    onPress={droppingRiders}
                                    disabled={isMarkingRider}
                                >
                                    <Text style={styles.pick_button_text}>{isMarkingRider ? '...' :'نزل'}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        
                        <TouchableOpacity onPress={() => setSelectedRider(null)}>
                            <AntDesign name="closecircleo" size={22} color="black" />
                        </TouchableOpacity>
                    </View>
                )
            ) : (
                <View style={styles.rider_info_box}>
                    {line.first_phase.phase_finished === false ? (
                        <View style={styles.trip_left_riders}>
                            <View style={styles.trip_left_riders_number}>
                                <Text style={styles.rider_name}>رحلة الذهاب</Text>
                            </View>                           
                            <Text style={styles.rider_name}>-</Text>
                            <View style={styles.trip_left_riders_number}>
                                <Text style={styles.rider_name}>{firstTripRemainingRiders}</Text>
                                <Text style={styles.rider_name}>راكب</Text>
                            </View>
                        </View>                        
                    ) : (
                        <View style={styles.trip_left_riders}>
                            <View style={styles.trip_left_riders_number}>
                                <Text style={styles.rider_name}>رحلة العودة</Text>
                            </View>                           
                            <Text style={styles.rider_name}>-</Text>
                            <View style={styles.trip_left_riders_number}>
                                <Text style={styles.rider_name}>{secondTripRemainingRiders}</Text>
                                <Text style={styles.rider_name}>راكب</Text>
                            </View>
                        </View>
                    )}                
                </View>
            )}
        </View>
    )
}

export default LinePage

//get screen height and width
const { width: SCwidth, height: SCheight } = Dimensions.get('window');

const styles = StyleSheet.create({
    map_container: {
        width:SCwidth,
        height:SCheight,
        position: 'relative',
    },
    map: {
        flex: 1,
    },
    rider_info_box: {
        position:'absolute',
        top:10,
        left:10,
        right:10,
        height:50,
        paddingHorizontal:10,
        flexDirection:'row-reverse',
        justifyContent:'space-between',
        alignItems:'center',
        borderRadius:10,
        backgroundColor:colors.WHITE,
        shadowColor:'#000',
        shadowOffset:{width:0,height:2},
        shadowOpacity:0.3,
        shadowRadius:4,
        elevation:5,
    },
    check_students_boxes:{
        width:280,
        height:50,
        borderRadius:15,
        flexDirection:'row-reverse',
        justifyContent:'space-between',
        alignItems:'center',
    },
    rider_name:{
        lineHeight:50,
        fontFamily: 'Cairo_400Regular',
        fontSize: 14,
        textAlign:'center',
        color:colors.BLACK
    },
    pick_button_accepted:{
        width:75,
        height:35,
        borderRadius:15,
        alignItems:'center',
        justifyContent:'center',
        backgroundColor:colors.BLUE,
    },
    pick_button_denied:{
        width:75,
        height:35,
        borderRadius:15,
        alignItems:'center',
        justifyContent:'center',
        backgroundColor:'#d11a2a',
    },
    finish_trip_button:{
        width:160,
        height:35,
        borderRadius:15,
        alignItems:'center',
        justifyContent:'center',
        backgroundColor:colors.BLUE,
    },
    finish_trip_button_text:{
        lineHeight:35,
        verticalAlign:'middle',
        fontFamily: 'Cairo_400Regular',
        color:colors.WHITE
    },
    finish_trip_disabled:{
        backgroundColor:'#CCC',
    },
    finish_trip_disabled_text:{
        color:colors.DARKGRAY
    },
    pick_button_text:{
        lineHeight:35,
        verticalAlign:'middle',
        fontFamily: 'Cairo_400Regular',
        color:colors.WHITE
    },
    trip_left_riders:{
        width:'100%',
        height:50,
        flexDirection:'row-reverse',
        justifyContent:'center',
        alignItems:'center',
        gap:10,
    },
    trip_left_riders_number:{
        width:100,
        height:50,
        borderRadius:15,
        flexDirection:'row-reverse',
        justifyContent:'center',
        alignItems:'center',
        gap:10,
    },
    rider_number:{
        lineHeight:50,
        fontFamily: 'Cairo_700Bold',
        fontSize: 14,
        textAlign:'center',
        color:colors.BLACK
    },
    finished_line_container:{
        height:SCheight,
    },
    logo:{
        height:200,
        marginTop:120,
        alignItems:'center',
        justifyContent:'center',
    },
    logo_image:{
        height:180,
        width:180,
        resizeMode:'contain',
    },
    finished_line_text:{
        width:250,
        height:50,
        borderColor:colors.BLACK,
        borderWidth:1,
        verticalAlign:'middle',
        borderRadius:15,
        textAlign:'center',
        fontFamily: 'Cairo_400Regular',
        fontSize:16,
    },
})
