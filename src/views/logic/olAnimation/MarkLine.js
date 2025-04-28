/**
 * 基于canvas绘制带游标的线段，支持自定义样式、曲线化 的工具类（配合openlayer使用）
 *
 * 维护记录：
 * ——————— 创建 - 高旭龙 - 2021.8.23
 */

class MarkLine
{
  // 默认参数
  defOptions =
    {
      moveSpeed: 1,                       // 游标移动速度
      deltaAngle: -0.2,                   // 线段曲线化角度，默认-0.2。设为0就是不偏移（直线）
      lineType: 'solid',                  // 线条类型 solid、dashed、dotted
      lineWidth: 1,                       // 线条宽度
      fillColor: 'rgba(204,3,125,0.8)',   // 线条颜色
      moveRadius: 2,                      // 移动点半径
      moveColor: '#fff',                  // 移动点颜色
      shadowColor: '#fff',                // 移动点阴影颜色
      shadowBlur: 5                       // 移动点阴影大小
    }

  /**
   * 调用参数说明
   * @param       {Object}        opts                                                参数对象
   * @param       {ol.Map}        opts.map                                            map实例对象
   * @param       {Object}        opts.begin                                          起始点配置对象，详细结构见Marker.js
   * @param       {Object}        opts.end                                            终止点配置对象，详细结构见Marker.js
   * @param       {Object}        [opts.options]                                      各类参数配置对象
   * @param       {Number}        [opts.options.moveSpeed=1]                          游标移动速度，默认1
   * @param       {String}        [opts.options.lineType='solid']                     线条类型 solid、dashed、dotted
   * @param       {Number}        [opts.options.lineWidth=1]                          线条宽度
   * @param       {String}        [opts.options.fillColor='rgba(204,3,125,0.8)']      线条颜色
   * @param       {Number}        [opts.options.moveRadius=2]                         移动点半径
   * @param       {String}        [opts.options.moveColor='#fff']                     移动点颜色
   * @param       {String}        [opts.options.shadowColor='#fff']                   移动点阴影颜色
   * @param       {Number}        [opts.options.shadowBlur=5]                         移动点阴影大小
   * @param       {}
   */
  constructor(opts)
  {
    this.map = opts.map
    this.options = {...this.defOptions, ...opts.options}
    this.begin = opts.begin
    this.end = opts.end
    this.step = 0
  }

  getPointList(from, to)
  {
    let points = [[from[0], from[1]], [to[0], to[1]]]
    const ex = points[1][0]
    const ey = points[1][1]
    points[3] = [ex, ey]
    points[1] = this.getOffsetPoint(points[0], points[3])
    points[2] = this.getOffsetPoint(points[3], points[0])
    points = this.smoothSpline(points, false)
    // 修正最后一点在插值产生的偏移
    points[points.length - 1] = [ex, ey]
    return points
  }

  /**
   * 根据起点、终点，进行偏移得到中间点坐标
   * @method
   * @param         {Array<Number>}     start         起点坐标
   * @param         {Array<Number>}     end           终点坐标
   * @returns       {Array<Number>}     偏移后的中间点坐标
   */
  getOffsetPoint(start, end)
  {
    const distance = this.getDistance(start, end) / 3 // 除以3？
    let angle, dX, dY
    const mp = [start[0], start[1]]
    const deltaAngle = this.options.deltaAngle // 偏移0.2弧度
    if (start[0] !== end[0] && start[1] !== end[1])
    {
      // 斜率存在
      const k = (end[1] - start[1]) / (end[0] - start[0])
      angle = Math.atan(k)
    }
    else if (start[0] === end[0])
    {
      // 垂直线
      angle = (start[1] <= end[1] ? 1 : -1) * Math.PI / 2
    }
    else
    {
      // 水平线
      angle = 0
    }
    if (start[0] <= end[0])
    {
      angle -= deltaAngle
      dX = Math.round(Math.cos(angle) * distance)
      dY = Math.round(Math.sin(angle) * distance)
      mp[0] += dX
      mp[1] += dY
    }
    else
    {
      angle += deltaAngle
      dX = Math.round(Math.cos(angle) * distance)
      dY = Math.round(Math.sin(angle) * distance)
      mp[0] -= dX
      mp[1] -= dY
    }
    return mp
  }

