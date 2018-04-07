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

console.log(process.env)

// REDUCERS
const reducers = combineReducers({
  recipe: recipeReducer
})

// MIDDLEWARE
const enhancers = compose(
  applyMiddleware(socketIoMiddleware, thunk),
  window.devToolsExtension ? window.devToolsExtension() : f => f
)

// CREATE THE STORE
const store = createStore(reducers, enhancers)
store.subscribe(()=>{
  // save the store to the database
  console.log(`${qualUrl}/store`)
  axios.post(`${qualUrl}/store`, {
    headers: {
  	  'Access-Control-Allow-Origin': '*',
  	},
    method: 'post',
    data: store.getState()
  }).then(res => {
    console.log(res)
  })
})

export default store
