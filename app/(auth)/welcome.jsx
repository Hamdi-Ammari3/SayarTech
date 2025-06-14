import {useState} from 'react'
import { StyleSheet,View,Image,Text,TouchableOpacity } from 'react-native'
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import LottieView from "lottie-react-native"
import logo from '../../assets/images/logo.jpg'
import colors from '../../constants/Colors'
import schoolBus from '../../assets/animations/school_bus.json'
import schedule from '../../assets/animations/schedule.json'
import driver from '../../assets/animations/driver.json'
import mapTracking from '../../assets/animations/map_tracking.json'
import AntDesign from '@expo/vector-icons/AntDesign'

const welcome = () => {

  const totalSteps = 4;
  const [currentPage, setCurrentPage] = useState(1)

  // Go to next page
  const handleNext = () => {
    if (currentPage < totalSteps) setCurrentPage(currentPage + 1)
  }
    
  // Return to previous page
  const handlePrevious = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1)
  }

  const onPressHandler = () => {
    router.push("(auth)/login")
  };

  // Render full pages
  const renderPage = () => {
    switch(currentPage) {
      case 1:
        return(
          <View style={styles.text_container}>
            <Text style={styles.text_title}>الحل الأفضل لنقل الطلاب</Text>
            <Text style={styles.text_content}>
              تطبيق "Safe" هو الحل الأمثل اللي يجمع السواقين الموثوقين ويخليك تراقب الرحلة، وتنظم جدولك اليومي بكل سهولة.
            </Text>
            <View style={styles.animation_container}>
              <LottieView
                source={schoolBus}
                autoPlay
                loop
                style={{ width: 160, height: 160,borderRadius:10}} // Ensures it fills the button
              />
            </View>
          </View>
        )
      case 2:
        return(
          <View style={styles.text_container}>
            <Text style={styles.text_title}>خدمات منظمة</Text>
            <Text style={styles.text_content}>
              عن طريق تطبيقنا، تقدر تنظم مواعيد الرحلات وتتابع كل خطوة. كلش سهل!
            </Text>
            <View style={styles.animation_container}>
              <LottieView
                source={schedule}
                autoPlay
                loop
                style={{ width: 200, height: 200,borderRadius:10}} // Ensures it fills the button
              />
            </View>
          </View>
        )
      case 3:
        return(
          <View style={styles.text_container}>
            <Text style={styles.text_title}>سواقين موثوقين</Text>
            <Text style={styles.text_content}>
              سواقين مدربين ومختارين بعناية، نضمنلك الراحة والأمان وانت تتنقل.
            </Text>
            <View style={styles.animation_container}>
              <LottieView
                source={driver}
                autoPlay
                loop
                style={{ width: 200, height: 200,borderRadius:10}} // Ensures it fills the button
              />
            </View>
          </View>
        )
      case 4:
        return(
          <View style={styles.text_container}>
            <Text style={styles.text_title}>مراقبة الرحلة</Text>
            <Text style={styles.text_content}>مع تطبيقنا، عندك عين على كل شي! راقب رحلتك بوقت حقيقي وتطمن أكثر على أولادك.</Text>
            <View style={styles.animation_container}>
              <LottieView
                source={mapTracking}
                autoPlay
                loop
                style={{ width: 200, height: 200,borderRadius:10}} // Ensures it fills the button
              />
            </View>
            <TouchableOpacity 
              style={styles.start_now_button}
              onPress={onPressHandler}
            >
              <Text style={styles.start_now_button_text}>ابدا الان</Text>
            </TouchableOpacity>
          </View>
        )
      default:
        null;
    }
  }

  // Page indicator component
  const renderPageIndicator = () => {
    return (
      <View style={styles.page_indicator_container}>
        <View style={styles.page_indicator_buttons_container}>
          {currentPage > 1 && (
            <TouchableOpacity style={styles.page_indicator_button} onPress={handlePrevious}>
              <AntDesign name="left" size={24} color={colors.BLUE}/>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.page_indicator_dots}>
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
        <View style={styles.page_indicator_buttons_container}>
          {currentPage < totalSteps && (
            <TouchableOpacity style={styles.page_indicator_button} onPress={handleNext}>
              <AntDesign name="right" size={24} color={colors.BLUE}/>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };
  
  return (
    <>
      <StatusBar style="auto"/>
      <SafeAreaView style={styles.container}>
        <View style={styles.image_text_container}>
          <View style={styles.image_container}>
            <Image style={styles.image} source={logo}/>
          </View>
          {renderPage()}
          {renderPageIndicator()}
        </View>
      </SafeAreaView>
    </>
  )
}

export default welcome

const styles = StyleSheet.create({
  container:{
    flex:1,
    backgroundColor:colors.WHITE,
  },
  image_text_container:{
    width:'100%',
    alignItems:'center',
    justifyContent:'center',
  },
  image_container:{
    width:'100%',
    height:200,
    alignItems:'center',
    justifyContent:'center',
  },
  image:{
    width:150,
    height:150,
    resizeMode:'contain',
  },
  text_container:{
    width:'100%',
    height:400,
    justifyContent:'center',
    alignItems:'center',
  },
  text_title:{
    fontFamily:'Cairo_700Bold',
    textAlign:'center',
    marginBottom:10
  },
  text_content:{
    width:'80%',
    fontFamily:'Cairo_400Regular',
    textAlign:'center'
  }, 
  animation_container:{
    width:200,
    height:200,
    justifyContent:'center',
    alignItems:'center',
    marginTop:25,
  },
  start_now_button:{
    width:120,
    height:40,
    justifyContent:'center',
    alignItems:'center',
    marginVertical:25,
    borderRadius:15,
    backgroundColor:colors.BLUE
  },
  start_now_button_text:{
    lineHeight:40,
    fontFamily:'Cairo_400Regular',
    textAlign:'center',
    color:colors.WHITE
  },
  page_indicator_container:{ 
    width:300,
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems:'center',
  },
  page_indicator_dots:{
    width:100,
    flexDirection: 'row', 
    justifyContent: 'center', 
  },
  pageIndicator: { 
    width: 13, 
    height: 13, 
    borderRadius: 10,
    margin: 5 
  },
  activeIndicator: { 
    backgroundColor: colors.PRIMARY
  },
  inactiveIndicator: { 
    backgroundColor: '#CCC' 
  },
  page_indicator_buttons_container:{
    width:50,
    flexDirection:'row',
    justifyContent:'center',
    alignItems:'center',
  },
  page_indicator_button:{
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'center'
  },
})
