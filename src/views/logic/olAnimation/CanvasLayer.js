/**
 * 基于canvas创建自定义图层并添加到ol地图上 的工具类（配合openlayer使用）
 *
 * 维护记录：
 * ——————— 创建 - 高旭龙 - 2021.8.23
 */

class CanvasLayer
{
  constructor(options)
  {
    this.options = options || {}
    this.paneName = this.options.paneName || 'labelPane'
    this.zIndex = this.options.zIndex || 0
    this._map = options.map
    this._lastDrawTime = null
    this.initialize()
    this.show()
  }

  /**
   * 初始化。创建画布，根据地图尺寸设置样式、注册相关事件
   * @method
   */
  initialize()
  {
    this.canvas = document.createElement('canvas')
    this.ctx = this.canvas.getContext('2d')
    this.canvas.style.cssText = 'position:absolute;' + 'left:0;' + 'top:0;' + 'z-index:' + this.zIndex + ';'
    this.adjustSize()
    this.adjustRatio(this.ctx)
    this._map.getViewport().appendChild(this.canvas)
    this._map.getView().on('propertychange', this.hide.bind(this))
    this._map.on('moveend', this.onMoveend.bind(this))
    this._map.on('change', this.onMoveend.bind(this))
    return this.canvas
  }

  destroy()
  {
    this._map.getViewport().removeChild(this.canvas)
  }

  /**
   * 地图发生拖拽或者缩放时的响应函数
   * @method
   */
  onMoveend()
  {
    this.show()
    this.adjustSize()
    this._draw()
  }

  /**
   * 根据传入地图的尺寸，设置canvas画布的宽高
   * @method
   */
  adjustSize()
  {
    const size = this._map.getSize()
    this.canvas.width = size[0]
    this.canvas.height = size[1]
    this.canvas.style.width = this.canvas.width + 'px'
    this.canvas.style.height = this.canvas.height + 'px'
  }

  /**
   * 根据当前2d上下文对象状态和画布的宽高，设置渲染对象的缩放级别
   * @param       {Object}     ctx       当前画布的 2d渲染上下文对象
   */
  adjustRatio(ctx)
  {
    const backingStore = ctx.backingStorePixelRatio || ctx.webkitBackingStorePixelRatio || ctx.mozBackingStorePixelRatio || ctx.msBackingStorePixelRatio || ctx.oBackingStorePixelRatio || ctx.backingStorePixelRatio || 1
    const pixelRatio = (window.devicePixelRatio || 1) / backingStore
    const canvasWidth = ctx.canvas.width
    const canvasHeight = ctx.canvas.height
    ctx.canvas.width = canvasWidth * pixelRatio
    ctx.canvas.height = canvasHeight * pixelRatio
    ctx.canvas.style.width = canvasWidth + 'px'
    ctx.canvas.style.height = canvasHeight + 'px'
    ctx.scale(pixelRatio, pixelRatio)
  }

  /**
   * 绘制。（地图发生拖拽或者缩放时，会调用该函数）
   * @method
   */
  _draw()
  {
    const size = this._map.getSize()
    const center = this._map.getView().getCenter()
    if (center)
    {
      const pixel = this._map.getPixelFromCoordinate(center)
      this.canvas.style.left = pixel[0] - size[0] / 2 + 'px'
      this.canvas.style.top = pixel[1] - size[1] / 2 + 'px'
      this.options.update && this.options.update.call(this)
    }
  }

  /**
   * 获取canvas的容器dom元素
   * @returns     {Dom}       canvas所在的dom对象
   */
  getContainer()
  {
    return this.canvas
  }

  /**
   * 显示canvas画布
   * @method
   */
  show()
  {
    this.canvas.style.display = 'block'
  }

  /**
   * 隐藏canvas画布
   * @method
   */
  hide()
  {
    this.canvas.style.display = 'none'
  }

  /**
   * 设置canvas所在dom的z-index
   * @method
   * @param   {Number}      zIndex        dom显示级别
   */
  setZIndex(zIndex)
  {
    this.canvas.style.zIndex = zIndex
  }

  getZIndex()
  {
    return this.zIndex
  }
}

export default CanvasLayer
