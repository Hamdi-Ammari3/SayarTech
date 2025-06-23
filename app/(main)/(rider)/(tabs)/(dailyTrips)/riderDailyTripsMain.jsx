import { StyleSheet,Text,View,ActivityIndicator,TouchableOpacity,FlatList,Dimensions } from 'react-native'
import {useState,useMemo} from 'react'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import dayjs from 'dayjs'
import 'dayjs/locale/ar'
import isToday from 'dayjs/plugin/isToday'
import isTomorrow from 'dayjs/plugin/isTomorrow'
import colors from '../../../../../constants/Colors'
import {useRiderData} from '../../../../stateManagment/RiderContext'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import FontAwesome from '@expo/vector-icons/FontAwesome'

const dailyTrips = () => {
  const {userData,fetchingUserDataLoading,intercityTrips,fetchingIntercityTrips} = useRiderData()
  const router = useRouter()
  dayjs.extend(isToday)
  dayjs.extend(isTomorrow)
  dayjs.locale('ar')

  const [activeTab, setActiveTab] = useState('myTrips')

  //Redirect to trip details page
  const redirectToTripDetailsPage = (trip) => {
    router.push({
      pathname:"/riderTripDetails",
      params:{
        tripID:trip.id,
      }
    })
  }

  //Filter trips list
  const eligibleRequestedTrips = useMemo(() => {

    if (!intercityTrips?.length) return []

    const now = new Date()

    const riderTripIDs = userData?.intercityTrips?.map(t => t.id)

    return intercityTrips
    .filter(trip => {
      const alreadyJoined = riderTripIDs.includes(trip.id);
      const notFull = trip.seats_booked < trip.seats_available;
      const isUpcoming = trip.start_datetime && trip.start_datetime.toDate() > now;
      const isFromDriver = trip.created_by === 'driver';
      const notStarted = trip.started === false;

      return isFromDriver && notStarted && notFull && isUpcoming && !alreadyJoined;
    })
    .sort((a, b) => a.start_datetime.toDate() - b.start_datetime.toDate());
  }, [userData, intercityTrips])

  //Fetching rider trips
  const myTrips = useMemo(() => {
    if (!userData?.intercityTrips || !intercityTrips?.length) return []; 

    const riderTripIDs = userData?.intercityTrips?.map(t => t.id);

    return intercityTrips
      .filter(trip => riderTripIDs.includes(trip.id))
      .sort((a, b) => a.start_datetime.toDate() - b.start_datetime.toDate());
  }, [userData, intercityTrips])

  //Format start date and time
  const formatTripStartTime = (timestamp) => {
    if (!timestamp) return '';
  
    const date = dayjs(timestamp.toDate());
  
    if (date.isToday()) {
      return `اليوم ${date.format('hh:mm A')}`;
    }
  
    if (date.isTomorrow()) {
      return `غدا ${date.format('hh:mm A')}`;
    }
  
    // Format: الخميس 13 يونيو 10:30 صباحا
    return date.format('dddd D MMMM hh:mm A');
  }

  // format trip amount
  const formatTripAmount = (amount) => {
    return amount?.toLocaleString('ar-IQ', {
      style: 'currency',
      currency: 'IQD',
      minimumFractionDigits: 0,
    })
  }

  //Loading 
  if (fetchingUserDataLoading || fetchingIntercityTrips) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.spinner_error_container}>
          <ActivityIndicator size="large" color={colors.PRIMARY}/>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.intercity_trips_container}>
        <View style={styles.tripTabButtonsContainer}>
          <TouchableOpacity
            style={[styles.tripTabButton, activeTab === 'myTrips' && styles.activeTripTabButton]}
            onPress={() => setActiveTab('myTrips')}
          >
            <Text style={[styles.tripTabText, activeTab === 'myTrips' && styles.activeTripTabText]}>
              رحلاتي
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tripTabButton, activeTab === 'requests' && styles.activeTripTabButton]}
            onPress={() => setActiveTab('requests')}
          >
            <Text style={[styles.tripTabText, activeTab === 'requests' && styles.activeTripTabText]}>
              قائمة الرحلات
            </Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={activeTab === 'myTrips' ? myTrips : eligibleRequestedTrips}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.available_trips_flatList_style}
          renderItem={({ item }) => (
            <View style={styles.tripBox}>
              <View style={styles.tripBox_header}>
                <Text style={styles.tripBox_header_text}>{userData.user_full_name}</Text>
                <FontAwesome name="user" size={24} color="darkgray" />
              </View>
              <View style={styles.tripBox_main}>
                <View style={styles.location_box}>
                  <View style={styles.location_text_box}>
                    <Text style={styles.trip_text_start_point_title}>الانطلاق</Text>
                    <Text style={styles.trip_text_start_point}>{item.start_point}</Text>
                  </View>
                  <View style={styles.location_icon_box}>
                    <MaterialCommunityIcons name="map-marker-account-outline" size={24} color="black" />
                  </View>
                </View>
                <View style={styles.location_box}>
                  <View style={styles.location_text_box}>
                    <Text style={styles.trip_text_start_point_title}>الوصول</Text>
                    <Text style={styles.trip_text_start_point}>{item.destination_address}</Text>
                  </View>
                  <View style={styles.location_icon_box}>
                    <MaterialCommunityIcons name="map-marker-check-outline" size={24} color="black" />
                  </View>
                </View>
    
                <View style={styles.location_box}>
                  <View style={styles.location_text_box}>
                    <Text style={styles.trip_text_start_point_title}>التوقيت</Text>
                    <Text style={styles.trip_text_start_point}>{formatTripStartTime(item.start_datetime)}</Text>
                  </View>
                  <View style={styles.location_icon_box}>
                    <MaterialIcons name="access-time" size={24} color="black" />
                  </View>
                </View>
              </View>
    
              <View style={styles.tripBox_footer}>
                <View style={[styles.tripBox_footer_section, styles.withSeparator]}>
                  <Text style={styles.tripBox_footer_text_title}>السعر</Text>
                  <Text style={styles.tripBox_footer_text}>{formatTripAmount(item?.seat_price)}</Text>
                </View>
                <View style={[styles.tripBox_footer_section, styles.withSeparator]}>
                  <Text style={styles.tripBox_footer_text_title}>مقاعد متاحة</Text> 
                  <Text style={styles.tripBox_footer_text}>{Number(item?.seats_available - item?.seats_booked)}</Text>
                </View>
                <View style={styles.tripBox_footer_section}>
                  <TouchableOpacity onPress={() => redirectToTripDetailsPage(item)}>
                    <Text style={styles.tripBox_footer_button_text}>التفاصيل</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.no_trip_text_box}>
              <Text style={styles.no_trip_text}>
                {activeTab === 'myTrips' ? 'ليس لديك رحلات حالياً' : 'لا توجد طلبات حالياً'}
              </Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  )
}

