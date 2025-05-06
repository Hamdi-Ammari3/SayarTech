import { useLocalSearchParams,useRouter } from 'expo-router'
import { View,Text,TouchableOpacity,StyleSheet,ActivityIndicator,Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Location from 'expo-location'
import { collection,doc,getDoc,writeBatch,setDoc,arrayUnion,increment,onSnapshot,runTransaction } from 'firebase/firestore'
import { DB } from '../firebaseConfig'
import { useEffect, useState } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import EvilIcons from '@expo/vector-icons/EvilIcons'
import colors from '../constants/Colors'

const TripResult = () => {

  const { tripId,from,to,price,riderId,riderNotificationToken,riderPhoneNumber,driverId,intercityTripId } = useLocalSearchParams ()
  const router = useRouter()
  const tripPrice = Number(price || 0);

  const [trip, setTrip] = useState(null)
  const [driverInfo, setDriverInfo] = useState(null)
  const [seatCount, setSeatCount] = useState(1)
  const [bookingTheTrip,setBookingTheTrip] = useState(false)
  const [seatsAvailable, setSeatsAvailable] = useState(0)

  //Fetch active trip info
  useEffect(() => {
    const fetchTrip = async () => {
      const docRef = doc(DB, 'activeTrips', tripId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setTrip(docSnap.data());
      }
    };
    if (tripId) fetchTrip();
  }, [tripId]);
  
  // Fetch driver info
  useEffect(() => {
    const fetchActiveDriverDetails = async () => {
      const driverDocRef = doc(DB, 'drivers', driverId);
      const driverSnapshot = await getDoc(driverDocRef);
      if (driverSnapshot.exists()) {
        setDriverInfo(driverSnapshot.data());
      } 
    }
    if (trip) {
      fetchActiveDriverDetails();
    } 
  }, [trip]);

  // Calculate price
  const totalPrice = tripPrice * seatCount;

  // Increament seats
  const incrementSeat = () => {
    if (seatCount < seatsAvailable) {
      setSeatCount(prev => prev + 1);
    }
  };
  
  // Decrement seats
  const decrementSeat = () => {
    if (seatCount > 1) {
      setSeatCount(prev => prev - 1);
    }
  };

  // Keep track of avalaible seats
  useEffect(() => {
    if (!tripId) return;
  
    const tripRef = doc(DB, "activeTrips", tripId);
    const unsubscribe = onSnapshot(tripRef, (snapshot) => {
      if (snapshot.exists()) {
        const tripData = snapshot.data();
        setSeatsAvailable(tripData.seats_capacity - tripData.seats_booked);
      }
    });
  
    return () => unsubscribe();
  }, [tripId]);
  
  // Get rider current location
  const getLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Permission not granted');
    }
    let location = await Location.getCurrentPositionAsync({});
    return location;
  };

  // Send multiple notifications in one request
  const sendBatchNotification = async (tokens, title, body) => {
    if (tokens.length === 0) return;

    try {
      const messages = tokens.map(token => ({
          to: token,
          sound: 'default',
          title,
          body
      }));

      await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messages),
      });

    } catch (error) {
      console.log("Batch notification error:", error);
    }
  };

  // Book a Seat
  const bookTrip = async () => {
    setBookingTheTrip(true)

    try {
      const location = await getLocation(); 

      const activeTripRef = doc(DB, "activeTrips", tripId);
      const activeTripSnap = await getDoc(activeTripRef);

      if (!activeTripSnap.exists()) {
        throw new Error("Active trip not found");
      }

      const activeTripData = activeTripSnap.data();

      // Safety check: prevent booking if trip is full
      if (activeTripData.seats_booked >= activeTripData.seats_capacity) {
        alert("هذه الرحلة ممتلئة بالفعل");
        setBookingTheTrip(false);
        return;
      }

      // 🚀 Step 1: Create the new ticket document
      const ticketRef = doc(collection(DB, "tickets")); // auto-ID
      const ticketData = {
        trip_id:tripId,
        trip_date: activeTripData.date,
        from: activeTripData.from,
        to: activeTripData.to,
        driver_id: activeTripData.driver_id,
        rider_id: riderId,
        seats_booked: seatCount,
        total_price: totalPrice,
        used: false,
        canceled:false,
        bookedAt: new Date()
      };

      await setDoc(ticketRef, ticketData);
      const ticketId = ticketRef.id; 

      const riderData = {
        rider_id: riderId,
        location: location.coords,
        picked: false,
        seats_booked: seatCount,
        total_price:totalPrice,
        ticket_code: ticketId,
        rider_notification_token:riderNotificationToken,
        rider_phone_number:riderPhoneNumber
      };

      const batch = writeBatch(DB);

      batch.update(activeTripRef, {
        riders: arrayUnion(riderData),
        seats_booked: increment(seatCount)
      });

      // Also update user doc with activeTripId
      const riderRef = doc(DB, "users", riderId);
      batch.update(riderRef, {
        activeTripId: tripId,
        tickets: arrayUnion(ticketId)
      });

      await batch.commit();

      // 🚀 Step 2: Check if car is now full
      const updatedSeatsBooked = activeTripData.seats_booked + seatCount;

      if (updatedSeatsBooked >= activeTripData.seats_capacity) {
        const intercityTripRef = doc(DB, "intercityTrips",intercityTripId);
  
        await runTransaction(DB, async (transaction) => {
          const intercityTripSnap = await transaction.get(intercityTripRef);
          if (!intercityTripSnap.exists()) {
            throw new Error("Intercity trip document does not exist!");
          }
  
          const intercityTripData = intercityTripSnap.data();
          const currentDrivers = intercityTripData.inStation || [];
          const currentInRoute = intercityTripData.inRoute || [];
  
          const driverToMove = currentDrivers.find(d => d.id === activeTripData.driver_id);
          if (!driverToMove) {
            console.log("Driver not found in drivers array!");
            return;
          }
  
          const updatedDrivers = currentDrivers.filter(d => d.id !== activeTripData.driver_id);
          const updatedInRoute = [...currentInRoute, driverToMove];

          transaction.update(intercityTripRef, {
            inStation: updatedDrivers,
            inRoute: updatedInRoute,
          });
  
          // 🚀 Get the next driver (first in line)
          const nextDriver = updatedDrivers[0];

          // 🚀 Send notification to next driver
          if (nextDriver?.driver_notification_token) {
            await sendBatchNotification(
              [nextDriver?.driver_notification_token],
              "استعد للرحلة القادمة",
              "لقد أصبحت السائق النشط التالي، الرجاء الاستعداد."
            );
          }
        });
      }

      // 🚀 Step 3: After successful booking, send notifications:
      const tokensToNotify = [];

      // Notify other riders in the trip
      if (activeTripData.riders && activeTripData.riders.length > 0) {
        activeTripData.riders.forEach(rider => {
            if (rider.rider_id !== riderId && rider.rider_notification_token) {
                tokensToNotify.push(rider.rider_notification_token);
            }
        });
      }

      // Notify the driver also
      if (activeTripData?.driver_notification_token) {
        tokensToNotify.push(activeTripData?.driver_notification_token);
      }

      // Send notifications
      if (tokensToNotify.length > 0) {
        await sendBatchNotification(
          tokensToNotify,
          "راكب جديد انضم للرحلة",
          "راكب جديد قام بالحجز لهذه الرحلة."
        );
      }

      alert("تم حجز الرحلة بنجاح");
    
    } catch (error) {
      console.log("Booking error:", error);
      alert("حدث خطأ أثناء الحجز، حاول مرة أخرى.");
    }  finally {
      setBookingTheTrip(false)
      router.push('/dailyTrips');
    } 
  };

  // Loading trip info ...
  if (!trip || !driverInfo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading_container}>
          <ActivityIndicator size="large" color={colors.PRIMARY}/>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      
      <View style={styles.trip_infos_box}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back-outline" size={20} color={colors.DARKGRAY} />
        </TouchableOpacity>
        <View style={styles.title}>
          <Text style={styles.titleText}>{from}</Text>
          <FontAwesome name="long-arrow-left" size={12} color="black" />
          <Text style={styles.titleText}>{to}</Text>
        </View>
      </View>
      
      <View style={styles.driver_infos_box}>
        <View style={styles.driverInfo}>
          <View style={styles.driverCarInfo}>
            <View style={styles.price}>
              <Text style={styles.priceText}>{tripPrice.toLocaleString()}</Text>
              <Text style={styles.priceText}>دينار</Text>
            </View>
            <View style={styles.price}>
              <Text style={styles.priceText}>{seatsAvailable}</Text>
              <Text style={styles.priceText}>مقاعد متاحة</Text>
            </View>
            <View style={styles.driverCarInfoImageBox}>
              <Image 
                source={{uri:driverInfo.driver_car_image}} 
                style={styles.driverCarInfoImage}
              />
            </View>
            <View style={styles.driverCarInfoTextBox}>
              <Text style={styles.driverInfoText}>موديل {driverInfo.driver_car_model || '---'} - {driverInfo.driver_car_plate || '---'}</Text>
            </View>
          </View>

          <View style={styles.driverPersonalInfo}>
            <View style={styles.driverPersonalInfoImageBox}>
              <Image 
                source={{uri:driverInfo.driver_personal_image}} 
                style={styles.driverPersonalInfoImage}
              />
            </View>
            <Text style={styles.driverPersonalInfoText}>{driverInfo.driver_full_name} {driverInfo.driver_family_name}</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.bookingBox}>
        <View style={styles.number_seat_booked_box}>
          <TouchableOpacity onPress={decrementSeat} style={{height:60,alignItems:'center'}}>
            <EvilIcons name="minus" size={28} style={{lineHeight:60}} />
          </TouchableOpacity >
          <Text style={styles.seatCountText}>{seatCount}</Text>
          <TouchableOpacity onPress={incrementSeat} style={{height:60,alignItems:'center'}}>
            <EvilIcons name="plus" size={28} style={{lineHeight:60}} />
          </TouchableOpacity >
        </View>

        {bookingTheTrip ? (
          <View style={styles.bookButton}>
            <ActivityIndicator size="small" color={colors.WHITE}/>
          </View>
        ) : (
          <TouchableOpacity 
            onPress={bookTrip}
            disabled={seatsAvailable === 0 || bookingTheTrip}
            style={[
              styles.bookButton,
              seatsAvailable === 0 && styles.bookButtonDisabled
            ]}
          >
            <Text style={styles.bookText}>احجز</Text>
            <Text style={styles.bookText}>-</Text>
            <Text style={styles.bookText}>{totalPrice.toLocaleString()} دينار</Text>
          </TouchableOpacity>
        )}
        
      </View>

    </SafeAreaView>
  );
}

