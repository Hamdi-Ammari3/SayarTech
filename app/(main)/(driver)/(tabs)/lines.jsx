import { useState,useEffect } from 'react'
import { StyleSheet,Text,View,ActivityIndicator,Image,ScrollView,TouchableOpacity,Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { writeBatch,doc } from "firebase/firestore"
import { DB } from '../../../../firebaseConfig'
import LottieView from "lottie-react-native"
import { useDriverData } from '../../../stateManagment/DriverContext'
import { useUser } from '@clerk/clerk-expo'
import dayjs from '../../../../utils/dayjs'
import colors from '../../../../constants/Colors'
import logo from '../../../../assets/images/logo.jpg'
import startEngineImage from '../../../../assets/images/push-button.png'
import LinePage from '../../../../components/LinePage'
import addDataAnimation from '../../../../assets/animations/adding_data.json'
import driverWaiting from '../../../../assets/animations/waiting_driver.json'

const lines = () => {
  const {userData,fetchingUserDataLoading,driverData,fetchingDriverDataLoading} = useDriverData()
  const { isLoaded } = useUser()
  const router = useRouter()
  
  const [selectedLine,setSelectedLine] = useState(0)
  const [todayDate, setTodayDate] = useState("")
  const [journeyStarted, setJourneyStarted] = useState(false)
  const [startJourneyLoading,setStartJourneyLoading] = useState(false)

  const driverDailyTracking = driverData[0]?.dailyTracking || {}

  //Redirect to add data screen
  const redirectToAddDataPage = () => {
    router.push({
      pathname:"/addDriverData",
      params: {
        driverName: userData.user_full_name,
        driverFamily:userData.user_family_name,
        driverUserId:userData.user_id,
        driverPhone:userData.phone_number,
        driverNotification:userData.user_notification_token,
      }
    })
  }

  //Redirect to add data screen
  const redirectToFindLinesPage = () => {
    router.push({
      pathname:"/driverAddNewLine",
      params: {
        driverData: JSON.stringify(driverData[0])
      }
    })
  }
  
  // Find the today date
  useEffect(() => {
    const getTodayDate = () => {
      const iraqNow = dayjs().utcOffset(180);

      // Keys for dailyTracking
      const yearMonthKey = `${iraqNow.year()}-${String(iraqNow.month() + 1).padStart(2, "0")}`;
      const dayKey = String(iraqNow.date()).padStart(2, "0");

      // Check if today’s journey started
      const dailyTracking = driverData[0]?.dailyTracking || {};
      const journeyCheck = dailyTracking?.[yearMonthKey]?.[dayKey]?.start_the_journey || false;
      setJourneyStarted(journeyCheck);

      // Display Arabic-formatted date string
      const iraqDate = new Date(iraqNow.format('YYYY-MM-DD'));
      const options = { weekday: "long", day: "2-digit", month: "long", year: "numeric" };
      const formattedDate = iraqDate.toLocaleDateString("ar-IQ", options);
      setTodayDate(formattedDate);
    };

    getTodayDate();
  }, [driverDailyTracking]);

  // Handle notification sending
  const sendNotification = async (token, title, body) => {
    try {
      const message = {
        to: token,
        sound: 'default',
        title: title,
        body: body 
      };

      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });
    } catch (error) {
      console.log("Error sending notification:", error);
    }
  }

  const startTodayJourney = async () => {
    try {
      setStartJourneyLoading(true);
      const batch = writeBatch(DB);
      const driverRef = doc(DB, "drivers", driverData[0].id);

      // Use dayjs for today's Iraq time
      const iraqNow = dayjs().utcOffset(180);
      const yearMonthKey = `${iraqNow.year()}-${String(iraqNow.month() + 1).padStart(2, "0")}`;
      const dayKey = String(iraqNow.date()).padStart(2, "0");
      const todayIndex = iraqNow.day(); // 0 = Sunday

      const iraqiTodayDateOnly = iraqNow.format("YYYY-MM-DD");

      // Convert Firestore Timestamp to "YYYY-MM-DD" string
      const toDateOnly = (timestamp) => dayjs(timestamp.toDate()).tz("Asia/Baghdad").format("YYYY-MM-DD");

      // Step 1: Filter active lines for today
      const activeLinesToday = driverData[0].lines
        .map((line) => {
          const todaySchedule = line.timeTable?.find((d) => d.dayIndex === todayIndex);

          // 1. Exclude if subs driver handles it today
          if (line.subs_driver && line.desactive_periode) {
            const start = toDateOnly(line.desactive_periode.start);
            const end = toDateOnly(line.desactive_periode.end);
            if (iraqiTodayDateOnly >= start && iraqiTodayDateOnly <= end) return null;
          }

          // 2. Exclude if active period has not started or ended
          if (line.original_driver && line.active_periode) {
            const start = toDateOnly(line.active_periode.start);
            const end = toDateOnly(line.active_periode.end);
            if (iraqiTodayDateOnly < start || iraqiTodayDateOnly > end) return null;
          }

          // 3. Filter riders with active subscription
          const validRiders = (line.riders || []).filter((rider) => {
            if (!rider.service_period || !rider.service_period.end_date) return false;

            //const start = toDateOnly(rider.service_period.start_date);
            const end = toDateOnly(rider.service_period.end_date);

            return iraqiTodayDateOnly <= end;
          });

          if (!todaySchedule?.active || validRiders.length === 0) return null;

          return {
            ...line,
            riders: validRiders,
          };
        })
        .filter(Boolean); // Remove nulls

      if (activeLinesToday.length === 0) {
        alert("لا يوجد خطوط لهذا اليوم");
        setStartJourneyLoading(false);
        return;
      }

      // Step 2: Sort active lines by today's start time
      const getTodayStartTimeInMinutes = (line) => {
        const schedule = line.timeTable?.find((d) => d.dayIndex === todayIndex);
        if (!schedule?.startTime) return Infinity;
        const start = dayjs(schedule.startTime.toDate()).tz("Asia/Baghdad");
        return start.hour() * 60 + start.minute();
      };
      activeLinesToday.sort((a, b) => getTodayStartTimeInMinutes(a) - getTodayStartTimeInMinutes(b));

      // Step 3: Load or initialize dailyTracking
      const existingTracking = driverData[0].dailyTracking || {};
      if (!existingTracking[yearMonthKey]) existingTracking[yearMonthKey] = {};
      if (!existingTracking[yearMonthKey][dayKey]) {
        existingTracking[yearMonthKey][dayKey] = { start_the_journey: null };
      }

      if (existingTracking[yearMonthKey][dayKey].start_the_journey) {
        alert("لقد بدأت رحلتك بالفعل اليوم.");
        setStartJourneyLoading(false);
        return;
      }

      const iraqStartTime = iraqNow.format("HH:mm");

      // Step 4: Build today_lines array for tracking
      const todayTrackingLines = activeLinesToday.map((line) => ({
        id: line.id,
        name: line.name,
        first_phase: {
          destination: line.destination,
          destination_location: line.destination_location,
          phase_finished: false,
          riders: line.riders.map((rider) => ({
            id: rider.id,
            name: rider.name,
            family_name: rider.family_name,
            home_location: rider.home_location || null,
            notification_token: rider.notification_token || null,
            phone_number: rider.phone_number || null,
            checked_at_home:false,
            picked_up: false,
          })),
        },
        second_phase: {
          phase_finished: false,
          riders: line.riders.map((rider) => ({
            id: rider.id,
            name: rider.name,
            family_name: rider.family_name,
            home_location: rider.home_location || null,
            notification_token: rider.notification_token || null,
            phone_number: rider.phone_number || null,
            dropped_off: false,
          })),
        },
      }));

      existingTracking[yearMonthKey][dayKey] = {
        start_the_journey: iraqStartTime,
        today_lines: todayTrackingLines,
      };

      // Step 5: Update Firestore
      batch.update(driverRef, {
        dailyTracking: existingTracking,
      });

      // Step 6: Reset trip status for all valid riders
      for (const line of activeLinesToday) {
        for (const rider of line.riders) {
          const riderRef = doc(DB, "riders", rider.id);
          batch.update(riderRef, {
            trip_status: "at home",
            checked_at_home:false,
            picked_up: false,
          });
        }
      }

      // Step 7: Notify all riders inside today's active lines
      for (const line of activeLinesToday) {
        for (const rider of line.riders) {
          if (rider.notification_token) {
            await sendNotification(
              rider.notification_token,
              "تنبيه الرحلة",
              `بدأ السائق رحلته اليوم في خط ${line.name}، يرجى الاستعداد`
            );
          }
        }
      }

      await batch.commit();
    } catch (error) {
      alert("حدث خطأ أثناء بدء الرحلة.");
      console.log("startTodayJourney error", error);
    } finally {
      setStartJourneyLoading(false);
    }
  };

  //Loading State
  if( !isLoaded || fetchingDriverDataLoading || fetchingUserDataLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.spinner_error_container}>
          <ActivityIndicator size="large" color={colors.PRIMARY} />
        </View>
      </SafeAreaView>
    )
  }

  // Driver haven't yet added his info
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
          <View style={styles.no_lines_box}>
            <Text style={styles.no_lines_text}>الرجاء اضافة بياناتك</Text>
            <TouchableOpacity style={styles.add_data_button} onPress={redirectToAddDataPage}>
              <Text style={styles.add_data_button_text}>اضف الآن</Text>
            </TouchableOpacity>
          </View>
        </View>        
      </SafeAreaView>
    )
  }

  // Driver service type not lines
  if(driverData?.length > 0 && driverData[0]?.service_type !== "خطوط") {
    return(
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
          <View>
            <Text style={styles.service_unavailable_text}>هذه الخدمة غير متوفرة في حسابك</Text>
          </View>
        </View>  
      </SafeAreaView>
    )
  }

  // Driver have no lines in his account
  if(
      driverData?.length > 0 && 
      driverData[0]?.service_type === "خطوط" &&
      driverData[0]?.lines?.length === 0
  ) {
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
          <View style={styles.no_lines_box}>
            <Text style={styles.no_lines_text}>لا يوجد خطوط في حسابك</Text>
            <TouchableOpacity style={styles.add_data_button} onPress={redirectToFindLinesPage}>
              <Text style={styles.add_data_button_text}>اضف الآن</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  // if the driver didnt start the today journey
  if(
      driverData?.length > 0 && 
      driverData[0]?.service_type === "خطوط" &&
      driverData[0]?.lines?.length > 0 && 
      journeyStarted === false
  ) {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.start_today_trip_container}>
          <View style={styles.logo}>
            <Image source={logo} style={styles.logo_image}/>
          </View>
          <View style={styles.start_today_trip_box}>
            <Text style={styles.today_date_text}>{todayDate}</Text>
            <View style={styles.start_trip_container}>
              <TouchableOpacity 
                onPress={() => startTodayJourney()}
                disabled={startJourneyLoading}
              >
                <Image source={startEngineImage} style={styles.start_engine_image}/>
              </TouchableOpacity>
              <Text style={styles.start_trip_text}>
                {startJourneyLoading ? '...' : 'ابدأ خطوط اليوم'}
              </Text>
            </View>   
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
          {driverData[0]?.dailyTracking && (() => {
            const iraqNow = dayjs().utcOffset(180);
            const yearMonthKey = `${iraqNow.year()}-${String(iraqNow.month() + 1).padStart(2, "0")}`;
            const dayKey = String(iraqNow.date()).padStart(2, "0");

            const todayLines = driverData[0]?.dailyTracking?.[yearMonthKey]?.[dayKey]?.today_lines || []

            return todayLines
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
                    {li.name}
                  </Text>
                </TouchableOpacity>
              ))
          })()}
        </ScrollView>
      </View>
      <View style={styles.student_info_container}>
        {(() => {
          const iraqNow = dayjs().utcOffset(180);
          const yearMonthKey = `${iraqNow.year()}-${String(iraqNow.month() + 1).padStart(2, "0")}`;
          const dayKey = String(iraqNow.date()).padStart(2, "0");
  
          const todayLines = driverData[0]?.dailyTracking?.[yearMonthKey]?.[dayKey]?.today_lines || []

          return todayLines[selectedLine] && (
            <LinePage
              key={todayLines[selectedLine].id}
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

export default lines

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
  add_data_button: {
    width:110,
    height:40,
    marginTop:0,
    justifyContent:'center',
    alignItems:'center',
    backgroundColor:'rgba(190, 154, 78, 0.30)',
    borderColor:colors.BLACK,
    borderWidth:1,
    borderRadius: 15,
  },
  add_data_button_text: {
    fontSize: 14,
    fontFamily: 'Cairo_700Bold',
    lineHeight: 35,
  },
  service_unavailable_text:{
    width:300,
    lineHeight:40,
    borderRadius:15,
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    backgroundColor:colors.GRAY
  },
  no_lines_box:{
    width:'100%',
    height:100,
    justifyContent:'center',
    alignItems:'center',
  },
  no_lines_text: {
    fontFamily: 'Cairo_400Regular',
    lineHeight:50,
  },
  start_today_trip_container:{
    width:'100%',
    alignItems:'center',
    justifyContent:'center',
  },
  start_today_trip_box:{
    height:300,
    marginTop:25,
    alignItems:'center',
    justifyContent:'center',
  },
  today_date_text:{
    fontFamily: 'Cairo_400Regular',
    fontSize:16,
    marginBottom:10,
  },
  start_trip_container:{
    height:200,
    alignItems:'center',
    justifyContent:'center',
  },
  start_engine_image:{
    height:130,
    width:130,
    resizeMode:'contain',
  },
  start_trip_text:{
    width:180,
    marginTop:20,
    textAlign:'center',
    fontFamily: 'Cairo_700Bold', 
    fontSize:16,
  },
  scrollViewContainer:{
    height:50,
    marginTop:20,
    width:'100%',
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
    backgroundColor:'rgba(190, 154, 78, 0.30)',
    borderColor:colors.BLACK,
  },
  active_line_name_button_text:{
    color:colors.BLACK,
    fontFamily: 'Cairo_700Bold',
  },
  student_info_container:{
    width:SCwidth,
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