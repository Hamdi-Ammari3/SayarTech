import { StyleSheet, TextInput, View } from 'react-native'
import React from 'react'
import colors from '../constants/Colors'

const CustomeInput = ({placeholderText,...props}) => {
  return (
    <View>
      <TextInput 
      {...props} 
      style={styles.input} />
    </View>
  )
}

export default CustomeInput

const styles = StyleSheet.create({
    input:{
        width:280,
        height:50,
        marginBottom:10,
        borderWidth:1,
        borderColor:colors.PRIMARY,
        borderRadius:15,
        color:colors.BLACK,
        textAlign:'center',
        fontFamily:'Cairo_400Regular'
    },
})