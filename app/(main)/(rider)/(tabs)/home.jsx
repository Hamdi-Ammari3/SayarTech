import { StyleSheet, Text, View, ActivityIndicator,Image,ScrollView,TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const home = () => {
  return (
    <SafeAreaView style={styles.container}>
        <View>
            <Text>Home Page</Text>
        </View>
    </SafeAreaView>
  )
}

export default home

const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#fff',
    },
})