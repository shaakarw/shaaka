import MapView from 'react-native-maps';

<MapView
  style={{ flex: 1 }}
  initialRegion={{
    latitude: -1.9441,
    longitude: 30.0619,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  }}
>
  <MapView.UrlTile
    urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    maximumZ={19}
  />
</MapView>