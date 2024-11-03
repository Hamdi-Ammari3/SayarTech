import { Tabs } from 'expo-router'
import colors from '../../../../constants/Colors'
import Ionicons from '@expo/vector-icons/Ionicons'
import FontAwesome5 from '@expo/vector-icons/FontAwesome5'
import AntDesign from '@expo/vector-icons/AntDesign'

const TabsLayout = () => {
  return (
    <Tabs screenOptions={{
      tabBarShowLabel:false,
      tabBarActiveTintColor:colors.PRIMARY,
      tabBarInactiveTintColor:'#3333',
    }}>
        <Tabs.Screen name='home' options={{headerShown:false,
          title:'Home',
          tabBarIcon:({color}) => <Ionicons name="home" size={24} color={color} />}}
        />
        <Tabs.Screen name='addData' options={{headerShown:false,
          title:'Add Data',
          tabBarIcon:({color}) => <AntDesign name="plussquare" size={24} color={color}/>}}
        />
        <Tabs.Screen name='profile' options={{headerShown:false,
          title:'Profile',
          tabBarIcon:({color}) => <FontAwesome5 name="user-alt" size={22  } color={color}/>}}/>
    </Tabs>
  )
}
export default TabsLayout