export default TripResult

const styles = StyleSheet.create({
  container: { 
    flex: 1 ,
    alignItems:'center',
    justifyContent:'center',
    backgroundColor: '#f5f5f5',
  },
  trip_infos_box:{
    width:330,
    height:60,
    borderRadius:15,
    backgroundColor: '#fff',
    flexDirection:'row',
    justifyContent:'center',
    alignItems:'center',
    borderColor:colors.GRAY,
    borderWidth:1,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    position:'relative',
  },
  title:{
    flexDirection:'row-reverse',
    alignItems:'center',
    justifyContent:'center',
    gap:10,
  },
  titleText:{
    lineHeight:60,
    fontFamily:'Cairo_400Regular',
    textAlign:'center',
    fontSize:15,
  },
  backButton: { 
    position:'absolute',
    top:0,
    left:15,
    height:60,
    justifyContent:'center',
    alignItems:'center',
  },
  driver_infos_box:{
    marginTop:20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverInfo: { 
    width:330,
    height:400,
    backgroundColor: '#fff',
    borderRadius:15,
    justifyContent:'space-between',
    alignItems:'center',
    borderColor:colors.GRAY,
    borderWidth:1,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
  },
  driverCarInfo:{
    height:320,
    justifyContent:'space-between',
    alignItems:'center',
  },
  price:{
    height:40,
    flexDirection:'row-reverse',
    alignItems:'center',
    justifyContent:'center',
    gap:5,
  },
  priceText:{
    fontFamily:'Cairo_700Bold',
    textAlign:'center',
    fontSize:14,
    lineHeight:40,
  },
  carSeatImage:{
    height:22,
    width:22
  },
  driverCarInfoImageBox:{
    width: 200,
    height: 200,
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
  driverCarInfoTextBox:{
    height:30,
  },
  driverInfoText:{
    fontFamily:'Cairo_400Regular',
    textAlign:'center',
    fontSize:13,
    lineHeight:30
  },
  driverPersonalInfo:{
    width:'100%',
    height:60,
    flexDirection:'row-reverse',
    justifyContent:'center',
    alignItems:'center',
    borderTopWidth:1,
    borderTopColor:'#ddd',
    position:'relative'
  },
  driverPersonalInfoText:{
    fontFamily:'Cairo_400Regular',
    textAlign:'center',
    fontSize:14,
    lineHeight:50,
  },
  driverPersonalInfoImageBox:{
    width:50,
    height:50,
    justifyContent:'center',
    alignItems:'center',
    borderRadius:50,
    borderColor:colors.BLUE,
    borderWidth:1,
    position:'absolute',
    right:30,
    top:5
  },
  driverPersonalInfoImage:{
    height:45,
    width:45,
    resizeMode:'cover',
    borderRadius: 45,
  },
  bookingBox: { 
    alignItems:'center',
  },
  number_seat_booked_box:{
    width:330,
    height:60,
    marginTop:20,
    borderRadius:15,
    backgroundColor: '#fff',
    flexDirection:'row',
    justifyContent:'center',
    alignItems:'center',
    gap:50,
    borderColor:colors.GRAY,
    borderWidth:1,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
  },
  seatCountText:{
    lineHeight:60,
    fontFamily:'Cairo_700Bold',
    fontSize: 16
  },
  bookButton: {
    width:330,
    height:60,
    flexDirection:'row-reverse',
    alignItems:'center',
    justifyContent:'center',
    gap:5,
    marginTop:20,
    backgroundColor: colors.BLUE,
    borderRadius: 15,
    alignItems: 'center',
    borderColor:colors.BLUE,
    borderWidth:1,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
  },
  bookButtonDisabled: {
    backgroundColor: '#CCCCCC',
    borderColor:'#CCCCCC'
  },
  bookText: { 
    lineHeight:60,
    fontFamily:'Cairo_400Regular',
    color: '#fff', 
    fontSize: 16 
  },
  loading_container:{
    flex: 1,
    flexDirection:'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
