/**
 * @fileOverview
 * instance controls from native
 *
 * - init bundle
 * - fire event
 * - callback
 * - refresh
 * - destroy
 *
 * corresponded with the API of instance manager (framework.js)
 */

import { extend, typof, removeWeexPrefix } from '../util'
import renderer from '../config'
import {
  defineFn,
  bootstrap,
  register
} from './bundle'

/**
 * Init an app by run code with data.
 * In native renderer if the code is empty then we just prepare an instance
 * env only for run the real code later.
 * @param  {object} app
 * @param  {string} code
 * @param  {object} data
 */
export function init (app, code, data) {
  console.debug('[JS Framework] Intialize an instance with:\n', data)
  let result

  // prepare app env methods
  const bundleDefine = (...args) => defineFn(app, ...args)
  const bundleBootstrap = (name, config, _data) => {
    result = bootstrap(app, name, config, _data || data)
    updateActions(app)
    app.doc.listener.createFinish()
    console.debug(`[JS Framework] After intialized an instance(${app.id})`)
  }
  const bundleRegister = (...args) => register(app, ...args)
  const bundleRender = (name, _data) => {
    result = bootstrap(app, name, {}, _data)
  }
  const bundleRequire = name => _data => {
    result = bootstrap(app, name, {}, _data)
  }
  const bundleDocument = app.doc
  const bundleRequireModule = name => app.requireModule(removeWeexPrefix(name))

  // prepare code
  let functionBody
  /* istanbul ignore if */
  if (typeof code === 'function') {
    // `function () {...}` -> `{...}`
    // not very strict
    functionBody = code.toString().substr(12)
  }
  else if (code) {
    functionBody = code.toString()
  }

  // run code and get result
  const { WXEnvironment } = global
  if (WXEnvironment && WXEnvironment.platform !== 'Web') {
    // timer APIs polyfill in native
    const timer = app.requireModule('timer')
    const timerAPIs = {
      setTimeout: (...args) => {
        const handler = function () {
          args[0](...args.slice(2))
        }
        timer.setTimeout(handler, args[1])
        return app.uid.toString()
      },
      setInterval: (...args) => {
        const handler = function () {
          args[0](...args.slice(2))
        }
        timer.setInterval(handler, args[1])
        return app.uid.toString()
      },
      clearTimeout: (n) => {
        timer.clearTimeout(n)
      },
      clearInterval: (n) => {
        timer.clearInterval(n)
      }
    }

    // Special: if the code is empty that means we only need to prepare an
    // environment. If so we just return a enviorment object.
    if (!code) {
      return {
        define: bundleDefine,
        require: bundleRequire,
        document: bundleDocument,
        bootstrap: bundleBootstrap,
        register: bundleRegister,
        render: bundleRender,
        __weex_define__: bundleDefine,
        __weex_bootstrap__: bundleBootstrap,
        __weex_document__: bundleDocument,
        __weex_require__: bundleRequireModule,
        setTimeout: timerAPIs.setTimeout,
        setInterval: timerAPIs.setInterval,
        clearTimeout: timerAPIs.clearTimeout,
        clearInterval: timerAPIs.clearInterval
      }
    }

    const fn = new Function(
      'define',
      'require',
      'document',
      'bootstrap',
      'register',
      'render',
      '__weex_define__', // alias for define
      '__weex_bootstrap__', // alias for bootstrap
      '__weex_document__', // alias for bootstrap
      '__weex_require__',
      'setTimeout',
      'setInterval',
      'clearTimeout',
      'clearInterval',
      functionBody
    )

    fn(
      bundleDefine,
      bundleRequire,
      bundleDocument,
      bundleBootstrap,
      bundleRegister,
      bundleRender,
      bundleDefine,
      bundleBootstrap,
      bundleDocument,
      bundleRequireModule,
      timerAPIs.setTimeout,
      timerAPIs.setInterval,
      timerAPIs.clearTimeout,
      timerAPIs.clearInterval)
  }
  else {
    const fn = new Function(
      'define',
      'require',
      'document',
      'bootstrap',
      'register',
      'render',
      '__weex_define__', // alias for define
      '__weex_bootstrap__', // alias for bootstrap
      '__weex_document__', // alias for bootstrap
      '__weex_require__',
      functionBody
    )

    fn(
      bundleDefine,
      bundleRequire,
      bundleDocument,
      bundleBootstrap,
      bundleRegister,
      bundleRender,
      bundleDefine,
      bundleBootstrap,
      bundleDocument,
      bundleRequireModule)
  }

  return result
}

