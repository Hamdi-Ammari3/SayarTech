import { Alert, StyleSheet, Text, View,ActivityIndicator,Image,TouchableOpacity,ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import React,{useEffect, useState} from 'react'
import { useRouter } from 'expo-router'
import colors from '../../../../constants/Colors'
import CustomeButton from '../../../../components/CustomeButton'
import CustomeInput from '../../../../components/CustomeInput'
import {DB} from '../../../../firebaseConfig'
import { addDoc , collection} from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import * as Location from 'expo-location'
import { useUser } from '@clerk/clerk-expo'
import { Dropdown } from 'react-native-element-dropdown'
import DateTimePicker from '@react-native-community/datetimepicker'
import * as ImagePicker from 'expo-image-picker'
import { useDriverData } from '../../../stateManagment/DriverContext'

const addData = () => {
  const { user } = useUser()
  const router = useRouter()

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

  const {userData,driverData,fetchingUserDataLoading} = useDriverData()

  const createAlert = (alerMessage) => {
    Alert.alert(alerMessage)
  }

//Cars type array
  const cars = [
    {name: 'سيارة خاصة صالون ', type: 'private car 4 places', seats: 4 },
    {name:'سيارة خاصة ٧ راكب ',type:'private car 7 places', seats:7},
    {name:'ستاركس ',type:'starex',seats:11},
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

// Get the current location
const getLocation = async () => {
  let { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    createAlert('عذراً، لا يمكننا الوصول إلى موقعك بدون إذن');
    return;
  }
  let location = await Location.getCurrentPositionAsync({});
  setLocation(location)
}

//Get the driver birth date
const showDatePicker = () => {
  setShowPicker(true);
};

// Function to pick an image
const pickPersonalImage = async () => {
  try {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setPersonalImage(result.assets[0].uri); // Set the selected image URI
    } else {
      createAlert('حدث خطأ اثناء اختيار الصورة');
    }
  } catch (error) {
    createAlert('حدث خطأ اثناء اختيار الصورة');
  }
};

const PickCarImage = async () => {
  try {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      aspect: [4, 3],
      quality: 1,
    });
    if (!result.canceled) {
      setCarImage(result.assets[0].uri); // Set the selected image URI
    } else {
      createAlert('حدث خطأ اثناء اختيار الصورة');
    }
  } catch (error) {
    createAlert('حدث خطأ اثناء اختيار الصورة');
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

// Handle the Date Change
 const handleDateChange = (event, selectedDate) => {
  if (event.type === "set") {
    const currentDate = selectedDate || driverBirthDate;
    setDriverBirthDate(currentDate);
    setDateSelected(true);
  }
  setShowPicker(false);
};

//Add New Driver
  const addNewDriverHandler = async () => {
  if (!user) {
    createAlert('المستخدم غير معرف')
    return
  }

  if (!location) {
    createAlert('يرجى تحديد موقعك اولا')
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
      current_location:{latitude:location.coords.latitude,longitude:location.coords.longitude},
      driver_home_location:location,
      driver_birth_date:driverBirthDate,
      driver_car_type:carType,
      driver_car_model:carModel,
      driver_car_plate:carPlate,
      driver_car_seats: carSeats,
      driver_personal_image: personalImageUrl,
      driver_car_image: carImageUrl,
      students_picked:[],
      first_trip_status:'not started',
      first_trip_start:null,
      first_trip_end:null,
      second_trip_status:'finished',
      second_trip_start:null,
      second_trip_end:null,
      rating:null
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
    setPersonalImage(null)
    setCarImage(null)

  } catch (error) {
     createAlert('. يرجى المحاولة مرة أخرى')
  } finally{
    setAddingDriverDataLoading(false)
    router.replace('/home')      
  }
}

// Clear the form fields
  const clearFormHandler = () => {
    setLocation(null)
    setCarType('')
    setCarModel('')
    setCarPlate('')
    setCarSeats('')
    setDateSelected(false)
    setPersonalImage(null)
    setCarImage(null)
  }

// Loading or fetching user data from DB
  if (fetchingUserDataLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.spinner_error_container}>
          <ActivityIndicator size="large" color={colors.PRIMARY}/>
        </View>
      </SafeAreaView>
    )
  }

// Loading till adding driver data
  if (addingDriverDataLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.spinner_error_container}>
          <ActivityIndicator size="large" color={colors.PRIMARY}/>
        </View>
      </SafeAreaView>
    )
  }

