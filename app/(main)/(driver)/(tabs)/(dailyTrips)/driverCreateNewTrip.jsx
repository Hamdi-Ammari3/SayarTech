import {useState} from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Alert,StyleSheet,Text,View,ActivityIndicator,TouchableOpacity,TextInput,Platform } from 'react-native'
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete'
import { useRouter } from 'expo-router'
import { useDriverData } from '../../../../stateManagment/DriverContext'
import DateTimePicker from '@react-native-community/datetimepicker'
import { collection,addDoc,Timestamp,doc,arrayUnion,updateDoc } from 'firebase/firestore'
import { DB } from '../../../../../firebaseConfig'
import dayjs from "dayjs"
import colors from '../../../../../constants/Colors'
import FontAwesome5 from '@expo/vector-icons/FontAwesome5'

const intercityTripCreation = () => {
    const {driverData} = useDriverData()
    const router = useRouter()
    const GOOGLE_MAPS_APIKEY = ''

    const totalSteps = 2
    const [currentPage, setCurrentPage] = useState(1)
    const [startPoint,setStartPoint] = useState('')
    const [startCity,setStartCity] = useState('')
    const [endPoint,setEndPoint] = useState('')
    const [endCity,setEndCity] = useState('')
    const [datePart, setDatePart] = useState(new Date())
    const [timePart, setTimePart] = useState(new Date())
    const [startDateTime, setStartDateTime] = useState(null)
    const [pickerMode, setPickerMode] = useState(null)
    const [pickerVisible, setPickerVisible] = useState(false)
    const [seatsNumber,setSeatsNumber] = useState('')
    const [seatPrice,setSeatPrice] = useState('')
    const [rawSeatPrice, setRawSeatPrice] = useState('')
    const [addingNewTripLoading,setAddingNewTripLoading] = useState(false)

    const createAlert = (alerMessage) => {
        Alert.alert(alerMessage)
    }

    //Come back to home screen
    const comeBackToHome = () => {
        router.push('/driverDailyTripsMain')   
    }

    const openDatePicker = () => {
        setPickerMode('date');
        setPickerVisible(true);
    };

    const openTimePicker = () => {
        setPickerMode('time');
        setPickerVisible(true);
    };

    const handlePickerChange = (event, selected) => {
        if (Platform.OS === 'ios') {
            if (selected) {
            if (pickerMode === 'date') setDatePart(selected);
            if (pickerMode === 'time') setTimePart(selected);
            }
        } else {
            setPickerVisible(false);
            if (event.type === 'set' && selected) {
                let newDatePart = datePart;
                let newTimePart = timePart;

                if (pickerMode === 'date') {
                    newDatePart = selected;
                    setDatePart(newDatePart);
                }

                if (pickerMode === 'time') {
                    newTimePart = selected;
                    setTimePart(newTimePart);
                }
                const combined = new Date(newDatePart);
                combined.setHours(newTimePart.getHours());
                combined.setMinutes(newTimePart.getMinutes());
                combined.setSeconds(0);
                setStartDateTime(combined);
            }
        }
    }

    const confirmIosPicker = () => {
        setPickerVisible(false);
        const combined = new Date(datePart);
        combined.setHours(timePart.getHours());
        combined.setMinutes(timePart.getMinutes());
        setStartDateTime(combined);
    }

    //Format price input
    const formatNumberWithCommas = (value) => {
        if (!value) return '';
        const numberOnly = value.replace(/[^0-9]/g, '');
        return Number(numberOnly).toLocaleString(); // adds commas automatically
    }

    // Go to next page
    const handleNext = () => {
        if (currentPage < totalSteps) setCurrentPage(currentPage + 1);
    }

    // Return to previous page
    const handlePrevious = () => {
        if (currentPage > 1) setCurrentPage(currentPage - 1);
    }

    //Create new intercity trip
    const createNewTrip = async() => {
        if(!startPoint) return createAlert('يرجى تحديد مكان الانطلاق')
        if(!endPoint) return createAlert('يرجى تحديد مكان الوصول')
        if(!startDateTime) return createAlert('يرجى تحديد تاريخ و وقت الانطلاق')
        if (!seatsNumber || isNaN(seatsNumber)) return createAlert('يرجى تحديد عدد المقاعد المتاحة')
        if (!rawSeatPrice || isNaN(rawSeatPrice)) return createAlert('يرجى تحديد الثمن ')

        setAddingNewTripLoading(true)

        try {
            const tripData = {
                created_by:'driver',
                trip_creator:driverData[0].full_name,
                start_point:startPoint,
                start_city:startCity,
                destination_address:endPoint,
                destination_city:endCity,
                start_datetime: Timestamp.fromDate(startDateTime),
                seats_available: Number(seatsNumber),
                seat_price: Number(rawSeatPrice),
                company_commission:1500,
                driver_name:driverData[0].full_name,
                driver_id:driverData[0].id,
                driver_notification:driverData[0].notification_token,
                driver_phone:driverData[0].phone_number,
                car_type:driverData[0].car_type,
                car_modal:driverData[0].car_model,
                car_plate:driverData[0].car_plate,
                seats_booked:0,
                riders:[],
                started:false,
                canceled:false,
                payed:false
            }
            const intercityTripsCollectionRef = collection(DB,'intercityTrips')
            const docRef = await addDoc(intercityTripsCollectionRef,tripData)

            // Step 2: Add snapshot to driver's doc
            const driverDocRef = doc(DB, 'drivers', driverData[0].id)
            const snapshot = {
                id: docRef.id,
                canceled:false
            }
            await updateDoc(driverDocRef, {
                intercityTrips: arrayUnion(snapshot) 
            })

            createAlert('تم اضافة الرحلة بنجاح')
        } catch (error) {
            createAlert('. يرجى المحاولة مرة أخرى')
            console.log(error)
        } finally{
            setAddingNewTripLoading(false)
            router.push('/driverDailyTripsMain')
        }
    }

    //Adding new trip loading
    if (addingNewTripLoading) {
        return (
          <SafeAreaView style={styles.container}>
            <View style={styles.spinner_error_container}>
              <ActivityIndicator size="large" color={colors.PRIMARY}/>
            </View>
          </SafeAreaView>
        )
    }

    // Page indicator component
    const renderPageIndicator = () => {
        return (
            <View style={styles.pageIndicatorContainer}>
                {Array.from({ length: totalSteps }, (_, index) => (
                    <View
                        key={index}
                        style={[
                        styles.pageIndicator,
                        currentPage === index + 1 ? styles.activeIndicator : styles.inactiveIndicator,
                        ]}
                    />
                ))}
            </View>
        )
    }

    // Render full pages
    const renderPage = () => {
        switch(currentPage) {
            case 1:
                return(
                    <View style={styles.create_trip_section}>
                        <GooglePlacesAutocomplete
                            placeholder="مكان الانطلاق"
                            fetchDetails={true}
                            onPress={(data, details = null) => {
                                if (details) {
                                    setStartPoint(data.description)
                                    const cityComponent = details.address_components.find((comp) =>
                                        comp.types.includes("locality") || comp.types.includes("administrative_area_level_1")
                                    )
                                    if (cityComponent) {
                                        setStartCity(cityComponent.long_name)
                                    }
                                }
                            }}
                            query={{
                                key: GOOGLE_MAPS_APIKEY,
                                language: 'ar',
                                components: 'country:iq',
                            }}
                            textInputProps={{
                                placeholderTextColor: colors.BLACK,
                            }}
                            styles={{
                                container: {
                                    flex: 0,
                                    width:300,
                                    zIndex: 999,
                                },
                                textInput: {
                                    height:47,
                                    marginBottom:10,
                                    borderWidth:1,
                                    borderColor:colors.BLACK,
                                    borderRadius:15,
                                    color:colors.BLACK,
                                    textAlign:'center',
                                    fontFamily:'Cairo_400Regular',
                                },
                                listView: { 
                                    backgroundColor: 'white' ,
                                    maxHeight: 200,
                                    borderRadius: 10,
                                    zIndex: 10,
                                    elevation: 5,
                                },
                            }}
                        />
                        <GooglePlacesAutocomplete
                            placeholder="مكان الوصول"
                            fetchDetails={true}
                            onPress={(data, details = null) => {
                                if (details) {
                                    setEndPoint(data.description)
                                    const cityComponent = details.address_components.find((comp) =>
                                        comp.types.includes("locality") || comp.types.includes("administrative_area_level_1")
                                    )
                                    if (cityComponent) {
                                        setEndCity(cityComponent.long_name)
                                    }
                                }
                            }}
                            query={{
                                key: GOOGLE_MAPS_APIKEY,
                                language: 'ar',
                                components: 'country:iq',
                            }}
                            textInputProps={{
                                placeholderTextColor: colors.BLACK,
                            }}
                            styles={{
                                container: {
                                    flex: 0,
                                    width:300,
                                    zIndex: 999,
                                },
                                textInput: {
                                    height:47,
                                    marginBottom:10,
                                    borderWidth:1,
                                    borderColor:colors.BLACK,
                                    borderRadius:15,
                                    color:colors.BLACK,
                                    textAlign:'center',
                                    fontFamily:'Cairo_400Regular',
                                },
                                listView: { 
                                    backgroundColor: 'white' ,
                                    maxHeight: 200,
                                    borderRadius: 10,
                                    zIndex: 10,
                                    elevation: 5,
                                },
                            }}
                        />
                    </View>
                )
            case 2:
                return(
                    <View style={styles.create_trip_section}>
                        <TouchableOpacity onPress={openDatePicker} style={styles.customeInput}>
                            <Text style={styles.customeInput_text}>
                                {startDateTime ? dayjs(startDateTime).format('YYYY-MM-DD') : 'تحديد التاريخ'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={openTimePicker} style={styles.customeInput}>
                            <Text style={styles.customeInput_text}>
                                {startDateTime ? dayjs(startDateTime).format('HH:mm') : 'تحديد الوقت'}
                            </Text>
                        </TouchableOpacity>

                        {pickerVisible && (
                            Platform.OS === 'ios' ? (
                                <Modal transparent animationType="slide" visible={pickerVisible}>
                                    <View style={styles.modalContainer}>
                                        <View style={styles.pickerContainer}>
                                            <DateTimePicker
                                                value={pickerMode === 'date' ? datePart : timePart}
                                                mode={pickerMode}
                                                display="spinner"
                                                onChange={handlePickerChange}
                                                is24Hour={false}
                                            />
                                            <TouchableOpacity onPress={confirmIosPicker} style={styles.doneButton}>
                                                <Text style={styles.doneButtonText}>تأكيد</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </Modal>
                            ) : (
                                <DateTimePicker
                                    value={pickerMode === 'date' ? datePart : timePart}
                                    mode={pickerMode}
                                    display="spinner"
                                    onChange={handlePickerChange}
                                    is24Hour={false}
                                />
                            )
                        )}
                        <TextInput
                            style={styles.customeInput}
                            placeholderTextColor={colors.BLACK}
                            placeholder="عدد المقاعد"
                            keyboardType="numeric"
                            value={seatsNumber}
                            onChangeText={(text) => setSeatsNumber(text.replace(/[^0-9]/g, ''))}
                        />
                        <TextInput
                            style={styles.customeInput}
                            placeholderTextColor={colors.BLACK}
                            placeholder="السعر"
                            keyboardType="numeric"
                            value={seatPrice}
                            onChangeText={(text) => {
                                const numberOnly = text.replace(/[^0-9]/g, '');
                                setRawSeatPrice(numberOnly);
                                setSeatPrice(formatNumberWithCommas(numberOnly));
                            }}
                        />
                    </View>
                )
            }
        }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.title}>
                <Text style={styles.titleText}>إنشاء رحلة</Text>
                <TouchableOpacity style={styles.arrowBackFunction} onPress={comeBackToHome}>
                    <FontAwesome5 name="arrow-circle-left" size={24} color="black" />
                </TouchableOpacity>
            </View>
            {renderPageIndicator()}
            <View style={styles.form}>
                {renderPage()}
                <View style={styles.final_buttons_container}>
                {currentPage > 1 && (
                    <TouchableOpacity style={styles.add_trip_button} onPress={handlePrevious}>
                        <Text style={styles.add_trip_button_text}>السابق</Text>
                    </TouchableOpacity>
                )}
                {currentPage < totalSteps ? (
                    <TouchableOpacity style={styles.add_trip_button} onPress={handleNext}>
                        <Text style={styles.add_trip_button_text}>التالي</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity 
                        style={styles.add_trip_button} 
                        onPress={createNewTrip}
                        disabled={addingNewTripLoading}
                    >
                        <Text style={styles.add_trip_button_text}>{addingNewTripLoading ? '...' :'أضف'}</Text>
                    </TouchableOpacity>
                )}
                </View>
            </View>
        </SafeAreaView >
    )
}

