import { useState,useEffect } from 'react'
import { StyleSheet,Text,View,ActivityIndicator,Image,ScrollView,TouchableOpacity,Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link } from 'expo-router'
import { writeBatch, doc } from "firebase/firestore"
import { DB } from '../../../../firebaseConfig'
import LottieView from "lottie-react-native"
import { useDriverData } from '../../../stateManagment/DriverContext'
import { useUser } from '@clerk/clerk-expo'
import colors from '../../../../constants/Colors'
import logo from '../../../../assets/images/logo.jpg'
import LinePage from '../../../../components/LinePage'
import addDataAnimation from '../../../../assets/animations/adding_data.json'
import driverWaiting from '../../../../assets/animations/waiting_driver.json'

// use Toast message instead of alerts

const Home = () => {
  const {driverData,fetchingDriverDataLoading} = useDriverData()
  const { isLoaded } = useUser()
  const [selectedLine,setSelectedLine] = useState(0)
  const [todayDate, setTodayDate] = useState("")
  const [journeyStarted, setJourneyStarted] = useState(false)
  const [startJouneyLoading,setStartJouneyLoading] = useState(false)
  const [jouneyCompleted,setJouneyCompleted] = useState(false)

  // Find the today date
  useEffect(() => {
    const getTodayDate = () => {
      const iraqTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Baghdad" });
      const [month, day, year] = iraqTime.split(/[/, ]/); // Extract parts manually
      const iraqDate = new Date(`${year}-${month}-${day}T00:00:00`); // Construct valid date

      const options = { weekday: "long", day: "2-digit", month: "long", year: "numeric" };
      const formattedDate = iraqDate.toLocaleDateString("ar-IQ", options);
      setTodayDate(formattedDate);

      // Extract year-month and day keys for tracking
      const yearMonthKey = `${year}-${month.padStart(2, "0")}`; // "YYYY-MM"
      const dayKey = day.padStart(2, "0"); // "DD"

      // Check if today's journey has started
      const dailyTracking = driverData?.[0]?.dailyTracking || {};
      const journeyCheck = dailyTracking?.[yearMonthKey]?.[dayKey]?.start_the_journey || false;
      const completeJouneyCheck = dailyTracking?.[yearMonthKey]?.[dayKey]?.complete_today_journey;
      setJourneyStarted(journeyCheck);
      setJouneyCompleted(completeJouneyCheck)
    };

    getTodayDate();
  }, [driverData[0]])

  // Start the today jouney  
  const startTodayJourney = async () => {
    try {
      setStartJouneyLoading(true);
      const batch = writeBatch(DB);
      const driverRef = doc(DB, "drivers", driverData[0].id);

      const iraqTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Baghdad" });
      const [month, day, year] = iraqTime.split(/[/, ]/);
      const iraqDate = new Date(`${year}-${month}-${day}T00:00:00`);
      const iraqiTodayDate = new Date().toLocaleDateString("fr-CA", { timeZone: "Asia/Baghdad" });

      const yearMonthKey = `${year}-${month.padStart(2, "0")}`; // "YYYY-MM"
      const dayKey = day.padStart(2, "0"); // "DD"
      const todayIndex = iraqDate.getDay() // day index from 0 to 6
    
      // Function to get YYYY-MM-DD from Firestore timestamp
      const toDateOnlyString = (timestamp) => new Date(timestamp.seconds * 1000).toISOString().split("T")[0];

      // Filter valid lines for today
      const activeLinesToday = driverData[0].line.filter((line) => {
        const todaySchedule = line.lineTimeTable?.find((day) => day.dayIndex === todayIndex);

        // Skip line if substitute driver is handling it today
        if (line.subs_driver && line.desactive_periode) {
          const { start, end } = line.desactive_periode;
          const startDate = toDateOnlyString(start);
          const endDate = toDateOnlyString(end);
          if (iraqiTodayDate >= startDate && iraqiTodayDate <= endDate) {
            return false; // Don't include this line today
          }
        }

        // Skip line if its active_periode has not started yet
        if (line.original_driver && line.active_periode) {
          const { start, end } = line.active_periode;
          const startDate = toDateOnlyString(start);
          const endDate = toDateOnlyString(end);

          // If today is before the start of the active period, exclude it
          if (iraqiTodayDate < startDate) {
            return false;
          }

          // If the active period has ended, exclude it (but don't delete it)
          if (iraqiTodayDate > endDate) {
            return false;
          }
        }

        // Include only active lines with students
        return todaySchedule?.active && line.riders.length > 0;
      });
  
      if (activeLinesToday.length === 0) {
        alert("لا يوجد خطوط لهذا اليوم");
        setStartJouneyLoading(false)
        return;
      }

      const getTodayStartTimeInMinutes = (line) => {
        const todaySchedule = line.lineTimeTable?.find((d) => d.dayIndex === todayIndex);
        if (!todaySchedule?.startTime) return Infinity;
        const date = new Date(todaySchedule.startTime.seconds * 1000);
        return date.getHours() * 60 + date.getMinutes();
      };
  
      // Sort active lines by start time
      activeLinesToday.sort((a, b) => getTodayStartTimeInMinutes(a) - getTodayStartTimeInMinutes(b))
  
      // Get existing tracking object
      const existingTracking = driverData[0].dailyTracking || {};
      if (!existingTracking[yearMonthKey]) existingTracking[yearMonthKey] = {};
      if (!existingTracking[yearMonthKey][dayKey]) {
        existingTracking[yearMonthKey][dayKey] = { start_the_journey: null };
      }

      // Prevent resetting if journey already started
      if (existingTracking[yearMonthKey][dayKey].start_the_journey) {
        alert("لقد بدأت رحلتك بالفعل اليوم.")
        setStartJouneyLoading(false)
        return;
      }

      // Store the start journey event
      const iraqRealTime = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Baghdad", hour12: false }).slice(0, 5); // "HH:MM"

      // Build today's tracking lines with status
      const todayTrackingLines = activeLinesToday.map((line, index) => {
        return {
          id: line.id,
          lineName: line.lineName,
          line_destination: line.line_destination,
          line_destination_location: line.line_destination_location,
          line_index: index + 1,
          line_active: index === 0, // First line is active
          current_trip: "first",
          first_trip_started: false,
          first_trip_finished: false,
          second_trip_started: false,
          second_trip_finished: false,
          riders: line.riders.map((rider) => ({
            id: rider.id,
            name: rider.name,
            notification_token: rider.notification_token || null,
            phone_number: rider.phone_number || null,
            home_location: rider.home_location || null,
            picked_up: false,
            checked_in_front_of_school: false,
            picked_from_school: false,
            dropped_off: false,
          })),
        };
      });

      existingTracking[yearMonthKey][dayKey] = {
        start_the_journey: iraqRealTime,
        complete_today_journey: false,
        today_lines: todayTrackingLines,
      };
  
      // Update Firestore with batch
      batch.update(driverRef, {
        dailyTracking: existingTracking,
      });

      // Reset trip status for all riders in today's active lines
      for (const line of activeLinesToday) {
        for (const rider of line.riders) {
          const riderRef = doc(DB, 'riders', rider.id);
          batch.update(riderRef, {
            trip_status: 'at home',
            picked_up: false
          });
        }
      }
  
      // Commit batch updates
      await batch.commit();

    } catch (error) {
      alert("حدث خطأ أثناء بدء الرحلة.");
      console.log(error)
    } finally {
      setStartJouneyLoading(false)
    }
  }
  
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
  
  // if the driver haven't yet added his info
  if(!driverData?.length) {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.add_your_data_container}>
          <View style={styles.logo}>
            <Image source={logo} style={styles.logo_image}/>
          </View>
          <View style={styles.animation_container}>
            <LottieView
              source={addDataAnimation}
              autoPlay
              loop
              style={{ width: 200, height: 200}}
            />
          </View>
          <View style={styles.add_your_data_text_container}>
            <Text style={styles.add_your_data_text}>الرجاء اضافة بياناتك</Text>
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
        <View style={styles.add_your_data_container}>
          <View style={styles.logo}>
            <Image source={logo} style={styles.logo_image}/>
          </View>
          <View style={styles.animation_container}>
            <LottieView
              source={driverWaiting}
              autoPlay
              loop
              style={{ width: 250, height: 250}}
            />
          </View>
          <View style={styles.no_assigned_students_box}>
            <Text style={styles.no_student_text}>جاري ربط حسابك بركاب</Text>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  // if the driver didnt start the today journey
  if(driverData?.length > 0 && driverData[0].line.length > 0 && journeyStarted === false) {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.no_driver_data_container}>
          <View style={styles.logo}>
            <Image source={logo} style={styles.logo_image}/>
          </View>
          
          <View style={styles.start_today_trip_container}>
            <Text style={styles.today_date_text}>{todayDate}</Text>
            {startJouneyLoading ? (
              <View style={styles.start_today_trip_btn}>
                <ActivityIndicator size="large" color={colors.WHITE} />
              </View>
            ) : (
              <TouchableOpacity style={styles.start_today_trip_btn} onPress={() => startTodayJourney()}>
                <Text style={styles.start_today_trip_btn_text}>ابدا خطوط اليوم</Text>
              </TouchableOpacity> 
            )}
          </View>
        </View>
      </SafeAreaView>
    )
  }

  // if the driver start and complete successuflly the today jouney
  if(driverData?.length > 0 && driverData[0].line.length > 0 && journeyStarted !== false && jouneyCompleted === true) {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.no_driver_data_container}>
          <View style={styles.logo}>
            <Image source={logo} style={styles.logo_image}/>
          </View>
          
          <View style={styles.start_today_trip_container}>
            <Text style={styles.today_date_text}>{todayDate}</Text>
            <Text style={styles.today_trip_completed_text}>لقد انهيت رحلات اليوم بنجاح</Text>
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
          {driverData?.[0]?.dailyTracking && (() => {
            const iraqTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Baghdad" });
            const [month, day, year] = iraqTime.split(/[/, ]/);
            const yearMonthKey = `${year}-${month.padStart(2, "0")}`;
            const dayKey = day.padStart(2, "0") || "01"; // fallback

            const todayLines = (
              driverData[0]?.dailyTracking?.[yearMonthKey]?.[dayKey]?.today_lines || []
            ).filter(line => {
              const isCompleted = line.second_trip_finished === true;
              return !isCompleted;
            });

            return todayLines
              .sort((a, b) => (a.line_index || 999) - (b.line_index || 999))
              .map((li,index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.line_name_button,
                    selectedLine === index && styles.active_line_name_button,
                  ]}
                  onPress={() => setSelectedLine(index)}
                >
                  <Text
                    style={[
                      styles.line_name_button_text,
                      selectedLine === index && styles.active_line_name_button_text, // Apply active text style if selected
                    ]}
                  >
                    {li.lineName}
                  </Text>
                </TouchableOpacity>
              ))
          })()}
        </ScrollView>
      </View>
      <View style={styles.student_info_container}>
        {(() => {
          const iraqTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Baghdad" });
          const [month, day, year] = iraqTime.split(/[/, ]/);
          const yearMonthKey = `${year}-${month.padStart(2, "0")}`;
          const dayKey = day.padStart(2, "0");
  
          const todayLines = (
            driverData[0]?.dailyTracking?.[yearMonthKey]?.[dayKey]?.today_lines || []
          ).filter(line => {
            const isCompleted =
              line.second_trip_finished === true;
            return !isCompleted;
          });

          return todayLines[selectedLine] && (
            <LinePage
              line={todayLines[selectedLine]}
              selectedLine={selectedLine}
              todayLines = {todayLines}
            />
          )
        })()}
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
  add_your_data_container:{
    width:'100%',
    alignItems:'center',
    justifyContent:'center',
  },
  logo:{
    width:'100%',
    height:200,
    alignItems:'center',
    justifyContent:'center',
  },
  logo_image:{
    height:180,
    width:180,
    resizeMode:'contain',
  },
  animation_container:{
    width:200,
    height:200,
    justifyContent:'center',
    alignItems:'center',
    marginTop:25,
  },
  add_your_data_text_container:{
    width:'100%',
    height:200,
    justifyContent:'center',
    alignItems:'center',
  },
  add_your_data_text:{
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
  no_driver_data: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  no_driver_data_container:{
    height:430,
    paddingTop:30,
    alignItems:'center',
    justifyContent:'space-between',
  },
  no_assigned_students_box:{
    width:'100%',
    height:100,
    justifyContent:'center',
    alignItems:'center',
  },
  no_student_text: {
    fontFamily: 'Cairo_700Bold',
    color:colors.BLACK,
    lineHeight:100
  },
  start_today_trip_container:{
    height:100,
    alignItems:'center',
    justifyContent:'space-between',
  },
  today_date_text:{
    fontFamily: 'Cairo_400Regular',
    fontSize:16,
  },
  today_trip_completed_text:{
    width:220,
    height:50,
    backgroundColor:colors.WHITE,
    borderColor:colors.BLACK,
    borderWidth:1,
    verticalAlign:'middle',
    borderRadius:15,
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    fontSize:16,
  },
  start_today_trip_btn:{
    width:220,
    height:50,
    borderRadius:15,
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
  spinner_error_container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
})