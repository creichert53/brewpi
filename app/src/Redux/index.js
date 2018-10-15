import { createStore, applyMiddleware, combineReducers, compose } from 'redux'
import createSocketIoMiddleware from 'redux-socket.io'
import thunk from 'redux-thunk'
import _ from 'lodash'
import io from 'socket.io-client'
import url from 'url'
import axios from 'axios'
import numeral from 'numeral'

// IMPORT REDUCERS
import types from './types'
import recipeReducer from './reducers/recipeReducer'
import settingsReducer from './reducers/settingsReducer'
import temperatureReducer from './reducers/temperatureReducer'
import temperatureArrayReducer from './reducers/temperatureArrayReducer'
import timeReducer from './reducers/timeReducer'

// CREATE SOCKET-IO MIDDLEWARE
const urlObj = url.parse(window.location.href)
const serverPort = process.env.REACT_APP_SERVER_PORT
const qualUrl = `${urlObj.protocol}//${urlObj.hostname}${serverPort ? ':' + serverPort : ''}`
let socket = io(qualUrl);
let socketIoMiddleware = createSocketIoMiddleware(socket, 'server/')

// REDUCERS
export const SET_STORE_FROM_SERVER = 'SET_STORE_FROM_SERVER'
const reducers = combineReducers({
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
    store: { ...store.getState() }
  })
}

// MIDDLEWARE
const enhancers = compose(
  applyMiddleware(thunk, appendStoreToAction, socketIoMiddleware),
  window.devToolsExtension ? window.devToolsExtension() : f => f
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

export default store