export default dailyTrips

const { width: SCwidth, height: SCheight } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  intercity_trips_container:{
    width:'100%',
    alignItems:'center',
  },
  tripTabButtonsContainer: {
    width:300,
    marginTop:25,
    marginBottom:50,
    flexDirection:'row-reverse',
    alignItems:'center',
    justifyContent:'center',
    gap:20,
  },
  tripTabButton: {
    width:135,
    height:42,
    justifyContent:'center',
    alignItems:'center',
  },
  activeTripTabButton: {
    borderBottomColor:'#295F98',
    borderBottomWidth:2
  },
  tripTabText: {
    lineHeight:42,
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.DARKGRAY,
  },
  activeTripTabText: {
    color:'#295F98'
  },
  available_trips_flatList_style:{
    paddingBottom:120,
  },
  tripBox:{
    width:SCwidth - 35,
    height:350,
    marginBottom:15,
    borderRadius:15,
    alignItems:'center',
    borderColor:'#ddd',
    borderWidth:1,
    backgroundColor: '#fff',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    position:'relative'
  },
  tripBox_header:{
    height:60,
    width:'90%',
    flexDirection:'row',
    justifyContent:'flex-end',
    alignItems:'center',
    gap:10,
  },
  tripBox_header_text:{
    lineHeight:40,
    fontFamily: 'Cairo_700Bold',
    fontSize:15
  },
  tripBox_status_box:{
    position:'absolute',
    top:0,
    left:0,
    width:100,
    height:40,
    alignItems:'center',
    justifyContent:'center',
    borderTopLeftRadius:15,
    backgroundColor:'#328E6E'
  },
  tripBox_status_text:{
    lineHeight:40,
    fontFamily: 'Cairo_400Regular',
    fontSize:15,
    color:colors.WHITE
  },
  tripBox_main:{
    width:'100%',
    height:210,
    marginVertical:8,
  },
  location_box:{
    flexDirection:'row',
    justifyContent:'flex-end',
    marginBottom:15,
  },
  location_text_box:{
    height:60,
    justifyContent:'space-between',
    alignItems:'flex-end',
  },
  location_icon_box:{
    height:60,
    width:50,
    justifyContent:'center',
    alignItems:'center',
  },
  trip_text_start_point_title:{
    lineHeight:30,
    fontFamily: 'Cairo_400Regular',
    fontSize:13,
    color:colors.DARKGRAY
  },
  trip_text_start_point:{
    lineHeight:30,
    fontFamily: 'Cairo_700Bold',
    fontSize:14,
  },
  tripBox_footer:{
    width:'100%',
    height:60,
    flexDirection:'row-reverse',
    alignItems:'center',
    justifyContent:'center',
    borderTopWidth:1,
    borderTopColor:'#ddd'
  },
  tripBox_footer_section:{
    flex: 1,
    height:50,
    alignItems:'center',
    justifyContent:'center',
  },
  withSeparator: {
    borderLeftWidth: 1.5,
    borderLeftColor: '#ddd',
  },
  tripBox_footer_text_title:{
    lineHeight:25,
    fontFamily: 'Cairo_400Regular',
    fontSize:13,
    color:colors.DARKGRAY,
  },
  tripBox_footer_text:{
    lineHeight:25,
    fontFamily: 'Cairo_700Bold',
    fontSize:14,
  },
  tripBox_footer_button_text:{
    lineHeight:30,
    fontFamily: 'Cairo_700Bold',
    fontSize:14,
    color:'#295F98'
  },
  no_trip_text_box:{
    height:400,
    justifyContent:'center',
  },
  no_trip_text:{
    width:300,
    lineHeight:40,
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    fontSize:15
  },
  floatingAddButton: {
    position: 'absolute',
    top:600,
    right: 20,
    width: 50,
    height: 50,
    backgroundColor: '#295F98',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    zIndex: 100,
  },
  spinner_error_container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
