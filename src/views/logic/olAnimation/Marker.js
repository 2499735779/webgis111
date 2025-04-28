/**
 * 基于canvas绘制点/圆，支持动态辐射 的工具类（配合openlayer使用）
 *
 * 维护记录：
 * ——————— 创建 - 高旭龙 - 2021.8.23
 */

class Marker
{
  // 默认参数
  defOptions =
    {
      useFilker: true,                          // 是否启用动态辐射效果
      maxFilkerScale: 4,                        // 辐射时最大圆圈半径的比例倍数，默认为4
      markerRadius: 8,                          // 点半径
      scaleUnit: 0.03,                          // 辐射速度
      label: '',                                // 标注文本
      fillColor: 'rgba(135,237,145,0.8)',       // 填充颜色
      strokeColor: '#fff',                      // 边界线条颜色
      shadowColor: '#fff',                      // 点边界阴影颜色
      shadowBlur: 5,                            // 点边界阴影大小
      textFont: '12px Microsoft YaHei',         // 点文本字体属性
      textColor: '#fff'                         // 点文本颜色
    }
  /**
   * 调用参数说明
   * @param       {Object}                opts                                                参数对象
   * @param       {ol.Map}                opts.map                                            map实例对象
   * @param       {Array<Number>}         opts.location                                       点位坐标，如：[10,10]
   * @param       {Boolean}               [opts.options.useFilker=true]                       是否启用动态辐射效果
   * @param       {Number}                [opts.options.markerRadius=8]                       点半径
   * @param       {Number}                [opts.options.scaleUnit=0.03]                       辐射速度
   * @param       {String}                [opts.options.label='']                             标注文本
   * @param       {String}                [opts.options.fillColor='rgba(135,237,145,0.8)']    填充颜色
   * @param       {String}                [opts.options.strokeColor='#fff']                   边界线条颜色
   * @param       {String}                [opts.options.shadowColor='#fff']                   点边界阴影颜色
   * @param       {Number}                [opts.options.shadowBlur=5]                         点边界阴影大小
   * @param       {String}                [opts.options.textAlign='center']                   文本内容的当前对齐方式。center: 居中；start:从坐标位置开始，往后显示文字。end:在坐标左侧开始，到坐标位置结束
   * @param       {String}                [opts.options.textFont='12px Microsoft YaHei']      点文本字体属性
   * @param       {String}                [opts.options.textColor='#fff']                     点文本颜色
   */
  constructor(opts)
  {
    this.map = opts.map
    this.options = {...this.defOptions, ...opts.options}
    this.location = opts.location
    this.color = opts.color
    this.useFilker = opts.useFilker === undefined ? true : !!opts.useFilker
    this.index = 0
  }

  draw(context)
  {
    this.pixel = this.map.getPixelFromCoordinate(this.location)
    if (!this.pixel)
      return
    context.save()
    context.beginPath()
    context.fillStyle = this.options.fillColor || this.color
    context.strokeStyle = this.options.strokeColor || this.color
    context.shadowColor = this.options.shadowColor || this.color
    context.shadowBlur = this.options.shadowBlur
    // const radius = this.options.markerRadius
    const radius = this.useFilker ? this.options.markerRadius * (this.index % this.defOptions.maxFilkerScale + 1) : this.options.markerRadius
    context.arc(this.pixel[0], this.pixel[1], radius, 0, Math.PI * 2, true)
    context.closePath()
    context.fill()

    context.textAlign = this.options.textAlign || 'center'
    context.textBaseline = 'middle'
    context.font = this.options.textFont || '12px Microsoft YaHei'
    context.fillStyle = this.options.textColor || this.color
    context.fillText(this.options.label, this.pixel[0], this.pixel[1])
    context.restore()
    this.index += this.options.scaleUnit || 0.03
  }
}
export default Marker
