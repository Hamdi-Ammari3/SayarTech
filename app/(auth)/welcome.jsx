import { StyleSheet, View,Image } from 'react-native'
import { SafeAreaView } from "react-native-safe-area-context"
import React from 'react'
import logo from '../../assets/images/logo.jpeg'
import CustomeButton from '../../components/CustomeButton'
import colors from '../../constants/Colors'
import { router } from 'expo-router'

const welcome = () => {

  const onPressHandler = () => {
    router.push('(auth)/login')
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.box}>
        <View style={styles.image_button_container}>
          <View style={styles.image_container}>
            <Image style={styles.image} source={logo}/>
          </View>
         <CustomeButton title='ابدأ الآن' onPressHandler={onPressHandler}/>
        </View>
      </View>
    </SafeAreaView>
  )
}

export default welcome

const styles = StyleSheet.create({
  container:{
    width:'100%',
    height:'100%',
    backgroundColor:colors.WHITE,
  },
  box:{
    width:'100%',
    height:'70%',
    alignItems:'center',
    justifyContent:'center',
  },
  image_button_container:{
    width:'100%',
    height:400,
    alignItems:'center',
    justifyContent:'space-between',
  },
  image_container:{
    width:'100%',
    height:300,
    alignItems:'center',
    justifyContent:'center',
    borderRadius:15,
    marginBottom:20,
  },
  image:{
    width:250,
    height:250,
    resizeMode:'contain',
    borderRadius:15
  },
})