// Check whether the user add data or no
  if(driverData.length > 0 && addingDriverDataLoading === false) {
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
      <Text style={styles.title}>اضافة بيانات</Text>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.form} 
        >

          <CustomeButton
            title={personalImageLoading ? 'جاري تحميل الصورة' : personalImage ? 'تم اختيار الصورة' : 'صورتك الشخصية'}
            onPressHandler={pickPersonalImage}
          />
          {personalImage && 
            <View style={styles.image_container}>
              <Image source={{ uri: personalImage }} style={styles.image_container_image} />
            </View>
          }

          <CustomeButton
            title={dateSelected ? driverBirthDate.toLocaleDateString() : 'تاريخ الميلاد'}
            onPressHandler={showDatePicker} 
          />
          {showPicker && (
            <DateTimePicker
              value={driverBirthDate}
              mode="date"
              display="default"
              onChange={handleDateChange}
              maximumDate={new Date()} // Optional: Prevent selecting future dates
            />
          )}
          <Dropdown
            style={styles.dropdown}
            placeholderStyle={styles.dropdownStyle}
            selectedTextStyle={styles.dropdownStyle}
            data={cars}
            labelField="name"
            valueField="name"
            placeholder= 'نوع السيارة'
            value={carType}
            onChange={item => {
              handleCarChange(item.name)
            }}
          />
          <CustomeInput
            placeholder={'موديل السيارة'}
            value={carModel}
            onChangeText={(text) => setCarModel(text)}
          />
          <CustomeInput
            placeholder={'رقم اللوحة'}
            value={carPlate}
            onChangeText={(text) => setCarPlate(text)}
          />
          
          <CustomeButton
            title={carImageLoading ? 'جاري تحميل الصورة' : carImage ? 'تم اختيار الصورة' : 'صورة السيارة'}
            onPressHandler={PickCarImage}
          />
          {carImage && 
            <View style={styles.image_container}>
              <Image source={{ uri: carImage }} style={styles.image_container_image} />
            </View>
          }
          
          <CustomeButton
            title={location !== null ? 'تم تحديد موقعك' : 'عنوان المنزل'}
            icon={true}
            iconType={location !== null ? 'done' : 'location'}
            onPressHandler={getLocation}
            disabledStatus={location !== null}
          />

          <View style={styles.location_msg_view}>
            <Text style={styles.location_warning_text}>التطبيق يسجل موقعك الحالي كعنوان للمنزل لذا يرجى التواجد في المنزل عند التسجيل و تفعيل خدمة تحديد الموقع الخاصة بالهاتف</Text>
          </View>

          <View style={styles.final_buttons_box}>
            <TouchableOpacity 
              onPress={addNewDriverHandler} 
              disabled={!userData || !carPlate || !carModel || !carType}
              style={styles.add_data_button}
            >
              <Text style={styles.add_data_button_text}>اضف</Text>
            </TouchableOpacity>

            <TouchableOpacity 
            onPress={clearFormHandler}
            style={styles.clear_data_button}
            >
              <Text style={styles.clear_data_button_text}>الغاء</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.location_warning_text}>* يرجى التأكد من ادخال جميع البيانات</Text>
          
        </ScrollView>    
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
  form:{
    marginTop:20,
    paddingVertical:10,
    justifyContent:'space-between',
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
  dropdown:{
    width:280,
    height:50,
    borderWidth:1,
    marginBottom:10,
    borderColor:colors.PRIMARY,
    borderRadius:20,
  },
  dropdownStyle:{
    fontFamily:'Cairo_400Regular',
    textAlign:'center',
    fontSize:14
  },
  location_msg_view:{
    width:280,
    paddingHorizontal:10,
    marginBottom:20,
  },
  location_warning_text:{
    fontFamily:'Cairo_700Bold',
    fontSize:11,
    textAlign:'center',
    marginBottom:10,
  },
  distanceText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
  },
  final_buttons_box:{
    flexDirection:'row-reverse',
    justifyContent:'space-between',
    width:280,
    marginVertical:10,
  },
  add_data_button:{
    width:130,
    height:50,
    backgroundColor:colors.PRIMARY,
    justifyContent:'center',
    alignItems:'center',
    borderRadius:15,
  },
  add_data_button_text:{
    fontFamily:'Cairo_700Bold',
    fontSize:15,
    color:colors.WHITE
  },
  clear_data_button:{
    width:130,
    height:50,
    borderColor:colors.PRIMARY,
    borderWidth:1,
    justifyContent:'center',
    alignItems:'center',
    borderRadius:15,
  },
  clear_data_button_text:{
    fontFamily:'Cairo_700Bold',
    fontSize:15,
    color:colors.PRIMARY
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
    height:100,
    backgroundColor:'#F6F8FA',
    flexDirection:'row-reverse',
    justifyContent:'space-around',
    alignItems:'center',
    borderRadius:15,
    marginTop:10
  },
  car_info_text:{
    fontFamily:'Cairo_400Regular',
    fontSize:14,
    color:'#858585'
  }
})