/**
 * Refresh an app with data to its root component options.
 * @param  {object} app
 * @param  {any}    data
 */
export function refresh (app, data) {
  console.debug(`[JS Framework] Refresh with`, data,
            `in instance[${app.id}]`)
  const vm = app.vm
  if (vm && data) {
    // app.doc.close()
    if (typeof vm.refreshData === 'function') {
      vm.refreshData(data)
    }
    else {
      extend(vm, data)
    }
    updateActions(app)
    app.doc.listener.refreshFinish()
    // app.doc.open()
    return
  }
  return new Error(`invalid data "${data}"`)
}

/**
 * Destroy an app.
 * @param  {object} app
 */
export function destroy (app) {
  console.debug(`[JS Framework] Destory an instance(${app.id})`)

  app.id = ''
  app.options = null
  app.blocks = null
  app.vm = null
  app.doc = null
  app.customComponentMap = null
  app.callbacks = null
}

/**
 * Get a JSON object to describe the document body.
 * @param  {object} app
 * @return {object}
 */
export function getRootElement (app) {
  const doc = app.doc || {}
  const body = doc.body || {}
  return body.toJSON ? body.toJSON() : {}
}

/**
 * Fire an event from renderer. The event has type, an event object and an
 * element ref. If the event comes with some virtual-DOM changes, it should
 * have one more parameter to describe the changes.
 * @param  {object} app
 * @param  {string} ref
 * @param  {type}   type
 * @param  {object} e
 * @param  {object} domChanges
 */
export function fireEvent (app, ref, type, e, domChanges) {
  console.debug(`[JS Framework] Fire a "${type}" event on an element(${ref}) in instance(${app.id})`)
  if (Array.isArray(ref)) {
    ref.some((ref) => {
      return app.fireEvent(ref, type, e) !== false
    })
    return
  }
  const el = app.doc.getRef(ref)
  if (el) {
    // app.doc.close()
    const result = app.doc.fireEvent(el, type, e, domChanges)
    updateActions(app)
    app.doc.listener.updateFinish()
    // app.doc.open()
    return result
  }
  return new Error(`invalid element reference "${ref}"`)
}

/**
 * Make a callback for a certain app.
 * @param  {object}   app
 * @param  {number}   callbackId
 * @param  {any}      data
 * @param  {boolean}  ifKeepAlive
 */
export function callback (app, callbackId, data, ifKeepAlive) {
  console.debug(`[JS Framework] Invoke a callback(${callbackId}) with`, data,
            `in instance(${app.id})`)
  const callback = app.callbacks[callbackId]
  if (typeof callback === 'function') {
    // app.doc.close()
    callback(data)
    if (typeof ifKeepAlive === 'undefined' || ifKeepAlive === false) {
      app.callbacks[callbackId] = undefined
    }
    updateActions(app)
    app.doc.listener.updateFinish()
    // app.doc.open()
    return
  }
  return new Error(`invalid callback id "${callbackId}"`)
}

/**
 * Collect all virtual-DOM mutations together and send them to renderer.
 * @param  {object} app
 */
export function updateActions (app) {
  app.differ.flush()
  const tasks = []
  if (app.doc && app.doc.listener && app.doc.listener.updates.length) {
    tasks.push(...app.doc.listener.updates)
    app.doc.listener.updates = []
  }
  if (tasks.length) {
    return callTasks(app, tasks)
  }
}

/**
 * Call all tasks from an app to renderer (native).
 * @param  {object} app
 * @param  {array}  tasks
 */
export function callTasks (app, tasks) {
  if (typof(tasks) !== 'array') {
    tasks = [tasks]
  }

  tasks.forEach((task) => {
    task.args = task.args.map(arg => normalize(arg, app))
  })

  return renderer.sendTasks(app.id, tasks, '-1')
}

/**
 * Normalize a value. Specially, if the value is a function, then generate a function id
 * and save it to `app.callbacks`, at last return the function id.
 * @param  {any}        v
 * @param  {object}     app
 * @return {primitive}
 */
function normalize (v, app) {
  const type = typof(v)

  switch (type) {
    case 'undefined':
    case 'null':
      return ''
    case 'regexp':
      return v.toString()
    case 'date':
      return v.toISOString()
    case 'number':
    case 'string':
    case 'boolean':
    case 'array':
    case 'object':
      if (v instanceof renderer.Element) {
        return v.ref
      }
      return v
    case 'function':
      app.callbacks[++app.uid] = v
      return app.uid.toString()
    default:
      return JSON.stringify(v)
  }
}
