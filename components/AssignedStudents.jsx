import { StyleSheet, Text, View } from 'react-native'
import React from 'react'

const AssignedStudents = ({item}) => {

  const birthdate = new Date(item.student_birth_date.seconds * 1000);

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
        <Text style={styles.student_info_text}>{item.student_full_name}</Text>
        <Text style={styles.student_info_text}>{item.student_family_name}</Text>
      </View>

      <Text style={styles.student_info_text}>{userAge} سنة</Text>
      <Text style={styles.student_info_text}>{item.student_school}</Text> 

      <View style={styles.student_info_box}>
        <Text style={styles.student_info_text}>{item.student_state}</Text> 
        <Text style={styles.student_info_text}>/</Text> 
        <Text style={styles.student_info_text}>{item.student_city}</Text>
      </View>
        <Text style={styles.student_info_text}>{item.student_street}</Text>
        <Text style={styles.student_info_text}>{item.student_home_address}</Text>
      

    </View>
  )
}

export default AssignedStudents

const styles = StyleSheet.create({
  container:{
    margin:10,
    paddingVertical:10,
    alignItems:'center',
    backgroundColor:'#F6F8FA',
    borderRadius:15
  },
  student_info_box:{
    width:350,
    flexDirection:'row-reverse',
    justifyContent:'center',
    alignItems:'center',
  },
  student_info_text:{ 
    fontFamily:'Cairo_400Regular',
    fontSize:14,
    marginHorizontal:2,
    marginVertical:5
  },
})