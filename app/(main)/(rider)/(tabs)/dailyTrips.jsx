import { StyleSheet, Text, View, ActivityIndicator,Image,ScrollView,TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const dailyTrips = () => {
  return (
    <SafeAreaView style={styles.container}>
        <View>
            <Text>daily trips</Text>
        </View>
    </SafeAreaView>
  )
}

export default dailyTrips

const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#fff',
    },
})