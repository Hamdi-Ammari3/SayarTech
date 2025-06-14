import {Alert,StyleSheet,Text,View,ActivityIndicator,Image,TouchableOpacity,TextInput,Platform,Modal} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {useEffect, useState} from 'react'
import { useRouter,useLocalSearchParams } from 'expo-router'
import colors from '../constants/Colors'
import { DB } from '../firebaseConfig'
import { addDoc , collection} from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import * as Location from 'expo-location'
import MapView from 'react-native-maps'
import { Dropdown } from 'react-native-element-dropdown'
import DateTimePicker from '@react-native-community/datetimepicker'
import * as ImagePicker from 'expo-image-picker'
import Ionicons from '@expo/vector-icons/Ionicons'
import FontAwesome6 from '@expo/vector-icons/FontAwesome6'
import FontAwesome5 from '@expo/vector-icons/FontAwesome5'
import AntDesign from '@expo/vector-icons/AntDesign'

const addData = () => {
    const {driverName,driverFamily,driverUserId,driverPhone,driverNotification} = useLocalSearchParams()
    const router = useRouter()

    const totalSteps = 2
    const [currentPage, setCurrentPage] = useState(1)

    const [serviceType,setServiceType] = useState('')
    const [openLocationModal,setOpenLocationModal] = useState(false)
    const [loadingLocation, setLoadingLocation] = useState(false)
    const [homeCoords,setHomeCoords] = useState(null)
    const [homeAddress,setHomeAddress] = useState('')
    const [carType,setCarType] = useState('')
    const [carPlate,setCarPlate] = useState('')
    const [carSeats,setCarSeats] = useState('')
    const [carModel,setCarModel] = useState('')
    const [driverBirthDate,setDriverBirthDate] = useState(new Date())
    const [dateSelected, setDateSelected] = useState(false);
    const [showPicker,setShowPicker] = useState(false);
    const [addingDriverDataLoading,setAddingDriverDataLoading] = useState(false)
    const [personalImage,setPersonalImage] = useState(null)
    const [personalImageLoading,setPersonalImageLoading] = useState(false)
    const [carImage,setCarImage] = useState(null)
    const [carImageLoading,setCarImageLoading] = useState(false)
  
    const createAlert = (alerMessage) => {
        Alert.alert(alerMessage)
    }

    //Come back to home screen
    const comeBackToHome = () => {
        router.push('/(main)/(driver)/(tabs)/home')  
    }

    //Driver service type
    const driverServiceType = [
        {name:'خطوط'},
        {name:'رحلات يومية بين المدن'}
    ]

    //Handle driver service type
    const handleServiceType = (service) => {
        setServiceType(service)
    }

    //lines Cars type
    const carsList = [
        {name: 'صالون',seats:4},
        {name:'ميني باص ١٢ راكب',seats:12},
        {name:'ميني باص ١٨ راكب',seats:18},
        {name:'٧ راكب (جي ام سي / تاهو)',seats:7},
    ]

    // Handle the car type change
    const handleCarChange = (vehicle) => {
        setCarType(vehicle)
        setCarSeats('')
    }

    // Change car seat number whenever the car type changes
    useEffect(() => {
        if (carType) {
            const selectedCar = carsList.find((car) => car.name === carType)
            if (selectedCar) {
                setCarSeats(selectedCar.seats)
            } else {
                setCarSeats('')
            }
        }
    }, [carType])

    //Pick driver home location
    const getLocation = async () => {
        Alert.alert(
          "مطلوب إذن الموقع",
          "يستخدم تطبيق Safe موقعك لحفظ عنوان المنزل بدقة. لن نستخدم بيانات موقعك في الخلفية أو نشاركها مع أي طرف ثالث.",
          [
            {
              text: "إلغاء",
              style: "cancel",
            },
            {
              text: "موافق",
              onPress: async () => {
                setOpenLocationModal(true)
                setLoadingLocation(true)
                let { status } = await Location.requestForegroundPermissionsAsync();
    
                if (status !== 'granted') {
                  createAlert('عذراً، لا يمكننا الوصول إلى موقعك بدون إذن');
                  return;
                }
    
                setOpenLocationModal(true);
                setLoadingLocation(true);
    
                try {
                  let location = await Location.getCurrentPositionAsync({});
                  const coords = {latitude: location.coords.latitude,longitude: location.coords.longitude}
                  setHomeCoords(coords)
                } catch (error) {
                  createAlert('تعذر الحصول على الموقع. حاول مرة أخرى.')
                  console.log(error)
                  setOpenLocationModal(false)
                } finally{
                  setLoadingLocation(false)
                }
              },
            },
          ]
        );
    }
    
    //Save location value
    const saveLocationValue = async() => {
        if (homeCoords) {
          try {
            const addressData = await Location.reverseGeocodeAsync(homeCoords);
            if (addressData.length > 0) {
              const addr = addressData[0];
              const fullAddress = `${addr.city || ''}, ${addr.region || ''}`;
              setHomeAddress(fullAddress);
            }
            setOpenLocationModal(false);
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

    // Function to capture a real-time photo for the driver's personal image
    const capturePersonalImage = async () => {
        try {
            // Request camera permissions
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                createAlert('تحتاج إلى منح إذن الكاميرا لالتقاط صورة.');
                return;
            }
      
            // Launch camera
            let result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaType?.Images,
                allowsEditing: false,
                aspect: [4, 3],
                quality: 1,
            });
      
            if (!result.canceled) {
                setPersonalImage(result.assets[0].uri); // Set the captured image URI
            }
        } catch (error) {
            createAlert('حدث خطأ أثناء التقاط الصورة');
            console.log(error)
        }
    };

    // Function to capture a real-time photo for the car image
    const captureCarImage = async () => {
        try {
            // Request camera permissions
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                createAlert('تحتاج إلى منح إذن الكاميرا لالتقاط صورة.');
                return;
            }
      
            // Launch camera
            let result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaType?.Images,
                allowsEditing: false,
                aspect: [4, 3],
                quality: 1,
            });
      
            if (!result.canceled) {
                setCarImage(result.assets[0].uri); // Set the captured image URI
            }
        } catch (error) {
            createAlert('حدث خطأ أثناء التقاط الصورة');
            console.log(error);
        }
    };

    // Function to upload image to Firebase Storage
    const uploadImage = async (uri) => {
        const storage = getStorage();
        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            const filename = uri.substring(uri.lastIndexOf('/') + 1);
            const storageRef = ref(storage, `drivers/${filename}`);
            setPersonalImageLoading(true);

            await uploadBytes(storageRef, blob);
            const downloadURL = await getDownloadURL(storageRef)

            setPersonalImageLoading(false);
            setCarImageLoading(false);
            return downloadURL; // Return the image URL
    
        } catch (error) {
            createAlert('حدث خطأ اثناء تحميل الصورة')
            setPersonalImageLoading(false); // End the loading state
            setCarImageLoading(false);
            throw new Error('Failed to upload image');
        }
    };

    //Get the driver birth date
    const showDatePicker = () => {
        setShowPicker(true);
    };

    // Handle the Date Change
    const handleDateChange = (event, selectedDate) => {
        if(Platform.OS === 'ios') {
            if (selectedDate) {
                setDriverBirthDate(selectedDate);
                setDateSelected(true);
            }
        } else {
            if (event.type === "set" && selectedDate) {
                const currentDate = selectedDate || driverBirthDate;
                setDriverBirthDate(currentDate);
                setDateSelected(true);
            }
            setShowPicker(false);
        } 
    };

    // Close the picker manually for iOS
    const closePicker = () => {
        setShowPicker(false);
    };

    // Go to next page
    const handleNext = () => {
        if (currentPage < totalSteps) setCurrentPage(currentPage + 1);
    };

    // Return to previous page
    const handlePrevious = () => {
        if (currentPage > 1) setCurrentPage(currentPage - 1);
    };

    //Add New Driver
    const addNewDriverHandler = async () => {
        if (!serviceType) return createAlert('الرجاء تحديد نوع الخدمة')
        if (!personalImage) return createAlert('الرجاء اضافة الصورة الشخصية')
        if (!dateSelected) return createAlert("يرجى إدخال تاريخ الميلاد")
        if (!homeCoords) return createAlert('يرجى تحديد الموقع')
        if (!carType) return createAlert('يرجى تحديد نوع السيارة')
        if (!carModel) return createAlert('يرجى ادخال موديل السيارة')
        if (!carPlate) return createAlert('يرجى ادخال رقم لوحة السيارة')
        if (!carImage) return createAlert('الرجاء اضافة صورة السيارة')
            
        setAddingDriverDataLoading(true)
  
        try {
            let personalImageUrl,carImageUrl = null;
            if (personalImage) {
                personalImageUrl = await uploadImage(personalImage)
            }
            if (carImage) {
                carImageUrl = await uploadImage(carImage)
            }

            const driverData = {
                full_name: driverName,
                family_name:driverFamily,
                user_id:driverUserId,
                service_type:serviceType,
                birth_date:driverBirthDate,
                phone_number:driverPhone,
                notification_token:driverNotification,
                current_location:homeCoords,
                home_location:homeCoords,
                home_address:homeAddress,
                car_type:carType,
                car_model:carModel,
                car_plate:carPlate,
                car_seats: carSeats,
                personal_image: personalImageUrl,
                car_image: carImageUrl,
                lines:[],
                riders_rating:[],
                team_rating:[],
            }

            const driversCollectionRef = collection(DB,'drivers')
            const docRef = await addDoc(driversCollectionRef,driverData)

            createAlert('تم تسجيل المعلومات بنجاح')
    
            // Clear the form fields
            setServiceType('')
            setPersonalImage(null)
            setDateSelected(false)
            setDriverBirthDate(new Date())
            setHomeCoords(null)
            setCarType('')
            setCarModel('')
            setCarPlate('')
            setCarSeats('')
            setCarImage(null)
            setCurrentPage(1)

        } catch (error) {
            createAlert('. يرجى المحاولة مرة أخرى')
        } finally{
            setAddingDriverDataLoading(false)
            router.push('/(main)/(driver)/(tabs)/home')       
        }
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
        );
    };

    // Render full pages
    const renderPage = () => {
        switch(currentPage) {
            case 1:
                return(
                    <View style={{alignItems:'center',justifyContent:'center'}}>
                        <View style={styles.sectionLabelBox}>
                            <Text style={styles.sectionLabelText}>معلومات شخصية</Text>
                        </View> 
                        <Dropdown
                            style={styles.dropdown}
                            placeholderStyle={styles.dropdownStyle}
                            selectedTextStyle={styles.dropdownStyle}
                            itemTextStyle={styles.dropdownTextStyle}
                            data={driverServiceType}
                            labelField="name"
                            valueField="name"
                            placeholder= 'نوع الخدمة'
                            value={serviceType}
                            onChange={item => {
                                handleServiceType(item.name)
                            }}
                        />
                        <TouchableOpacity style={styles.fullButton} onPress={capturePersonalImage}>
                            <Text style={styles.fullBtnText}>{personalImageLoading ? 'جاري تحميل الصورة' : personalImage ? 'تم اختيار الصورة' : 'صورتك الشخصية'}</Text>
                        </TouchableOpacity>
                        {personalImage && 
                            <View style={styles.image_container}>
                                <Image source={{ uri: personalImage }} style={styles.image_container_image} />
                            </View>
                        }
                        <TouchableOpacity style={styles.fullButton} onPress={showDatePicker}>
                            <Text style={styles.fullBtnText}>{dateSelected ? driverBirthDate.toLocaleDateString() : 'تاريخ الميلاد'}</Text>
                        </TouchableOpacity>
                        {showPicker && (
                            Platform.OS === 'ios' ? (
                                <Modal transparent animationType="slide" visible={showPicker}>
                                    <View style={styles.modalContainer}>
                                        <View style={styles.pickerContainer}>
                                            <DateTimePicker
                                                value={driverBirthDate}
                                                mode="date"
                                                display="spinner"
                                                onChange={handleDateChange}
                                                maximumDate={new Date()}
                                            />
                                            <TouchableOpacity onPress={closePicker} style={styles.doneButton}>
                                                <Text style={styles.doneButtonText}>تأكيد</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </Modal>
                            ) : (
                                <DateTimePicker
                                    value={driverBirthDate}
                                    mode="date"
                                    display="spinner"
                                    onChange={handleDateChange}
                                    maximumDate={new Date()}
                                />
                            )
                        )}
                        <TouchableOpacity 
                            style={styles.fullButton} 
                            onPress={getLocation} 
                        >
                            <Ionicons name="location-outline" size={24} style={styles.icon} />
                            {homeAddress ? (
                                <Text style={styles.fullBtnText}>{homeAddress}</Text>
                            ) : (
                                <Text style={styles.fullBtnText}>عنوان المنزل</Text>
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
                                        <Text style={styles.modal_title}>العنوان</Text>
                                    </View>
                                    <View style={styles.mapContainer}>
                                        {loadingLocation ? (
                                            <View style={styles.loading_location}>
                                                <Text style={styles.loading_location_text}>جاري تحديد موقعك ...</Text>
                                            </View>
                                        ) : (
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
                                                        latitude: homeCoords?.latitude || 33.3152,
                                                        longitude: homeCoords?.longitude || 44.3661,
                                                        latitudeDelta: 0.005,
                                                        longitudeDelta: 0.005,
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
                                                    <FontAwesome6 name="map-pin" size={24} color="blue" />
                                                </View>
                                            </>
                                        )}
                                    </View>
                                </View>
                            </View>
                        </Modal> 
                    </View>
                )
            case 2:
                return(
                    <View style={{alignItems:'center',justifyContent:'center'}}>
                        <View style={styles.sectionLabelBox}>
                            <Text style={styles.sectionLabelText}>معلومات السيارة</Text>
                        </View> 
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
                            placeholder={'موديل السيارة'}
                            value={carModel}
                            onChangeText={(text) => setCarModel(text)}
                        />
                        <TextInput
                            style={styles.customeInput}
                            placeholderTextColor={colors.BLACK}
                            placeholder={'رقم اللوحة'}
                            value={carPlate}
                            onChangeText={(text) => setCarPlate(text)}
                        />
                        <TouchableOpacity style={styles.fullButton} onPress={captureCarImage}>
                            <Text style={styles.fullBtnText}>{carImageLoading ? 'جاري تحميل الصورة' : carImage ? 'تم اختيار الصورة' : 'صورة السيارة'}</Text>
                        </TouchableOpacity>
                        {carImage && 
                        <View style={styles.image_container}>
                            <Image source={{ uri: carImage }} style={styles.image_container_image} />
                        </View>
                        }
                    </View>
                )
            default:
                return null;
        }
    }

      // Loading or fetching user data from DB
    if (addingDriverDataLoading) {
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
            <View style={styles.header}>
                <View style={styles.title}>
                    <Text style={styles.title_text}>اضافة بيانات</Text>
                    <TouchableOpacity style={styles.arrowBackFunction} onPress={comeBackToHome}>
                        <FontAwesome5 name="arrow-circle-left" size={24} color="black" />
                    </TouchableOpacity>
                </View>            
                {renderPageIndicator()}
            </View>
            <View style={styles.form}>
                {renderPage()}
            </View>
            <View style={styles.BtnHalfContainer}>
                {currentPage > 1 && (
                    <TouchableOpacity style={styles.halfButton} onPress={handlePrevious}>
                        <Text style={styles.btnText}>السابق</Text>
                    </TouchableOpacity>
                )}
                {currentPage < totalSteps ? (
                    <TouchableOpacity style={styles.halfButton} onPress={handleNext}>
                        <Text style={styles.btnText}>التالي</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={styles.halfButton} onPress={addNewDriverHandler}>
                        <Text style={styles.btnText}>أضف</Text>
                    </TouchableOpacity>
                )}
            </View>    
        </SafeAreaView>
    )
}

export default addData

const styles = StyleSheet.create({
    container:{
        flex:1,
        alignItems:'center',
        backgroundColor:colors.WHITE
    },
    header:{
        width:'100%',
        height:150,
        alignItems:'center',
        justifyContent:'center',
        gap:10,
    },
    title:{
        width:'100%',
        height:40,
        flexDirection:'row-reverse',
        alignItems:'center',
        justifyContent:'center',
        gap:20,
    },
    title_text:{
        lineHeight:40,
        fontFamily:'Cairo_400Regular',
        fontSize:24,
    },
    pageIndicatorContainer:{ 
        flexDirection: 'row', 
        justifyContent: 'center', 
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
    sectionLabelBox:{
        width:280,
        height:40,
        marginBottom:10,
        alignItems:'center',
        justifyContent:'center',
    },
    sectionLabelText:{
        width:180,
        lineHeight:40,
        fontFamily: 'Cairo_400Regular',
        fontSize:14,
        textAlign:'center',
        backgroundColor:colors.BLUE,
        color:colors.WHITE,
        borderRadius:15,
    },
    form:{
        width:'100%',
        height:450,
        justifyContent:'center',
        alignItems:'center',
    },
    image_container:{
        width:100,
        height:100,
        marginBottom:10,
    },
    image_container_image:{
        width:100,
        height:100,
        resizeMode:'contain',
    },
    fullButton:{
        width:280,
        height:50,
        marginBottom:10,
        borderColor:colors.BLACK,
        borderWidth:1,
        borderRadius:15,
        flexDirection:'row',
        alignItems:'center',
        justifyContent:'center'
    },  
    fullBtnText:{
        lineHeight:50,
        verticalAlign:'middle',
        fontFamily:'Cairo_400Regular',
        fontSize:15,
        color:colors.BLACK
    },
    BtnHalfContainer:{
        width:280,
        flexDirection:'row',
        justifyContent:'center',
        gap:20,
    },
    halfButton:{
        width:120,
        height:40,
        justifyContent:'center',
        alignItems:'center',
        backgroundColor:'rgba(190, 154, 78, 0.30)',
        borderColor:colors.BLACK,
        borderWidth:1,
        borderRadius: 15,
    },
    btnText:{
        fontSize: 14,
        fontFamily: 'Cairo_400Regular',
        lineHeight: 40,
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
    icon:{
        marginRight:10,
    },
    dropdown:{
        width:280,
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
        fontSize:14
    },
    dropdownTextStyle:{
        textAlign:'center',
    },
    customeInput:{
        width:280,
        height:50,
        marginBottom:10,
        borderWidth:1,
        borderColor:colors.BLACK,
        borderRadius:15,
        color:colors.BLACK,
        textAlign:'center',
        fontFamily:'Cairo_400Regular'
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
    spinner_error_container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
})
