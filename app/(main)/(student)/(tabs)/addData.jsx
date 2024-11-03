import { Alert, StyleSheet, Text, View,ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import React,{useEffect, useState} from 'react'
import { useRouter } from 'expo-router'
import colors from '../../../../constants/Colors'
import CustomeButton from '../../../../components/CustomeButton'
import {DB} from '../../../../firebaseConfig'
import { addDoc , collection } from 'firebase/firestore'
import * as Location from 'expo-location'
import haversine from 'haversine'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useUser } from '@clerk/clerk-expo'
import { Dropdown } from 'react-native-element-dropdown'
import { useStudentData } from '../../../stateManagment/StudentState'

const addData = () => {
  const { user } = useUser()
  const router = useRouter()

  const [studentSex,setStudentSex] = useState('')
  const [studentSchool,setStudentSchool] = useState('')
  const [location, setLocation] = useState(null)
  const [schoolLocation, setSchoolLocation] = useState(null)
  const [distance, setDistance] = useState(null)
  const [carType,setCarType] = useState('')
  const [addingNewStudentLoading,setAddingNewStudentLoading] = useState(false)
  const [studentBirthDate,setStudentBirthDate] = useState(new Date())
  const [dateSelected, setDateSelected] = useState(false);
  const [showPicker,setShowPicker] = useState(false);

  const {userData,fetchingUserDataLoading,students,schools,fetchingSchoolsLoading} = useStudentData()

  const createAlert = (alerMessage) => {
    Alert.alert(alerMessage)
  }

  const sex = [
    { name: 'ذكر'},
    {name:'انثى'}
  ]

  const cars = [
    {name: 'سيارة خاصة صالون ', type: 'private car 4 places', seats: 4 },
    {name:'سيارة خاصة ٧ راكب ',type:'private car 7 places', seats:7},
    {name:'ستاركس ',type:'starex',seats:11},
    {name:'باص صغير ١٢ راكب',type:'minu-bus',seats:12},
    {name:'باص متوسط ١٤ راكب',type:'medium-bus',seats:14},
    {name:'باص كبير ٣٠ راكب',type:'large-bus',seats:30}
  ]

// Handle student sex change
  const handleStudentSex = (sexType) => {
    setStudentSex(sexType)
  }

// Handle the car type change
  const handleCarChange = (vehicle) => {
    setCarType(vehicle)
  }

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

// Handle school name change
  const handleSchoolChange = (schoolName) => {
    setStudentSchool(schoolName)
    setDistance(null)
  }

  // Set school location based on school name
  useEffect(() => {
    if (studentSchool) {
      const selectedSchool = schools.find((school) => school.name === studentSchool)
      if (selectedSchool) {
        setSchoolLocation({
          latitude: selectedSchool.latitude,
          longitude: selectedSchool.longitude,
        })
      } else {
        setSchoolLocation(null)
      }
    }
  }, [studentSchool])

//Calculate home - school distance
const calculateDistance = () => {
    if (location && schoolLocation) {
      const start = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      }
      const end = schoolLocation

      const dist = haversine(start, end, { unit: 'km' })
      setDistance(dist.toFixed(2))
    }
  }

// trigger distance calculation whenever the home / school location changes
  useEffect(() => {
    if (location && schoolLocation) {
      calculateDistance()
    }
  }, [schoolLocation, location])

//Get the driver birth date
const showDatePicker = () => {
  setShowPicker(true);
};

// Handle the Date Change
 const handleDateChange = (event, selectedDate) => {
  if (event.type === "set") {
    const currentDate = selectedDate || studentBirthDate;
    setStudentBirthDate(currentDate);
    setDateSelected(true);
  }
  setShowPicker(false);
};

//Adding new student
  const addNewStudentHandler = async () => {
    if (!user) {
      createAlert('المستخدم غير معرف')
      return
    }

    if (!location) {
      createAlert('يرجى تحديد موقعك اولا')
      return
    }

    setAddingNewStudentLoading(true)

    try {
      const studentsCollectionRef = collection(DB,'students')
      const studentData = {
        student_full_name: userData.user_full_name,
        student_family_name:userData.user_family_name,
        student_user_id:userData.user_id,
        student_phone_number:userData.phone_number,
        student_birth_date:studentBirthDate,
        student_sex:studentSex,
        student_home_location:location,
        student_school:studentSchool,
        student_school_location:schoolLocation,
        distance_to_school: distance,
        student_car_type:carType,
        driver_id:null,
        picked_up:false,
        dropped_off:false,
        picked_from_school:false,
        checked_in_front_of_school:false,
        student_trip_status:'at home',
        tomorrow_trip_canceled:false,
        called_by_driver:false,
      }

      const docRef = await addDoc(studentsCollectionRef,studentData)

      createAlert('تم تسجيل المعلومات بنجاح')
      
      // Clear the form fields
      setDateSelected(false)
      setStudentSex('')
      setLocation(null)
      setStudentSchool('')
      setSchoolLocation(null)
      setDistance(null)
      setCarType('')

    } catch (error) {
       createAlert('. يرجى المحاولة مرة أخرى')
    } finally{
      setAddingNewStudentLoading(false)
      router.replace('/home')      
    }
  }

  // Clear the form fields
  const clearFormHandler = () => {
    setDateSelected(false)
    setStudentSex('')
    setLocation(null)
    setStudentSchool('')
    setSchoolLocation(null)
    setDistance(null)
    setCarType('')
  }

