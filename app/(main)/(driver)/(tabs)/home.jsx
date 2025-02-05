import { useState,useEffect } from 'react'
import { StyleSheet, Text, View, ActivityIndicator,Image,ScrollView,TouchableOpacity,Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link } from 'expo-router'
import { writeBatch, doc } from "firebase/firestore"
import { DB } from '../../../../firebaseConfig'
import { useDriverData } from '../../../stateManagment/DriverContext'
import { useUser } from '@clerk/clerk-expo'
import colors from '../../../../constants/Colors'
import logo from '../../../../assets/images/logo.jpeg'
import LinePage from '../../../../components/LinePage'

const Home = () => {
  const {driverData,fetchingDriverDataLoading} = useDriverData()
  const { isLoaded } = useUser()
  const [selectedLine,setSelectedLine] = useState(0)
  const [todayDate, setTodayDate] = useState("")

  // Find the today date
  useEffect(() => {
    const getTodayDate = () => {
      const now = new Date();
      const options = { weekday: "long", day: "2-digit", month: "long", year: "numeric" };
      const formattedDate = now.toLocaleDateString("ar-IQ", options);
      setTodayDate(formattedDate);
    };

    getTodayDate();
  }, []);


  // Start the today jouney  
  const startTodayJourney = async () => {
    try {
      const batch = writeBatch(DB);
      const driverRef = doc(DB, "drivers", driverData[0].id);
  
      // Get today's day index (0=Sunday, ..., 6=Saturday)
      const todayIndex = new Date().getDay();
  
      // Filter only active lines for today with students
      const activeLinesToday = driverData[0].line
        .map((line) => {
          const todaySchedule = line.lineTimeTable?.find(
            (day) => day.dayIndex === todayIndex
          );
  
          if (todaySchedule?.active && line.students.length > 0) {
            return {
              ...line,
              startTime: todaySchedule.startTime, // Store today's start time for sorting
            };
          }
          return null;
        })
        .filter(Boolean); // Remove null values
  
      if (activeLinesToday.length === 0) {
        alert("لا يوجد خطوط لهذا اليوم");
        return;
      }

      // Normalize Time for Sorting
      const getTimeInMinutes = (timestamp) => {
        if (!timestamp) return Infinity; // Put invalid times at the end
        const date = new Date(timestamp.seconds * 1000);
        return date.getHours() * 60 + date.getMinutes(); // Convert to total minutes
      };
  
      // Sort active lines by start time
      activeLinesToday.sort((a, b) => getTimeInMinutes(a.startTime) - getTimeInMinutes(b.startTime));
  
      // Assign indexes and activate the first line only
      const sortedLines = activeLinesToday.map((line, index) => ({
        ...line,
        line_index: index + 1, // Number the lines
        line_active: index === 0, // Activate only the first one
      }));
  
      // Update Firestore with batch
      batch.update(driverRef, {
        start_the_journey: true,
        line: sortedLines, // Update sorted & activated lines
      });
  
      // Commit batch updates
      await batch.commit();
  
    } catch (error) {
      console.error("Error starting the journey:", error);
      alert("حدث خطأ أثناء بدء الرحلة.");
    }
  };
  
  //Loading State
  if( fetchingDriverDataLoading  || !isLoaded) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.spinner_error_container}>
          <ActivityIndicator size="large" color={colors.PRIMARY} />
        </View>
      </SafeAreaView>
    )
  }
  
  // if the driver haven't yet registered his info
  if(!driverData?.length) {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.no_driver_data_container}>
          <View style={styles.logo}>
            <Image source={logo} style={styles.logo_image}/>
          </View>
          <View style={styles.no_driver_data}>
            <Text style={styles.no_driver_data_text}>الرجاء اضافة بياناتك الخاصة</Text>
            <Link href="/addData" style={styles.link_container}>
              <Text style={styles.link_text}>اضف الآن</Text>
            </Link>
          </View>
        </View>        
      </SafeAreaView>
    )
  }

  //if the driver have no assigned students
  if(driverData?.length > 0 && driverData[0].line.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.no_driver_data_container}>
          <View style={styles.logo}>
            <Image source={logo} style={styles.logo_image}/>
          </View>
          <View style={styles.no_assigned_students_box}>
            <Text style={styles.no_student_text}>ليس لديك خطوط في حسابك</Text>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  // if the driver didnt start the today journey
  if(driverData?.length > 0 && driverData[0].line.length > 0 && driverData[0].start_the_journey === false) {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.no_driver_data_container}>
          <View style={styles.logo}>
            <Image source={logo} style={styles.logo_image}/>
          </View>
          
          <View style={styles.start_today_trip_container}>
            <Text style={styles.today_date_text}>{todayDate}</Text>
            <TouchableOpacity style={styles.start_today_trip_btn} onPress={() => startTodayJourney()}>
              <Text style={styles.start_today_trip_btn_text}>ابدا خطوط اليوم</Text>
            </TouchableOpacity>
          </View>
          
        </View>
      </SafeAreaView>
    )
  }

  return(
    <SafeAreaView style={styles.container}>

      <View style={styles.scrollViewContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.line_name_buttons_container}
        >
          {driverData[0].line
          .filter((li) => li.students.length > 0)
          .sort((a, b) => (a.line_index || 999) - (b.line_index || 999))
          .map((li,index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.line_name_button,
                selectedLine === index && styles.active_line_name_button, // Apply active style if selected
              ]}
              onPress={() => setSelectedLine(index)}
            >
              <Text
                style={[
                  styles.line_name_button_text,
                  selectedLine === index && styles.active_line_name_button_text, // Apply active text style if selected
                ]}
              >
                {li.lineName}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.student_info_container}>
        {driverData[0].line[selectedLine] && (
          <LinePage line={driverData[0].line[selectedLine]} selectedLine={selectedLine}/>
        )}
      </View>

    </SafeAreaView>
  )
}

