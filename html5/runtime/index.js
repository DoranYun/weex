/**
 * @fileOverview
 * Register framework(s) in JS runtime. Weex supply two layers for 3rd-party
 * framework(s): one is the instance management layer, another is the
 * virtual-DOM layer.
 */

// This config is generated by `npm run build:config`.
// It will collect all `runtime/framework-*.js` files and import each of them.
// The filename is also the framework name.
import frameworks from './config'

import { Document, Element, Comment } from '../vdom'

const config = {
  Document, Element, Comment,
  sendTasks (...args) {
    return global.callNative(...args)
  }
}

// Init each framework by `init` method and `config` which contains three
// virtual-DOM Class: `Document`, `Element` & `Comment`, and a JS bridge method:
// `sendTasks(...args)`.
for (const name in frameworks) {
  const framework = frameworks[name]
  framework.init(config)
}

const versionRegExp = /^\/\/ *(\{[^\}]*\}) *\r?\n/

/**
 * Detect a JS Bundle code and make sure which framework it's based to. Each JS
 * Bundle should make sure that it starts with a line of JSON comment and is
 * more that one line.
 * @param  {string} code
 * @return {object}
 */
function checkVersion (code) {
  let info
  const result = versionRegExp.exec(code)
  if (result) {
    try {
      info = JSON.parse(result[1])
    }
    catch (e) {}
  }
  return info
}

const instanceMap = {}

global.WXInstanceMap = instanceMap

/**
 * Prepare env for an new instance instead create it directly. This mode could
 * avoid running `new Function` during create an instance.
 * @param  {string} id
 * @param  {string} type
 * @param  {object} config
 * @param  {object} data
 */
export function prepareInstance (id, type, config, data) {
  type = type || 'Weex'
  const framework = frameworks[type]
  if (framework && framework.prepareInstance) {
    instanceMap[id] = framework.prepareInstance(id, config, data)
    instanceMap[id].framework = type
  }
  else {
    instanceMap[id] = {}
  }
}

/**
 * Check which framework a certain JS Bundle code based to. And create instance
 * by this framework.
 * @param {string} id
 * @param {string} code
 * @param {object} config
 * @param {object} data
 */
function createInstance (id, code, config, data) {
  let info = instanceMap[id]
  if (!info) {
    info = checkVersion(code) || {}
    if (!frameworks[info.framework]) {
      info.framework = 'Weex'
    }
    instanceMap[id] = info
    config = config || {}
    config.bundleVersion = info.version
    console.debug(`[JS Framework] create an ${info.framework}@${config.bundleVersion} instance from ${config.bundleVersion}`)
    return frameworks[info.framework].createInstance(id, code, config, data)
  }
  return new Error(`invalid instance id "${id}"`)
}

const methods = {
  prepareInstance,
  createInstance
}

/**
 * Register methods which init each frameworks.
 * @param {string} methodName
 */
function genInit (methodName) {
  methods[methodName] = function (...args) {
    for (const name in frameworks) {
      const framework = frameworks[name]
      if (framework && framework[methodName]) {
        framework[methodName](...args)
      }
    }
  }
}

// @todo: The method `registerMethods` will be re-designed or removed later.
['registerComponents', 'registerModules', 'registerMethods'].forEach(genInit)

/**
 * Register methods which will be called for each instance.
 * @param {string} methodName
 */
function genInstance (methodName) {
  methods[methodName] = function (...args) {
    const id = args[0]
    const info = instanceMap[id]
    if (methodName === 'destroyInstance') {
      delete instanceMap[id]
    }
    if (info && frameworks[info.framework]) {
      return frameworks[info.framework][methodName](...args)
    }
    return new Error(`invalid instance id "${id}"`)
  }
}

['destroyInstance', 'refreshInstance', 'receiveTasks', 'getRoot'].forEach(genInstance)

/**
 * Adapt some legacy method(s) which will be called for each instance. These
 * methods should be deprecated and removed later.
 * @param {string} methodName
 * @param {string} nativeMethodName
 */
function adaptInstance (methodName, nativeMethodName) {
  methods[nativeMethodName] = function (...args) {
    const id = args[0]
    const info = instanceMap[id]
    if (info && frameworks[info.framework]) {
      return frameworks[info.framework][methodName](...args)
    }
    return new Error(`invalid instance id "${id}"`)
  }
}

adaptInstance('receiveTasks', 'callJS')

export default methods
