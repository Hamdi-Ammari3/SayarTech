import { StyleSheet,View,Image,Text,TouchableOpacity } from 'react-native'
import { SafeAreaView } from "react-native-safe-area-context"
import React from 'react'
import logo from '../../assets/images/logo.jpeg'
import colors from '../../constants/Colors'
import { router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

const welcome = () => {

  const onPressHandler = () => {
    router.push('(auth)/login')
  }
  
  return (
    <>
    <StatusBar style="auto"/>
    <SafeAreaView style={styles.container}>
      <View style={styles.box}>
        <View style={styles.image_button_container}>
          <View style={styles.image_container}>
            <Image style={styles.image} source={logo}/>
          </View>
          <TouchableOpacity style={styles.button} onPress={onPressHandler}>
            <View style={styles.btnView}>
              <Text style={styles.btntext}>ابدأ الآن</Text>
            </View>
          </TouchableOpacity>
        </View>
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
  button:{
    width:280,
    height:50,
    marginBottom:10,
    backgroundColor:colors.PRIMARY,
    borderRadius:15,
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'center'
  },
  btnView:{
    height:50,
    alignItems:'center',
    justifyContent:'center',
  },  
  btntext:{
    fontFamily:'Cairo_700Bold',
    fontSize:15,
    color:colors.WHITE,
  },
})