export default Home;

//get screen height
const { width: SCwidth, height: SCheight } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.WHITE,
  },
  spinner_error_container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  no_driver_data_container:{
    height:400,
    paddingTop:30,
    alignItems:'center',
    justifyContent:'space-between',
  },
  logo:{
    width:'100%',
    height:150,
    justifyContent:'center',
    alignItems:'center',
  },
  logo_image:{
    height:120,
    width:120,
    resizeMode:'contain',
  },
  no_driver_data: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  no_driver_data_text:{
    fontFamily: 'Cairo_400Regular',
  },
  link_container: {
    backgroundColor: colors.PRIMARY,
    width:100,
    height:50,
    textAlign:'center',
    marginTop:10,
    borderRadius: 20,
  },
  link_text: {
    lineHeight:50,
    color: colors.WHITE,
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
  },
  no_assigned_students_box:{
    height:50,
    width:300,
    marginTop:95,
    backgroundColor:colors.BLUE,
    borderRadius:15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  no_student_text: {
    lineHeight:50,
    fontFamily: 'Cairo_400Regular',
    color:colors.WHITE
  },
  start_today_trip_container:{
    alignItems:'center',
    justifyContent:'center',
  },
  today_date_text:{
    fontFamily: 'Cairo_400Regular',
    marginBottom:15
  },
  start_today_trip_btn:{
    width:250,
    height:50,
    borderRadius:15,
    marginBottom:20,
    alignItems:'center',
    justifyContent:'center',
    backgroundColor:colors.BLUE
  },
  start_today_trip_btn_text:{
    lineHeight:50,
    fontSize:16,
    fontFamily: 'Cairo_400Regular',
    color:colors.WHITE
  },
  scrollViewContainer:{
    height:60,
    width:'100%',
    position:'absolute',
    top:40,
    left:0,
    zIndex:100,
    alignItems:'center',
    justifyContent:'center',
  },
  line_name_buttons_container:{
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'center',
  },
  line_name_button:{
    backgroundColor:colors.WHITE,
    borderColor:'#ddd',
    borderWidth:1,
    minWidth:150,
    height:40,
    borderRadius:15,
    alignItems:'center',
    justifyContent:'center',
    marginHorizontal: 5
  },
  line_name_button_text:{
    lineHeight:40,
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    fontSize:13,
  },
  active_line_name_button:{
    backgroundColor:colors.PRIMARY,
    borderColor:colors.PRIMARY,
  },
  active_line_name_button_text:{
    color:colors.WHITE,
    fontFamily: 'Cairo_700Bold',
  },
  student_info_container:{
    flex:1,
    height:SCheight,
    alignItems:'center',
    justifyContent:'center',
  },
})