export default intercityTripCreation

const styles = StyleSheet.create({
    container:{
        flex:1,
        backgroundColor:colors.WHITE,
    },
    title:{
        width:'100%',
        height:100,
        flexDirection:'row-reverse',
        alignItems:'center',
        justifyContent:'center',
        gap:20,
    },
    titleText:{
        lineHeight:40,
        fontFamily:'Cairo_400Regular',
        fontSize:24,
        textAlign:'center',
    },
    arrowBackFunction:{
        height:40,
        alignItems:'center',
        justifyContent:'center',
    },
    pageIndicatorContainer:{ 
        flexDirection: 'row', 
        justifyContent: 'center', 
        marginBottom:50,
    },
    pageIndicator: { 
        width: 13, 
        height: 13, 
        borderRadius: 10,
        margin: 5 
    },
    activeIndicator: { 
        backgroundColor: colors.PRIMARY
    },
    inactiveIndicator: { 
        backgroundColor: '#CCC' 
    },
    form:{
        width:'100%',
        justifyContent:'center',
        alignItems:'center',
    },
    create_trip_section:{
        justifyContent:'center',
        alignItems:'center',
        marginBottom:20
    },
    customeInput:{
        width:300,
        height:50,
        marginBottom:10,
        borderWidth:1,
        borderColor:colors.BLACK,
        borderRadius:15,
        color:colors.BLACK,
        textAlign:'center',
        fontFamily:'Cairo_400Regular'
    },
    customeInput_text:{
        lineHeight:50,
        fontFamily:'Cairo_400Regular',
        fontSize:14,
        textAlign:'center',
    },
    final_buttons_container:{
        width:280,
        flexDirection:'row',
        justifyContent:'center',
        gap:20,
    },
    add_trip_button:{
        width:120,
        height:40,
        justifyContent:'center',
        alignItems:'center',
        borderRadius:15,
        backgroundColor:colors.BLUE
    },
    add_trip_button_text:{
        lineHeight:40,
        fontFamily:'Cairo_400Regular',
        textAlign:'center',
        color:colors.WHITE
    },
    spinner_error_container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
})