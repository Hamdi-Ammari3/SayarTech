import {useState} from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Alert,StyleSheet,Text,View,ActivityIndicator,TouchableOpacity,TextInput,Platform,Modal,ScrollView } from 'react-native'
import MapView from 'react-native-maps'
import * as Location from 'expo-location'
import { useRouter,useLocalSearchParams } from 'expo-router'
import { Dropdown } from 'react-native-element-dropdown'
import DateTimePicker from '@react-native-community/datetimepicker'
import { collection,Timestamp,doc,arrayUnion,writeBatch } from 'firebase/firestore'
import { DB } from '../../../../../firebaseConfig'
import dayjs from "dayjs"
import colors from '../../../../../constants/Colors'
import FontAwesome5 from '@expo/vector-icons/FontAwesome5'
import FontAwesome6 from '@expo/vector-icons/FontAwesome6'
import AntDesign from '@expo/vector-icons/AntDesign'

const riderCreateNewTrip = () => {
  const router = useRouter()

  const {riderName,riderID,notificationToken,phoneNumber,balance} = useLocalSearchParams()

  const account_balance = Number(balance);

  const [openLocationModal,setOpenLocationModal] = useState(false)
  const [homeCoords,setHomeCoords] = useState(null)
  const [homeAddress,setHomeAddress] = useState('')
  const [homeCity,setHomeCity] = useState('')
  const [openDestinationModal,setOpenDestinationModal] = useState(false)
  const [destinationCoords,setDestinationCoords] = useState(null)
  const [destinationAddress,setDestinationAddress] = useState(null)
  const [destinationCity,setDestinationCity] = useState('')
  const [datePart, setDatePart] = useState(new Date())
  const [timePart, setTimePart] = useState(new Date())
  const [startDateTime, setStartDateTime] = useState(null)
  const [pickerMode, setPickerMode] = useState(null)
  const [pickerVisible, setPickerVisible] = useState(false)
  const [seatsNumber,setSeatsNumber] = useState('')
  const [carType,setCarType] = useState('')
  const [seatPrice,setSeatPrice] = useState('')
  const [addingNewTripLoading,setAddingNewTripLoading] = useState(false)

  const createAlert = (alerMessage) => {
    Alert.alert(alerMessage)
  }

  //Come back to home screen
  const comeBackToHome = () => {
    router.push('/riderDailyTripsMain')  
  }
  
  //Save location value
  const saveLocationValue = async() => {
    if (homeCoords) {
      try {
        const addressData = await Location.reverseGeocodeAsync(homeCoords);
        if (addressData.length > 0) {
          const addr = addressData[0];
          const fullAddress = `${addr.city || ''}, ${addr.region || ''}`;
          setHomeCity(addr.city)
          setHomeAddress(fullAddress)
        }
        setOpenLocationModal(false)
      } catch (error) {
        alert("حدث خطأ أثناء جلب العنوان.");
      }      
    } else {
      alert("يرجى تحديد الموقع أولا.");
    }
  }
  
  //Close location pick modal
  const closePickLocationModal = () => {
    setOpenLocationModal(false)
  }

  //Save destination location value
  const saveDestinationLocationValue = async() => {
    if (destinationCoords) {
      try {
        const addressData = await Location.reverseGeocodeAsync(destinationCoords);
        if (addressData.length > 0) {
          const addr = addressData[0];
          const fullAddress = `${addr.city || ''}, ${addr.region || ''}`;
          setDestinationCity(addr.city)
          setDestinationAddress(fullAddress)
        }
        setOpenDestinationModal(false)
      } catch (error) {
        alert("حدث خطأ أثناء جلب العنوان.");
      }      
    } else {
      alert("يرجى تحديد الموقع أولا.");
    }
  }

  //Close location pick modal
  const closePickEndLocationModal = () => {
    setOpenDestinationModal(false)
  }
  
  //Open date picker
  const openDatePicker = () => {
    setPickerMode('date');
    setPickerVisible(true);
  }

  //Open time picker
  const openTimePicker = () => {
    setPickerMode('time');
    setPickerVisible(true);
  }

  //Handle change date
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

  //Confirm date selection
  const confirmIosPicker = () => {
    setPickerVisible(false);
    const combined = new Date(datePart);
    combined.setHours(timePart.getHours());
    combined.setMinutes(timePart.getMinutes());
    setStartDateTime(combined);
  }

  //lines Cars type
  const carsList = [
    {name: 'صالون'},
    {name:'ميني باص ١٢ راكب'},
    {name:'ميني باص ١٨ راكب'},
    {name:'٧ راكب (جي ام سي / تاهو)'}
  ]

  // Handle the car type change
  const handleCarChange = (vehicle) => {
    setCarType(vehicle)
  }

  //Create new intercity trip
  const createNewTrip = async() => {
    if(!homeCoords) return createAlert('يرجى تحديد مكان الانطلاق')
    if(!destinationCoords) return createAlert('يرجى تحديد مكان الوصول')
    if(!startDateTime) return createAlert('يرجى تحديد تاريخ و وقت الانطلاق')
    if(!seatsNumber || isNaN(seatsNumber)) return createAlert('يرجى تحديد عدد الركاب')
    if(!seatPrice || isNaN(seatPrice)) return createAlert('يرجى تحديد الثمن')

    // Define trip fee
    const companyCommission = 1500
    const totalTripCost = Number(seatPrice) + Number(companyCommission)

    if (account_balance < totalTripCost) {
      return createAlert(`الرصيد غير كافٍ لإنشاء الرحلة. المبلغ المطلوب هو ${totalTripCost.toLocaleString()} د.ع. يرجى تعبئة الرصيد.`);
    }

    setAddingNewTripLoading(true)

    try {
      const tripData = {
        created_by:'rider',
        trip_creator:riderName,
        start_point:homeAddress,
        start_city:homeCity,
        destination_address:destinationAddress,
        destination_city:destinationCity,
        destination_location:destinationCoords,
        start_datetime: Timestamp.fromDate(startDateTime),
        seats_booked: Number(seatsNumber),
        total_price: Number(seatPrice),
        company_commission:1500,
        driver_name:null,
        driver_id:null,
        driver_notification:null,
        driver_phone:null,
        car_type:carType,
        car_modal:null,
        car_plate:null,
        riders:[{
          id: riderID,
          name:riderName,
          location:homeCoords,
          phone:phoneNumber,
          notification:notificationToken,
          seats_booked: Number(seatsNumber),
          total_price: Number(seatPrice),
          picked_check,
          picked:false
        }],
        started:false,
        canceled:false
      }
      const intercityTripsRef = doc(collection(DB,'intercityTrips'))
      const userRef = doc(DB, 'users', riderID)
      const batch = writeBatch(DB)

      batch.set(intercityTripsRef, tripData)
      batch.update(userRef, {
        account_balance: account_balance - totalTripCost,
        intercityTrips: arrayUnion({
          id:intercityTripsRef.id,
          picked:false,
          canceled:false
        })
      })
      await batch.commit();
      createAlert('تم اضافة الرحلة بنجاح')
    } catch (error) {
      createAlert('. يرجى المحاولة مرة أخرى')
      console.log(error)
    } finally {
      setAddingNewTripLoading(false)
      router.push('/riderDailyTripsMain') 
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.title}>
        <Text style={styles.titleText}>إنشاء رحلة</Text>
        <TouchableOpacity style={styles.arrowBackFunction} onPress={comeBackToHome}>
          <FontAwesome5 name="arrow-circle-left" size={24} color="black" />
        </TouchableOpacity>
      </View>
      <ScrollView 
        contentContainerStyle={{ paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.form}>
          <TouchableOpacity
            style={styles.location_button} 
            onPress={() => setOpenLocationModal(true)}
          >
            {homeAddress ? (
              <Text style={styles.location_button_text}>{homeAddress}</Text>
            ) : (
              <Text style={styles.location_button_text}>مكان الانطلاق</Text>
            )}
          </TouchableOpacity>
          <Modal
            animationType="fade"
            transparent={true} 
            visible={openLocationModal} 
            onRequestClose={closePickLocationModal}
          >
            <View style={styles.modal_container}>
              <View style={styles.modal_box}>
                <View style={styles.modal_header}>
                  <TouchableOpacity onPress={closePickLocationModal}>
                    <AntDesign name="closecircleo" size={24} color="gray" />
                  </TouchableOpacity>
                  <Text style={styles.modal_title}>نقطة الانطلاق</Text>
                </View>
                <View style={styles.mapContainer}>
                    <>
                      <View style={styles.mapControls}>
                        <TouchableOpacity 
                          style={styles.save_location_button} 
                          onPress={saveLocationValue}
                        >
                          <Text style={styles.save_location_button_text}>حفظ الموقع</Text>
                        </TouchableOpacity>
                      </View>
                      <MapView
                        style={styles.map}
                        initialRegion={{
                          latitude: 33.3152,
                          longitude: 44.3661,
                          latitudeDelta: 10,
                          longitudeDelta: 10, 
                        }}
                        showsUserLocation={true}
                        showsMyLocationButton={true}
                        onRegionChangeComplete={(reg) => {
                          setHomeCoords({
                            latitude: reg.latitude,
                            longitude: reg.longitude,
                          });
                        }}
                      />
                      <View style={styles.centerPin}>
                        <FontAwesome6 name="map-pin" size={24} color="red" />
                      </View>
                    </>
                </View>
              </View>
            </View>
          </Modal> 
          <TouchableOpacity
            style={styles.location_button} 
            onPress={() => setOpenDestinationModal(true)}
          >
            {destinationAddress ? (
              <Text style={styles.location_button_text}>{destinationAddress}</Text>
            ) : (
              <Text style={styles.location_button_text}>نقطة الوصول</Text>
            )}
          </TouchableOpacity>
          <Modal
            animationType="fade"
            transparent={true} 
            visible={openDestinationModal} 
            onRequestClose={closePickEndLocationModal}
          >
            <View style={styles.modal_container}>
              <View style={styles.modal_box}>
                <View style={styles.modal_header}>
                  <TouchableOpacity onPress={closePickEndLocationModal}>
                    <AntDesign name="closecircleo" size={24} color="gray" />
                  </TouchableOpacity>
                  <Text style={styles.modal_title}>مكان الوصول</Text>
                </View>
                <View style={styles.mapContainer}>
                    <>
                      <View style={styles.mapControls}>
                        <TouchableOpacity 
                          style={styles.save_location_button} 
                          onPress={saveDestinationLocationValue}
                        >
                          <Text style={styles.save_location_button_text}>حفظ الموقع</Text>
                        </TouchableOpacity>
                      </View>
                      <MapView
                        style={styles.map}
                        initialRegion={{
                          latitude: 33.3152,
                          longitude: 44.3661,
                          latitudeDelta: 10,
                          longitudeDelta: 10,
                        }}
                        onRegionChangeComplete={(reg) => {
                          setDestinationCoords({
                            latitude: reg.latitude,
                            longitude: reg.longitude,
                          });
                        }}
                      />
                      <View style={styles.centerPin}>
                        <FontAwesome6 name="map-pin" size={24} color="red" />
                      </View>
                    </>
                </View>
              </View>
            </View>
          </Modal>
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
            placeholder="عدد الركاب"
            keyboardType="numeric"
            value={seatsNumber}
            onChangeText={(text) => setSeatsNumber(text.replace(/[^0-9]/g, ''))}
          />
          <Dropdown
            style={styles.dropdown}
            placeholderStyle={styles.dropdownStyle}
            selectedTextStyle={styles.dropdownStyle}
            itemTextStyle={styles.dropdownTextStyle}
            data={carsList}
            labelField="name"
            valueField="name"
            placeholder= 'نوع السيارة'
            value={carType}
            onChange={item => {
              handleCarChange(item.name)
            }}
          />
          <TextInput
            style={styles.customeInput}
            placeholderTextColor={colors.BLACK}
            placeholder="السعر"
            keyboardType="numeric"
            value={seatPrice}
            onChangeText={(text) => setSeatPrice(text.replace(/[^0-9]/g, ''))}
          />
          <TouchableOpacity 
            style={styles.add_trip_button} 
            onPress={createNewTrip}
            disabled={addingNewTripLoading}
          >
            <Text style={styles.add_trip_button_text}>{addingNewTripLoading ? '...' :'أضف'}</Text>
          </TouchableOpacity>
        </View>
        </ScrollView>
    </SafeAreaView >
  )
}

export default riderCreateNewTrip

const styles = StyleSheet.create({
  container:{
    flex:1,
    backgroundColor:colors.WHITE,
  },
  title:{
    width:'100%',
    height:150,
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
  form:{
    width:'100%',
    justifyContent:'center',
    alignItems:'center',
  },
  location_button:{
    width:300,
    height:50,
    marginBottom:10,
    borderColor:colors.BLACK,
    borderWidth:1,
    borderRadius:15,
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'center'
  },
  location_button_text:{
    lineHeight:50,
    verticalAlign:'middle',
    fontFamily:'Cairo_400Regular',
    fontSize:15,
    color:colors.BLACK,
  },
  modal_container:{
    flex:1,
    justifyContent:'center',
    alignItems:'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modal_box:{
    width: '95%',
    height:600,
    backgroundColor:colors.WHITE,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  modal_header:{
    width:'100%',
    height:40,
    flexDirection:'row',
    justifyContent:'center',
    alignItems:'center',
  },
  modal_title:{
    lineHeight:40,
    fontFamily:'Cairo_700Bold',
    fontSize:15,
    marginLeft:10,
  },
  mapContainer:{
    width:'100%',
    height:540,
  },
  loading_location:{
    width:'100%',
    height:'100%',
    justifyContent: 'center',
    alignItems:'center'
  },
  loading_location_text:{
    lineHeight:40,
    fontFamily:'Cairo_400Regular',
  },
  map:{
    width:'100%',
    height:'100%',
  },
  mapControls: {
    width:'100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap:10,
    position:'absolute',
    top:5,
    left:0,
    zIndex:5,
  },
  smallButton: {
    height:40,
    width:120,
    borderRadius: 8,
    backgroundColor: 'gray',
    flexDirection:'row',
    justifyContent:'center',
    alignItems: 'center',
  },
  smallButtonText: {
    lineHeight:40,
    fontFamily: 'Cairo_400Regular',
    color:colors.WHITE
  },
  save_location_button:{
    height:40,
    width:120,
    borderRadius: 8,
    backgroundColor: colors.BLUE,
    flexDirection:'row',
    justifyContent:'center',
    alignItems: 'center',
  },
  save_location_button_text:{
    lineHeight:40,
    fontFamily: 'Cairo_400Regular',
    color:colors.WHITE
  },
  centerPin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -40, 
    zIndex: 10,
  },
  endPointInputContainer:{
    width:'100%',
    height:540,
    alignItems:'center',
    justifyContent:'center',
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
    fontFamily:'Cairo_400Regular',
    fontSize:15,
  },
  customeInput_text:{
    lineHeight:50,
    fontFamily:'Cairo_400Regular',
    fontSize:15,
    textAlign:'center',
  },
  dropdown:{
    width:300,
    height:50,
    borderWidth:1,
    marginBottom:10,
    borderColor:colors.BLACK,
    borderRadius:15,
  },
  dropdownStyle:{
    lineHeight:50,
    fontFamily:'Cairo_400Regular',
    textAlign:'center',
    fontSize:15
  },
  dropdownTextStyle:{
    textAlign:'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  pickerContainer: {
    backgroundColor: colors.DARKGRAY,
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    alignItems:'center',
    justifyContent:'center'
  },
  doneButton: {
    width:100,
    marginTop: 10,
    backgroundColor: '#BE9A4E',
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 5,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
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