  smoothSpline(points, isLoop)
  {
    const len = points.length
    const ret = []
    let distance = 0
    for (let i = 1; i < len; i++)
      distance += this.getDistance(points[i - 1], points[i])
    let segs = distance / 2
    segs = segs < len ? len : segs
    for (let i = 0; i < segs; i++)
    {
      const pos = i / (segs - 1) * (isLoop ? len : len - 1)
      const idx = Math.floor(pos)
      const w = pos - idx
      let p0
      const p1 = points[idx % len]
      let p2
      let p3
      if (!isLoop)
      {
        p0 = points[idx === 0 ? idx : idx - 1]
        p2 = points[idx > len - 2 ? len - 1 : idx + 1]
        p3 = points[idx > len - 3 ? len - 1 : idx + 2]
      }
      else
      {
        p0 = points[(idx - 1 + len) % len]
        p2 = points[(idx + 1) % len]
        p3 = points[(idx + 2) % len]
      }
      const w2 = w * w
      const w3 = w * w2

      ret.push([this.interpolate(p0[0], p1[0], p2[0], p3[0], w, w2, w3), this.interpolate(p0[1], p1[1], p2[1], p3[1], w, w2, w3)])
    }
    return ret
  }

  interpolate(p0, p1, p2, p3, t, t2, t3)
  {
    const v0 = (p2 - p0) * 0.5
    const v1 = (p3 - p1) * 0.5
    return (2 * (p1 - p2) + v0 + v1) * t3 + (-3 * (p1 - p2) - 2 * v0 - v1) * t2 + v0 * t + p1
  }

  getDistance(p1, p2)
  {
    return Math.sqrt((p1[0] - p2[0]) * (p1[0] - p2[0]) + (p1[1] - p2[1]) * (p1[1] - p2[1]))
  }

  drawMarker(context)
  {
    this.begin.draw(context)
    this.end.draw(context)
  }

  drawLinePath(context)
  {
    const pointList = this.path = this.getPointList(this.map.getPixelFromCoordinate(this.begin.location), this.map.getPixelFromCoordinate(this.end.location))
    const len = pointList.length
    context.save()
    context.beginPath()
    context.lineWidth = this.options.lineWidth
    context.strokeStyle = this.options.fillColor
    context.shadowColor = this.options.shadowColor
    context.shadowBlur = this.options.shadowBlur

    if (!this.options.lineType || this.options.lineType === 'solid')
    {
      context.moveTo(pointList[0][0], pointList[0][1])
      for (let i = 0; i < len; i++)
        context.lineTo(pointList[i][0], pointList[i][1])
    }
    else if
    (this.options.lineType === 'dashed' || this.options.lineType === 'dotted')
    {
      for (let i = 1; i < len; i += 2)
      {
        context.moveTo(pointList[i - 1][0], pointList[i - 1][1])
        context.lineTo(pointList[i][0], pointList[i][1])
      }
    }
    context.stroke()
    context.restore()
    this.step = 0 // 缩放地图时重新绘制动画
  };

  drawMoveCircle(context)
  {
    const pointList = this.path || this.getPointList(this.map.getPixelFromCoordinate(this.begin.location), this.map.getPixelFromCoordinate(this.end.location))

    // 根据this.step获取当前点位坐标
    let curPoint
    // 如果this.step是整数，直接取
    if (Number(this.step) % 1 === 0)
      curPoint = pointList[this.step]
    else
    {
      // 获取前后点坐标
      const [lastPoint, nextPoint] = [pointList[Math.floor(this.step)], pointList[Math.floor(this.step) + 1]]
      // 根据小数点占得比例构造当前点坐标
      const scale = this.step - Math.floor(this.step)
      curPoint = [lastPoint[0] + scale * (nextPoint[0] - lastPoint[0]), lastPoint[1] + scale * (nextPoint[1] - lastPoint[1])]
    }
    const updStep = () =>
    {
      this.step += this.options.moveSpeed || 1
      if (this.step >= pointList.length - 1)
        this.step = 0
    }
    if (!curPoint)
      return updStep()

    context.save()
    context.fillStyle = this.options.moveColor
    context.shadowColor = this.options.shadowColor
    context.shadowBlur = this.options.shadowBlur
    context.beginPath()
    context.arc(curPoint[0], curPoint[1], this.options.moveRadius, 0, Math.PI * 2, true)
    context.fill()
    context.closePath()
    context.restore()
    updStep()
  }
}

export default MarkLine
