import {Alert,StyleSheet,Text,View,TouchableOpacity,TextInput,ActivityIndicator,FlatList,Platform,Modal} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import React,{useEffect, useState} from 'react'
import { useRouter } from 'expo-router'
import Checkbox from 'expo-checkbox'
import colors from '../../../../constants/Colors'
import {DB} from '../../../../firebaseConfig'
import { addDoc , collection,onSnapshot } from 'firebase/firestore'
import * as Location from 'expo-location'
import DateTimePicker from '@react-native-community/datetimepicker'
import Ionicons from '@expo/vector-icons/Ionicons'
import FontAwesome6 from '@expo/vector-icons/FontAwesome6'
import { useUser } from '@clerk/clerk-expo'
import { Dropdown } from 'react-native-element-dropdown'
import { useRiderData } from '../../../stateManagment/RiderContext'

const addData = () => {
  const { user } = useUser()
  const router = useRouter()
  const {userData,fetchingUserDataLoading,schools,fetchingSchoolsLoading,states,fetchingState} = useRiderData()

  const totalSteps = 3;
  const [currentPage, setCurrentPage] = useState(1)

  const [studentFullName,setStudentFullName] = useState('')
  const [showBirthdayPicker,setShowBirthdayPicker] = useState(false)
  const [studentBirthDate,setStudentBirthDate] = useState(new Date())
  const [studentSex,setStudentSex] = useState('')
  const [studentSchool,setStudentSchool] = useState('')
  const [pickerVisible, setPickerVisible] = useState(false);
  const [currentPicker, setCurrentPicker] = useState({ day: null, field: null });
  const [pickerTime, setPickerTime] = useState(new Date());
  const [firstDayTimes, setFirstDayTimes] = useState(null);
  const [location, setLocation] = useState(null)
  const [homeAdress,setHomeAdress] = useState('')
  const [studentState,setStudentState] = useState('')
  const [cities,setCities] = useState([])
  const [studentCity,setStudentCity] = useState('')
  const [studentStreet,setStudentStreet] = useState('')
  const [carType,setCarType] = useState('')
  const [schoolLocation, setSchoolLocation] = useState(null)
  const [dateSelected, setDateSelected] = useState(false)
  const [addingNewStudentLoading,setAddingNewStudentLoading] = useState(false)

  const createAlert = (alerMessage) => {
    Alert.alert(alerMessage)
  }

  //Get the student birth date
  const showBirthDayDatePicker = () => {
    setShowBirthdayPicker(true);
  };
  
  // Handle the BirthDate Change
  const handleBirthDayDateChange = (event, selectedDate) => {
    if(Platform.OS === 'ios') {
      if (selectedDate) {
        setStudentBirthDate(selectedDate);
        setDateSelected(true);
      }
    } else {
      if (event.type === "set" && selectedDate) {
        const currentDate = selectedDate || studentBirthDate;
        setStudentBirthDate(currentDate);
        setDateSelected(true);
      }
      setShowBirthdayPicker(false);
    }
  }

  // Close the picker manually for iOS
  const closePicker = () => {
    setShowBirthdayPicker(false);
  };

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
    { id:0,day: "الأحد", active: false, startTime: null, endTime: null },
    { id:1,day: "الاثنين", active: false, startTime: null, endTime: null },
    { id:2,day: "الثلاثاء", active: false, startTime: null, endTime: null },
    { id:3,day: "الأربعاء", active: false, startTime: null, endTime: null },
    { id:4,day: "الخميس", active: false, startTime: null, endTime: null },
    { id:5,day: "الجمعة", active: false, startTime: null, endTime: null },
    { id:6,day: "السبت", active: false, startTime: null, endTime: null },
  ]);
  
  // Open the time-table picker
  const handleTimeSelect = (day, field) => {
    const selectedDay = schoolTimetable.find((item) => item.day === day);

    // Use the existing time or fallback to the current time
    const initialTime = selectedDay[field] ? new Date(selectedDay[field]) : new Date();

    // Set a neutral base date for consistent handling
    initialTime.setFullYear(2000, 0, 1);

    setPickerTime(initialTime);
    setCurrentPicker({ day, field });
    setPickerVisible(true);
  };
  
  // Handle picker time change
  const handlePickerChange = (event, selectedTime) => {
    if (Platform.OS === "ios") {
      if (selectedTime) {
        const neutralTime = new Date(selectedTime);
        neutralTime.setFullYear(2000, 0, 1);
        setPickerTime(neutralTime);
      }
    } else if (event.type === "set" && selectedTime) {
        setPickerVisible(false);
        const neutralTime = new Date(selectedTime);
        neutralTime.setFullYear(2000, 0, 1);
        setPickerTime(neutralTime);

        setSchoolTimetable((prev) =>
          prev.map((item) =>
            item.day === currentPicker.day
              ? { ...item, [currentPicker.field]: neutralTime }
              : item
          )
        )
    }
  };

  // Confirm time-table selection (for iOS)
  const confirmPickerSelection = () => {
  if (pickerTime) {
    setSchoolTimetable((prev) =>
      prev.map((item) =>
        item.day === currentPicker.day
          ? { ...item, [currentPicker.field]: pickerTime }
          : item
      )
    );
    setPickerVisible(false);
  }
  };
  
  // Select active days
  const toggleDayActive = (dayId) => {
    const updatedTimetable = schoolTimetable.map((item) => {
      if (item.id === dayId) {
        // Reset startTime and endTime when day is deselected
        return item.active
          ? { ...item, active: false, startTime: null, endTime: null }
          : { ...item, active: true }; // Keep times intact if re-activating
      }
      return item;
    });
    setSchoolTimetable(updatedTimetable);
  };
  
  // Track the first day times select for copy to all btn
  useEffect(() => {
    const firstDayWithTimes = schoolTimetable.find(
      (item) => item.startTime && item.endTime
    );
    if (firstDayWithTimes) {
      setFirstDayTimes({
        startTime: new Date(firstDayWithTimes.startTime),
        endTime: new Date(firstDayWithTimes.endTime),
      });
    } else {
      setFirstDayTimes(null); // Clear the state if no valid day is found
    }
  }, [schoolTimetable]);
  
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
      return;
    }

    if(!studentFullName) {
      createAlert('يرجى ادخال اسم الطالب')
      return;
    }

    if (!dateSelected) {
      createAlert("يرجى إدخال تاريخ الميلاد");
      return;
    }
    
    if (!studentSex) {
      createAlert("يرجى تحديد الجنس");
      return;
    }
    
    if (!carType) {
      createAlert("يرجى اختيار نوع السيارة");
      return;
    }
  
    if (!studentSchool) {
      createAlert("يرجى اختيار المدرسة");
      return;
    }

    if(!firstDayTimes) {
      createAlert("يرجى ادخال الجدول الزمني للمدرسة")
      return
    }

    // Check school timetable for missing times
    const incompleteTimetable = schoolTimetable.find(
      (entry) => entry.active && (!entry.startTime || !entry.endTime)
    );
    if (incompleteTimetable) {
      createAlert(
        `يرجى تحديد وقت الدخول والخروج ليوم ${incompleteTimetable.day}`
      );
      return;
    }

    if (!studentState) {
      createAlert("يرجى اختيار المحافظة");
      return;
    }
    
    if (!studentCity) {
      createAlert("يرجى اختيار القضاء");
      return;
    }
      
    if (!studentStreet) {
      createAlert("يرجى إدخال اسم الحي");
      return;
    }
    
    if (!homeAdress) {
      createAlert("يرجى تحديد اقرب نقطة دالة على عنوانكم");
      return;
    }
    
    if (!location) {
      createAlert('يرجى تحديد الموقع')
      return
    }

    setAddingNewStudentLoading(true)

    try {
      const studentsCollectionRef = collection(DB,'riders')
      const studentData = {
        full_name: studentFullName,
        parent_full_name:userData.user_full_name,
        family_name:userData.user_family_name,
        rider_type:'student',
        user_id:userData.user_id,
        phone_number:userData.phone_number,
        user_notification_token:userData.user_notification_token,
        birth_date:studentBirthDate,
        sex:studentSex,
        state:studentState,
        city:studentCity,
        street:studentStreet,
        home_address:homeAdress,
        home_location:location,
        destination:studentSchool,
        destination_location:schoolLocation,
        timetable: schoolTimetable,
        car_type:carType,
        monthly_sub:0,
        company_commission:0,
        driver_commission:0,
        trip_status:'at home',
        driver_id:null,
        picked_up:false,
        tomorrow_trip_canceled:false,
      }

      const docRef = await addDoc(studentsCollectionRef,studentData)

      createAlert('تم تسجيل المعلومات بنجاح')
      
      // Clear the form fields
      setStudentFullName('')
      setDateSelected(false)
      setStudentBirthDate(new Date())
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
        { id:0,day: "الأحد", active: false, startTime: null, endTime: null },
        { id:1,day: "الاثنين", active: false, startTime: null, endTime: null },
        { id:2,day: "الثلاثاء", active: false, startTime: null, endTime: null },
        { id:3,day: "الأربعاء", active: false, startTime: null, endTime: null },
        { id:4,day: "الخميس", active: false, startTime: null, endTime: null },
        { id:5,day: "الجمعة", active: false, startTime: null, endTime: null },
        { id:6,day: "السبت", active: false, startTime: null, endTime: null },
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
    if (!(date instanceof Date) || isNaN(date)) return "00:00"; // Fallback for invalid dates
  
    const hours = date.getHours()?.toString().padStart(2, "0");
    const minutes = date.getMinutes()?.toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };
  
  // School time-table component
  const SchoolTimetableComponent = ({ timetable, onUpdate, onTimeSelect }) => {    
    return (
      <FlatList
        data={timetable}
        keyExtractor={(item) => item.id}
        extraData={timetable} 
        contentContainerStyle={styles.flatList_style}
        renderItem={({ item }) => (
          <View style={styles.dayRow}>
            <Checkbox
              style={styles.checkbox}
              value={item.active}
              onValueChange={() => toggleDayActive(item.id)}
              color={item.active ? '#16B1FF' : undefined}
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
              <Text 
                style={[styles.timeText, item.active && styles.activeTimeText]}
              >{item.active && item.startTime ? formatTime(item.startTime) : "الدخول"}</Text>
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
              <Text 
                style={[styles.timeText, item.active && styles.activeTimeText]}
              >{item.active && item.endTime ? formatTime(item.endTime) : "الخروج"}</Text>
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

  // Check if there is active days to render the copy to all btn
  const hasActiveDays = schoolTimetable.some((item) => item.active);

  // Render full pages
  const renderPage = () => {
    switch (currentPage) {
      case 1:
        return (
          <View>
            <TextInput
              style={styles.customeInput}
              placeholderTextColor={colors.BLACK}
              placeholder="الاسم الكامل"
              value={studentFullName}
              onChangeText={(text) => setStudentFullName(text)}
            />
            <TouchableOpacity style={styles.fullButton} onPress={showBirthDayDatePicker}>
              <Text style={styles.fullBtnText}>
                {dateSelected ? studentBirthDate.toLocaleDateString() : 'تاريخ الميلاد'}
              </Text>
            </TouchableOpacity>
            {showBirthdayPicker && (
              Platform.OS === 'ios' ? (
                <Modal transparent animationType="slide" visible={showBirthdayPicker}>
                  <View style={styles.modalContainer}>
                    <View style={styles.pickerContainer}>
                      <DateTimePicker
                        value={studentBirthDate}
                        mode="date"
                        display="spinner"
                        onChange={handleBirthDayDateChange}
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
                  value={studentBirthDate}
                  mode="date"
                  display="spinner"
                  onChange={handleBirthDayDateChange}
                  maximumDate={new Date()}
                />
              )
            )}
            <Dropdown
              style={styles.dropdown}
              placeholderStyle={styles.dropdownStyle}
              selectedTextStyle={styles.dropdownStyle}
              itemTextStyle={styles.dropdownTextStyle}
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
              itemTextStyle={styles.dropdownTextStyle}
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
              itemTextStyle={styles.dropdownTextStyle}
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
              Platform.OS === "ios" ? (
                <Modal transparent animationType="slide" visible={pickerVisible}>
                  <View style={styles.modalContainer}>
                    <View style={styles.pickerContainer}>
                      <DateTimePicker
                        value={pickerTime || new Date()}
                        mode='time'
                        display="spinner"
                        onChange={handlePickerChange}
                        is24Hour={false}
                        minimumDate={new Date(1980, 0, 1)}
                        maximumDate={new Date(new Date().getFullYear() - 1, 0, 1)}
                      />
                      <TouchableOpacity onPress={confirmPickerSelection} style={styles.doneButton}>
                        <Text style={styles.doneButtonText}>تأكيد</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Modal>
              ) : (
                <DateTimePicker
                  value={pickerTime}
                  mode="time"
                  display='spinner'
                  onChange={handlePickerChange}
                  is24Hour={false}
                />
              )             
            )}
            {firstDayTimes && hasActiveDays  && (
              <View style={styles.copyButtonContainer}>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={() => {
                  const newTimetable = schoolTimetable.map((item) => {
                    if (item.day !== "الجمعة" && item.day !== "السبت") {
                      return {
                        ...item,
                        active:true,
                        startTime: firstDayTimes.startTime,
                        endTime: firstDayTimes.endTime,
                      };
                    }
                    return item;
                  });
                  setSchoolTimetable(newTimetable);
                }}
              >
                <Text style={styles.copyButtonText}>نسخ لجميع الأيام</Text>
              </TouchableOpacity>
              </View>
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
                itemTextStyle={styles.dropdownTextStyle}
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
                itemTextStyle={styles.dropdownTextStyle}
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
            <TextInput
              style={styles.customeInput}
              placeholderTextColor={colors.BLACK}
              placeholder="الحي"
              value={studentStreet}
              onChangeText={(text) => setStudentStreet(text)}
            />
            <TextInput
              style={styles.customeInput}
              placeholderTextColor={colors.BLACK}
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
            <View style={styles.location_msg_view}>
              <Text style={styles.location_warning_text}>التطبيق يسجل موقعك الحالي كعنوان للمنزل لذا يرجى التواجد في المنزل عند التسجيل و تفعيل خدمة تحديد الموقع الخاصة بالهاتف</Text>
            </View>
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
    lineHeight:50,
    fontFamily:'Cairo_400Regular',
    textAlign:'center',
    fontSize:14
  },
  dropdownTextStyle:{
    textAlign:'center',
  },
  flatList_style:{
    marginTop:3,
  },
  dayRow: {
    height:50,
    marginBottom: 6,
    paddingHorizontal:7,
    flexDirection: "row-reverse",
    alignItems: "center", 
    borderWidth:1,
    borderColor:colors.PRIMARY,
    borderRadius:15,
  },
  checkbox:{
    borderColor:'#777'
  },
  dayText: {
    lineHeight:40,
    textAlign:'center',
    fontFamily:'Cairo_400Regular',
    flex: 1,
    fontSize: 15,
  },
  timeInput: {
    width:60,
    height:30,
    borderRadius: 5,
    backgroundColor:'#e0e0e0',
    backgroundColor:colors.BLUE
  },
  disabledInput:{
    backgroundColor:null
  },
  timeText: {
    lineHeight:30,
    textAlign:'center',
    fontFamily:'Cairo_400Regular',
    fontSize: 14,
  },
  activeTimeText:{
    color:colors.WHITE
  },
  timeSeparator: {
    marginHorizontal: 5,
    fontSize: 14,
    fontWeight: "bold",
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
    lineHeight:50,
    verticalAlign:'middle',
    fontFamily:'Cairo_400Regular',
    fontSize:15,
    color:colors.BLACK,
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
    backgroundColor: colors.PRIMARY,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 5,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  copyButtonContainer:{
    alignItems:'center',
  },
  copyButton:{
    width:170,
    height:40,
    backgroundColor:colors.BLUE,
    borderRadius:15,
    alignItems:'center',
    justifyContent:'center'
  },
  copyButtonText:{
    lineHeight:40,
    fontFamily:'Cairo_400Regular',
    fontSize:15,
    color:colors.WHITE
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
    lineHeight:50,
    verticalAlign:'middle',
    fontFamily:'Cairo_700Bold',
    fontSize:15,
    color:colors.WHITE
  },
  map: {
    width: '95%',
    height: 270,
    marginVertical: 10,
  },
  spinner_error_container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
})