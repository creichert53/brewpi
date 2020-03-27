import { createStore, applyMiddleware, combineReducers, compose } from 'redux'
import createSocketIoMiddleware from 'redux-socket.io'
import thunk from 'redux-thunk'
import io from 'socket.io-client'
import url from 'url'

// IMPORT REDUCERS
import types from './types'
import controlReducer from './reducers/controlReducer'
import elementReducer from './reducers/elementReducer'
import recipeReducer from './reducers/recipeReducer'
import settingsReducer from './reducers/settingsReducer'
import temperatureReducer from './reducers/temperatureReducer'
import temperatureArrayReducer from './reducers/temperatureArrayReducer'
import timeReducer from './reducers/timeReducer'

// CREATE SOCKET-IO MIDDLEWARE
const urlObj = url.parse(window.location.href)
const serverPort = process.env.REACT_APP_SERVER_PORT
const qualUrl = `${urlObj.protocol}//${urlObj.hostname}${serverPort ? ':' + serverPort : ''}`
let socket = io(qualUrl)
let socketIoMiddleware = createSocketIoMiddleware(socket, 'server/')

// REDUCERS
export const SET_STORE_FROM_SERVER = 'SET_STORE_FROM_SERVER'
const reducers = combineReducers({
  elements: elementReducer,
  io: controlReducer,
  recipe: recipeReducer,
  settings: settingsReducer,
  temperatures: temperatureReducer,
  temperatureArray: temperatureArrayReducer,
  time: timeReducer
})
const rootReducer = (state, action) => {
  if (action.type === SET_STORE_FROM_SERVER) {
    state = action.payload
  }
  return reducers(state, action)
}
const appendStoreToAction = store => next => action => {
  return next({
    ...action,
    store: { ...store.getState() },
    types
  })
}

// MIDDLEWARE
const composeEnhancers =
  typeof window === 'object' &&
  window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ ?
    window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({
      // Specify extension’s options like name, actionsBlacklist, actionsCreators, serialize...
    }) : compose
const enhancers = composeEnhancers(
  applyMiddleware(thunk, appendStoreToAction, socketIoMiddleware)
)

// CREATE THE STORE
const store = createStore(rootReducer, enhancers)

// SOCKET INFO
socket.on('store initial state', data => {
  delete data.id
  store.dispatch({
    type: SET_STORE_FROM_SERVER,
    payload: data
  })
})
socket.on('new temperature', temps => {
  store.dispatch({
    type: types.UPDATE_TEMPERATURE,
    payload: temps
  })
})
socket.on('clear temp array', () => {
  store.dispatch({
    type: types.CLEAR_TEMPERATURE_ARRAY
  })
})
socket.on('temp array', temps => {
  store.dispatch({
    type: types.UPDATE_TEMPERATURE_ARRAY,
    payload: temps
  })
})
socket.on('time', time => {
  store.dispatch({
    type: types.UPDATE_TIME,
    payload: time
  })
})
socket.on('elements', value => {
  store.dispatch({
    type: types.UPDATE_ELEMENTS,
    payload: value
  })
})
socket.on('output update', value => {
  store.dispatch({
    type: types.UPDATE_LIVE_OUTPUT,
    payload: value
  })
})

export default store
