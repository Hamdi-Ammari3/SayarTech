import { StyleSheet,Text,View,ActivityIndicator,Image,TouchableOpacity,Alert,Linking } from 'react-native'
import {useEffect,useState,useRef} from 'react'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Dropdown } from 'react-native-element-dropdown'
import { collection, onSnapshot,getDoc,doc,writeBatch,arrayRemove,increment } from 'firebase/firestore'
import {DB} from '../../../../firebaseConfig'
import { captureRef } from 'react-native-view-shot'
import * as MediaLibrary from 'expo-media-library'
import QRCode from 'react-native-qrcode-svg'
import colors from '../../../../constants/Colors'
import road from '../../../../assets/images/road.jpg'
import logo from '../../../../assets/images/logo.jpg'
import { useRiderData } from '../../../stateManagment/RiderContext'
import Ionicons from '@expo/vector-icons/Ionicons'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import AntDesign from '@expo/vector-icons/AntDesign'
import RiderTripMap from '../../../../components/RiderTripMap'


const dailyTrips = () => {
  const {userData,fetchingUserDataLoading} = useRiderData()

  const [startPoint,setStartPoint] = useState('')
  const [endPoint,setEndPoint] = useState('')
  const [cityData, setCityData] = useState({})
  const [availableFromCities, setAvailableFromCities] = useState([])
  const [availableToCities, setAvailableToCities] = useState([])
  const [selectedTripId, setSelectedTripId] = useState(null)
  const [selectedTripPrice, setSelectedTripPrice] = useState(null)
  const [searchingTrip,setSearchingTrip] = useState(false)
  const [tripData, setTripData] = useState(null)
  const [hasActiveTripToday, setHasActiveTripToday] = useState(false)
  const [loadingTripData, setLoadingTripData] = useState(true)
  const [driverInfo, setDriverInfo] = useState(null)
  const [activeTab, setActiveTab] = useState('tripStatus')
  const [cancelingTrip,setCancelingTrip] = useState(false)

  const createAlert = (alerMessage) => {
    Alert.alert(alerMessage)
  }

  // Fetch active trip data
  useEffect(() => {
    let unsubscribe;
  
    const fetchTripData = () => {
      if (fetchingUserDataLoading || !userData) {
        setLoadingTripData(false);
        return;
      }

      if (!userData.activeTripId) {
        setHasActiveTripToday(false);
        setLoadingTripData(false);
        return;
      }
  
      const tripRef = doc(DB, 'activeTrips', userData.activeTripId);
  
      unsubscribe = onSnapshot(tripRef, (snapshot) => {
        const today = new Date().toISOString().split('T')[0];
  
        if (!snapshot.exists()) {
          setHasActiveTripToday(false);
          setTripData(null);
        } else {
          const trip = snapshot.data();
  
          if (trip.date === today) {
            setTripData({ ...trip, id: snapshot.id });
            setHasActiveTripToday(true);
          } else {
            setTripData(null);
            setHasActiveTripToday(false);
          }
        }
  
        setLoadingTripData(false);
      });
    };
  
    fetchTripData();
  
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [userData, fetchingUserDataLoading]);
  
  // Fetch driver info
  useEffect(() => {
    const fetchActiveDriverDetails = async () => {
      const driverDocRef = doc(DB, 'drivers', tripData.driver_id);
      const driverSnapshot = await getDoc(driverDocRef);
      if (driverSnapshot.exists()) {
        setDriverInfo(driverSnapshot.data());
      } 
    }
    if (hasActiveTripToday) {
      fetchActiveDriverDetails();
    } 
  }, [tripData]);
  
  // Fetch cities combination
  useEffect(() => {
    const citiesInfoCollectionRef = collection(DB, 'fromToCities')
    const unsubscribe = onSnapshot(citiesInfoCollectionRef, (querySnapshot) => {
      const combinedData = {};
  
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        Object.keys(data).forEach((fromCity) => {
          combinedData[fromCity] = data[fromCity];
        });
      });
  
      setCityData(combinedData); // now it's an object like before
      setAvailableFromCities(Object.keys(combinedData));
    });
  
    return () => unsubscribe();
  }, []);
  
  // Rider selects start point
  const handleStartPoint = (fromCity) => {
    setStartPoint(fromCity);
    setEndPoint('');
    if (cityData[fromCity]) {
      setAvailableToCities(
        Object.entries(cityData[fromCity]).map(([toCity, trip]) => ({
          name: toCity,
          id: trip.id,
          price: trip.price,
        }))
      );
    } else {
      setAvailableToCities([]);
    }
  };
  
  // Rider selects destination
  const handleEndPoint = (item) => {
    setEndPoint(item.name);
    setSelectedTripPrice(item.price);
    setSelectedTripId(item.id); 
  }

  // Search trip handle
  const handleSearch = async () => {
    if (!selectedTripId || fetchingUserDataLoading) return;
    setSearchingTrip(true)

    try {
      // Step 1: Get intercityTrips doc
      const intercityTripDocRef = doc(DB, 'intercityTrips', selectedTripId);
      const intercityTripSnap = await getDoc(intercityTripDocRef);

      if (!intercityTripSnap.exists()) {
        createAlert('حدث خطا الرجاء المحاولة مرة ثانية')
        return;
      }

      const intercityTripData = intercityTripSnap.data();
      const currentTripId = intercityTripData.currentTrip;

      let tripData = null;

      if (currentTripId) {
        // Step 2: Get active trip info
        const activeTripDocRef = doc(DB, 'activeTrips', currentTripId);
        const activeTripSnap = await getDoc(activeTripDocRef);
  
        if (activeTripSnap.exists()) {
          const activeTripData = activeTripSnap.data();
  
          // Step 3: Check if the active trip is for today and there is empty seats
          const todayDate = new Date().toISOString().split('T')[0]; // yyyy-mm-dd
          if (activeTripData.date === todayDate && activeTripData.seats_booked < activeTripData.seats_capacity) {
            tripData = { ...activeTripData, id: activeTripSnap.id };
          }
        }
      }

      // Step 4: If no valid trip found, create a new one
      if (!tripData) {
        const activeDriver = intercityTripData.inStation?.[0]; // Assuming first driver is active

        if (!activeDriver) {
          createAlert('لا يوجد سائق متوفر حاليا, الرجاء اعادة المحاولة لاحقا')
          return
        }

        const newTripRef = doc(collection(DB, 'activeTrips'));
        const todayDate = new Date().toISOString().split('T')[0]; // yyyy-mm-dd

        const newTripData = {
          intercityTripId: selectedTripId,
          oppositeIntercityTripId:intercityTripData.oppositeTrip,
          from: startPoint,
          to: endPoint,
          date: todayDate,
          driver_id: activeDriver.id,
          driver_notification_token: activeDriver.driver_notification_token,
          driver_phone_number: activeDriver.driver_phone_number,
          seats_capacity: activeDriver.seats_capacity || 8, // Default seats
          seats_booked: 0,
          riders: [],
          price:selectedTripPrice,
          started: false,
        }

        const batch = writeBatch(DB)
        batch.set(newTripRef, newTripData)

        // Update currentTrip id in intercityTrips
        batch.update(intercityTripDocRef, {
          currentTrip: newTripRef.id,
        });

         // Update driver's activeTripId
        const driverRef = doc(DB, 'drivers', activeDriver.id);
        batch.update(driverRef, {
          activeTripId: newTripRef.id,
        });

        await batch.commit();

        tripData = { ...newTripData, id: newTripRef.id };
      }

      // Step 5: Navigate to tripResult with trip info
      router.push({
        pathname: "/tripResult",
        params: {
          tripId: tripData.id,
          intercityTripId:selectedTripId,
          from: startPoint,
          to: endPoint,
          price: selectedTripPrice,
          riderId: userData.id,
          riderNotificationToken:userData.user_notification_token,
          riderPhoneNumber:userData.phone_number,
          driverNotificationToken:tripData.driver_notification_token,
          driverId: tripData.driver_id,
          seatsCapacity: tripData.seats_capacity,
          seatsBooked: tripData.seats_booked,
        }
      });

    } catch (error) {
      createAlert('حدث خطا الرجاء المحاولة مرة ثانية')
    } finally{
      setSearchingTrip(false)
    }
  };

  //Loading 
  if (fetchingUserDataLoading || loadingTripData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.PRIMARY}/>
        </View>
      </SafeAreaView>
    )
  }

  if(hasActiveTripToday && driverInfo === null) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.PRIMARY}/>
        </View>
      </SafeAreaView>
    )
  }

  // Trip current status
  const TripStatusSection = ({ tripData }) => {
    
    // Call the driver
    const callDriver = () => {
      const phoneUrl = `tel:${tripData.driver_phone_number}`;
      Linking.openURL(phoneUrl).catch(err =>
        alert("فشل في بدء المكالمة")
      )
    }

    // Cancel trip
    const cancelTrip = async () => {
      setCancelingTrip(true)
      try {
        const activeTripRef = doc(DB, "activeTrips", tripData.id);
        const riderDataInTrip = tripData.riders.find(r => r.rider_id === userData.id);

        if (!riderDataInTrip) {
          throw new Error("Rider is not part of this trip");
        }

        const ticketId = riderDataInTrip.ticket_code;
        if (!ticketId) {
          throw new Error("Ticket ID not found in rider data");
        }

        const ticketRef = doc(DB, "tickets", ticketId);
        const riderRef = doc(DB, "users", userData?.id);
      
        const batch = writeBatch(DB);
    
        // 1. Remove the rider from the active trip
        batch.update(activeTripRef, {
          riders: arrayRemove(riderDataInTrip),
          seats_booked: increment(-riderDataInTrip.seats_booked)
        });

        // 2. Update the ticket to mark as canceled
        batch.update(ticketRef, {
          canceled: true
        });

        // 3. Reset the rider's activeTripId to empty string
        batch.update(riderRef, {
          activeTripId: null
        });
    
        await batch.commit();
    
        alert("تم إلغاء الحجز بنجاح");
    
      } catch (error) {
        setCancelingTrip(false)
        alert("حدث خطأ أثناء إلغاء الحجز، حاول مرة أخرى.");
      } finally{
        setCancelingTrip(false)
      }
    }

    // If the trip started render the Map
    if(tripData.started === true) {
      return (
        <View style={styles.tripStatusSectionBox}>
          <View style={{marginVertical:10}}>
            <TouchableOpacity style={styles.callDriverButton} onPress={callDriver}>
              <Text style={styles.callDriverButtonText}>تواصل مع السائق</Text>
              <Ionicons name="call" size={24} color="white" />
            </TouchableOpacity>
          </View>
          <RiderTripMap tripData={tripData} userData={userData} driverInfo={driverInfo}/>
        </View>
      )
    }

    return (
      <View style={styles.tripStatusSectionBox}>
        <View style={{marginTop:50,marginBottom:10}}>
          <Text style={styles.tripStatusSectionText}>عدد الركاب: {tripData.seats_booked} / {tripData.seats_capacity}</Text>
        </View>
        <View style={styles.driverCarInfoImageBox}>
          <Image 
            source={{uri:driverInfo.driver_car_image}} 
            style={styles.driverCarInfoImage}
          />
        </View>
        <View style={{marginBottom:20}}>
          <TouchableOpacity style={styles.callDriverButton} onPress={callDriver}>
            <Text style={styles.callDriverButtonText}>تواصل مع السائق</Text>
            <Ionicons name="call" size={24} color="white" />
          </TouchableOpacity>
        </View>
        <View>
          {cancelingTrip ? (
            <View style={styles.deleteTripButton}>
              <ActivityIndicator size="small" color={colors.WHITE}/>
            </View>
          ) : (
            <TouchableOpacity style={styles.deleteTripButton} onPress={cancelTrip}>
            <Text style={styles.deleteTripButtonText}>الغاء الرحلة</Text>
            <MaterialCommunityIcons name="cancel" size={24} color="white" />
          </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // Trip ticket
  const MyTicketSection = ({ tripData }) => {
    const tripRider = tripData?.riders?.find(r => r.rider_id === userData.id);
    const ticketBoxRef = useRef();

    const handleSaveTicket = async () => {
      try {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('يجب السماح بالوصول إلى الصور لحفظ التذكرة');
          return;
        }
  
        const uri = await captureRef(ticketBoxRef, {
          format: 'png',
          quality: 1,
        });
  
        const asset = await MediaLibrary.createAssetAsync(uri);
        await MediaLibrary.createAlbumAsync('Safe - سيف', asset, false);
  
        Alert.alert('تم الحفظ', 'تم حفظ التذكرة في معرض الصور داخل ألبوم Safe - سيف');
      } catch (error) {
        Alert.alert('خطأ', 'حدث خطأ أثناء حفظ التذكرة.');
      }
    };

    if (!tripRider) {
      return (
        <View style={styles.ticketBox}>
          <View style={styles.no_ticket_found}>
            <Text style={styles.ticketText}>لا توجد تذكرة محجوزة لهذه الرحلة.</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.ticketContainer}>
        <View style={styles.ticketBox} ref={ticketBoxRef}>  
          <View style={styles.ticketLogo}>
            <Image source={logo} style={styles.logo_image}/>
          </View>
          <View style={{justifyContent:'center',alignItems:'center'}}>
            <Text style={styles.ticketText}>{tripData.date}</Text>
            <View style={styles.ticketFromToBox}>
              <Text style={styles.ticketText}>{tripData.from}</Text>
              <Text>-</Text>
              <Text style={styles.ticketText}>{tripData.to}</Text>
            </View>
            <Text style={styles.ticketText}>السائق: {driverInfo.driver_full_name} {driverInfo.driver_family_name}</Text>
            <Text style={styles.ticketText}>رقم اللوحة: {driverInfo.driver_car_plate}</Text>
            <Text style={styles.ticketText}>عدد المقاعد: {tripRider.seats_booked}</Text>
            <Text style={styles.ticketText}>السعر: {tripRider.total_price ? `${tripRider.total_price} د.ع` : "—"}</Text>
          </View>
          <View style={styles.separatorLine} ></View>
          <View style={styles.ticketCodeBox}>
            <Text style={styles.ticketText}>رمز التذكرة:</Text>
            <View style={styles.ticketQrTextCodeBox}>
              <Text style={styles.ticketCodeText}>{tripRider.ticket_code}</Text>
              <QRCode
                value={tripRider.ticket_code}
                size={60}
              />
            </View>
            
          </View>
        </View>
        <View>
          <TouchableOpacity style={styles.saveTicketBtn} onPress={handleSaveTicket}>
            <Text style={styles.saveTicketBtnText}>حفظ التذكرة على الهاتف</Text>
            <AntDesign name="save" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Rider have an active trip
  const activeTripComponent = () => {
    return(
      <View style={styles.box}>
        <View style={styles.tripActiveTab}>
          <TouchableOpacity
            style={[
              styles.tripTabButton,
              activeTab === 'tripStatus' && styles.activeTripTabButton
            ]}
            onPress={() => setActiveTab('tripStatus')}
          >
            <Text 
              style={[
                styles.tripTabButtonText,
                activeTab === 'tripStatus' && styles.activeTripTabButtonText
              ]}
            >حالة الرحلة</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tripTabButton,
              activeTab === 'myTicket' && styles.activeTripTabButton
            ]}
            onPress={() => setActiveTab('myTicket')}
          >
            <Text 
              style={[
                styles.tripTabButtonText,
                activeTab === 'myTicket' && styles.activeTripTabButtonText
              ]}
              >تذكرتي</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'tripStatus' ? (
          <TripStatusSection tripData={tripData} />
        ) : (
          <MyTicketSection tripData={tripData} />
        )}
      </View>
    )
  }

  // Rider have no active trip for today
  const searchTripComponent = () => {
    return(
      <View style={styles.box}>
        <View style={styles.image_box}>
          <Image source={road} style={styles.road_img}/>
          <View style={styles.overlay}>
            <Text style={styles.cover_text}>رحلاتك اليومية بين المدن صارت أسهل ويانا</Text>
          </View>
        </View>
        <View style={styles.search_trip_box}>
          <View style={styles.search_trip_from_to_box}>
            <Dropdown
              style={styles.dropdown}
              placeholderStyle={styles.dropdownStyle}
              selectedTextStyle={styles.dropdownStyle}
              itemTextStyle={styles.dropdownTextStyle}
              data={availableFromCities.map(city => ({ name: city, value: city }))}
              labelField="name"
              valueField="value"
              placeholder="الانطلاق"
              value={startPoint}
              onChange={item => handleStartPoint(item.value)}
            />
            <Dropdown
              style={styles.dropdown}
              placeholderStyle={styles.dropdownStyle}
              selectedTextStyle={styles.dropdownStyle}
              itemTextStyle={styles.dropdownTextStyle}
              data={availableToCities}
              labelField="name"
              valueField="name"
              placeholder="الوصول"
              value={availableToCities.find(c => c.name === endPoint) || null}
              onChange={item => handleEndPoint(item)}
            />
          </View>
          <View style={styles.search_trip_btn_box}>
            {searchingTrip ? (
              <View style={styles.search_trip_btn}>
                <ActivityIndicator size="small" color={colors.WHITE}/>
              </View>
            ) : (
              <TouchableOpacity style={styles.search_trip_btn} onPress={handleSearch}>
                <Text style={styles.search_trip_btn_text}>ابحث</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      {hasActiveTripToday && tripData ? (
        <>
          {activeTripComponent()}
        </>
        
      ) : (
        <>
          {searchTripComponent()}
        </>
      )}
    </SafeAreaView>
  )
}

export default dailyTrips

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  box:{
    width:'100%',
    height:'100%',
    alignItems:'center',
  },
  image_box:{
    width:'100%',
    height:420,
    position: 'relative',
    justifyContent:'center',
    alignItems:'center',
  },
  road_img:{
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 0.7,
  },
  overlay: {
    zIndex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cover_text: {
    fontSize: 18,
    fontFamily: 'Cairo_700Bold',
    color: '#fff',
    textAlign: 'center',
    paddingVertical: 10,
    paddingHorizontal: 55,
    borderRadius: 10,
  },
  search_trip_box:{
    width:300,
    height:150,
    borderRadius:15,
    justifyContent:'space-between',
    alignItems:'center',
    borderColor:'#ddd',
    borderWidth:1,
    backgroundColor: '#fff',
    marginTop: -75,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
  },
  search_trip_from_to_box:{
    width:'100%',
    height:100,
    justifyContent:'center',
    alignItems:'center',
  },
  dropdown:{
    width:300,
    height:50,
    borderBottomWidth:1,
    borderBottomColor:'#ddd',
    borderTopLeftRadius:15,
    borderTopRightRadius:15,
  },
  dropdownStyle:{
    lineHeight:50,
    fontFamily:'Cairo_400Regular',
    textAlign:'center',
    fontSize:15
  },
  dropdownTextStyle:{
    textAlign:'center',
  },
  search_trip_btn_box:{
    width:'100%',
    height:50,
    justifyContent:'center',
    alignItems:'center',
  },
  search_trip_btn:{
    width:300,
    height:50,
    backgroundColor:colors.BLUE,
    borderBottomLeftRadius:15,
    borderBottomRightRadius:15,
    justifyContent:'center',
    alignItems:'center',
  },
  search_trip_btn_text:{
    lineHeight:50,
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.WHITE,
  },
  tripActiveTab:{
    marginTop:20,
    flexDirection:'row-reverse',
    gap:10
  },
  tripTabButton:{
    width:150,
    height:50,
    alignItems:'center',
    justifyContent:'center',
    borderRadius: 15,
    backgroundColor: '#f5f5f5',
  },
  activeTripTabButton:{
    backgroundColor:colors.BLUE
  },
  tripTabButtonText:{
    lineHeight:50,
    fontFamily:'Cairo_400Regular',
    textAlign:'center',
    fontSize:15,
  },
  activeTripTabButtonText:{
    color:colors.WHITE
  },
  tripStatusSectionBox:{
    alignItems: 'center',
  },
  map_container:{
    width:500,
    height:500,
  },
  tripStatusSectionText:{
    lineHeight:50,
    fontFamily:'Cairo_700Bold',
    textAlign:'center',
    fontSize:14,
  },
  driverCarInfoImageBox:{
    width: 200,
    height: 200,
    marginBottom:30,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 15,
    backgroundColor: '#f5f5f5',
    overflow: 'hidden',
  },
  driverCarInfoImage:{
    height:'100%',
    width:'100%',
    resizeMode: 'contain',
    borderRadius: 12,
  },
  callDriverButton:{
    height:40,
    width:170,
    borderRadius:15,
    flexDirection:'row-reverse',
    alignItems:'center',
    justifyContent:'center',
    borderWidth:1,
    borderColor:'#075e54',
    backgroundColor:'#075e54'
  },
  callDriverButtonText:{
    lineHeight:35,
    marginLeft:10,
    fontFamily:'Cairo_400Regular',
    fontSize:15,
    color:colors.WHITE,
  },
  deleteTripButton:{
    height:40,
    width:170,
    borderRadius:15,
    flexDirection:'row-reverse',
    alignItems:'center',
    justifyContent:'center',
    borderWidth:1,
    borderColor:'#d11a2a',
    backgroundColor:'#d11a2a'
  },
  deleteTripButtonText:{
    lineHeight:35,
    marginLeft:10,
    fontFamily:'Cairo_400Regular',
    fontSize:15,
    color:colors.WHITE
  },
  ticketContainer:{
    flex:1,
    alignItems:'center',
  },
  ticketBox:{
    height:430,
    width:330,
    marginTop:50,
    alignItems:'center',
    justifyContent:'space-between',
    paddingVertical:10,
    borderColor:'#ddd',
    borderWidth:1,
    borderStyle: 'dashed', 
    backgroundColor:colors.WHITE,
    borderRadius:15,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
  },
  ticketLogo:{
    width:50,
    height:50,
    alignItems:'center',
    justifyContent:'center',
    borderRadius: 50,
    borderColor: colors.PRIMARY,
    borderWidth: 1,
  },
  logo_image:{
    height:40,
    width:40,
    resizeMode:'contain',
    borderRadius: 40,
  },
  ticketFromToBox:{
    flexDirection:'row-reverse',
    alignItems:'center',
    justifyContent:'center',
    gap:10,
  },
  ticketText:{
    lineHeight:35,
    fontFamily:'Cairo_400Regular',
    fontSize:15,
  },
  separatorLine: {
    width:'100%',
    borderStyle: 'dashed',
    borderWidth: 0.5,
    borderColor: '#ccc',
    marginVertical: 5,
  },
  ticketCodeBox:{
    alignItems:'center',
    justifyContent:'space-around',
  },
  ticketCodeText:{
    lineHeight:40,
    fontFamily:'Cairo_700Bold',
    fontSize:16,
  },
  ticketQrTextCodeBox:{
    width:'90%',
    flexDirection:'row-reverse',
    alignItems:'center',
    justifyContent:'space-between'
  },
  saveTicketBtn:{
    height:45,
    width:220,
    marginTop:20,
    borderRadius:15,
    flexDirection:'row-reverse',
    alignItems:'center',
    justifyContent:'center',
    borderWidth:1,
    borderColor:'#075e54',
    backgroundColor:'#075e54'
  },
  saveTicketBtnText:{
    lineHeight:40,
    marginLeft:10,
    fontFamily:'Cairo_400Regular',
    fontSize:15,
    color:colors.WHITE,
  },
  no_ticket_found:{
    flex:1,
    alignItems:'center',
    justifyContent:'center'
  },
  loadingBox:{
    flex:1,
    alignItems:'center',
    justifyContent:'center'
  }

})

