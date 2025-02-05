import {Alert,StyleSheet,Text,View,ActivityIndicator,Image,TouchableOpacity,TextInput,Platform,Modal} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import React,{useEffect, useState} from 'react'
import { useRouter } from 'expo-router'
import colors from '../../../../constants/Colors'
import {DB} from '../../../../firebaseConfig'
import { addDoc , collection} from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import * as Location from 'expo-location'
import { useUser } from '@clerk/clerk-expo'
import { Dropdown } from 'react-native-element-dropdown'
import DateTimePicker from '@react-native-community/datetimepicker'
import * as ImagePicker from 'expo-image-picker'
import Ionicons from '@expo/vector-icons/Ionicons'
import FontAwesome6 from '@expo/vector-icons/FontAwesome6'
import { useDriverData } from '../../../stateManagment/DriverContext'

const addData = () => {
  const { user } = useUser()
  const router = useRouter()

  const totalSteps = 2;
  const [currentPage, setCurrentPage] = useState(1)

  const [location, setLocation] = useState(null)
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
  
  const {userData,fetchingUserDataLoading,driverData,fetchingDriverDataLoading} = useDriverData()

  const createAlert = (alerMessage) => {
    Alert.alert(alerMessage)
  }

  //Cars type array
  const cars = [
    {name: 'سيارة صالون ٥ راكب', type: 'private car 4 places', seats: 5 },
    {name:'سيارة خاصة ٧ راكب',type:'private car 7 places', seats:7},
    {name:'ستاركس',type:'starex',seats:11},
    {name:'باص صغير ١٢ راكب',type:'minu-bus',seats:12},
    {name:'باص متوسط ١٤ راكب',type:'medium-bus',seats:14},
    {name:'باص كبير ٣٠ راكب',type:'large-bus',seats:30}
  ]

  // Handle the car type change
  const handleCarChange = (vehicle) => {
    setCarType(vehicle)
    setCarSeats('')
  }

  // Change car seat number whenever the car type changes
  useEffect(() => {
    if (carType) {
      const selectedCar = cars.find((car) => car.name === carType)
      if (selectedCar) {
        setCarSeats(selectedCar.seats)
      } else {
        setCarSeats('')
      }
    }
  }, [carType])

  const getLocation = async () => {
    // Step 1: Provide a prominent disclosure
    Alert.alert(
      "مطلوب إذن الموقع",
      "يقوم تطبيق Sayartech بجمع بيانات موقعك لحفظه كعنوان منزلك. يتيح لنا ذلك مطابقتك مع أقرب الطلاب لتحسين المسار. لا يتم جمع بيانات موقعك في الخلفية ولن يتم مشاركتها مع أطراف خارجية.",
      [
        {
          text: "cancel",
          style: "cancel",
        },
        {
          text: "Ok",
          onPress: async () => {
            // Step 2: Request permission after the user accepts the disclosure
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
              createAlert('عذراً، لا يمكننا الوصول إلى موقعك بدون إذن');
              return;
            }

            // Step 3: Get and save the location
            let location = await Location.getCurrentPositionAsync({});
            setLocation(location);
          },
        },
      ]
    );
  };

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

  // Add default student monthly subs bill
  const monthlyPaycheck = [
    {
      id:0,
      month:'january',
      amount:0,
      paid:false
    },
    {
      id:1,
      month:'february',
      amount:0,
      paid:false
    },
    {
      id:2,
      month:'march',
      amount:0,
      paid:false
    },
    {
      id:3,
      month:'april',
      amount:0,
      paid:false
    },
    {
      id:4,
      month:'may',
      amount:0,
      paid:false
    },
    {
      id:5,
      month:'june',
      amount:0,
      paid:false
    },
    {
      id:6,
      month:'july',
      amount:0,
      paid:false
    },
    {
      id:7,
      month:'august',
      amount:0,
      paid:false
    },
    {
      id:8,
      month:'september',
      amount:0,
      paid:false
    },
    {
      id:9,
      month:'october',
      amount:0,
      paid:false
    },
    {
      id:10,
      month:'november',
      amount:0,
      paid:false
    },
    {
      id:11,
      month:'december',
      amount:0,
      paid:false
    }
  ]

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
    if (!user) {
      createAlert('المستخدم غير معرف')
      return
    }

    if(!personalImage) {
      createAlert('الرجاء اضافة الصورة الشخصية')
      return
    }

    if (!dateSelected) {
      createAlert("يرجى إدخال تاريخ الميلاد");
      return
    }

    if (!location) {
      createAlert('يرجى تحديد الموقع')
      return
    }

    if(!carType) {
      createAlert('يرجى تحديد نوع السيارة')
      return
    }

    if(!carModel) {
      createAlert('يرجى ادخال موديل السيارة')
      return
    }

    if(!carPlate) {
      createAlert('يرجى ادخال رقم لوحة السيارة')
      return
    }

    if(!carImage) {
      createAlert('الرجاء اضافة صورة السيارة')
      return
    }

    setAddingDriverDataLoading(true)
  
    try {

      let personalImageUrl,carImageUrl = null;
      if (personalImage) {
        personalImageUrl = await uploadImage(personalImage)
      }
      if (carImage) {
        carImageUrl = await uploadImage(carImage)
      }
    
      const driversCollectionRef = collection(DB,'drivers')
      const driverData = {
        driver_full_name: userData.user_full_name,
        driver_family_name:userData.user_family_name,
        driver_user_id:userData.user_id,
        driver_phone_number:userData.phone_number,
        driver_notification_token:userData.user_notification_token,
        current_location:{latitude:location.coords.latitude,longitude:location.coords.longitude},
        driver_home_location:location,
        driver_birth_date:driverBirthDate,
        driver_car_type:carType,
        driver_car_model:carModel,
        driver_car_plate:carPlate,
        driver_car_seats: carSeats,
        driver_personal_image: personalImageUrl,
        driver_car_image: carImageUrl,
        line:[],
        start_the_journey:false,
        school_rating:[],
        student_rating:[],
        sayartech_team_rating:[],
        points:[],
        paycheck:monthlyPaycheck
      }

      const docRef = await addDoc(driversCollectionRef,driverData)

      createAlert('تم تسجيل المعلومات بنجاح')
    
      // Clear the form fields
      setLocation(null)
      setCarType('')
      setCarModel('')
      setCarPlate('')
      setCarSeats('')
      setDateSelected(false)
      setDriverBirthDate(new Date())
      setPersonalImage(null)
      setCarImage(null)
      setCurrentPage(1)

    } catch (error) {
      createAlert('. يرجى المحاولة مرة أخرى')
    } finally{
      setAddingDriverDataLoading(false)
      router.replace('/home')      
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

            <TouchableOpacity style={styles.fullButton} onPress={getLocation} disabled={location !== null}>
              <>
                {location !== null ? (
                    <FontAwesome6 name="circle-check" size={24} style={styles.icon} />
                ) : (
                    <Ionicons name="location-outline" size={24} style={styles.icon} />
                )}
              </>
              <Text style={styles.fullBtnText}>{location !== null ? 'تم تحديد موقعك' : 'عنوان المنزل'}</Text>
            </TouchableOpacity>

            <View style={styles.location_msg_view}>
              <Text style={styles.location_warning_text}>التطبيق يسجل موقعك الحالي كعنوان للمنزل لذا يرجى التواجد في المنزل عند التسجيل و تفعيل خدمة تحديد الموقع الخاصة بالهاتف</Text>
            </View>

          </View>
        )
      case 2:
        return(
          <View style={{alignItems:'center',justifyContent:'center'}}>
            <Dropdown
              style={styles.dropdown}
              placeholderStyle={styles.dropdownStyle}
              selectedTextStyle={styles.dropdownStyle}
              itemTextStyle={styles.dropdownTextStyle}
              data={cars}
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
  if (fetchingUserDataLoading || fetchingDriverDataLoading || addingDriverDataLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.spinner_error_container}>
          <ActivityIndicator size="large" color={colors.PRIMARY}/>
        </View>
      </SafeAreaView>
    )
  }

