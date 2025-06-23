import {Alert,StyleSheet,Text,View,ActivityIndicator,Image,TouchableOpacity,FlatList,Modal} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {useEffect,useState,useRef} from 'react'
import { useLocalSearchParams,useRouter  } from 'expo-router'
import { useLinesData } from '../stateManagment/LinesContext'
import MapView, { Marker } from 'react-native-maps'
import colors from '../../constants/Colors'
import { doc,writeBatch,arrayUnion,Timestamp,getDocs,collection} from 'firebase/firestore'
import {DB} from '../../firebaseConfig'
import { Dropdown } from 'react-native-element-dropdown'
import LottieView from "lottie-react-native"
import logo from '../../assets/images/logo.jpg'
import driverWaiting from '../../assets/animations/waiting_driver.json'
import AntDesign from '@expo/vector-icons/AntDesign'
import FontAwesome5 from '@expo/vector-icons/FontAwesome5'

const driverAddNewLine = () => {
  const mapRef = useRef(null)
  const router = useRouter()
  const {lines,fetchingLinesLoading} = useLinesData()
  const {driverData} = useLocalSearchParams()
  const parsedDriverData = JSON.parse(driverData)
  
  const [institutions, setInstitutions] = useState([])
  const [fetchingInstitutions, setFetchingInstitutions] = useState(true)
  const [groupedLines,setGroupedLines] = useState([])
  const [availableDestinations, setAvailableDestinations] = useState([])
  const [selectedDestination, setSelectedDestination] = useState(null)
  const [showLineDetailsModal,setShowLineDetailsModal] = useState(false)
  const [selectedLine,setSelectedLine] = useState(null)
  const [assigningLineLoading,setAssigningLineLoading] = useState(false)

  const createAlert = (alerMessage) => {
    Alert.alert(alerMessage)
  }

  //Come back to home screen
  const comeBackToHome = () => {
    router.push('/(driver)/(tabs)/home')
  }

  //Fetch B2B institutions
  useEffect(() => {
    const fetchInstitutions = async () => {
      try {
        const snapshot = await getDocs(collection(DB, 'institutions'));
        const fetchedInstitutions = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setInstitutions(fetchedInstitutions);
      } catch (error) {
        console.error("Failed to fetch institutions:", error);
      } finally {
        setFetchingInstitutions(false);
      }
    }
    fetchInstitutions()
  }, [])

  // Fetch available lines
  useEffect(() => {
    if (!parsedDriverData || fetchingLinesLoading) return;

    const carType = parsedDriverData.car_type;

    // Step 1: Filter available lines matching driver's car type
    const filtered = lines.filter(
      (line) => !line.driver_id && line.line_type === carType && line.riders.length > 0
    )

    // Step 2: Group lines by destination
    const grouped = filtered.reduce((acc, line) => {
      const dest = line.destination;

      // Calculate total monthly amount for this line
      const monthlyAmount = (line.riders || []).reduce((sum, rider) => {
        return sum + (rider.driver_commission || 0);
      }, 0);

      const lineWithTotal = { ...line, monthlyAmount };

      if (!acc[dest]) acc[dest] = [];
      acc[dest].push(lineWithTotal);
      return acc;
    }, {});

    // Convert object to array format for FlatList
    const groupedArray = Object.entries(grouped);
    setGroupedLines(groupedArray);

    // Extract unique destinations for dropdown
    const uniqueDestinations = Object.keys(grouped).map(dest => ({ name: dest }));
    setAvailableDestinations(uniqueDestinations);

  }, [lines]);

  // Open line details modal
  const handleLineDetailsPress = (line) => {
    setShowLineDetailsModal(true)
    setSelectedLine(line)
  };

  // Close line details modal
  const closeLineDetailsModal = () => {
    setShowLineDetailsModal(false)
    setSelectedLine(null)
  }

  // Send notification to riders of picked line
  const sendNotification = async (token, title, body) => {
    try {
      const message = {
        to: token,
        sound: 'default',
        title: title,
        body: body,
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
  };

  // Assign the line to a driver
  const assignLineToDriver = async (line) => {
    if (!parsedDriverData || !line) return;

    setAssigningLineLoading(true);

    try {
      // Check if rider is from an institution
      const isInstitutionRider = institutions.some(inst => inst.name === line.destination);

      const now = new Date();
      let end = new Date();

      if(isInstitutionRider) {
        const currentYear = now.getFullYear()
        const endYear = now.getMonth() >= 5 ? currentYear + 1 : currentYear
        end = new Date(endYear, 5, 15);
      } else {
        end.setDate(now.getDate() + 30);
      }
      
      const startTimestamp = Timestamp.fromDate(now);
      const endTimestamp = Timestamp.fromDate(end);

      const batch = writeBatch(DB);

      const driverRef = doc(DB, "drivers", parsedDriverData.id);
      const lineRef = doc(DB, "lines", line.id);

      // Collect notification tokens
      const riderNotificationTokens = [];

      // Prepare updated rider list
      const updatedRiders = (line.riders || []).map((rider) => {
        const updatedRider = {
          ...rider,
          service_period: {
            start_date: startTimestamp,
            end_date: endTimestamp,
          },
        };

        if (rider.notification_token) {
          riderNotificationTokens.push({
            token: rider.notification_token,
            name: rider.name,
          });
        }

        // Update rider document in DB
        const riderRef = doc(DB, "riders", rider.id);
        batch.update(riderRef, {
          driver_id: parsedDriverData.id,
          temporary_hold_amount: 0,
          service_period: {
            start_date: startTimestamp,
            end_date: endTimestamp,
          },
        });

        return updatedRider;
      });

      // Create updated line data for driver's copy
      const copiedLineData = {
        id: line.id,
        name: line.name,
        destination: line.destination,
        destination_location: line.destination_location,
        timeTable: line.timeTable,
        riders: updatedRiders,
      };

      // 1. Add line to driver's "lines" array
      batch.update(driverRef, {
        lines: arrayUnion(copiedLineData),
      });

      // 2. Update line with driver info and riders with service period
      batch.update(lineRef, {
        driver_id: parsedDriverData.id,
        driver_notification_token: parsedDriverData.notification_token,
        driver_phone_number: parsedDriverData.phone_number,
        riders: updatedRiders,
      });

      await batch.commit();

      // 🔔 Send notifications to all riders
      for (const rider of riderNotificationTokens) {
        await sendNotification(
          rider.token,
          "تم تعيين سائق لخطك",
          `${rider.name}، تم الآن تعيين السائق لخط ${line.name}. استعد للرحلة!`
        );
      }
      createAlert("تم إضافة الخط بنجاح");
    } catch (error) {
      createAlert("خطأ", "حدث خطأ أثناء إضافة الخط. حاول مرة أخرى.");
      console.log(error)
    } finally {
      router.push('/(main)/(driver)/(tabs)/home') 
      setAssigningLineLoading(false)
    }
  }

  // Loading or fetching user data from DB
  if (fetchingLinesLoading || assigningLineLoading || fetchingInstitutions) {
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
      <View style={styles.lines_container}>
        {availableDestinations.length > 0 && (
          <View style={styles.lines_header}>
            <Dropdown
              style={styles.dropdown}
              placeholderStyle={styles.dropdownStyle}
              selectedTextStyle={styles.dropdownStyle}
              itemTextStyle={styles.dropdownTextStyle}
              data={availableDestinations}
              labelField="name"
              valueField="name"
              placeholder= 'الوجهة'
              value={selectedDestination}
              onChange={item => setSelectedDestination(item.name)}
            />
            <TouchableOpacity style={styles.arrowBackFunction} onPress={comeBackToHome}>
              <FontAwesome5 name="arrow-circle-left" size={24} color="black" />
            </TouchableOpacity>
          </View>
          
        )}
        <FlatList
          data={groupedLines.filter(([destination]) =>
            selectedDestination ? destination === selectedDestination : true
          )}
          keyExtractor={([destination]) => destination}
          contentContainerStyle={styles.flatList_style}
          renderItem={({ item: [destination, lines] }) => (
            <View style={styles.lines_group}>
              <Text style={styles.lines_group_text}>{destination} ({lines.length})</Text>
              {lines.map((line,index) => (
                <View key={index} style={styles.line_data_box}>
                  <View style={styles.line_data_texts}>
                    <View style={styles.line_details_box}>
                      <Text style={styles.line_data_text}>الركاب</Text>
                      <Text style={styles.line_data_text}>{line.riders?.length ?? 0}</Text>
                    </View>
                    <View style={styles.line_details_box}>
                      <Text style={styles.line_data_text}>الاجرة</Text>
                      <Text style={styles.line_data_text}>{line.monthlyAmount.toLocaleString()} د.ع</Text>
                    </View>
                  </View>
                  <View style={styles.line_data_texts}>
                    <TouchableOpacity style={styles.line_details_button} onPress={() => handleLineDetailsPress(line)}>
                      <Text style={styles.line_details_button_text}>تفاصيل الخط</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.add_line_button} 
                      onPress={() =>assignLineToDriver(line)}
                      disabled={assigningLineLoading}
                    >
                      <Text style={styles.add_line_button_text}>{assigningLineLoading ? '...':'اضف الخط'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
          ListEmptyComponent={() => (
            <View style={styles.add_your_data_container}>
              <View style={styles.logo}>
                <Image source={logo} style={styles.logo_image}/>
              </View>
              <View style={styles.arrowBackFunctionNextLogo}>
                <TouchableOpacity style={styles.arrowBackFunction} onPress={comeBackToHome}>
                  <FontAwesome5 name="arrow-circle-left" size={24} color="black" />
                </TouchableOpacity>
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
                <Text style={styles.service_unavailable_text}>لا يوجد خطوط شاغرة حاليا</Text>
              </View>
            </View>
          )}
        />
        {selectedLine && (
          <Modal
            animationType="fade"
            transparent={true} 
            visible={showLineDetailsModal} 
            onRequestClose={() => setShowLineDetailsModal(false)}
          >
            <View style={styles.modal_container}>
              <View style={styles.modal_box}>
                <View style={styles.modal_header}>
                  <TouchableOpacity onPress={closeLineDetailsModal}>
                    <AntDesign name="closecircleo" size={24} color="gray" />
                  </TouchableOpacity>
                  <Text style={styles.modal_title}>{selectedLine.name}</Text>
                </View>
                <View style={styles.mapContainer}>
                  <MapView
                    style={styles.map}
                    ref={mapRef}
                    provider="google"
                    onMapReady={() => {
                      if (selectedLine?.riders?.length) {
                        const coordinates = [
                          ...selectedLine.riders.map(r => ({
                            latitude: r.home_location.latitude,
                            longitude: r.home_location.longitude,
                          })),
                          {
                            latitude: selectedLine.destination_location.latitude,
                            longitude: selectedLine.destination_location.longitude,
                          },
                        ];
                        mapRef.current?.fitToCoordinates(coordinates, {
                          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                          animated: true,
                        });
                      }
                    }}
                  >
                    {/* Riders Markers */}
                    {selectedLine?.riders?.map((rider, index) => (
                      <Marker
                        key={index}
                        coordinate={{
                          latitude: rider.home_location.latitude,
                          longitude: rider.home_location.longitude,
                        }}
                        title={rider.name}
                        pinColor="red"                       
                      >
                      </Marker>
                    ))}
                    {/* Line Destination Marker */}
                    <Marker
                      coordinate={{
                        latitude: selectedLine.destination_location.latitude,
                        longitude: selectedLine.destination_location.longitude,
                      }}
                      title={selectedLine.destination}
                      pinColor="blue"
                    />
                  </MapView>
                </View>
              </View>
            </View>
          </Modal>
        )}
      </View>    
    </SafeAreaView>
  )
}

export default driverAddNewLine

const styles = StyleSheet.create({
  container:{
    flex:1,
    alignItems:'center',
    backgroundColor:colors.WHITE,
  },
  add_your_data_container:{
    width:'100%',
    alignItems:'center',
    justifyContent:'center',
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
  service_unavailable_text:{
    width:300,
    lineHeight:40,
    borderRadius:15,
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    backgroundColor:colors.GRAY
  },
  link_container: {
    backgroundColor: colors.PRIMARY,
    width:120,
    height:50,
    justifyContent:'center',
    alignItems:'center',
    marginTop:10,
    borderRadius: 20,
  },
  link_text: {
    lineHeight:50,
    color: colors.WHITE,
    fontFamily: 'Cairo_700Bold',
    fontSize: 14,
  },
  icon:{
    marginRight:10,
  },
  spinner_error_container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo:{
    width:'100%',
    height:200,
    alignItems:'center',
    justifyContent:'center',
    position:'relative',
  },
  arrowBackFunctionNextLogo:{
    position:'absolute',
    top:80,
    left:0
  },
  logo_image:{
    height:180,
    width:180,
    resizeMode:'contain',
  },
  lines_header:{
    width:'100%',
    marginVertical:25,
    flexDirection:'row-reverse',
    alignItems:'center',
    justifyContent:'space-around'
  },
  dropdown:{
    width:300,
    height:40,
    borderWidth:1,
    borderColor:colors.BLACK,
    borderRadius:15,
  },
  dropdownStyle:{
    lineHeight:40,
    fontFamily:'Cairo_400Regular',
    textAlign:'center',
    fontSize:14
  },
  dropdownTextStyle:{
    textAlign:'center',
  },
  lines_container:{
    justifyContent:'space-between',
    alignItems:'center',
  },
  lines_group:{
    alignItems:'center',
  },
  lines_group_text:{
    lineHeight:40,
    marginBottom:10,
    fontSize:14,
    textAlign:'center',
    backgroundColor:colors.WHITE,
    fontFamily:'Cairo_700Bold'
  },
  line_data_box:{
    width:350,
    height:110,
    borderRadius:15,
    marginBottom:15,
    backgroundColor:colors.GRAY,
    justifyContent:'space-around',
    alignItems:'center',
  },
  line_data_texts:{
    width:320,
    flexDirection:'row-reverse',
    justifyContent:'space-around',
    alignItems:'center',
  },
  line_details_box:{
    height:40,
    flexDirection:'row-reverse',
    justifyContent:'center',
    alignItems:'center',
    gap:7,
  },
  line_data_text:{
    fontSize: 14,
    fontFamily: 'Cairo_400Regular',
    lineHeight: 40,
    textAlign: 'center',
  },
  line_details_button:{
    height:40,
    width:100,
    justifyContent:'center',
    alignItems:'center',
    backgroundColor:colors.WHITE,
    borderColor:colors.BLACK,
    borderWidth:1,
    borderRadius:15,
  },
  line_details_button_text:{
    fontSize: 14,
    fontFamily: 'Cairo_400Regular',
    lineHeight: 40,
    textAlign: 'center',
  },
  add_line_button:{
    height:40,
    width:100,
    justifyContent:'center',
    alignItems:'center',
    backgroundColor:colors.BLUE,
    borderRadius:15,
  },
  add_line_button_text:{
    fontSize: 14,
    fontFamily: 'Cairo_400Regular',
    lineHeight: 40,
    textAlign: 'center',
    color:colors.WHITE
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
    verticalAlign:'middle',
    fontFamily:'Cairo_700Bold',
    fontSize:15,
    marginLeft:10,
  },
  mapContainer:{
    width:'100%',
    height:540,
  },
  map:{
    width:'100%',
    height:'100%',
  },
  marker_label:{
    backgroundColor:'red'
  },
  marker_label_text:{
    
  }
})
