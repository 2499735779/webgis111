<script setup>

import Map from '../Map.vue'
import VectorLayer from 'ol/layer/Vector.js'
import VectorSource from 'ol/source/Vector.js'
import {Fill, Stroke, Circle, Style} from 'ol/style.js'
import {MultiPoint, Point} from 'ol/geom.js'
import {Modify} from 'ol/interaction.js'
import {never, platformModifierKeyOnly, primaryAction} from 'ol/events/condition.js'
import {getCenter, getHeight, getWidth} from 'ol/extent.js'
import Feature from 'ol/Feature'
import LineString from 'ol/geom/LineString'
import Polygon from 'ol/geom/Polygon'

let selMap = null
const lineCoor = [[12758317.315499168, 3562866.9013162893], [12758017.315499168, 3562866.9013162893]]
const polygonCoor = [[[12758417.315499168, 3562866.9013162893],
  [12758917.315499168, 3562866.9013162893],
  [12758617.315499168, 3563166.9013162893],
  [12758417.315499168, 3562866.9013162893]]]

const style = new Style({
  geometry: (feature) =>
  {
    const modifyGeometry = feature.get('modifyGeometry')
    return modifyGeometry ? modifyGeometry.geometry : feature.getGeometry()
  },
  fill: new Fill({color: 'rgba(255, 255, 255, 0.4)',}),
  stroke: new Stroke({color: '#ffcc33', width: 2,}),
  image: new Circle({radius: 7, fill: new Fill({color: '#ffcc33',}),
  }),
})

const lineFeature = new Feature(new LineString(lineCoor))
const polygonFeature = new Feature(new Polygon(polygonCoor))
const vectorLayer = new VectorLayer({
  source: new VectorSource({
    features: [lineFeature, polygonFeature]
  }),
  style: (feature) =>
  {
    const styles = [style]
    const modifyGeometry = feature.get('modifyGeometry')
    const geometry = modifyGeometry ? modifyGeometry.geometry : feature.getGeometry()
    const result = calculateCenter(geometry)
    const center = result.center
    if (center)
    {
      styles.push(new Style({geometry: new Point(center),
        image: new Circle({radius: 4, fill: new Fill({color: '#ff3333'})})
      }))
      const coordinates = result.coordinates
      if (coordinates)
      {
        const minRadius = result.minRadius
        const sqDistances = result.sqDistances
        const rsq = minRadius * minRadius
        const points = coordinates.filter((coordinate, index) =>
        {
          return sqDistances[index] > rsq
        })
        styles.push(new Style({
          geometry: new MultiPoint(points),
          image: new Circle({radius: 4, fill: new Fill({color: '#33cc33'})})
        }))
      }
    }
    return styles
  },
})

const defaultStyle = new Modify({source: vectorLayer.getSource()})
  .getOverlay()
  .getStyleFunction()

const modify = new Modify({
  source: vectorLayer.getSource(),
  condition: (event) =>
  {
    return primaryAction(event) && !platformModifierKeyOnly(event)
  },
  deleteCondition: never,
  insertVertexCondition: never,
  style: (feature) =>
  {
    feature.get('features').forEach((modifyFeature) =>
    {
      const modifyGeometry = modifyFeature.get('modifyGeometry')
      if (modifyGeometry)
      {
        const point = feature.getGeometry().getCoordinates()
        let modifyPoint = modifyGeometry.point
        if (!modifyPoint)
        {
          modifyPoint = point
          modifyGeometry.point = modifyPoint
          modifyGeometry.geometry0 = modifyGeometry.geometry
          const result = calculateCenter(modifyGeometry.geometry0)
          modifyGeometry.center = result.center
          modifyGeometry.minRadius = result.minRadius
        }

        const center = modifyGeometry.center
        const minRadius = modifyGeometry.minRadius
        let dx, dy
        dx = modifyPoint[0] - center[0]
        dy = modifyPoint[1] - center[1]
        const initialRadius = Math.sqrt(dx * dx + dy * dy)
        if (initialRadius > minRadius)
        {
          const initialAngle = Math.atan2(dy, dx)
          dx = point[0] - center[0]
          dy = point[1] - center[1]
          const currentRadius = Math.sqrt(dx * dx + dy * dy)
          if (currentRadius > 0)
          {
            const currentAngle = Math.atan2(dy, dx)
            const geometry = modifyGeometry.geometry0.clone()
            geometry.scale(currentRadius / initialRadius, undefined, center)
            geometry.rotate(currentAngle - initialAngle, center)
            modifyGeometry.geometry = geometry
          }
        }
      }
    })
    return defaultStyle(feature)
  },
})

const changeInteraction = () =>
{
  if (modify !== null)
    selMap.removeInteraction(modify)
  if (modify !== null)
  {
    selMap.addInteraction(modify)
    modify.on('modifystart', (event) =>
    {
      event.features.forEach((feature) =>
      {
        feature.set(
          'modifyGeometry',
          {geometry: feature.getGeometry().clone()},
          true
        )
      })
    })

    modify.on('modifyend', (event) =>
    {
      event.features.forEach((feature) =>
      {
        const modifyGeometry = feature.get('modifyGeometry')
        if (modifyGeometry)
        {
          feature.setGeometry(modifyGeometry.geometry)
          feature.unset('modifyGeometry', true)
        }
      })
    })
  }
}

const calculateCenter = (geometry) =>
{
  let center, coordinates, minRadius
  const type = geometry.getType()
  if (type === 'Polygon')
  {
    let x = 0
    let y = 0
    let i = 0
    coordinates = geometry.getCoordinates()[0].slice(1)
    coordinates.forEach((coordinate) =>
    {
      x += coordinate[0]
      y += coordinate[1]
      i++
    })
    center = [x / i, y / i]
  }
  else if (type === 'LineString')
  {
    center = geometry.getCoordinateAt(0.5)
    coordinates = geometry.getCoordinates()
  }
  else
    center = getCenter(geometry.getExtent())
  let sqDistances
  if (coordinates)
  {
    sqDistances = coordinates.map((coordinate) =>
    {
      const dx = coordinate[0] - center[0]
      const dy = coordinate[1] - center[1]
      return dx * dx + dy * dy
    })
    minRadius = Math.sqrt(Math.max.apply(Math, sqDistances)) / 3
  }
  else
  {
    minRadius =
      Math.max(
        getWidth(geometry.getExtent()),
        getHeight(geometry.getExtent())
      ) / 3
  }
  return {
    center: center,
    coordinates: coordinates,
    minRadius: minRadius,
    sqDistances: sqDistances,
  }
}

const onGraRotateCreate = map =>
{
  selMap = map
  // 将图层添加到地图上
  map.addLayer(vectorLayer)
  changeInteraction()
}
</script>

<template>
  <Map @created="onGraRotateCreate"></Map>
</template>

<style>
</style>