// Loading till adding student data
  if (addingNewStudentLoading || fetchingUserDataLoading || fetchingSchoolsLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.spinner_error_container}>
          <ActivityIndicator size="large" color={colors.PRIMARY}/>
        </View>
      </SafeAreaView>
    )
  }

// Check whether the user add data or no
  if(students.length > 0 && addingNewStudentLoading === false) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.spinner_error_container}>
          <Text style={styles.already_added_style}>لقد تمت اضافة بياناتك</Text>
        </View>
      </SafeAreaView>
    )
  }

  return(
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>اضافة بيانات</Text>
        <View style={styles.form}>
          <CustomeButton
            title={dateSelected ? studentBirthDate.toLocaleDateString() : 'تاريخ الميلاد'}
            onPressHandler={showDatePicker} 
          />
          {showPicker && (
            <DateTimePicker
              value={studentBirthDate}
              mode="date"
              display="default"
              onChange={handleDateChange}
              maximumDate={new Date()}
            />
          )}
          <Dropdown
            style={styles.dropdown}
            placeholderStyle={styles.dropdownStyle}
            selectedTextStyle={styles.dropdownStyle}
            data={sex}
            labelField="name"
            valueField="name"
            placeholder= 'الجنس'
            value={studentSex}
            onChange={item => {
            handleStudentSex(item.name)
            }}
          />
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
          <Dropdown
            style={styles.dropdown}
            placeholderStyle={styles.dropdownStyle}
            selectedTextStyle={styles.dropdownStyle}
            data={schools}
            labelField="name"
            valueField="name"
            placeholder= 'المدرسة'
            value={studentSchool}
            onChange={item => {
            handleSchoolChange(item.name)
            }}
          />
          <CustomeButton
            title={location !== null ? 'تم تحديد موقعك' : 'عنوان المنزل'}
            icon={true}
            iconType={location !== null ? 'done' : 'location'}
            onPressHandler={getLocation}
            disabledStatus={location !== null}
          />
          <View style={styles.location_msg_view}>
            {distance ? (
              <Text style={styles.location_warning_text}>المسافة بين منزل الطالب و المدرسة: {distance} كلم</Text>
            ) : (
              <Text style={styles.location_warning_text}>التطبيق يسجل موقعك الحالي كعنوان للمنزل لذا يرجى التواجد في المنزل عند التسجيل و تفعيل خدمة تحديد الموقع الخاصة بالهاتف</Text>
            )}
          </View>
          <CustomeButton 
            title={'أضف'}
            onPressHandler={addNewStudentHandler}
            disabledStatus={!studentSchool || !studentBirthDate || !studentSex || !carType}
          />
          <Text style={styles.location_warning_text}>* يرجى التأكد من ادخال جميع البيانات</Text>
          <CustomeButton 
            title={'الغاء'}
            onPressHandler={clearFormHandler}
          />
        </View>          
    </SafeAreaView>
  )
}

export default addData

const styles = StyleSheet.create({
  container:{
    flex:1,
    alignItems:'center',
    paddingVertical:20,
    backgroundColor:colors.WHITE
  },
  title:{
    marginVertical:30,
    fontFamily:'Cairo_400Regular',
    fontSize:24,
  },
  form:{
    width:'100%',
    justifyContent:'space-between',
    alignItems:'center',
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
    fontFamily:'Cairo_400Regular',
    textAlign:'center',
    fontSize:14
  },
  age_sex_input_container:{
    flexDirection:'row',
    width:280,
    alignItems:'center',
    justifyContent:'space-between'
  },
  age_input:{
    width:135,
    height:50,
    marginBottom:10,
    borderWidth:1,
    borderColor:colors.PRIMARY,
    borderRadius:15,
    textAlign:'center',
    fontFamily:'Cairo_400Regular'
  },
  sex_dropdown:{
    width:135,
    height:50,
    borderWidth:1,
    marginBottom:10,
    borderColor:colors.PRIMARY,
    borderRadius:15,
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
  map: {
    width: '95%',
    height: 270,
    marginVertical: 10,
  },
  distanceText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 12,
  },
  spinner_error_container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  already_added_style:{
    fontFamily: 'Cairo_400Regular',
    fontSize:16
  }
})