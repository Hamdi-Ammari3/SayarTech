import { useState,useEffect } from 'react'
import { StyleSheet,Text,View,ActivityIndicator,Image,ScrollView,TouchableOpacity,Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { writeBatch,doc } from "firebase/firestore"
import { DB } from '../../../../firebaseConfig'
import LottieView from "lottie-react-native"
import { useDriverData } from '../../../stateManagment/DriverContext'
import { useUser } from '@clerk/clerk-expo'
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
      const dailyTracking = driverData[0]?.dailyTracking || {};
      const journeyCheck = dailyTracking?.[yearMonthKey]?.[dayKey]?.start_the_journey || false;
      setJourneyStarted(journeyCheck);
    };
  
    getTodayDate();
  }, [driverDailyTracking])

  // Start the today jouney  
  const startTodayJourney = async () => {
    try {
      setStartJourneyLoading(true);
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
      const activeLinesToday = driverData[0].lines.filter((line) => {
        const todaySchedule = line.timeTable?.find((day) => day.dayIndex === todayIndex);

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
        return todaySchedule?.active && line.riders?.length > 0;
      });
  
      if (activeLinesToday?.length === 0) {
        alert("لا يوجد خطوط لهذا اليوم");
        setStartJourneyLoading(false)
        return;
      }

      const getTodayStartTimeInMinutes = (line) => {
        const todaySchedule = line.timeTable?.find((d) => d.dayIndex === todayIndex);
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
        setStartJourneyLoading(false)
        return;
      }

      // Store the start journey event
      const iraqRealTime = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Baghdad", hour12: false }).slice(0, 5); // "HH:MM"

      // Build today's tracking lines with status
      const todayTrackingLines = activeLinesToday.map((line) => {
        return {
          id: line.id,
          name: line.name,   
          first_phase:{
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
        };
      });

      existingTracking[yearMonthKey][dayKey] = {
        start_the_journey: iraqRealTime,
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
      console.log('error', error)
    } finally {
      setStartJourneyLoading(false)
    }
  }

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

  //if the driver have no lines in his account
  if(driverData?.length > 0 && driverData[0]?.lines?.length === 0) {
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
  if(driverData?.length > 0 && driverData[0]?.lines?.length > 0 && journeyStarted === false) {
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
            const iraqTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Baghdad" });
            const [month, day, year] = iraqTime.split(/[/, ]/);
            const yearMonthKey = `${year}-${month.padStart(2, "0")}`;
            const dayKey = day.padStart(2, "0") || "01"; // fallback

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
          const iraqTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Baghdad" });
          const [month, day, year] = iraqTime.split(/[/, ]/);
          const yearMonthKey = `${year}-${month.padStart(2, "0")}`;
          const dayKey = day.padStart(2, "0");
  
          const todayLines = driverData[0]?.dailyTracking?.[yearMonthKey]?.[dayKey]?.today_lines || []

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

/*
// Get today date in YYYY-MM-DD format (Baghdad timezone)
  const getTodayDate = () => {
    const iraqiTodayDate = new Date().toLocaleDateString("en-US", { timeZone: "Asia/Baghdad" }); // YYYY-MM-DD
    const [month, day, year] = iraqiTodayDate.split(/[/, ]/); // Extract parts manually
    const iraqDate = new Date(`${year}-${month}-${day}T00:00:00`); // Construct valid date
    const options = { weekday: "long", day: "2-digit", month: "long", year: "numeric" };
    const formattedDate = iraqDate.toLocaleDateString("ar-IQ", options);
    setTodayDate(formattedDate);
    return iraqiTodayDate;
  };

  // Check if today's journey has started
  const checkIfJourneyStarted = async () => {
    if (!driverId) return;
    const todayKey = getTodayDate();
    const todayLines = driverData?.[0]?.todayLines || {};
    const todayLineEntry = todayLines[todayKey];

    if (todayLineEntry && todayLineEntry[0].today_line_id) {
      setJourneyStarted(true);
    } else {
      setJourneyStarted(false);
    }
  };

  // Check journey status
  useEffect(() => {
    checkIfJourneyStarted()
  }, [driverId])

  // Start the today jouney  
  const startTodayJourney = async () => {
    try {
      setStartJourneyLoading(true)
      const batch = writeBatch(DB)
      const driverRef = doc(DB, "drivers", driverData[0]?.id)

      const iraqiTodayDate = new Date().toLocaleDateString("en-US", { timeZone: "Asia/Baghdad" })
      const [month, day, year] = iraqiTodayDate.split(/[/, ]/)
      const iraqDate = new Date(`${year}-${month}-${day}T00:00:00`)
      const todayIndex = iraqDate.getDay()

      // Fetch all line documents referenced by driver
      const lineIds = driverData[0]?.lines || [];
      const activeLinesToday = [];

      for (const lineId of lineIds) {
        const lineRef = doc(DB, 'lines', lineId)
        const lineDoc = await getDoc(lineRef)
        if (!lineDoc.exists()) continue

        const lineData = lineDoc.data();
        const todaySchedule = lineData.timeTable?.find(dayObj => dayObj.dayIndex === todayIndex);

        if (todaySchedule?.active && lineData.riders?.length > 0) {
          activeLinesToday.push({ id: lineId, ...lineData });
        }
      }

      if (activeLinesToday.length === 0) {
        Alert.alert('لا يوجد خطوط نشطة لهذا اليوم');
        setStartJourneyLoading(false);
        return;
      }

      // Sort active lines by today start time
      const getTodayStartTimeInMinutes = (line) => {
        const todaySchedule = line.timeTable?.find(d => d.dayIndex === todayIndex);
        if (!todaySchedule?.startTime) return Infinity;
        const date = new Date(todaySchedule.startTime.seconds * 1000);
        return date.getHours() * 60 + date.getMinutes();
      }

      activeLinesToday.sort((a, b) => getTodayStartTimeInMinutes(a) - getTodayStartTimeInMinutes(b))
      const todayLineDocIds = {}

      for (const line of activeLinesToday) {
        const newTodayLineRef = doc(collection(DB, 'todayLines'))
        const todayLineData = {
          date: iraqiTodayDate,
          line_id: line.id,
          line_name: line.name,
          destination: line.destination,
          driver_initiated_id: driverId,
          first_phase: {
            destination_location: line.destination_location,
            driver_id: null,
            phase_finished: false,
            riders: line.riders.map((rider) => ({
              id: rider.id,
              name: rider.name,
              family_name:rider.family_name,
              notification_token: rider.notification_token || null,
              phone_number: rider.phone_number || null,
              home_location: rider.home_location || null,
              picked_up: false,
            })),
          },
          second_phase: {
            driver_id: null,
            phase_finished: false,
            riders:[]
          }
        }

        batch.set(newTodayLineRef, todayLineData)
        todayLineDocIds[line.id] = newTodayLineRef.id

        // Safely update the line's dailyStatus object
        const lineRef = doc(DB, 'lines', line.id)
        const lineSnap = await getDoc(lineRef)
        if (!lineSnap.exists()) continue

        const existingDailyStatus = lineSnap.data().dailyStatus || {}
        existingDailyStatus[iraqiTodayDate] = newTodayLineRef.id

        batch.update(lineRef, {
          dailyStatus: existingDailyStatus
        }) 
      }

      // Safely update the driver’s todayLines object
      const driverSnap = await getDoc(driverRef);
      if (!driverSnap.exists()) throw new Error("Driver doc not found");
      const existingTodayLines = driverSnap.data().todayLines || {};

      const todayLineArray = []
      for (const line of activeLinesToday) {
        todayLineArray.push({
          today_line_id: todayLineDocIds[line.id],
          //paycheck: 0,
          //payed: false,
          //phases: []
        });
      }

      // Update just the date key inside todayLines
      existingTodayLines[iraqiTodayDate] = todayLineArray;

      batch.update(driverRef, {
        todayLines: existingTodayLines
      });

      // Reset all riders’ trip_status
      for (const line of activeLinesToday) {
        for (const rider of line.riders) {
          const riderRef = doc(DB, 'riders', rider.id);
          batch.update(riderRef, {
            trip_status: 'at home',
            picked_up: false,
          });
        }
      }
  
      // Commit batch updates
      await batch.commit();

    } catch (error) {
      alert("حدث خطأ أثناء بدء الرحلة.");
      console.log('error', error)
    } finally {
      setStartJourneyLoading(false)
    }
  }
*/
