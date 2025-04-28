import coordtransform from 'coordtransform'

// WGS84转GCJ-02
function wgs84togcj02(lng, lat) {
  return coordtransform.wgs84togcj02(lng, lat)
}
// GCJ-02转BD-09
function gcj02tobd09(lng, lat) {
  return coordtransform.gcj02tobd09(lng, lat)
}
export { wgs84togcj02, gcj02tobd09 };
