import { StyleSheet, Text, View,TouchableOpacity,ActivityIndicator } from 'react-native'
import colors from '../constants/Colors'
import Ionicons from '@expo/vector-icons/Ionicons'
import FontAwesome6 from '@expo/vector-icons/FontAwesome6'

const CustomeButton = ({title,icon,iconType,onPressHandler,disabledStatus,loading}) => {
  return (
    <>
        {loading ? (
            <TouchableOpacity style={styles.button}>
                <ActivityIndicator size="large" color={colors.WHITE} />
            </TouchableOpacity>
        ) : (
            <TouchableOpacity style={styles.button} onPress={onPressHandler} disabled={disabledStatus}>
                {icon &&
                <>
                {iconType === 'location' ? (
                    <Ionicons name="location-outline" size={24} style={styles.icon} />
                ) : (
                    <FontAwesome6 name="circle-check" size={24} style={styles.icon} />
                )}
                </>
                }
                <Text style={styles.text}>{title}</Text>
            </TouchableOpacity>
        )}
    </>
  )
}

export default CustomeButton

const styles = StyleSheet.create({
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
    text:{
        fontFamily:'Cairo_700Bold',
        fontSize:15,
        color:colors.WHITE
    },
    icon:{
        marginRight:10,
        color:colors.WHITE
    }
})

/*
<CustomeButton 
            title={'أضف'}
            onPressHandler={addNewDriverHandler}
            disabledStatus={!userData || !location || !carModel || !carPlate}
          />
          <Text style={styles.location_warning_text}>* يرجى التأكد من ادخال جميع البيانات</Text>
          <CustomeButton 
            title={'الغاء'}
            onPressHandler={clearFormHandler}
          />
*/