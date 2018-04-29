import { createStore, applyMiddleware, combineReducers, compose } from 'redux'
import createSocketIoMiddleware from 'redux-socket.io'
import thunk from 'redux-thunk'
import io from 'socket.io-client'
import url from 'url'
import axios from 'axios'

// IMPORT REDUCERS
import recipeReducer from './reducers/recipeReducer'

// CREATE SOCKET-IO MIDDLEWARE
const urlObj = url.parse(window.location.href)
const serverPort = process.env.REACT_APP_SERVER_PORT
const qualUrl = `${urlObj.protocol}//${urlObj.hostname}${serverPort ? ':' + serverPort : ''}`
console.log(qualUrl)
let socket = io(qualUrl);
let socketIoMiddleware = createSocketIoMiddleware(socket, 'server/')

// REDUCERS
export const SET_STORE_FROM_SERVER = 'SET_STORE_FROM_SERVER'
const reducers = combineReducers({
  recipe: recipeReducer
})
const rootReducer = (state, action) => {
  if (action.type === SET_STORE_FROM_SERVER) {
    state = action.payload
  }
  return reducers(state, action)
}

// MIDDLEWARE
const enhancers = compose(
  applyMiddleware(socketIoMiddleware, thunk),
  window.devToolsExtension ? window.devToolsExtension() : f => f
)

// CREATE THE STORE
const store = createStore(rootReducer, enhancers)
store.subscribe(()=>{
  // save the store to the database
  axios.post(`${qualUrl}/store`, {
    headers: {
  	  'Access-Control-Allow-Origin': '*',
  	},
    method: 'post',
    data: store.getState()
  }).catch(err => {
    console.log(err)
  })
})

// SOCKET INFO
socket.on('store initial state', (data) => {
  delete data.id
  store.dispatch({
    type: SET_STORE_FROM_SERVER,
    payload: data
  })
})

export default store
