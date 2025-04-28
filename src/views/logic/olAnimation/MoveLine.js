/**
 * 基于canvas绘制流动线条 的工具类（配合openlayer使用）
 *
 * 维护记录：
 * ——————— 创建 - 高旭龙 - 2021.8.23
 */

import CanvasLayer from './CanvasLayer'
import MarkLine from './MarkLine'
import Marker from './Marker'

class MoveLine
{
  // 默认参数
  defOptions =
    {
      markerRadius: 3,                            // marker点半径
      markerColor: '#fff',                        // marker点颜色,为空或null则默认取线条颜色
      lineType: 'solid',                          // 线条类型 solid、dashed、dotted
      lineWidth: 1,                               // 线条宽度
      colors: ['rgba(135,237,145,0.8)', 'rgba(102,204,255,0.8)', 'rgba(204,153,255,0.8)', 'rgba(255,153,153,0.8)', 'rgba(255,228,143,0.8)', 'rgba(204,3,125,0.8)'],                               //线条颜色
      strokeColor: '#fff',                        // 边框线条颜色
      moveRadius: 2,                              // 移动点半径
      moveColor: '#fff',                          // 移动点颜色
      shadowColor: '#fff',                        // 移动点阴影颜色
      shadowBlur: 5,                              // 移动点阴影大小
      textFont: '12px Microsoft YaHei',           // 文本字体属性
      textColor: '#fff'                          // 文本颜色
    }
  // 全局变量
  baseLayer = null
  animationLayer = null
  animationFlag = true
  markLines = []
  requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame || (callback => window.setTimeout(callback, 1000 / 60))

  /**
   * 调用参数说明
   * @param       {Object}                  opts                                                参数对象
   * @param       {ol.Map}                  opts.map                                            map实例对象
   * @param       {Array<MarkLine>}         [opts.data]                                         MarkLine类型的数据配置集合，具体格式见MarkLine.js
   * @param       {Object}                  [opts.options]                                      各类自定义参数配置对象
   * @param       {Number}                  [opts.options.markerRadius=3]                       marker点半径1
   * @param       {String}                  [opts.options.markerColor='#fff']                   marker点颜色,为空或null则默认取线条颜色1
   * @param       {String}                  [opts.options.lineType='solid']                     线条类型 solid、dashed、dotted1
   * @param       {Number}                  [opts.options.lineWidth=1]                          线条宽度1
   * @param       {Array<String>}           [opts.options.colors]                               线条随机颜色集合。
   * @param       {String}                  [opts.options.strokeColor='#fff']                   边框线条颜色1
   * @param       {Number}                  [opts.options.moveRadius=2]                         移动点半径1
   * @param       {String}                  [opts.options.moveColor='#fff']                     移动点颜色1
   * @param       {String}                  [opts.options.shadowColor='#fff']                   移动点阴影颜色1
   * @param       {Number}                  [opts.options.shadowBlur=5]                         移动点阴影大小1
   * @param       {String}                  [opts.options.textFont='12px Microsoft YaHei']      文本字体属性1
   * @param       {String}                  [opts.options.textColor='#fff']                     文本颜色1
   */
  constructor(opts)
  {
    this.map = opts.map
    this.width = this.map.getSize()[0]
    this.height = this.map.getSize()[1]
    this.data = opts.data
    this.options = {...this.defOptions, ...opts.options}
    this.baseLayer = new CanvasLayer({
      map: this.map,
      update: this.brush.bind(this)
    })
    this.animationLayer = new CanvasLayer({
      map: this.map,
      update: this.render.bind(this)
    })
    const drawFrame = _ =>
    {
      requestAnimationFrame(drawFrame)
      this.render()
    }
    drawFrame()
  }

  destroy()
  {
    this.baseLayer.destroy()
    this.animationLayer.destroy()
  }

  // 底层canvas渲染，标注，线条
  brush()
  {
    const baseCtx = this.baseLayer.canvas.getContext('2d')
    if (!baseCtx)
      return
    this.addMarkLine()
    baseCtx.clearRect(0, 0, this.width, this.height)
    this.markLines.forEach(line =>
    {
    //   line.drawMarker(baseCtx)
      line.drawLinePath(baseCtx)
    })
  }

  // 上层canvas渲染，动画效果
  render()
  {
    const animationCtx = this.animationLayer.canvas.getContext('2d')
    if (!animationCtx)
      return
    if (!this.animationFlag)
      return animationCtx.clearRect(0, 0, this.width, this.height)
    // animationCtx.clearRect(0, 0, this.width, this.height)
    // 设置拖尾效果
    animationCtx.fillStyle = 'rgba(0,0,0,0.93)'
    const prev = animationCtx.globalCompositeOperation
    animationCtx.globalCompositeOperation = 'destination-in'
    animationCtx.fillRect(0, 0, this.width, this.height)
    animationCtx.globalCompositeOperation = prev
    this.markLines.forEach(markLine =>
    {
      markLine.drawMoveCircle(animationCtx)
      markLine.drawMarker(animationCtx)
    })
  }

  addMarkLine()
  {
    this.markLines = []
    this.data.forEach((line, index) =>
    {
      const defColor = this.options.colors[index]
      this.markLines.push(new MarkLine({
        map: this.map,
        options: {fillColor: defColor, ...this.options, ...line.options},
        id: index,
        begin: new Marker({
          map: this.map,
          color: defColor,
          ...line.begin,
          options: {fillColor: defColor, ...this.options, ...line.begin.options}
        }),
        end: new Marker({
          map: this.map,
          color: defColor,
          ...line.end,
          options: {fillColor: defColor, ...this.options, ...line.end.options}
        })
      }))
    })
  }

  update(resetOpts)
  {
    this.options = {...this.options, ...resetOpts}
  }
}

export default MoveLine
