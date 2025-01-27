import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

const AssignedStudents = ({item}) => {
  
  const birthdate = new Date(item.birth_date.seconds * 1000)
  
  const calculateAge = (birthdate) => {
    const today = new Date();
    const birthYear = birthdate.getFullYear();
    const birthMonth = birthdate.getMonth();
    const birthDay = birthdate.getDate();
  
    let age = today.getFullYear() - birthYear;
  
    // Check if the birthday has passed this year
    if (
      today.getMonth() < birthMonth ||
      (today.getMonth() === birthMonth && today.getDate() < birthDay)
    ) {
      age--; // If the birthday hasn't passed yet, subtract one from the age
    }
  
    return age;
  }

  const userAge = calculateAge(birthdate);

  return (
    <View style={styles.container}>
      <View style={styles.student_info_box}>
        <Text style={styles.student_info}>{item.name}</Text>
        <Text style={styles.student_info}>{item.family_name}</Text>
        <Text style={{marginHorizontal:5}}>-</Text>
        <Text style={styles.student_info}>{userAge} سنة</Text>
      </View>
      <Text style={styles.student_info}>{item.student_street} - {item.student_city} - {item.student_state}</Text>
    </View>
  )
}

export default AssignedStudents

const styles = StyleSheet.create({
  container:{
    width:340,
    height:60,
    marginVertical:10,
    alignItems:'center',
    justifyContent:'center',
    borderRadius:15,
    backgroundColor:'#f0f0f0'
  },
  student_info_box:{
    flexDirection:'row-reverse',
    justifyContent:'center',
    alignItems:'center',
    height:30,
  },
  student_info:{
    height:30,
    verticalAlign:'middle',
    fontFamily:'Cairo_400Regular',
    fontSize:14,
    marginHorizontal:4
  },
})