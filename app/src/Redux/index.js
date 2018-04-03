import { createStore, applyMiddleware, combineReducers, compose } from 'redux'
import createSocketIoMiddleware from 'redux-socket.io'
import thunk from 'redux-thunk'
import io from 'socket.io-client'
import url from 'url'

// IMPORT REDUCERS
import recipeReducer from './reducers/recipeReducer'

// CREATE SOCKET-IO MIDDLEWARE
const urlObj = url.parse(window.location.href)
let socket = io(`${urlObj.protocol}//${urlObj.host}`);
let socketIoMiddleware = createSocketIoMiddleware(socket, 'server/')

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
  console.log('new client state', store.getState());
})

export default store
