import React,{useState} from 'react'
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
          </View>
        )
      default:
        null;
    }
  }
  
  return (
    <>
      <StatusBar style="auto"/>
      <SafeAreaView style={styles.container}>

        <View style={styles.image_text_container}>
          <View style={styles.image_container}>
            <Image style={styles.image} source={logo}/>
          </View>
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
            <TouchableOpacity style={styles.halfButton} onPress={onPressHandler}>
              <Text style={styles.btnText}>ابدا الان</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </>
  )
}

export default welcome

const styles = StyleSheet.create({
  container:{
    width:'100%',
    height:'100%',
    backgroundColor:colors.WHITE,
  },
  image_text_container:{
    width:'100%',
    alignItems:'center',
    justifyContent:'center'
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
  BtnHalfContainer:{
    height:100,
    width:'100%',
    flexDirection:'row',
    justifyContent:'center',
    alignItems:'center',
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
  finalBtnContainer:{
    width:'100%',
    marginTop:10,
    alignItems:'center',
    justifyContent:'center',
  },
  btnText:{
    lineHeight:50,
    verticalAlign:'middle',
    fontFamily:'Cairo_700Bold',
    fontSize:15,
    color:colors.WHITE
  },
})
