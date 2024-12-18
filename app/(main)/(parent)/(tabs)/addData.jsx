import { Alert, StyleSheet, Text, View,TouchableOpacity,ActivityIndicator, FlatList, Switch } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import React,{useEffect, useState} from 'react'
import { useRouter } from 'expo-router'
import colors from '../../../../constants/Colors'
import CustomeInput from '../../../../components/CustomeInput'
import {DB} from '../../../../firebaseConfig'
import { addDoc , collection,onSnapshot } from 'firebase/firestore'
import * as Location from 'expo-location'
import DateTimePicker from '@react-native-community/datetimepicker'
import Ionicons from '@expo/vector-icons/Ionicons'
import FontAwesome6 from '@expo/vector-icons/FontAwesome6'
import { useUser } from '@clerk/clerk-expo'
import { Dropdown } from 'react-native-element-dropdown'
import { useStudentData } from '../../../stateManagment/StudentState'

const addData = () => {
  const { user } = useUser()
  const router = useRouter()
  const {userData,fetchingUserDataLoading,schools,fetchingSchoolsLoading,states,fetchingState} = useStudentData()

  const totalSteps = 3;
  const [currentPage, setCurrentPage] = useState(1)

  const [studentFullName,setStudentFullName] = useState('')
  const [studentBirthDate,setStudentBirthDate] = useState(new Date())
  const [studentSex,setStudentSex] = useState('')
  const [studentSchool,setStudentSchool] = useState('')
  const [pickerVisible, setPickerVisible] = useState(false);
  const [currentPicker, setCurrentPicker] = useState({ day: null, field: null });
  const [location, setLocation] = useState(null)
  const [homeAdress,setHomeAdress] = useState('')
  const [studentState,setStudentState] = useState('')
  const [cities,setCities] = useState([])
  const [studentCity,setStudentCity] = useState('')
  const [studentStreet,setStudentStreet] = useState('')
  const [carType,setCarType] = useState('')
  const [schoolLocation, setSchoolLocation] = useState(null)
  const [showPicker,setShowPicker] = useState(false)
  const [dateSelected, setDateSelected] = useState(false)
  const [addingNewStudentLoading,setAddingNewStudentLoading] = useState(false)

  const createAlert = (alerMessage) => {
    Alert.alert(alerMessage)
  }

  //Get the student birth date
  const showDatePicker = () => {
    setShowPicker(true);
  };
  
  // Handle the BirthDate Change
  const handleDateChange = (event, selectedDate) => {
    setShowPicker(false);
    if (event.type === "set") {
      const currentDate = selectedDate || studentBirthDate;
      setStudentBirthDate(currentDate);
      setDateSelected(true);
    }
  }

  // Student Sex
  const sex = [
    { name: 'ذكر'},
    {name:'انثى'}
  ]

  // Handle student sex change
  const handleStudentSex = (sexType) => {
    setStudentSex(sexType)
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
  }

  // Handle school name change
  const handleSchoolChange = (schoolName) => {
    setStudentSchool(schoolName)
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

  // School time table
  const [schoolTimetable, setSchoolTimetable] = useState([
    { day: "الاثنين", active: false, startTime: null, endTime: null },
    { day: "الثلاثاء", active: false, startTime: null, endTime: null },
    { day: "الاربعاء", active: false, startTime: null, endTime: null },
    { day: "الخميس", active: false, startTime: null, endTime: null },
    { day: "الجمعة", active: false, startTime: null, endTime: null },
    { day: "السبت", active: false, startTime: null, endTime: null },
    { day: "الاحد", active: false, startTime: null, endTime: null },
  ]);
  
  // Open the time-table picker
  const handleTimeSelect = (day, field) => {
    setCurrentPicker({ day, field });
    setPickerVisible(true);
  };
  
  // Change student time-table
  const handlePickerChange = (event, selectedTime) => {
    setPickerVisible(false);
    if (event.type === "set" && selectedTime) {
      setSchoolTimetable((prev) =>
        prev.map((item) =>
          item.day === currentPicker.day
            ? { ...item, [currentPicker.field]: selectedTime }
            : item
        )
      );
    }
  };

  //Handle the state change
  const handleStateChange = (state) => {
    setStudentState(state);
  };

  // Fetch Cities based on selected Province (State)
  const fetchCities = (selectedState) => {
    const schoolInfoCollectionRef = collection(DB, 'states')
      const unsubscribe = onSnapshot(
        schoolInfoCollectionRef,
        async(querySnapshot) => {
          const stateData = querySnapshot.docs
            .map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }))
            setCities(stateData.find((state) => state.name === selectedState).cities)
        }
      )
    return () => unsubscribe();
  };

  // Handle the city change
  const handleCityChange = (city) => {
    setStudentCity(city);
  }

  // Get student home location
  const getLocation = async () => {
    // Step 1: Provide a prominent disclosure
    Alert.alert(
      "مطلوب إذن الموقع",
      "يستخدم تطبيق Sayartech بيانات موقعك للمساعدة في حفظ عنوان منزل طفلك. يضمن ذلك توفير خدمات التوصيل والاستلام بدقة لطفلك. لن يتم جمع بيانات موقعك في الخلفية ولن يتم مشاركتها مع أطراف خارجية.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "OK",
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

  // Go to next page
  const handleNext = () => {
    if (currentPage < totalSteps) setCurrentPage(currentPage + 1);
  };

  // Return to previous page
  const handlePrevious = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  //Adding new student
  const addNewStudentHandler = async () => {
    
    if (!user) {
      createAlert('المستخدم غير معرف')
      return
    }

    // Validate all required fields
    if (
      !studentFullName ||
      !studentBirthDate ||
      !studentSex ||
      !carType ||
      !studentSchool ||
      !schoolLocation ||
      schoolTimetable.some((entry) => entry.active && (!entry.startTime || !entry.endTime)) ||
      !studentState ||
      !studentCity ||
      !studentStreet ||
      !homeAdress
    ) {
        createAlert('يرجى ملء جميع الحقول المطلوبة');
        return;
      }
    
    if (!location) {
      createAlert('يرجى تحديد موقعك اولا')
      return
    }

    setAddingNewStudentLoading(true)

    try {
      const studentsCollectionRef = collection(DB,'students')
      const studentData = {
        student_full_name: studentFullName,
        student_parent_full_name:userData.user_full_name,
        student_family_name:userData.user_family_name,
        student_user_id:userData.user_id,
        student_phone_number:userData.phone_number,
        student_user_notification_token:userData.user_notification_token,
        student_birth_date:studentBirthDate,
        student_sex:studentSex,
        student_state:studentState,
        student_city:studentCity,
        student_street:studentStreet,
        student_home_address:homeAdress,
        student_home_location:location,
        student_school:studentSchool,
        student_school_location:schoolLocation,
        school_timetable: schoolTimetable,
        student_car_type:carType,
        driver_id:null,
        picked_up:false,
        tomorrow_trip_canceled:false,
        student_trip_status:'at home',
      }

      const docRef = await addDoc(studentsCollectionRef,studentData)

      createAlert('تم تسجيل المعلومات بنجاح')
      
      // Clear the form fields
      setStudentFullName('')
      setDateSelected(false)
      setStudentSex('')
      setLocation(null)
      setStudentSchool('')
      setSchoolLocation(null)
      setCarType('')
      setStudentState('')
      setStudentCity('')
      setStudentStreet('')
      setHomeAdress('')
      setSchoolTimetable([
        { day: "الاثنين", active: false, startTime: null, endTime: null },
        { day: "الثلاثاء", active: false, startTime: null, endTime: null },
        { day: "الاربعاء", active: false, startTime: null, endTime: null },
        { day: "الخميس", active: false, startTime: null, endTime: null },
        { day: "الجمعة", active: false, startTime: null, endTime: null },
        { day: "السبت", active: false, startTime: null, endTime: null },
        { day: "الاحد", active: false, startTime: null, endTime: null },
      ]);
      setCurrentPage(1)

    } catch (error) {
      createAlert('. يرجى المحاولة مرة أخرى')
    } finally{
      setAddingNewStudentLoading(false)
      router.replace('/home')      
    }
  }

  // Utility function to format time as HH:mm
  const formatTime = (date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // School time-table component
  const SchoolTimetableComponent = ({ timetable, onUpdate, onTimeSelect }) => {
    const updateDay = (day, field, value) => {
      const newTimetable = timetable.map((item) =>
        item.day === day ? { ...item, [field]: value } : item
      );
      onUpdate(newTimetable);
    };
  
    return (
      <FlatList
        data={timetable}
        keyExtractor={(item) => item.day}
        contentContainerStyle={styles.flatList_style}
        renderItem={({ item }) => (
          <View style={styles.dayRow}>
            {/* Enable/Disable Day */}
            <Switch
              value={item.active}
              onValueChange={(value) => updateDay(item.day, "active", value)}
            />
            <Text style={styles.dayText}>{item.day}</Text>
            {/* Start Time Picker */}
            <TouchableOpacity
              style={[styles.timeInput, !item.active && styles.disabledInput]}
              onPress={() => {
                if (item.active) {
                  onTimeSelect(item.day, "startTime");
                }
              }}
              disabled={!item.active}
            >
              <Text style={styles.timeText}>{item.active && item.startTime ? formatTime(item.startTime) : "الدخول"}</Text>
            </TouchableOpacity>
            <Text style={styles.timeSeparator}>-</Text>
            {/* End Time Picker */}
            <TouchableOpacity
              style={[styles.timeInput, !item.active && styles.disabledInput]}
              onPress={() => {
                if (item.active) {
                  onTimeSelect(item.day, "endTime");
                }
              }}
              disabled={!item.active}
            >
              <Text style={styles.timeText}>{item.active && item.endTime ? formatTime(item.endTime) : "الخروج"}</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    );
  };
  
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
    switch (currentPage) {
      case 1:
        return (
          <View>
            <CustomeInput
              placeholder="الاسم الكامل"
              value={studentFullName}
              onChangeText={(text) => setStudentFullName(text)}
            />
            <TouchableOpacity style={styles.fullButton} onPress={showDatePicker}>
              <Text style={styles.fullBtnText}>
                {dateSelected ? studentBirthDate.toLocaleDateString() : 'تاريخ الميلاد'}
              </Text>
            </TouchableOpacity>
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
              placeholder="الجنس"
              value={studentSex}
              onChange={item => handleStudentSex(item.name)}
            />
            <Dropdown
              style={styles.dropdown}
              placeholderStyle={styles.dropdownStyle}
              selectedTextStyle={styles.dropdownStyle}
              data={cars}
              labelField="name"
              valueField="name"
              placeholder="نوع السيارة"
              value={carType}
              onChange={item => handleCarChange(item.name)}
            />
          </View>
        );
      case 2:
        return (
          <View>
            <Dropdown
              style={styles.dropdown}
              placeholderStyle={styles.dropdownStyle}
              selectedTextStyle={styles.dropdownStyle}
              data={schools}
              labelField="name"
              valueField="name"
              placeholder= 'المدرسة'
              value={studentSchool}
              onChange={item => handleSchoolChange(item.name)}
            />
            <SchoolTimetableComponent
              timetable={schoolTimetable}
              onUpdate={setSchoolTimetable}
              onTimeSelect={handleTimeSelect}
            />
            {pickerVisible && (
              <DateTimePicker
                value={new Date()}
                mode="time"
                display="default"
                onChange={handlePickerChange}
                is24Hour={true}
              />
            )}
          </View>
        );
      case 3:
        return (
          <View>
            <View style={styles.HalfDropDownContainer}>
              <Dropdown
                style={styles.dropdownHalf}
                placeholderStyle={styles.dropdownStyle}
                selectedTextStyle={styles.dropdownStyle}
                data={states}
                labelField="name"
                valueField="name"
                placeholder= 'المحافظة'
                value={studentState}
                onChange={item => {
                  handleStateChange(item.name)
                  fetchCities(item.name)
                }}
              />
              <Dropdown
                style={styles.dropdownHalf}
                placeholderStyle={styles.dropdownStyle}
                selectedTextStyle={styles.dropdownStyle}
                data={cities}
                labelField="name"
                valueField="name"
                placeholder= 'القضاء'
                value={studentCity}
                onChange={item => {
                  handleCityChange(item.name)
                }}
              />
            </View>
            <CustomeInput
              placeholder="الحي"
              value={studentStreet}
              onChangeText={(text) => setStudentStreet(text)}
            />
            <CustomeInput
              placeholder="اقرب نقطة دالة"
              value={homeAdress}
              onChangeText={(text) => setHomeAdress(text)}
            />
            <Text style={styles.address_warning_text}>مثلا قرب جامع الرحمة</Text>
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
          </View>
        );
      default:
        return null;
    }
  };

  if (addingNewStudentLoading || fetchingSchoolsLoading || fetchingUserDataLoading || fetchingState) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.spinner_error_container}>
          <ActivityIndicator size="large" color={colors.PRIMARY}/>
        </View>
      </SafeAreaView>
    )
  }

  return(
    <SafeAreaView style={styles.container}>

      <View>
        <Text style={styles.title}>اضافة طالب</Text>
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
          <TouchableOpacity style={styles.halfButton} onPress={addNewStudentHandler}>
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
    justifyContent:'space-between',
    paddingVertical:20,
    backgroundColor:colors.WHITE
  },
  title:{
    marginBottom:20,
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
  dropdown:{
    width:280,
    height:50,
    borderWidth:1,
    marginBottom:10,
    borderColor:colors.PRIMARY,
    borderRadius:15,
  },
  HalfDropDownContainer:{
    width:280,
    flexDirection:'row-reverse',
    justifyContent:'space-between'
  },
  dropdownHalf:{
    width:135,
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
  flatList_style:{
    marginTop:20
  },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
    borderWidth:1,
    borderColor:colors.PRIMARY,
    borderRadius:15,
  },
  dayText: {
    textAlign:'center',
    fontFamily:'Cairo_400Regular',
    flex: 1,
    fontSize: 14,
  },
  timeInput: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 5,
    borderRadius: 15,
    alignItems: "center",
  },
  disabledInput: {
    backgroundColor: "#e0e0e0",
  },
  timeText: {
    textAlign:'center',
    fontFamily:'Cairo_400Regular',
    fontSize: 14,
  },
  timeSeparator: {
    marginHorizontal: 5,
    fontSize: 14,
    fontWeight: "bold",
  },
  submitButton: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#28a745",
    borderRadius: 5,
    alignItems: "center",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
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
  address_warning_text:{
    fontFamily:'Cairo_700Bold',
    fontSize:11,
    textAlign:'center',
    marginBottom:20,
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
    fontFamily:'Cairo_400Regular',
    fontSize:15,
    color:colors.BLACK
  },
  icon:{
    marginRight:10,
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
    fontFamily:'Cairo_700Bold',
    fontSize:15,
    color:colors.WHITE
  },
  halfButtonClearForm:{
    width:135,
    height:50,
    marginHorizontal:5,
    backgroundColor:colors.GRAY,
    borderRadius:15,
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'center'
  },
  btnTextClearForm:{
    fontFamily:'Cairo_700Bold',
    fontSize:15,
    color:colors.BLACK
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