// Check whether the user add data or no
  if(driverData[0] && addingDriverDataLoading === false) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.already_added_container}>
          <View>
            <Image source={{uri:driverData[0]?.driver_car_image}} style={{width:150,height:150,resizeMode:'contain'}}/>
          </View>
          <View style={styles.car_info_box}>
            <Text style={styles.car_info_text}>{driverData[0]?.driver_car_type}</Text> 
            <Text style={{ color: '#858585' }}> | </Text>
            <Text style={styles.car_info_text}>{driverData[0]?.driver_car_model}</Text>
            <Text style={{ color: '#858585' }}> | </Text>
             <Text style={styles.car_info_text}>{driverData[0]?.driver_car_plate}</Text>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  return(
      <SafeAreaView style={styles.container}>

        <View>
          <Text style={styles.title}>اضافة بيانات</Text>
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
    paddingVertical:10,
    backgroundColor:colors.WHITE
  },
  title:{
    marginTop:30,
    fontFamily:'Cairo_400Regular',
    fontSize:24,
  },
  pageIndicatorContainer:{ 
    flexDirection: 'row', 
    justifyContent: 'center', 
  },
  pageIndicator: { 
    width: 20, 
    height: 8, 
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
    height:500,
    width:300,
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
    borderColor:colors.PRIMARY,
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
    justifyContent:'center'
  },
  halfButton:{
    width:130,
    height:50,
    marginHorizontal:5,
    backgroundColor:colors.PRIMARY,
    borderRadius:15,
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'center'
  },
  btnText:{
    lineHeight:50,
    verticalAlign:'middle',
    fontFamily:'Cairo_700Bold',
    fontSize:15,
    color:colors.WHITE
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
    borderColor:colors.PRIMARY,
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
    borderColor:colors.PRIMARY,
    borderRadius:15,
    color:colors.BLACK,
    textAlign:'center',
    fontFamily:'Cairo_400Regular'
  },
  location_msg_view:{
    width:280,
    paddingHorizontal:10,
    marginVertical:10,
  },
  location_warning_text:{
    fontFamily:'Cairo_700Bold',
    fontSize:11,
    textAlign:'center',
  },
  spinner_error_container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  already_added_container:{
    flex:1,
    justifyContent:'center',
    alignItems:'center',
    backgroundColor:colors.WHITE,
    paddingVertical:30,
    borderRadius:15,
  },
  car_info_box:{
    width:300,
    height:50,
    backgroundColor:colors.GRAY,
    flexDirection:'row-reverse',
    justifyContent:'space-around',
    alignItems:'center',
    borderRadius:15,
    marginTop:10
  },
  car_info_text:{
    lineHeight:50,
    verticalAlign:'middle',
    fontFamily:'Cairo_400Regular',
    fontSize:14,
    color:'#858585'
  }
})
